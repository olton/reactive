# Understanding Reactive Programming with `Reactive`

## Introduction

Welcome to this comprehensive guide on `Reactive`, a powerful JavaScript library for reactive programming and two-way data binding. This article is designed for beginner programmers who want to understand the concepts of reactive programming and how to implement them in their web applications.

## What is `Reactive`?

`Reactive` is a lightweight JavaScript library that provides a reactive data model with two-way data binding capabilities. It allows you to create dynamic web applications where the UI automatically updates when the underlying data changes, and vice versa. This eliminates the need for manual DOM manipulation and helps you write cleaner, more maintainable code.

## Key Concepts

### Reactive Programming

Reactive programming is a programming paradigm focused on data flows and the propagation of changes. In reactive programming, when a data source changes, all elements that depend on that data are automatically updated. This is in contrast to imperative programming, where you would need to manually update each dependent element.

### Two-Way Data Binding

Two-way data binding is a connection between the UI (view) and the data model. When the data model changes, the UI updates automatically, and when the user interacts with the UI (e.g., inputs data), the model updates automatically. This creates a seamless connection between your data and your UI.

### Virtual DOM

A virtual DOM is a lightweight copy of the actual DOM. `Reactive` uses a virtual DOM to track changes and update only the parts of the UI that need to be updated, making it more efficient than directly manipulating the DOM.

## Core Components of Reactive

### Reactive

The `Reactive` class is the main entry point of the library. It manages the reactive data, DOM bindings, computed properties, and more. When you create a new instance of `Reactive`, you provide it with initial data and configuration options.

```javascript
import Reactive from '@olton/reactive';

const model = new Reactive({
  name: 'John',
  age: 30,
});
```

### ReactiveStore

The `ReactiveStore` class is the heart of the reactivity system. It uses JavaScript Proxies to create a reactive state object that can detect changes to properties and arrays. When a property changes, it notifies all elements that depend on that property.

### DOMManager

The `DOMManager` class handles the DOM binding and updates. It parses the DOM for template expressions, sets up two-way data binding for input elements, and updates the DOM when the model's data changes.

## How to Use Model

### Installation

You can install `Model` using npm:

```bash
npm install @olton/reactive
```

### Basic Usage

Here's a simple example of how to use `Reactive`:

```javascript
import Reactive from '@olton/reactive';

// Create a new reactive instance with initial data
const reactive = new Reactive({
  name: 'John',
  age: 30,
});

// Initialize the reactive instance on a DOM element
reactive.init('#app');
```

In your HTML, you can use template expressions to display data from the reactive instance:

```html
<div id="app">
  <p>Name: {{name}}</p>
  <p>Age: {{age}}</p>

  <input type="text" data-model="name" />
  <input type="number" data-model="age" />
</div>
```

When the user types in the input fields, the reactive instance's data will update automatically, and the displayed values will update as well.

### Computed Properties

You can define computed properties that depend on other properties:

```javascript
const reactive = new Reactive({
  firstName: 'John',
  lastName: 'Doe',
  fullName: function () {
    return this.firstName + ' ' + this.lastName;
  },
});
```

In your HTML, you can use the computed property like any other property:

```html
<p>Full Name: {{fullName}}</p>
```

### Watchers (side effects)

Computed properties are great for declarative derived state. For side effects (DOM integrations, API calls, syncing other state), use `watch`.

Watch by path:

```javascript
const stop = reactive.watch('count', (newValue, oldValue) => {
  console.log('count changed:', oldValue, '->', newValue);
});

// later
stop();
```

Watch by getter:

```javascript
reactive.watch(
  (state) => `${state.firstName} ${state.lastName}`,
  (fullName) => {
    document.title = fullName;
  },
);
```

Use `immediate` to run callback right away and `onCleanup` for cancelable async side effects:

```javascript
reactive.watch(
  'searchQuery',
  async (query, _oldQuery, onCleanup) => {
    const controller = new AbortController();
    onCleanup(() => controller.abort());

    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    });

    reactive.data.searchResult = await response.json();
  },
  { immediate: true },
);
```

### Conditional Rendering

You can conditionally render elements based on data in your model:

```html
<div data-if="age >= 18">
  <p>You are an adult.</p>
</div>
<div data-if="age < 18">
  <p>You are a minor.</p>
</div>
```

### Loops

You can render lists of items using loops:

```html
<ul>
  <li data-loop="item in items">{{item.name}}</li>
</ul>
```

In your model:

```javascript
const reactive = new Reactive({
  items: [{ name: 'Item 1' }, { name: 'Item 2' }, { name: 'Item 3' }],
});
```

### Dynamic class binding (`:class`)

You can bind any number of classes with object syntax. Each value is evaluated as a boolean.

```html
<div :class="{ 'block-color': isBlack, disabled: isDisabled, visible: isVisible }">Status block</div>
```

```javascript
const reactive = new Reactive({
  isBlack: true,
  isDisabled: false,
  isVisible: true,
});
```

In this example, `block-color` and `visible` are added, while `disabled` is removed.

### Slots (content projection)

Reactive supports slot projection with default and named slots.

Default slot:

```html
<div id="card">
  <slot><p>Fallback content</p></slot>
  <p>{{name}}</p>
</div>
```

