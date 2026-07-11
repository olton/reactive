<div align="center">

# Reactive

Reactive – Is a reactive data model for two-way data binding directly in your HTML code without precompiling.

</div>

<div align="center">

![Dependencies](https://img.shields.io/badge/Dependencies-none-darklime.svg)
![Package Version](https://img.shields.io/github/package-json/v/olton/reactive)
![GitHub Release](https://img.shields.io/github/v/release/olton/reactive)
![NPM Version](https://img.shields.io/npm/v/%40olton%2Freactive)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?color=7852a9)
![Code size](https://img.shields.io/github/languages/code-size/olton/reactive.svg?color=green)

</div>

## Main Features

- Reactive data model with automatic DOM updates.
- Two-way binding via `data-model` for inputs and form controls.
- Template expressions in HTML: `{{property}}`.
- Computed properties and `watch` for side effects.
- Built-in directives: conditional rendering (`data-if`) and loops (`data-loop`).
- Runtime templates and slots with no precompilation step.

## Installation

You can install Reactive via npm:

```bash
npm install @olton/reactive
```

## Usage

### Basic Example

```html
<div id="app">
  <h2>{{name}}</h2>
  <input type="text" data-model="name" />
</div>

<script type="module">
  import Reactive from '@olton/reactive';

  const app = new Reactive({
    name: 'John',
  });

  app.init('#app');
</script>
```

## Documentation

Read about `Reactive` usage in the [DESCRIPTION](DESCRIPTION.md).

## License

Reactive is licensed under a [MIT license](LICENSE).

## Sponsors

If you like this project, please consider supporting it by:

- Star this repository on GitHub
- Sponsor this project on GitHub Sponsors
- **PayPal** to `serhii@pimenov.com.ua`.
- [**Patreon**](https://www.patreon.com/metroui)
- [**Buy me a coffee**](https://buymeacoffee.com/pimenov)

---

Copyright © 2025-2026 by [Serhii Pimenov](https://pimenov.com.ua)
