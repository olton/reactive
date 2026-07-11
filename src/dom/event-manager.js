import Logger from '../logger/logger.js';

export default class EventManager {
  static KEY_MODIFIERS_MAP = {
    enter: ['enter'],
    tab: ['tab'],
    delete: ['delete', 'backspace'],
    esc: ['escape', 'esc'],
    space: [' ', 'space', 'spacebar'],
    up: ['arrowup', 'up'],
    down: ['arrowdown', 'down'],
    left: ['arrowleft', 'left'],
    right: ['arrowright', 'right'],
  };

  static SYSTEM_MODIFIERS_MAP = {
    ctrl: 'ctrlKey',
    alt: 'altKey',
    shift: 'shiftKey',
    meta: 'metaKey',
  };

  static MOUSE_BUTTON_MODIFIERS_MAP = {
    left: 0,
    middle: 1,
    right: 2,
  };

  /**
   * Creates a copy of the event manager
   * @param {Object} domManager - DOM manager for working with DOM elements
   * @param {Object} reactive - Reactive store that will be used as a context in events
   */
  constructor(domManager, reactive) {
    Logger.DEBUG_LEVEL = reactive.options.debug ? 4 : 0;
    Logger.debug('EventManager: Init EventManager');

    this.domManager = domManager;
    this.reactive = reactive;
    this.eventHandlers = new Map();

    Logger.debug('EventManager: EventManager initialized');
  }

  /**
   * Analyzes DOM-Vreyevo and finds all attributes starting with @,
   * Registering them as events
   * @param {HTMLElement} rootElement - Root element for searching for events
   */
  parseEvents(rootElement) {
    Logger.debug('EventManager: Parsing events with @...');
    const allElements = rootElement.querySelectorAll('*');
    const elements = [rootElement, ...Array.from(allElements)];

    elements.forEach((element) => {
      const attributes = Array.from(element.attributes || []);

      attributes.forEach((attr) => {
        if (attr.name.startsWith('@')) {
          Logger.debug(`EventManager: Found attribute with "@" ${attr.name} in`, element);

          const { eventName, modifiers } = this.parseEventDescriptor(attr.name);
          const handler = attr.value.trim();

          this.bindEventHandler(element, eventName, handler, modifiers);
          element.removeAttribute(attr.name); // Удаляем атрибут, чтобы избежать дублирования
        }
      });
    });
  }

  /**
   * Parses event descriptor from attribute name.
   * Example: @click.prevent.stop => { eventName: 'click', modifiers: ['prevent', 'stop'] }
   * @param {string} attrName - Event attribute name
   * @returns {{eventName: string, modifiers: string[]}}
   */
  parseEventDescriptor(attrName) {
    const descriptor = attrName.startsWith('@') ? attrName.slice(1) : attrName;
    const [eventName, ...mods] = descriptor.split('.').filter(Boolean);

    return {
      eventName,
      modifiers: mods,
    };
  }

  /**
   * Converts event modifiers to addEventListener options.
   * @param {string[]} modifiers - Event modifiers
   * @returns {{capture: boolean, once: boolean, passive: boolean}}
   */
  getEventListenerOptions(modifiers = []) {
    return {
      capture: modifiers.includes('capture'),
      once: modifiers.includes('once'),
      passive: modifiers.includes('passive'),
    };
  }

  /**
   * Checks whether a modifier belongs to keyboard key modifiers.
   * @param {string} modifier - Event modifier
   * @returns {boolean}
   */
  isKeyModifier(modifier) {
    return modifier in EventManager.KEY_MODIFIERS_MAP;
  }

  /**
   * Checks whether a modifier belongs to system key modifiers.
   * @param {string} modifier - Event modifier
   * @returns {boolean}
   */
  isSystemModifier(modifier) {
    return modifier in EventManager.SYSTEM_MODIFIERS_MAP;
  }

  /**
   * Checks whether a modifier belongs to mouse button modifiers.
   * @param {string} modifier - Event modifier
   * @returns {boolean}
   */
  isMouseButtonModifier(modifier) {
    return modifier in EventManager.MOUSE_BUTTON_MODIFIERS_MAP;
  }

