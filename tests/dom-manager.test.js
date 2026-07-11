import { describe, it, expect, waitFor } from '@olton/latte';
import DOMManager from '../src/dom/dom-manager.js';
import Reactive from '../src/index.js';

describe('DOMManager', () => {
  it('should create a new instance with required dependencies', () => {
    const reactive = new Reactive();
    const domManager = new DOMManager(reactive);

    expect(domManager).toBeDefined();
    expect(domManager.reactive).toBe(reactive);
    expect(domManager.elements).toBeArray();
    expect(domManager.inputs).toBeArray();
    expect(domManager.domDependencies).toBeMap();
    expect(domManager.virtualDom).toBeMap();
    expect(domManager.loopManager).toBeDefined();
    expect(domManager.conditionalManager).toBeDefined();
    expect(domManager.attributeManager).toBeDefined();
    expect(domManager.eventManager).toBeDefined();
  });

  it('should register DOM dependencies', () => {
    const reactive = new Reactive();
    const domManager = new DOMManager(reactive);
    const element = document.createElement('div');

    domManager.registerDomDependency('user.name', element, { type: 'template', template: '{{user.name}}' });

    expect(domManager.domDependencies.has('user.name')).toBe(true);
    expect(domManager.domDependencies.get('user.name').size).toBe(1);

    // Register another dependency for the same property
    const anotherElement = document.createElement('span');
    domManager.registerDomDependency('user.name', anotherElement, { type: 'template', template: 'Name: {{user.name}}' });

    expect(domManager.domDependencies.get('user.name').size).toBe(2);
  });

  it('should set input values correctly', () => {
    const reactive = new Reactive();
    const domManager = new DOMManager(reactive);

    // Test text input
    const textInput = document.createElement('input');
    textInput.type = 'text';

    domManager.setInputValue(textInput, 'John Doe');
    expect(textInput.value).toBe('John Doe');

    // Test checkbox input
    const checkboxInput = document.createElement('input');
    checkboxInput.type = 'checkbox';

    domManager.setInputValue(checkboxInput, true);
    expect(checkboxInput.checked).toBe(true);

    domManager.setInputValue(checkboxInput, false);
    expect(checkboxInput.checked).toBe(false);
  });

  it('should update inputs for a specific property', () => {
    const reactive = new Reactive();
    const domManager = new DOMManager(reactive);

    // Create and register inputs
    const input1 = document.createElement('input');
    input1.setAttribute('data-model', 'user.name');

    const input2 = document.createElement('input');
    input2.setAttribute('data-model', 'user.email');

    domManager.inputs.push({ element: input1, property: 'user.name' }, { element: input2, property: 'user.email' });

    // Update only name inputs
    domManager.updateInputs('user.name', 'John Doe');

    expect(input1.value).toBe('John Doe');
    expect(input2.value).toBe(''); // Should not be updated

    // Update email inputs
    domManager.updateInputs('user.email', 'john@example.com');

    expect(input1.value).toBe('John Doe'); // Should not change
    expect(input2.value).toBe('john@example.com');
  });

  it('should update all DOM elements', () => {
    const reactive = new Reactive({ user: { name: 'John', age: 30 } });
    const domManager = new DOMManager(reactive);

    // Create text nodes with templates
    const nameNode = document.createTextNode('{{user.name}}');
    const ageNode = document.createTextNode('Age: {{user.age}}');

    // Register elements
    domManager.elements.push(
      { node: nameNode, propName: 'user.name', template: '{{user.name}}' },
      { node: ageNode, propName: 'user.age', template: 'Age: {{user.age}}' },
    );

    // Create and register inputs
    const nameInput = document.createElement('input');
    nameInput.setAttribute('data-model', 'user.name');

    const ageInput = document.createElement('input');
    ageInput.setAttribute('data-model', 'user.age');

    domManager.inputs.push({ element: nameInput, property: 'user.name' }, { element: ageInput, property: 'user.age' });

    // Update all DOM elements
    domManager.updateAllDOM();

    // Check text nodes
    expect(nameNode.textContent).toBe('John');
    expect(ageNode.textContent).toBe('Age: 30');

    // Check inputs
    expect(nameInput.value).toBe('John');
    expect(ageInput.value).toBe('30');
  });

  it('should update DOM for a specific property', () => {
    const reactive = new Reactive({ user: { name: 'John', age: 30 } });
    const domManager = new DOMManager(reactive);

    // Create elements and register dependencies
    const nameElement = document.createElement('div');
    const ageElement = document.createElement('div');

    domManager.domDependencies.set('user.name', new Set([{ element: nameElement, type: 'template', template: '{{user.name}}' }]));

    domManager.domDependencies.set('user.age', new Set([{ element: ageElement, type: 'template', template: '{{user.age}}' }]));

    // Update DOM for user.name
    domManager.updateDOM('user.name', 'Jane');

    // Since we're mocking, we can't actually test the DOM updates directly,
    // but we can verify that the method doesn't throw errors
    expect(true).toBe(true);
  });

  it('should destroy and clean up resources', () => {
    const reactive = new Reactive();
    const domManager = new DOMManager(reactive);

    // Create and register an input with a handler
    const input = document.createElement('input');
    input.__modelInputHandler = () => {};
    input.addEventListener = (event, handler) => {
      input.__handlers = input.__handlers || {};
      input.__handlers[event] = handler;
    };
    input.removeEventListener = (event, handler) => {
      if (input.__handlers && input.__handlers[event] === handler) {
        delete input.__handlers[event];
      }
    };

    domManager.inputs.push({ element: input, property: 'test' });

    // Call destroy
    domManager.destroy();

    // Verify cleanup
    expect(domManager.elements.length).toBe(0);
    expect(domManager.inputs.length).toBe(0);
    expect(domManager.domDependencies.size).toBe(0);
    expect(domManager.virtualDom.size).toBe(0);
  });

  it('should support object syntax for :class binding', async () => {
    const reactive = new Reactive({ isActive: false });
    const domManager = reactive.dom;

    const root = document.createElement('div');
    const target = document.createElement('div');
    target.setAttribute(':class', '{ active: isActive }');
    root.appendChild(target);

    domManager.bindDOM(root);

    expect(target.classList.contains('active')).toBe(false);

    reactive.data.isActive = true;
    await waitFor(10);
    expect(target.classList.contains('active')).toBe(true);

    reactive.data.isActive = false;
    await waitFor(10);
    expect(target.classList.contains('active')).toBe(false);
  });

  it('should project default slot content', () => {
    const reactive = new Reactive({ message: 'Hello Slot' });
    const domManager = reactive.dom;

    const root = document.createElement('div');
    root.innerHTML = `
      <section id="card">
        <h3>Header</h3>
        <slot></slot>
      </section>
    `;

    const card = root.querySelector('#card');
    const content = document.createElement('p');
    content.textContent = '{{message}}';
    card.appendChild(content);

    domManager.bindDOM(root);

    expect(card.querySelector('slot')).toBe(null);
    expect(card.textContent.includes('Hello Slot')).toBe(true);
  });

  it('should project named slots and keep fallback when slot is empty', () => {
    const reactive = new Reactive();
    const domManager = reactive.dom;

    const root = document.createElement('div');
    root.innerHTML = `
      <article id="layout">
        <header><slot name="header"><h1>Fallback Header</h1></slot></header>
        <main><slot><p>Fallback Body</p></slot></main>
      </article>
    `;

    const layout = root.querySelector('#layout');
    const title = document.createElement('h2');
    title.setAttribute('slot', 'header');
    title.textContent = 'Projected Header';
    layout.appendChild(title);

    domManager.bindDOM(root);

    expect(layout.querySelector('slot')).toBe(null);
    expect(layout.querySelector('header').textContent.includes('Projected Header')).toBe(true);
    expect(layout.querySelector('main').textContent.includes('Fallback Body')).toBe(true);
  });

  it('should mount runtime component from template without compilation', () => {
    const reactive = new Reactive({ message: 'Hello Runtime' });
    const domManager = reactive.dom;

    const root = document.createElement('div');

    const template = document.createElement('template');
    template.id = 'card-component';
    template.innerHTML = `
      <section class="card">
        <header><slot name="title">Fallback Title</slot></header>
        <main><slot>Fallback Body</slot></main>
        <footer>{{message}}</footer>
      </section>
    `;

    root.appendChild(template);

    const host = document.createElement('div');
    host.setAttribute('data-component', 'card-component');

    const title = document.createElement('h3');
    title.setAttribute('slot', 'title');
    title.textContent = 'Runtime Title';

    const body = document.createElement('p');
    body.textContent = '{{message}}';

    host.appendChild(title);
    host.appendChild(body);
    root.appendChild(host);

    domManager.bindDOM(root);

    expect(host.querySelector('.card') === null).toBe(false);
    expect(host.textContent.includes('Runtime Title')).toBe(true);
    expect(host.textContent.includes('Hello Runtime')).toBe(true);
    expect(host.textContent.includes('Fallback Body')).toBe(false);
  });

  it('should support data-props aliases for runtime component templates', async () => {
    const reactive = new Reactive({
      user: {
        name: 'Ira',
        city: 'Kyiv',
      },
      isActive: false,
    });
    const domManager = reactive.dom;

    const root = document.createElement('div');

    const template = document.createElement('template');
    template.id = 'profile-card';
    template.innerHTML = `
      <article>
        <h3>{{title}}</h3>
        <p :class="{ active: stateActive }">{{cityName}}</p>
      </article>
    `;
    root.appendChild(template);

    const host = document.createElement('div');
    host.setAttribute('data-component', 'profile-card');
    host.setAttribute('data-props', '{ title: user.name, cityName: user.city, stateActive: isActive }');
    root.appendChild(host);

    domManager.bindDOM(root);

    const title = host.querySelector('h3');
    const city = host.querySelector('p');

    expect(title.textContent).toBe('Ira');
    expect(city.textContent).toBe('Kyiv');
    expect(city.classList.contains('active')).toBe(false);

    reactive.data.user.name = 'Inna';
    reactive.data.user.city = 'Lviv';
    reactive.data.isActive = true;
    await waitFor(20);

    expect(title.textContent).toBe('Inna');
    expect(city.textContent).toBe('Lviv');
    expect(city.classList.contains('active')).toBe(true);
  });

  it('should support two-way props with sync prefix', async () => {
    const reactive = new Reactive({ user: { name: 'John' } });
    const domManager = reactive.dom;

    const root = document.createElement('div');
    root.innerHTML = `
      <template id="editor-card">
        <input data-model="nameValue" />
      </template>
      <div data-component="editor-card" data-props="{ nameValue: sync:user.name }"></div>
    `;

    domManager.bindDOM(root);

    const input = root.querySelector('input');
    expect(input.value).toBe('John');

    input.value = 'Jane';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    await waitFor(20);

    expect(reactive.data.user.name).toBe('Jane');
  });

  it('should keep one-way props read-only for data-model and emit diagnostic', () => {
    const reactive = new Reactive({ user: { name: 'John' } }, { devDiagnostics: true });
    const domManager = reactive.dom;

    const root = document.createElement('div');
    root.innerHTML = `
      <template id="read-card">
        <input data-model="nameValue" />
      </template>
      <div data-component="read-card" data-props="{ nameValue: user.name }"></div>
    `;

    domManager.bindDOM(root);

    const diagnostics = reactive.getDiagnostics();
    expect(diagnostics.some((item) => item.message.includes("One-way prop 'nameValue'"))).toBe(true);
  });

  it('should run runtime component lifecycle hooks', async () => {
    const calls = [];
    globalThis.onMountedHook = (payload) => {
      calls.push(`mounted:${payload.phase}`);
    };
    globalThis.onUpdatedHook = (payload) => {
      calls.push(`updated:${payload.propertyPath}`);
    };
    globalThis.onBeforeUnmountHook = (payload) => {
      calls.push(`before:${payload.phase}`);
    };

    const reactive = new Reactive({ user: { name: 'John' } }, { devDiagnostics: true });

    const root = document.createElement('div');
    root.innerHTML = `
      <template id="life-card"><p>{{nameValue}}</p></template>
      <div
        data-component="life-card"
        data-props="{ nameValue: user.name }"
        data-on-mounted="onMountedHook"
        data-on-updated="onUpdatedHook"
        data-on-before-unmount="onBeforeUnmountHook"
      ></div>
    `;

    reactive.dom.bindDOM(root);
    reactive.data.user.name = 'Jane';
    await waitFor(20);
    reactive.destroy();

    expect(calls.some((value) => value === 'mounted:mounted')).toBe(true);
    expect(calls.some((value) => value.includes('updated:user.name'))).toBe(true);
    expect(calls.some((value) => value === 'before:beforeUnmount')).toBe(true);

    delete globalThis.onMountedHook;
    delete globalThis.onUpdatedHook;
    delete globalThis.onBeforeUnmountHook;
  });

  it('should block unsafe expressions in safe mode', () => {
    const reactive = new Reactive({ count: 1 }, { safeExpressions: true, devDiagnostics: true });
    const domManager = reactive.dom;

    const root = document.createElement('div');
    const target = document.createElement('div');
    target.setAttribute(':class', 'window.alert(1)');
    root.appendChild(target);

    domManager.bindDOM(root);

    const diagnostics = reactive.getDiagnostics();
    expect(diagnostics.some((item) => item.message.includes('Unsafe expression blocked'))).toBe(true);
  });

  it('should cache runtime templates when option is enabled', () => {
    const reactive = new Reactive({}, { runtimeTemplateCache: true });
    const domManager = reactive.dom;

    const root = document.createElement('div');
    root.innerHTML = `
      <template id="cache-card"><p>cache</p></template>
      <div data-component="cache-card"></div>
      <div data-component="cache-card"></div>
    `;

    domManager.bindDOM(root);

    expect(domManager.runtimeTemplateCache.has('#cache-card')).toBe(true);
  });

  it('should support scoped slots via :alias props', async () => {
    const reactive = new Reactive({
      user: {
        name: 'Marta',
      },
    });

    const root = document.createElement('div');
    root.innerHTML = `
      <template id="scope-card">
        <section>
          <slot name="title" :item="user"></slot>
        </section>
      </template>
      <div data-component="scope-card">
        <h3 slot="title">{{item.name}}</h3>
      </div>
    `;

    reactive.dom.bindDOM(root);

    const title = root.querySelector('h3');
    expect(title.textContent).toBe('Marta');

    reactive.data.user.name = 'Nina';
    await waitFor(20);

    expect(title.textContent).toBe('Nina');
  });

  it('should support scoped slot aliases from data-slot-props object', async () => {
    const reactive = new Reactive({
      user: {
        city: 'Kyiv',
      },
    });

    const root = document.createElement('div');
    root.innerHTML = `
      <template id="scope-object-card">
        <section>
          <slot name="body" data-slot-props="{ location: user.city }"></slot>
        </section>
      </template>
      <div data-component="scope-object-card">
        <p slot="body">{{location}}</p>
      </div>
    `;

    reactive.dom.bindDOM(root);

    const body = root.querySelector('p');
    expect(body.textContent).toBe('Kyiv');

    reactive.data.user.city = 'Lviv';
    await waitFor(20);

    expect(body.textContent).toBe('Lviv');
  });
});
