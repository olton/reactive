import LoopManager from './loop-manager.js';
import ConditionalManager from './conditional-manager.js';
import AttributeManager from './attribute-manager.js';
import EventManager from './event-manager.js';
import Logger from '../logger/logger.js';

/**
 * The DOMManager class handles interactions with the DOM, including the registration of DOM dependencies,
 * processing of template nodes, input binding for two-way data binding, and updates to the DOM elements
 * based on the reactive store's data.
 */
export default class DOMManager {
  /**
   * Creates an instance of the DOMManager class, initializing necessary properties and dependencies
   * for managing the DOM in relation to the reactive store. Sets up managers for loops, conditionals, and attributes,
   * and prepares structures for DOM dependencies and virtual DOM.
   *
   * @param {Object} reactive - The reactive store that serves as the data source for the DOMManager.
   *                            It is used for data binding and template rendering in the DOM.
   */
  constructor(reactive) {
    Logger.DEBUG_LEVEL = reactive.options.debug ? 4 : 0;
    Logger.debug('DOMManager: Init DOMManager');

    this.reactive = reactive;
    this.elements = [];
    this.inputs = [];
    this.domDependencies = new Map();
    this.virtualDom = new Map();
    this.runtimeComponents = new Set();
    this.runtimeTemplateCache = new Map();
    this.aliasExpressionCache = new Map();
    this.diagnostics = [];

    this.loopManager = new LoopManager(this, reactive);
    this.conditionalManager = new ConditionalManager(this, reactive);
    this.attributeManager = new AttributeManager(this, reactive);
    this.eventManager = new EventManager(this, reactive);

    Logger.debug('DOMManager: DOMManager initialized');
  }

  /**
   * Stores a runtime diagnostic message.
   *
   * @param {'warn'|'error'|'info'} level - Diagnostic level.
   * @param {string} message - Diagnostic message.
   */
  addDiagnostic(level, message) {
    if (!this.reactive.options.devDiagnostics) {
      return;
    }

    this.diagnostics.push({
      level,
      message,
      timestamp: Date.now(),
    });
  }

  /**
   * Returns collected runtime diagnostics.
   * @returns {Array<{level: string, message: string, timestamp: number}>}
   */
  getDiagnostics() {
    return [...this.diagnostics];
  }

  /**
   * Clears runtime diagnostics.
   */
  clearDiagnostics() {
    this.diagnostics = [];
  }

  /**
   * Registers a dependency between a reactive property path and a DOM element.
   * - Creates a new Set for the property path if it doesn't exist
   * - Adds element and additional info to the dependency set
   * - Supports multiple elements depending on the same property
   *
   * @param {string} propertyPath - Reactive property path to watch
   * @param {HTMLElement} domElement - DOM element to update
   * @param {Object} info - Additional dependency metadata
   */
  registerDomDependency(propertyPath, domElement, info) {
    if (!this.domDependencies.has(propertyPath)) {
      this.domDependencies.set(propertyPath, new Set());
    }
    this.domDependencies.get(propertyPath).add({
      element: domElement,
      ...info,
    });
  }