  /**
   * Determines whether the event has mouse button information.
   * @param {Event} event - DOM event
   * @returns {boolean}
   */
  isMouseButtonEvent(event) {
    return 'button' in event && typeof event.button === 'number';
  }

  /**
   * Validates mouse button against modifier.
   * @param {Event} event - DOM event
   * @param {string} modifier - Mouse button modifier
   * @returns {boolean}
   */
  matchesMouseButtonModifier(event, modifier) {
    const expectedButton = EventManager.MOUSE_BUTTON_MODIFIERS_MAP[modifier];
    return event.button === expectedButton;
  }

  /**
   * Validates system modifier state for event.
   * @param {Event} event - DOM event
   * @param {string} modifier - System modifier
   * @returns {boolean}
   */
  matchesSystemModifier(event, modifier) {
    const property = EventManager.SYSTEM_MODIFIERS_MAP[modifier];
    return Boolean(event[property]);
  }

  /**
   * Validates exact system modifiers combination.
   * @param {Event} event - DOM event
   * @param {string[]} requiredModifiers - Required system modifiers
   * @returns {boolean}
   */
  matchesExactSystemModifiers(event, requiredModifiers = []) {
    const requiredSet = new Set(requiredModifiers);

    return Object.entries(EventManager.SYSTEM_MODIFIERS_MAP).every(([modifier, prop]) => {
      return Boolean(event[prop]) === requiredSet.has(modifier);
    });
  }

  /**
   * Validates keyboard event key against modifier.
   * @param {Event} event - DOM event
   * @param {string} modifier - Keyboard modifier
   * @returns {boolean}
   */
  matchesKeyModifier(event, modifier) {
    if (!('key' in event) || typeof event.key !== 'string') {
      return false;
    }

    const normalizedKey = event.key.toLowerCase();
    const allowedKeys = EventManager.KEY_MODIFIERS_MAP[modifier];
    return allowedKeys.includes(normalizedKey);
  }

