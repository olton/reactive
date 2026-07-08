export default class ReactivePlugin {
  reactive = null;
  options = {};

  constructor(reactive, options = {}) {
    this.reactive = reactive;
    this.options = options;
  }

  run() {}
}
