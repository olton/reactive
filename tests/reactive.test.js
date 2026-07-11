import { describe, it, expect, mock, waitFor } from '@olton/latte';
import Reactive, { ReactivePlugin } from '../src/index.js';

describe('Reactive', () => {
  it('should create a new instance with default options', () => {
    const model = new Reactive();
    expect(model.options.id).toBe('reactive');
    expect(model.options.useSimpleExpressions).toBeTrue();
    expect(model.options.debug).toBeFalse();
  });

  it('should create a new instance with custom options', () => {
    const model = new Reactive({}, { id: 'custom-model', debug: false });
    expect(model.options.id).toBe('custom-model');
  });

  it('should register computed properties', () => {
    const model = new Reactive({
      firstName: 'John',
      lastName: 'Doe',
      fullName: function () {
        return this.firstName + ' ' + this.lastName;
      },
    });

    expect(model.computed.fullName).toBeDefined();
    expect(typeof model.computed.fullName.getter).toBe('function');
  });

  it('should add validator to a path', () => {
    const model = new Reactive({ age: 25 });
    const validator = mock((value) => value >= 18);

    model.addValidator('age', validator);

    model.data.age = 17;

    expect(validator).toHaveBeenCalled();
    expect(model.data.age).toBe(25);
  });

  it('should add formatter to a path', async () => {
    const model = new Reactive({ price: 10 });
    const formatter = mock((value) => `$${value}`);

    model.addFormatter('price', formatter);
    model.data.price = 20;

    await waitFor(100); // Wait for the formatter to be called

    expect(formatter).toHaveBeenCalled();
    expect(model.data.price).toBe('$20');
  });

  it('should use middleware', async () => {
    const model = new Reactive({ count: 0 });
    const middleware = mock((v) => v + 1);

    model.use(middleware);

    model.data.count = 1;
    await waitFor(100); // Wait for the middleware to be called

    expect(middleware).toHaveBeenCalled();
    expect(model.data.count).toBe(1);
  });

  it('should watch a path for changes', () => {
    const model = new Reactive({ count: 0 });
    const callback = mock();

    // Spy on the store's watch method
    model.store.watch = mock();

    model.watch('count', callback);

    expect(model.store.watch).toHaveBeenCalled();
  });

  it('should watch getter source changes', async () => {
    const model = new Reactive({ firstName: 'John', lastName: 'Doe' });
    const callback = mock();

    model.watch((state) => `${state.firstName} ${state.lastName}`, callback);

    model.data.firstName = 'Jane';
    await waitFor(20);

    expect(callback).toHaveBeenCalled();
    const [newValue, oldValue, onCleanup] = callback.mock.calls[0];
    expect(newValue).toBe('Jane Doe');
    expect(oldValue).toBe('John Doe');
    expect(typeof onCleanup).toBe('function');
  });

  it('should support watch immediate option', () => {
    const model = new Reactive({ count: 1 });
    const callback = mock();

    model.watch('count', callback, { immediate: true });

    const [newValue, oldValue, onCleanup] = callback.mock.calls[0];
    expect(newValue).toBe(1);
    expect(oldValue).toBe(undefined);
    expect(typeof onCleanup).toBe('function');
  });

  it('should support deep path watch', async () => {
    const model = new Reactive({ user: { profile: { name: 'John' } } });
    const callback = mock();

    model.watch('user', callback, { deep: true });

    model.data.user.profile.name = 'Jane';
    await waitFor(20);

    expect(callback).toHaveBeenCalled();
    const [newValue] = callback.mock.calls[0];
    expect(newValue.profile.name).toBe('Jane');
  });

  it('should stop watching and run cleanup on stop', async () => {
    const model = new Reactive({ count: 0 });
    const callback = mock();
    const cleanup = mock();

    const stop = model.watch('count', (newValue, oldValue, onCleanup) => {
      callback(newValue, oldValue);
      onCleanup(cleanup);
    });

    model.data.count = 1;
    await waitFor(20);
    stop();
    model.data.count = 2;
    await waitFor(20);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('should batch updates', () => {
    const model = new Reactive({ count: 0, total: 0 });

    // Spy on the store's batch method
    model.store.batch = mock();

    const callback = () => {
      model.data.count = 1;
      model.data.total = 100;
    };

    model.batch(callback);

    expect(model.store.batch).toHaveBeenCalled();
  });

  it('should validate paths', () => {
    const model = new Reactive({ user: { name: 'John' } });

    expect(model.validatePath('user.name')).toBeTrue();
    expect(model.validatePath('user.age')).toBeFalse();
  });

  it('should save and restore state', () => {
    const model = new Reactive({ count: 0 });

    // Spy on the stateManager's methods
    model.stateManager.saveState = mock(() => JSON.stringify({ data: { count: 0 }, timestamp: 1747033007280 }));
    model.stateManager.restoreState = mock();

    model.save();
    expect(model.stateManager.saveState).toHaveBeenCalled('Save state not called');

    model.restore();
    expect(model.stateManager.restoreState).toHaveBeenCalled('Restore state not called');
  });

  it('should create and restore snapshots', async () => {
    const model = new Reactive({ count: 0 }, { debug: false });

    // Spy on the stateManager's methods
    model.stateManager.createSnapshot = mock(() => JSON.stringify({ data: { count: 0 }, timestamp: 1747033007280 }));
    model.stateManager.restoreSnapshot = mock();

    const snapshot = model.snapshot();
    expect(model.stateManager.createSnapshot).toHaveBeenCalled('Create snapshot not called');

    model.snapshot(snapshot);
    expect(model.stateManager.restoreSnapshot).toHaveBeenCalled('Restore snapshot not called');
  });

  it('should enable and disable auto-save', () => {
    const model = new Reactive({ count: 0 });

    // Spy on the stateManager's methods
    model.stateManager.enableAutoSave = mock();
    model.stateManager.disableAutoSave = mock();

    model.autoSave(1000);
    model.autoSave(null);

    expect(model.stateManager.enableAutoSave).toHaveBeenCalled();
    expect(model.stateManager.disableAutoSave).toHaveBeenCalled();
  });

  it('should register and use plugins', async () => {
    class MyPlugin extends ReactivePlugin {
      constructor(reactive, options) {
        super(reactive);
        this.options = options;
        this.reactive = reactive;
      }

      run() {
        this.reactive.data.count = 10; // У batch змінювати можна безпосередньо
      }
    }

    const reactive = new Reactive(
      {
        count: 2,
      },
      {
        plugins: [{ name: 'test', plugin: MyPlugin, options: { someOption: true } }],
      },
    );

    expect(() => {
      reactive.registerPlugin('test', MyPlugin);
    }).toThrow();

    reactive.usePlugin('test');
    await waitFor(100); // Wait for the plugin to run
    expect(reactive.data.count).toBe(10);

    // Clean up
    reactive.removePlugin('test');
    expect(reactive.plugins.has('test')).toBeFalse();
  });

  it('should destroy the model', () => {
    const reactive = new Reactive();

    // Spy on the dom's and store's destroy methods
    reactive.dom.destroy = mock();
    reactive.store.destroy = mock();

    reactive.destroy();

    expect(reactive.dom.destroy).toHaveBeenCalled();
    expect(reactive.store.destroy).toHaveBeenCalled();
  });
});