  /**
   * Recursively processes template nodes and replaces placeholders with values.
   * - Handles text nodes: replaces {{expression}} with actual values
   * - For text nodes: compares original and new content to avoid unnecessary updates
   * - For element nodes: recursively processes all child nodes
   * - Supports both context values and reactive store values
   *
   * @param {Node} node - DOM node to process
   * @param {Object} context - Optional context data for placeholder replacement
   */
  processTemplateNode(node, context) {
    Logger.debug('DOMManager: processTemplateNode', { node, context });

    if (node.nodeType === Node.TEXT_NODE) {
      const originalText = node.textContent;
      const newText = node.textContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
        path = path.trim();

        // Function to get value by path
        const getValueByPath = (obj, path) => {
          return path.split('.').reduce((value, key) => {
            return value ? value[key] : undefined;
          }, obj);
        };

        // First, look in the local context
        let value = context ? getValueByPath(context, path) : undefined;

        // If not found in context, look in the reactive store
        if (value === undefined) {
          value = this.reactive.store.get(path);
        }

        return value !== undefined ? value : '';
      });
      if (originalText !== newText) {
        Logger.debug(`DOMManager: updated node text from ${originalText} to ${newText}`);
        node.textContent = newText;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      Array.from(node.childNodes).forEach((child) => {
        this.processTemplateNode(child, context);
      });
    }
  }

  /**
   * Parses DOM tree for template placeholders and sets up reactive bindings.
   * - Uses TreeWalker to efficiently traverse text nodes
   * - Detects template expressions using regex pattern
   * - Registers dependencies for each found template expression
   * - Preserves original template text for future updates
   * - Handles regex state reset between matches
   *
   * @param {HTMLElement} root - Starting point for DOM traversal
   */
  parse(root) {
    Logger.debug('DOMManager: parse from', root);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);

    let node;
    const regex = /\{\{\s*([^}]+)\s*\}\}/g;

    while ((node = walker.nextNode())) {
      let match;
      const text = node.textContent;
      const originalText = text;

      regex.lastIndex = 0;

      while ((match = regex.exec(text)) !== null) {
        Logger.debug(`DOMManager: parse match found for ${text}`, match);

        const propPath = match[1].trim();

        this.registerDomDependency(propPath, node, {
          type: 'template',
          template: originalText,
        });

        this.elements.push({
          node,
          propName: propPath,
          template: originalText,
        });
      }

      Logger.debug(`DOMManager: update virtual DOM set`, { node, text: node.textContent });
      this.virtualDom.set(node, node.textContent);
    }

    Logger.debug('DOMManager: Find inputs with data-model directive...');
    const inputs = root.querySelectorAll('[data-model]');
    Logger.debug('DOMManager: Found inputs with data-model:', inputs.length);
    inputs.forEach((input) => {
      const property = input.getAttribute('data-model');

      Logger.debug('DOMManager: Register handler for:', { input, property });

      const handler = (e) => {
        const value = input.type === 'checkbox' || input.type === 'radio' ? e.target.checked : e.target.value;

        this.reactive.store.set(property, value);
      };

      input.__reactiveInputHandler = handler;

      input.addEventListener('input', handler);

      this.inputs.push({
        element: input,
        property: property,
      });
    });
  }

  /**
   * Sets the value of the input element based on the provided value.
   * For checkboxes and radio buttons, it sets the `checked` property.
   * For other input types, it sets the `value` property.
   *
   * @param {HTMLInputElement} input - The input element to update.
   * @param {*} value - The value to set for the input. For checkboxes and radio buttons, it should be a boolean.
   */
  setInputValue(input, value) {
    if (input.type === 'checkbox' || input.type === 'radio') {
      input.checked = Boolean(value);
    } else {
      input.value = value;
    }
  }

  /**
   * Updates all input elements associated with the specified reactive property with the provided value.
   * It ensures that the value in the DOM accurately reflects the value in the reactive store.
   *
   * @param {string} propName - The name of the reactive property whose value should be updated in the inputs.
   * @param {*} value - The value to set for the associated inputs.
   */
  updateInputs(propName, value) {
    Logger.debug('DOMManager: updateInputs', { propName, value });
    this.inputs.forEach((item) => {
      if (item.property === propName) {
        Logger.debug('DOMManager: update input', { item, value });
        this.setInputValue(item.element, value);
      }
    });
  }

  /**
   * Updates all DOM elements based on the current state of the reactive store.
   * This includes:
   * - Text nodes containing template placeholders.
   * - Input elements bound using `data-model` attributes.
   *
   * Iterates through registered nodes and inputs, updating their content
   * or values to reflect the latest reactive store state.
   *
   * Ensures that the UI remains synchronized with the underlying reactive store.
   */
  updateAllDOM() {
    Logger.debug('DOMManager: updateAllDOM');

    this.elements.forEach((element) => {
      let newContent = element.template;
      newContent = newContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
        path = path.trim();
        return this.reactive.store.get(path);
      });
      element.node.textContent = newContent;
      Logger.debug(`DOMManager: updated node`, { element, newContent });
    });

    Logger.debug('DOMManager: update inputs');
    this.inputs.forEach((item) => {
      Logger.debug('DOMManager: update input', { item });
      const value = this.reactive.store.get(item.property);
      this.setInputValue(item.element, value);
      Logger.debug('DOMManager: updated input', { item, value });
    });
  }

  /**
   * Updates the DOM elements or attributes whenever a property in the reactive store changes.
   * It resolves what elements depending on the property should be updated,
   * including templates, conditionals, loops, and attributes.
   *
   * @param {string} propertyPath - Path of the property in the reactive store that triggered the change.
   * @param {*} value - New value of the property (could be a primitive, object, or array).
   */
  updateDOM(propertyPath, value) {
    Logger.debug(`DOMManager: update DOM for ${propertyPath} with ${value}`);

    if (!propertyPath) {
      console.warn('Path is undefined in updateDOM');
      return;
    }

    const isArrayMethodChange = value && typeof value === 'object' && 'method' in value;

    if (isArrayMethodChange) {
      propertyPath = value.path || propertyPath;
    }

    const elementsToUpdate = new Set();

    if (this.domDependencies.has(propertyPath)) {
      this.domDependencies.get(propertyPath).forEach((dep) => elementsToUpdate.add(dep));
      // const deps = this.domDependencies.get(propertyPath);
      // for (const { element, meta } of deps) {
      //     console.log(element, meta);
      //     // Обрабатываем разные типы зависимостей
      //     if (meta && meta.type) {
      //         switch (meta.type) {
      //             case 'attribute':
      //                 // Обработка атрибутов
      //                 // this.updateElementAttribute(element, meta.attribute, meta.expression);
      //                 break;
      //         }
      //     }
      // }
    }

    const pathParts = propertyPath.split('.');
    let currentPath = '';
    for (let i = 0; i < pathParts.length; i++) {
      currentPath = currentPath ? `${currentPath}.${pathParts[i]}` : pathParts[i];
      if (this.domDependencies.has(currentPath)) {
        this.domDependencies.get(currentPath).forEach((dep) => elementsToUpdate.add(dep));
      }
    }

    const conditionalElements = this.conditionalManager.getDependenciesByPath(propertyPath);
    conditionalElements.forEach((dep) => {
      if (dep.type === 'if') {
        this.conditionalManager.updateConditional(dep.element, dep.expression);
      }
    });

    this.domDependencies.forEach((deps, path) => {
      if (path.startsWith(`${propertyPath}.`) || path.startsWith(`${propertyPath}[`)) {
        deps.forEach((dep) => elementsToUpdate.add(dep));
      }
    });

    if (Array.isArray(value) || isArrayMethodChange || typeof value === 'object') {
      this.loopManager.updateLoops(propertyPath, value);
    }

    if (elementsToUpdate.size === 0) return;

    const updates = {
      template: [],
      conditional: [],
      loop: [],
      attribute: [],
    };

    elementsToUpdate.forEach((dep) => {
      if (dep && dep.type) {
        updates[dep.type].push(dep);
      }
    });

    updates.template.forEach((dep) => this.updateTemplateNode(dep.element, dep.template));
    updates.conditional.forEach((dep) => this.conditionalManager.updateConditional(dep.element, dep.expression));
    updates.attribute.forEach((dep) => this.attributeManager.update(dep.element, dep.attribute, dep.expression));
    updates.loop.forEach((dep) => this.loopManager.updateLoopPart(dep.element, dep.arrayPath, value, dep.index));

    this.runtimeComponents.forEach((component) => {
      const hasDependency = Array.from(component.propsSources).some((path) => this.isPathDependency(path, propertyPath));
      if (!hasDependency) {
        return;
      }

      this.invokeLifecycleHook(component.lifecycle.updated, component.host, {
        phase: 'updated',
        propertyPath,
        value,
      });
    });
  }

  /**
   * Updates a template-based DOM node's content with the latest values
   * from the reactive store.
   *
   * This method uses a Mustache-like syntax (for example, `{{propertyName}}`)
   * to replace placeholders in the template with actual values retrieved
   * from the reactive store. If the content changes compared to the virtual DOM,
   * the DOM node is updated, and the new content is recorded in the virtual DOM.
   *
   * @param {HTMLElement} node - The DOM node to update.
   * @param {string} template - The template string containing placeholders
   *                            for dynamic values.
   */
  updateTemplateNode(node, template) {
    const newContent = template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, path) => {
      path = path.trim();
      return this.reactive.store.get(path);
    });

    if (this.virtualDom.get(node) !== newContent) {
      node.textContent = newContent;
      this.virtualDom.set(node, newContent);
    }
  }

  /**
   * Mounts runtime components declared with `data-template`.
   * Component template is resolved from `<template id="...">` and projected with light DOM content.
   *
   * @param {HTMLElement} rootElement - Root element to process.
   */
  processRuntimeComponents(rootElement) {
    const componentHosts = rootElement.querySelectorAll('[data-template]');

    componentHosts.forEach((host) => {
      const reference = (host.getAttribute('data-template') || '').trim();
      if (!reference) {
        return;
      }

      const selector = reference.startsWith('#') ? reference : `#${reference}`;
      const template = this.resolveRuntimeTemplate(selector, rootElement);

      if (!(template instanceof HTMLTemplateElement)) {
        Logger.warn(`DOMManager: template ${selector} not found for component host`, host);
        this.addDiagnostic('warn', `Template '${selector}' not found for data-template`);
        return;
      }

      const mountRoot = document.createElement('div');
      mountRoot.appendChild(template.content.cloneNode(true));

      const propsAliases = this.parseComponentProps(host.getAttribute('data-props'), host);
      if (propsAliases.size) {
        this.applyComponentPropsAliases(mountRoot, propsAliases);
      }

      const lifecycle = this.parseLifecycleHooks(host);

      const lightDomNodes = Array.from(host.childNodes);
      lightDomNodes.forEach((node) => mountRoot.appendChild(node));

      this.resolveSlotsForHost(mountRoot);

      host.innerHTML = '';
      while (mountRoot.firstChild) {
        host.appendChild(mountRoot.firstChild);
      }

      host.removeAttribute('data-template');
      host.removeAttribute('data-props');

      const propsSources = new Set();
      propsAliases.forEach((meta) => propsSources.add(meta.sourcePath));

      this.runtimeComponents.add({
        host,
        propsSources,
        lifecycle,
      });

      this.invokeLifecycleHook(lifecycle.mounted, host, {
        phase: 'mounted',
      });
    });
  }

  /**
   * Resolves template element for runtime component and applies optional cache.
   *
   * @param {string} selector - Template selector.
   * @param {HTMLElement} rootElement - Current bind root.
   * @returns {HTMLTemplateElement | null}
   */
  resolveRuntimeTemplate(selector, rootElement) {
    if (this.reactive.options.runtimeTemplateCache && this.runtimeTemplateCache.has(selector)) {
      return this.runtimeTemplateCache.get(selector);
    }

    const template = rootElement.querySelector(selector) || document.querySelector(selector);
    const resolved = template instanceof HTMLTemplateElement ? template : null;

    if (this.reactive.options.runtimeTemplateCache && resolved) {
      this.runtimeTemplateCache.set(selector, resolved);
    }

    return resolved;
  }

  /**
   * Parses lifecycle hooks from component host attributes.
   *
   * @param {HTMLElement} host - Component host.
   * @returns {{mounted: string|null, updated: string|null, beforeUnmount: string|null}}
   */
  parseLifecycleHooks(host) {
    return {
      mounted: host.getAttribute('data-on-mounted'),
      updated: host.getAttribute('data-on-updated'),
      beforeUnmount: host.getAttribute('data-on-before-unmount'),
    };
  }

  /**
   * Invokes lifecycle method if available on reactive data or global scope.
   *
   * @param {string|null} hookName - Method name.
   * @param {HTMLElement} host - Component host.
   * @param {Object} payload - Lifecycle payload.
   */
  invokeLifecycleHook(hookName, host, payload) {
    if (!hookName) {
      return;
    }

    const method = this.reactive.data?.[hookName] || globalThis?.[hookName];
    if (typeof method === 'function') {
      method.call(this.reactive.data, {
        host,
        ...payload,
      });
      return;
    }

    this.addDiagnostic('warn', `Lifecycle hook '${hookName}' not found`);
  }

  /**
   * Parses data-props aliases for runtime components.
   * Format: { localName: source.path, local2: "another.path" }
   *
   * @param {string|null} rawProps - Raw data-props attribute value.
   * @returns {Map<string, string>}
   */
  parseComponentProps(rawProps, host) {
    const aliases = new Map();
    const value = String(rawProps || '').trim();

    if (!value) {
      return aliases;
    }

    const body = value.startsWith('{') && value.endsWith('}') ? value.slice(1, -1) : value;

    const entries = [];
    let current = '';
    let quote = null;
    let depth = 0;

    for (let i = 0; i < body.length; i++) {
      const ch = body[i];

      if ((ch === '"' || ch === "'") && body[i - 1] !== '\\') {
        quote = quote === ch ? null : quote || ch;
      }

      if (!quote) {
        if (ch === '{' || ch === '[' || ch === '(') depth += 1;
        if (ch === '}' || ch === ']' || ch === ')') depth -= 1;

        if (ch === ',' && depth === 0) {
          if (current.trim()) {
            entries.push(current.trim());
          }
          current = '';
          continue;
        }
      }

      current += ch;
    }

    if (current.trim()) {
      entries.push(current.trim());
    }

    entries.forEach((entry) => {
      const delimiter = entry.indexOf(':');
      if (delimiter === -1) {
        return;
      }

      const key = entry
        .slice(0, delimiter)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      const source = entry
        .slice(delimiter + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');

      if (!key || !source) {
        return;
      }

      const twoWay = source.startsWith('sync:');
      const sourcePath = twoWay ? source.replace(/^sync:\s*/, '').trim() : source;

      if (!sourcePath) {
        this.addDiagnostic('warn', `Invalid data-props source for alias '${key}'`);
        return;
      }

      aliases.set(key, {
        sourcePath,
        mode: twoWay ? 'two-way' : 'one-way',
      });
    });

    if (!aliases.size && value) {
      this.addDiagnostic('warn', `Unable to parse data-props on component host ${host?.tagName || ''}`);
    }

    return aliases;
  }

  /**
   * Applies data-props aliases to text templates and directive expressions.
   *
   * @param {HTMLElement} rootElement - Component mount root.
   * @param {Map<string, string>} aliases - Local-to-store path map.
   */
  applyComponentPropsAliases(rootElement, aliases) {
    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, null);
    let textNode;

    while ((textNode = walker.nextNode())) {
      if (!textNode.textContent || !textNode.textContent.includes('{{')) {
        continue;
      }

      textNode.textContent = this.replaceAliasesInTemplateText(textNode.textContent, aliases);
    }

    const allElements = rootElement.querySelectorAll('*');
    allElements.forEach((element) => {
      Array.from(element.attributes).forEach((attribute) => {
        const dynamicAttribute =
          attribute.name.startsWith(':') ||
          attribute.name.startsWith('@') ||
          attribute.name === 'data-if' ||
          attribute.name === 'data-else-if' ||
          attribute.name === 'data-for' ||
          attribute.name === 'data-in' ||
          attribute.name === 'data-model' ||
          attribute.name === 'data-bind';

        if (!dynamicAttribute) {
          return;
        }

        if (attribute.name === 'data-model') {
          const modelPath = String(attribute.value || '').trim();
          const aliasMeta = aliases.get(modelPath);

          if (aliasMeta) {
            if (aliasMeta.mode === 'two-way') {
              element.setAttribute(attribute.name, aliasMeta.sourcePath);
            } else {
              this.addDiagnostic('warn', `One-way prop '${modelPath}' cannot be used with data-model`);
            }
            return;
          }
        }

        element.setAttribute(attribute.name, this.replaceAliasesInExpression(attribute.value, aliases));
      });
    });
  }

  /**
   * Replaces aliases in an expression with store source paths.
   *
   * @param {string} expression - Source expression.
   * @param {Map<string, {sourcePath: string, mode: string} | string>} aliases - Alias map.
   * @returns {string}
   */
  replaceAliasesInExpression(expression, aliases) {
    let updated = String(expression || '');
    const cacheKey = `${Array.from(aliases.entries())
      .map(([alias, meta]) => `${alias}:${this.resolveAliasSourcePath(meta)}`)
      .join('|')}::${updated}`;

    if (this.aliasExpressionCache.has(cacheKey)) {
      return this.aliasExpressionCache.get(cacheKey);
    }

    aliases.forEach((meta, alias) => {
      const sourcePath = this.resolveAliasSourcePath(meta);
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedAlias}(?=\\b|\\.)`, 'g');
      updated = updated.replace(regex, sourcePath);
    });

    this.aliasExpressionCache.set(cacheKey, updated);

    return updated;
  }

  /**
   * Replaces aliases in all template placeholders within text.
   *
   * @param {string} text - Template text.
   * @param {Map<string, {sourcePath: string, mode: string} | string>} aliases - Alias map.
   * @returns {string}
   */
  replaceAliasesInTemplateText(text, aliases) {
    return String(text || '').replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expr) => {
      const replaced = this.replaceAliasesInExpression(expr.trim(), aliases);
      return `{{${replaced}}}`;
    });
  }

  /**
   * Resolves the source path from alias metadata.
   *
   * @param {{sourcePath: string, mode: string} | string} meta - Alias metadata.
   * @returns {string}
   */
  resolveAliasSourcePath(meta) {
    return typeof meta === 'string' ? meta : meta.sourcePath;
  }

  /**
   * Extracts scoped slot aliases from slot attributes.
   * Supports `:alias="path"` and optional `data-slot-props="{ alias: path }"`.
   *
   * @param {HTMLSlotElement} slotElement - Slot element.
   * @returns {Map<string, {sourcePath: string, mode: string}>}
   */
  parseScopedSlotAliases(slotElement) {
    const aliases = new Map();

    Array.from(slotElement.attributes).forEach((attribute) => {
      if (!attribute.name.startsWith(':')) {
        return;
      }

      const aliasName = attribute.name.slice(1).trim();
      const sourcePath = String(attribute.value || '').trim();

      if (!aliasName || !sourcePath) {
        return;
      }

      aliases.set(aliasName, {
        sourcePath,
        mode: 'one-way',
      });
    });

    const objectAliases = this.parseComponentProps(slotElement.getAttribute('data-slot-props'));
    objectAliases.forEach((meta, alias) => {
      aliases.set(alias, {
        sourcePath: meta.sourcePath,
        mode: 'one-way',
      });
    });

    return aliases;
  }

  /**
   * Applies scoped slot aliases to a slotted node tree.
   *
   * @param {Node} node - Slotted node.
   * @param {Map<string, {sourcePath: string, mode: string}>} aliases - Scoped aliases.
   */
  applyScopedSlotAliases(node, aliases) {
    if (!aliases.size) {
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = this.replaceAliasesInTemplateText(node.textContent, aliases);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const root = node;

    Array.from(root.attributes || []).forEach((attribute) => {
      const dynamicAttribute =
        attribute.name.startsWith(':') ||
        attribute.name.startsWith('@') ||
        attribute.name === 'data-if' ||
        attribute.name === 'data-else-if' ||
        attribute.name === 'data-for' ||
        attribute.name === 'data-in' ||
        attribute.name === 'data-model' ||
        attribute.name === 'data-bind';

      if (!dynamicAttribute) {
        return;
      }

      root.setAttribute(attribute.name, this.replaceAliasesInExpression(attribute.value, aliases));
    });

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let textNode;

    while ((textNode = walker.nextNode())) {
      if (!textNode.textContent || !textNode.textContent.includes('{{')) {
        continue;
      }

      textNode.textContent = this.replaceAliasesInTemplateText(textNode.textContent, aliases);
    }

    const allElements = root.querySelectorAll('*');
    allElements.forEach((element) => {
      Array.from(element.attributes).forEach((attribute) => {
        const dynamicAttribute =
          attribute.name.startsWith(':') ||
          attribute.name.startsWith('@') ||
          attribute.name === 'data-if' ||
          attribute.name === 'data-else-if' ||
          attribute.name === 'data-for' ||
          attribute.name === 'data-in' ||
          attribute.name === 'data-model' ||
          attribute.name === 'data-bind';

        if (!dynamicAttribute) {
          return;
        }

        element.setAttribute(attribute.name, this.replaceAliasesInExpression(attribute.value, aliases));
      });
    });
  }

  /**
   * Projects light DOM children into <slot> placeholders in a Vue-like way.
   * Supports named slots via `slot` attribute, default slot, and fallback content.
   *
   * @param {HTMLElement} rootElement - Root element to process.
   */
  processSlots(rootElement) {
    const elements = [rootElement, ...rootElement.querySelectorAll('*')];
    const hosts = elements.filter((element) => this.isSlotHost(element));

    // Resolve outer hosts first so they can project content into nested slot outlets.
    hosts.sort((a, b) => this.getElementDepth(a) - this.getElementDepth(b));

    hosts.forEach((host) => this.resolveSlotsForHost(host));
  }

  /**
   * Determines whether an element should be treated as a slot host.
   *
   * @param {Element} element - Candidate element.
   * @returns {boolean}
   */
  isSlotHost(element) {
    if (element.nodeType !== Node.ELEMENT_NODE || !element.querySelector('slot')) {
      return false;
    }

    const hasDirectSlot = Array.from(element.children).some((child) => child.tagName === 'SLOT');
    if (hasDirectSlot) {
      return true;
    }

    const hasSlottableDirectChild = Array.from(element.childNodes).some((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent.trim().length > 0;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }

      if (node.hasAttribute('slot')) {
        return true;
      }

      return !node.querySelector('slot');
    });

    return hasSlottableDirectChild;
  }

  /**
   * Calculates element depth in the DOM tree.
   *
   * @param {Element} element - Target element.
   * @returns {number}
   */
  getElementDepth(element) {
    let depth = 0;
    let current = element;

    while (current && current.parentElement) {
      depth += 1;
      current = current.parentElement;
    }

    return depth;
  }

  /**
   * Resolves all direct slot children for a single host element.
   *
   * @param {Element} host - Slot host element.
   */
  resolveSlotsForHost(host) {
    const directSlots = Array.from(host.querySelectorAll('slot'));

    if (!directSlots.length) {
      return;
    }

    const lightDomNodes = Array.from(host.childNodes).filter((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SLOT') {
        return false;
      }

      // Elements that contain slot outlets are considered template wrappers, not slottable content.
      if (node.nodeType === Node.ELEMENT_NODE && node.querySelector('slot') && !node.hasAttribute('slot')) {
        return false;
      }

      return true;
    });
    const assigned = new Set();

    directSlots.forEach((slotElement) => {
      const slotName = slotElement.getAttribute('name');
      const scopedAliases = this.parseScopedSlotAliases(slotElement);

      const matchedNodes = lightDomNodes.filter((node) => {
        if (assigned.has(node)) {
          return false;
        }

        if (slotName) {
          return node.nodeType === Node.ELEMENT_NODE && node.getAttribute('slot') === slotName;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent.trim().length > 0;
        }

        return node.nodeType === Node.ELEMENT_NODE && !node.hasAttribute('slot');
      });

      if (matchedNodes.length) {
        matchedNodes.forEach((node) => {
          assigned.add(node);

          this.applyScopedSlotAliases(node, scopedAliases);

          if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('slot')) {
            node.removeAttribute('slot');
          }

          slotElement.parentNode.insertBefore(node, slotElement);
        });
      } else {
        while (slotElement.firstChild) {
          slotElement.parentNode.insertBefore(slotElement.firstChild, slotElement);
        }
      }

      slotElement.remove();
    });
  }

  /**
   * Checks whether the given pathA is a dependency of pathB.
   *
   * A path is considered a dependency if:
   * - It is identical to the other path.
   * - It is a hierarchical descendent of the other path (for example, pathB starts with pathA).
   * - It is an array element of the other path (for example, pathB starts with pathA followed by an array index).
   *
   * @param {string} pathA - The base path to check against.
   * @param {string} pathB - The path to verify as a dependency.
   * @returns {boolean} - Returns `true` if pathB is a dependency of pathA, otherwise `false`.
   */
  isPathDependency(pathA, pathB) {
    return pathB === pathA || pathB.startsWith(`${pathA}.`) || pathB.startsWith(`${pathA}[`);
  }

  /**
   * Retrieves all paths from the DOM dependency tracker that are
   * dependent on the given path. A path is considered dependent if:
   * - It is hierarchically related (for example, a path starts with the given path).
   * - It matches exactly with the given path.
   *
   * This method collects and returns all such dependent paths.
   *
   * @param {string} path - The path for which to find dependent paths.
   * @returns {string[]} - An array of dependent paths.
   */
  getDependentPaths(path) {
    const dependentPaths = [];
    this.domDependencies.forEach((_, depPath) => {
      if (this.isPathDependency(path, depPath)) {
        dependentPaths.push(depPath);
      }
    });
    return dependentPaths;
  }

  /**
   * Binds and processes the DOM for data binding, conditional rendering,
   * loops, and attribute updates. This method integrates the different
   * managers and processes involved in setting up the live DOM bindings.
   *
   * Steps performed:
   * 1. Parses loops within the DOM using the loop manager.
   * 2. Parses conditional elements using the conditional manager.
   * 3. Parses standard attributes using the attribute manager.
   * 4. Processes custom attribute bindings (colon-prefixed attributes).
   * 5. Parses any additional elements or bindings.
   * 6. Updates the DOM to reflect the current state of the reactive store.
   *
   * @param {HTMLElement} rootElement - The root element to initiate the DOM binding process.
   */
  bindDOM(rootElement) {
    Logger.debug('DOMManager: bind DOM from', rootElement);
    this.processRuntimeComponents(rootElement);
    this.processSlots(rootElement);
    this.loopManager.parseLoops(rootElement);
    this.conditionalManager.parseConditionals(rootElement);
    this.attributeManager.parseAttributesBind(rootElement);
    this.attributeManager.parseAttributes(rootElement);
    this.eventManager.parseEvents(rootElement);
    this.parse(rootElement);
    this.updateAllDOM();
    Logger.debug('DOMManager: binding completed');
  }

  /**
   * Destroys the instance by performing cleanup tasks.
   *
   * This method removes event listeners from input elements, clears out
   * internal data structures like `elements`, `inputs`, `domDependencies`,
   * and `virtualDom`, and calls the `destroy` methods of `loopManager` and
   * `conditionalManager`. It is intended to completely clean up the instance
   * and free resources to avoid memory leaks.
   */
  destroy() {
    this.runtimeComponents.forEach((component) => {
      this.invokeLifecycleHook(component.lifecycle.beforeUnmount, component.host, {
        phase: 'beforeUnmount',
      });
    });

    this.inputs.forEach(({ element }) => {
      if (element.__reactiveInputHandler) {
        element.removeEventListener('input', element.__reactiveInputHandler);
        delete element.__reactiveInputHandler;
      }
    });

    this.elements = [];
    this.inputs = [];
    this.domDependencies.clear();
    this.virtualDom.clear();
    this.runtimeComponents.clear();
    this.runtimeTemplateCache.clear();
    this.aliasExpressionCache.clear();
    this.clearDiagnostics();

    this.loopManager.destroy();
    this.conditionalManager.destroy();
    this.eventManager.destroy();

    Logger.debug('DOMManager: destroyed');
  }
}