  /**
   * Binds the event handler to the DOM element
   * @param {HTMLElement} element - DOM element
   * @param {string} eventName - Event name (without @)
   * @param {string} handlerExpression - Line with an event processor
   */
  bindEventHandler(element, eventName, handlerExpression, modifiers = []) {
    Logger.debug(`EventManager: Binding event handler with expression ${handlerExpression} for ${eventName} on`, element);

    const listenerOptions = this.getEventListenerOptions(modifiers);
    const hasExact = modifiers.includes('exact');
    const requiredSystemModifiers = modifiers.filter((modifier) => this.isSystemModifier(modifier));

    const eventHandler = (event) => {
      try {
        if (hasExact && !this.matchesExactSystemModifiers(event, requiredSystemModifiers)) {
          return;
        }

        for (const modifier of modifiers) {
          const handledAsMouseButton = this.isMouseButtonModifier(modifier) && this.isMouseButtonEvent(event);
          if (handledAsMouseButton) {
            if (!this.matchesMouseButtonModifier(event, modifier)) {
              return;
            }
            continue;
          }

          if (this.isSystemModifier(modifier) && !this.matchesSystemModifier(event, modifier)) {
            return;
          }

          if (this.isKeyModifier(modifier) && !this.matchesKeyModifier(event, modifier)) {
            return;
          }

          if (modifier === 'self' && event.target !== element) {
            return;
          }

          if (modifier === 'prevent') {
            if (listenerOptions.passive) {
              Logger.warn(`EventManager: .prevent cannot be used together with .passive for '${eventName}'`);
              continue;
            }
            event.preventDefault();
          }

          if (modifier === 'stop') {
            event.stopPropagation();
          }
        }

        if (!handlerExpression) {
          return;
        }

        const context = {
          $reactive: this.reactive,
          $event: event,
          $data: this.reactive.data,
          $dom: this.domManager,
        };

        const methodMatch = handlerExpression.match(/(\w+)\((.*)\)/);

        if (methodMatch) {
          const methodName = methodMatch[1];
          const paramsString = methodMatch[2];

          const resolveMethod = (path, context) => {
            return path.split('.').reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : undefined), context);
          };

          let method = resolveMethod(methodName, this.reactive); // Поиск в реактивном хранилище
          if (!method) {
            method = resolveMethod(methodName, window); // Поиск в глобальном объекте (например, window)
          }

          if (typeof method === 'function') {
            // Обрабатываем параметры, если они есть
            let params = [];
            if (paramsString.trim()) {
              params = paramsString.split(',').map((param) => {
                param = param.trim();

                if ((param.startsWith('"') && param.endsWith('"')) || (param.startsWith("'") && param.endsWith("'"))) {
                  return param.slice(1, -1);
                }

                if (!isNaN(param)) {
                  return Number(param);
                }

                if (param === '$event') {
                  Logger.debug(`EventManager: Requested Event`, event);
                  return event;
                }

                if (param === '$reactive') {
                  Logger.debug(`EventManager: Requested Reactive Store`, this.reactive);
                  return this.reactive;
                }

                if (param === '$data') {
                  Logger.debug(`EventManager: Requested Reactive Store Context`, this.reactive.data);
                  return this.reactive.data;
                }

                if (param === '$dom') {
                  Logger.debug(`EventManager: Requested DOMManager`, this.domManager);
                  return this.domManager;
                }

                return this.reactive.store.get(param);
              });
            }

            method.apply(context, params);
          } else {
            console.warn(`EventManager: The method '${methodName}' not found in a reactive store or global space!`);
          }
        } else {
          if (this.reactive.options.useSimpleExpressions) {
            const result = new Function(`return ${handlerExpression}`);
            result.apply(this.reactive.data);
          } else {
            console.warn(`EventManager: Unknown format of the event handler: '${handlerExpression}'`);
          }
        }
      } catch (error) {
        console.error(`EventManager: Error when performing an event processor '${eventName}': ${error.message}`);
      }
    };

    if (!this.eventHandlers.has(element)) {
      this.eventHandlers.set(element, new Map());
    }

    const elementHandlers = this.eventHandlers.get(element);
    if (elementHandlers.has(eventName)) {
      const previousBinding = elementHandlers.get(eventName);
      element.removeEventListener(eventName, previousBinding.handler, previousBinding.options);
    }

    elementHandlers.set(eventName, {
      handler: eventHandler,
      options: listenerOptions,
    });
    element.addEventListener(eventName, eventHandler, listenerOptions);
  }

  /**
   * Removes the event processor from the DOM element
   * @param {HTMLElement} element - DOM element
   * @param {string} eventName - Event name (without @)
   */
  removeEventHandler(element, eventName) {
    Logger.debug(`EventManager: Removing event handler for ${eventName} on`, element);
    if (this.eventHandlers.has(element)) {
      const elementHandlers = this.eventHandlers.get(element);

      if (elementHandlers.has(eventName)) {
        const binding = elementHandlers.get(eventName);
        element.removeEventListener(eventName, binding.handler, binding.options);
        elementHandlers.delete(eventName);

        if (elementHandlers.size === 0) {
          this.eventHandlers.delete(element);
        }
      }
    }
  }

  /**
   * Updates events for the element
   * @param {HTMLElement} element - DOM element for updating
   */
  updateEvents(element) {
    Logger.debug('EventManager: Updating events for', element);
    Array.from(element.attributes || []).forEach((attr) => {
      if (attr.name.startsWith('@')) {
        const { eventName, modifiers } = this.parseEventDescriptor(attr.name);
        const handler = attr.value.trim();

        this.bindEventHandler(element, eventName, handler, modifiers);
        element.removeAttribute(attr.name);
      }
    });
  }

  /**
   * Releases all resources and removes all events
   */
  destroy() {
    Logger.debug('EventManager: Destroying EventManager');
    this.eventHandlers.forEach((handlers, element) => {
      handlers.forEach((binding, eventName) => {
        Logger.debug(`EventManager: Removing event handler for ${eventName} on`, element);
        element.removeEventListener(eventName, binding.handler, binding.options);
      });
    });

    this.eventHandlers.clear();

    Logger.debug('EventManager: Destroyed');
  }
}