Named slot:

```html
<article id="layout">
  <header>
    <slot name="header"><h1>Fallback Header</h1></slot>
  </header>
  <main>
    <slot><p>Fallback Body</p></slot>
  </main>

  <h2 slot="header">Projected Header</h2>
</article>
```

If no matching content is provided, fallback content inside `<slot>` is used.

Scoped slots are also supported for runtime components.
You can pass slot props with `:alias="path"` directly on `<slot>`:

```html
<template id="scope-card">
  <section>
    <slot name="title" :item="user"></slot>
  </section>
</template>

<div data-template="scope-card">
  <h3 slot="title">{{item.name}}</h3>
</div>
```

Or with object syntax via `data-slot-props`:

```html
<template id="scope-object-card">
  <section>
    <slot name="body" data-slot-props="{ location: user.city }"></slot>
  </section>
</template>

<div data-template="scope-object-card">
  <p slot="body">{{location}}</p>
</div>
```

### Runtime components without compilation

You can compose reusable UI blocks directly in HTML using `<template>` and `data-template`.

```html
<template id="user-card">
  <article class="card">
    <header><slot name="title">User</slot></header>
    <section><slot>Empty content</slot></section>
    <footer>{{ user.name }}</footer>
  </article>
</template>

<div data-template="user-card">
  <h3 slot="title">Profile</h3>
  <p>{{ user.city }}</p>
</div>
```

Reactive mounts this at runtime during `init()`; no compiler/build transform is required.

You can also map local template aliases to reactive store paths using `data-props`:

```html
<template id="profile-card">
  <article>
    <h3>{{ title }}</h3>
    <p :class="{ active: stateActive }">{{ cityName }}</p>
  </article>
</template>

<div data-template="profile-card" data-props="{ title: user.name, cityName: user.city, stateActive: isActive }"></div>
```

Aliases from `data-props` are resolved at runtime and stay reactive because they are mapped to store paths.

For two-way props with `data-model`, use `sync:` prefix:

```html
<template id="editor-card">
  <label>Name <input data-model="nameValue" /></label>
</template>

<div data-template="editor-card" data-props="{ nameValue: sync:user.name }"></div>
```

Without `sync:`, prop aliases are one-way and do not write back to source path.

You can also register lifecycle hooks on the host element:

```html
<div
  data-template="user-card"
  data-on-mounted="onCardMounted"
  data-on-updated="onCardUpdated"
  data-on-before-unmount="onCardBeforeUnmount"
></div>
```

```javascript
const app = new Reactive({
  onCardMounted({ host }) {
    host.classList.add('ready');
  },
  onCardUpdated({ propertyPath }) {
    console.log('component updated by', propertyPath);
  },
});
```

Runtime options for safety, diagnostics and cache:

```javascript
const app = new Reactive(data, {
  safeExpressions: true,
  devDiagnostics: true,
  runtimeTemplateCache: true,
});

console.log(app.getDiagnostics());
app.clearDiagnostics();
```

When `safeExpressions` is enabled, unsafe expressions are blocked and recorded in diagnostics.
With `devDiagnostics`, runtime warnings (for example missing templates or one-way `data-model` misuse) are available through `getDiagnostics()`.

## Advanced Features

### State Management

`Reactive` includes a state management system that allows you to save and restore the state of your application:

```javascript
// Save the current state
const state = Reactive.save();

// Restore a previously saved state
Reactive.restore();

// Create a snapshot of the current state
const reactive = new Reactive({ name: 'John', age: 30 });
const snapshot = reactive.snapshot();

// Restore a snapshot
reactive.snapshot(snapshot);
```

### Plugins

You can extend the functionality of `Reactive` using plugins:

```javascript
import Reactive, { ReactivePlugin } from '@olton/reactive';

class MyPlugin extends ReactivePlugin {
  constructor(reactive, options) {
    super(reactive, options);
  }

  run() {
    // Plugin logic here
  }
}

const reactive = new Reactive(
  {},
  {
    plugins: [{ name: 'myPlugin', plugin: MyPlugin }],
  },
);

// Use the plugin
reactive.usePlugin('myPlugin');
```

### Middleware

You can use middleware to intercept and modify state changes:

```javascript
reactive.use((context, next) => {
  // Modify the context if needed
  console.log(`Property ${context.prop} changed from ${context.oldValue} to ${context.newValue}`);

  // Call the next middleware
  next();
});
```

## Best Practices

1. **Keep your reactive data simple**: Avoid circular references and complex nested structures.
2. **Use computed properties for derived data**: Instead of updating multiple properties when one changes, use computed properties to derive values.
3. **Validate your reactive instance**: Use the `validate()` method to check for potential issues like cyclic dependencies.
4. **Clean up resources**: Call the `destroy()` method when you're done with a reactive instance to free up resources.

## Conclusion

`Reactive` is a powerful library for reactive programming and two-way data binding. It provides a simple and intuitive API for creating dynamic web applications with minimal code. By understanding the concepts of reactive programming and how `Reactive` implements them, you can write cleaner, more maintainable code and create better user experiences.

For more detailed information, check out the [official documentation](https://v5.metroui.org.ua/libraries/reactive).

Happy coding!
