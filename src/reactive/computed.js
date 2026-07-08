import Logger from '../logger/logger.js';

/**
 * Manages computed properties in a reactive reactive system.
 * - Initializes computed property getters
 * - Tracks property dependencies automatically
 * - Updates computed values on dependency changes
 * - Supports nested object dependencies
 *
 * @class
 * @property {Object} reactive - Host reactive system
 * @property {Object} computed - Computed property definitions
 * @property {Object} store - Reference to reactive system's data store
 */
export default class ComputedProps {
  constructor(reactive, computed = {}) {
    Logger.DEBUG_LEVEL = reactive.options.debug ? 4 : 0;
    Logger.debug('Reactive: Init ComputedProps:', computed);

    this.reactive = reactive;
    this.computed = computed;
    this.store = reactive.store;
    this.asyncCache = new Map();

    this.init().then(() => {
      Object.getOwnPropertyNames(this.computed).forEach((prop) => {
        if (typeof this.computed[prop]['getter'] === 'function') {
          try {
            const value = this.computed[prop]['getter'].call(this.store.getState());
            Logger.debug(`Initializing computed property ${prop}:`, value);
          } catch (e) {
            console.error(`Error initializing computed property ${prop}:`, e);
          }
        }
      });
      Logger.debug('Reactive: ComputedProps initialized');
    });
  }

  /**
   * Sets up computed properties in the reactive system.
   * - Performs initial evaluation of all computed properties
   * - Defines getter proxies on reactive.data
   * - Makes computed properties enumerable and configurable
   * - Ensures reactive updates through getter access
   *
   * @method init
   */
  async init() {
    const initPromises = [];

    for (const key in this.computed) {
      const valuePromise = this.evaluate(key);
      initPromises.push(valuePromise);

      Object.defineProperty(this.reactive.data, key, {
        get: () => {
          const computed = this.computed[key];
          return computed.isAsync ? this.asyncCache.get(key) : computed.value;
        },
        enumerable: true,
        configurable: true,
      });
    }

    // Дождитесь завершения всех вычислений
    await Promise.all(initPromises);

    // Обновите DOM для каждого свойства
    for (const key in this.computed) {
      const value = this.computed[key].isAsync ? this.asyncCache.get(key) : this.computed[key].value;

      // Явно обновляем DOM для каждого свойства
      this.reactive.dom.updateDOM(key, value);
      this.reactive.dom.updateInputs(key, value);
    }

    return true;
  }

  /**
   * Evaluates computed property and tracks its dependencies.
   * - Creates proxy for dependency tracking
   * - Handles nested object dependencies
   * - Records all accessed properties during evaluation
   * - Emits computation events with results
   *
   * @method evaluate
   * @param {string} key - Computed property name
   * @returns {*} New computed value
   * @emits compute
   */
  async evaluate(key) {
    const computed = this.computed[key];
    const dependencies = new Set();

    const dataTracker = new Proxy(this.store.getState(), {
      get: (target, prop) => {
        dependencies.add(prop);
        let value = target[prop];

        if (value && typeof value === 'object') {
          return new Proxy(value, {
            get: (obj, nestedProp) => {
              dependencies.add(`${prop}.${nestedProp}`);
              return obj[nestedProp];
            },
          });
        }
        return value;
      },
    });

    // Перевіряємо чи геттер є асинхронним
    const isAsync = computed.getter.constructor.name === 'AsyncFunction';
    computed.isAsync = isAsync;

    try {
      const result = await computed.getter.call(dataTracker);
      computed.dependencies = [...dependencies];

      if (isAsync) {
        // Зберігаємо результат в кеш для асинхронних властивостей
        this.asyncCache.set(key, result);
      } else {
        computed.value = result;
      }

      this.reactive.store.emit('compute', {
        key,
        value: result,
        dependencies,
        isAsync,
      });

      return result;
    } catch (error) {
      console.error(`Error evaluating computed property "${key}":`, error);
      throw error;
    }
  }

  /**
   * Updates computed properties affected by reactive system changes.
   * Checks three types of dependencies:
   * - Direct property matches
   * - Nested property changes (parent changed)
   * - Parent property changes (child changed)
   *
   * @method update
   */
  async update() {
    const updatePromises = [];

    for (const key in this.computed) {
      const updatePromise = (async () => {
        const newValue = await this.evaluate(key);
        this.reactive.dom.updateDOM(key, newValue);
        this.reactive.dom.updateInputs(key, newValue);
      })();

      updatePromises.push(updatePromise);
    }

    await Promise.all(updatePromises);
  }

  /**
   * @method all
   * @description Retrieves all computed properties and their current values.
   * Converts the `computed` object into a plain object, mapping each computed
   * property's name to its current value.
   *
   * @returns {Object} An object containing all computed property names and their values.
   */
  all() {
    return Object.fromEntries(Object.entries(this.computed).map(([key, comp]) => [key, comp.value]));
  }
}
