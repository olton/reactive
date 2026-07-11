import { describe, it, expect, mock } from '@olton/latte';
import EventManager from '../src/dom/event-manager.js';
import Reactive from '../src/index.js';

describe('EventManager modifiers', () => {
  const keyCases = [
    { modifier: 'enter', key: 'Enter', mismatch: 'Tab' },
    { modifier: 'tab', key: 'Tab', mismatch: 'Enter' },
    { modifier: 'delete', key: 'Delete', mismatch: 'Enter' },
    { modifier: 'delete', key: 'Backspace', mismatch: 'Enter' },
    { modifier: 'esc', key: 'Escape', mismatch: 'Enter' },
    { modifier: 'space', key: ' ', mismatch: 'Enter' },
    { modifier: 'up', key: 'ArrowUp', mismatch: 'ArrowDown' },
    { modifier: 'down', key: 'ArrowDown', mismatch: 'ArrowUp' },
    { modifier: 'left', key: 'ArrowLeft', mismatch: 'ArrowRight' },
    { modifier: 'right', key: 'ArrowRight', mismatch: 'ArrowLeft' },
  ];

  const systemCases = [
    { modifier: 'ctrl', prop: 'ctrlKey' },
    { modifier: 'alt', prop: 'altKey' },
    { modifier: 'shift', prop: 'shiftKey' },
    { modifier: 'meta', prop: 'metaKey' },
  ];

  const mouseButtonCases = [
    { modifier: 'left', button: 0, mismatch: 2 },
    { modifier: 'right', button: 2, mismatch: 0 },
    { modifier: 'middle', button: 1, mismatch: 0 },
  ];

  it('should parse event name and modifiers from descriptor', () => {
    const reactive = new Reactive();
    const eventManager = new EventManager({}, reactive);

    const parsed = eventManager.parseEventDescriptor('@submit.prevent.stop');

    expect(parsed.eventName).toBe('submit');
    expect(parsed.modifiers[0]).toBe('prevent');
    expect(parsed.modifiers[1]).toBe('stop');
  });

  it('should parse capture, once and passive modifiers', () => {
    const reactive = new Reactive();
    const eventManager = new EventManager({}, reactive);

    const parsed = eventManager.parseEventDescriptor('@click.capture.once.passive');

    expect(parsed.eventName).toBe('click');
    expect(parsed.modifiers[0]).toBe('capture');
    expect(parsed.modifiers[1]).toBe('once');
    expect(parsed.modifiers[2]).toBe('passive');
  });

  it('should apply .prevent modifier for click event', () => {
    const reactive = new Reactive({ onClick: () => {} });
    reactive.onClick = mock();

    const eventManager = new EventManager({}, reactive);
    const button = document.createElement('button');

    eventManager.bindEventHandler(button, 'click', 'onClick($event)', ['prevent']);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    button.dispatchEvent(event);

    expect(event.defaultPrevented).toBeTrue();
    expect(reactive.onClick).toHaveBeenCalled();
  });

  it('should apply .stop modifier and stop bubbling', () => {
    const reactive = new Reactive({ onClick: () => {} });
    reactive.onClick = mock();

    const eventManager = new EventManager({}, reactive);
    const parent = document.createElement('div');
    const child = document.createElement('button');
    parent.appendChild(child);

    const parentHandler = mock();
    parent.addEventListener('click', parentHandler);

    eventManager.bindEventHandler(child, 'click', 'onClick($event)', ['stop']);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    child.dispatchEvent(event);

    expect(reactive.onClick).toHaveBeenCalled();
    expect(parentHandler).not.toHaveBeenCalled();
  });

  it('should support multiple modifiers for submit event', () => {
    const reactive = new Reactive({ onSubmit: () => {} });
    reactive.onSubmit = mock();

    const eventManager = new EventManager({}, reactive);
    const wrapper = document.createElement('div');
    const form = document.createElement('form');
    wrapper.appendChild(form);

    const wrapperHandler = mock();
    wrapper.addEventListener('submit', wrapperHandler);

    eventManager.bindEventHandler(form, 'submit', 'onSubmit($event)', ['prevent', 'stop']);

    const event = new form.ownerDocument.defaultView.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);

    expect(event.defaultPrevented).toBeTrue();
    expect(reactive.onSubmit).toHaveBeenCalled();
    expect(wrapperHandler).not.toHaveBeenCalled();
  });

  it('should support modifier-only handler', () => {
    const reactive = new Reactive();
    const eventManager = new EventManager({}, reactive);
    const form = document.createElement('form');

    eventManager.bindEventHandler(form, 'submit', '', ['prevent']);

    const event = new form.ownerDocument.defaultView.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);

    expect(event.defaultPrevented).toBeTrue();
  });

  it('should call handler only for .self when event target is the element itself', () => {
    const reactive = new Reactive({ onClick: () => {} });
    reactive.onClick = mock();

    const eventManager = new EventManager({}, reactive);
    const parent = document.createElement('div');
    const child = document.createElement('button');
    parent.appendChild(child);

    eventManager.bindEventHandler(parent, 'click', 'onClick($event)', ['self']);

    const childClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    child.dispatchEvent(childClick);

    expect(reactive.onClick).not.toHaveBeenCalled();

    const parentClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    parent.dispatchEvent(parentClick);

    expect(reactive.onClick).toHaveBeenCalled();
  });

  it('should support .capture and handle parent before child', () => {
    const sequence = [];
    const reactive = new Reactive({
      parentClick: () => sequence.push('parent'),
    });
    reactive.parentClick = mock(() => sequence.push('parent'));

    const eventManager = new EventManager({}, reactive);
    const parent = document.createElement('div');
    const child = document.createElement('button');
    parent.appendChild(child);

    child.addEventListener('click', () => sequence.push('child'));
    eventManager.bindEventHandler(parent, 'click', 'parentClick($event)', ['capture']);

    child.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    const parentIndex = sequence.indexOf('parent');
    const childIndex = sequence.indexOf('child');

    expect(parentIndex).toBe(0);
    expect(childIndex).not.toBe(-1);
    expect(parentIndex < childIndex).toBeTrue();
  });

  it('should support .once and run handler only one time', () => {
    const reactive = new Reactive({ onClick: () => {} });
    reactive.onClick = mock();

    const eventManager = new EventManager({}, reactive);
    const button = document.createElement('button');

    eventManager.bindEventHandler(button, 'click', 'onClick($event)', ['once']);

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(reactive.onClick).toHaveBeenCalledTimes(1);
  });

  it('should pass passive option to addEventListener for .passive modifier', () => {
    const reactive = new Reactive({ onScroll: () => {} });
    reactive.onScroll = mock();

    const eventManager = new EventManager({}, reactive);
    const element = document.createElement('div');

    let capturedOptions;
    const originalAdd = element.addEventListener.bind(element);
    element.addEventListener = (type, handler, options) => {
      capturedOptions = options;
      originalAdd(type, handler, options);
    };

    eventManager.bindEventHandler(element, 'scroll', 'onScroll($event)', ['passive']);

    expect(capturedOptions.passive).toBeTrue();
    expect(capturedOptions.capture).toBeFalse();
    expect(capturedOptions.once).toBeFalse();
  });

  keyCases.forEach(({ modifier, key, mismatch }) => {
    it(`should support .${modifier} key modifier`, () => {
      const reactive = new Reactive({ onKey: () => {} });
      reactive.onKey = mock();

      const eventManager = new EventManager({}, reactive);
      const input = document.createElement('input');

      eventManager.bindEventHandler(input, 'keydown', 'onKey($event)', [modifier]);

      input.dispatchEvent(new KeyboardEvent('keydown', { key: mismatch, bubbles: true, cancelable: true }));
      expect(reactive.onKey).not.toHaveBeenCalled();

      input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      expect(reactive.onKey).toHaveBeenCalledTimes(1);
    });
  });

  systemCases.forEach(({ modifier, prop }) => {
    it(`should support .${modifier} system modifier for click event`, () => {
      const reactive = new Reactive({ onClick: () => {} });
      reactive.onClick = mock();

      const eventManager = new EventManager({}, reactive);
      const button = document.createElement('button');

      eventManager.bindEventHandler(button, 'click', 'onClick($event)', [modifier]);

      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(reactive.onClick).not.toHaveBeenCalled();

      button.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          [prop]: true,
        }),
      );
      expect(reactive.onClick).toHaveBeenCalledTimes(1);
    });
  });

  systemCases.forEach(({ modifier, prop }) => {
    it(`should support .${modifier} system modifier for keydown event`, () => {
      const reactive = new Reactive({ onKey: () => {} });
      reactive.onKey = mock();

      const eventManager = new EventManager({}, reactive);
      const input = document.createElement('input');

      eventManager.bindEventHandler(input, 'keydown', 'onKey($event)', [modifier]);

      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }),
      );
      expect(reactive.onKey).not.toHaveBeenCalled();

      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
          [prop]: true,
        }),
      );
      expect(reactive.onKey).toHaveBeenCalledTimes(1);
    });
  });

  it('should allow extra system modifiers for non-exact .ctrl', () => {
    const reactive = new Reactive({ onClick: () => {} });
    reactive.onClick = mock();

    const eventManager = new EventManager({}, reactive);
    const button = document.createElement('button');

    eventManager.bindEventHandler(button, 'click', 'onClick($event)', ['ctrl']);

    button.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        altKey: true,
        shiftKey: true,
      }),
    );

    expect(reactive.onClick).toHaveBeenCalledTimes(1);
  });

  it('should trigger .ctrl.exact only when only ctrl is pressed', () => {
    const reactive = new Reactive({ onClick: () => {} });
    reactive.onClick = mock();

    const eventManager = new EventManager({}, reactive);
    const button = document.createElement('button');

    eventManager.bindEventHandler(button, 'click', 'onClick($event)', ['ctrl', 'exact']);

    button.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
      }),
    );
    expect(reactive.onClick).toHaveBeenCalledTimes(1);

    button.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        altKey: true,
      }),
    );
    expect(reactive.onClick).toHaveBeenCalledTimes(1);
  });

  it('should trigger .exact only when no system modifiers are pressed', () => {
    const reactive = new Reactive({ onClick: () => {} });
    reactive.onClick = mock();

    const eventManager = new EventManager({}, reactive);
    const button = document.createElement('button');

    eventManager.bindEventHandler(button, 'click', 'onClick($event)', ['exact']);

    button.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(reactive.onClick).toHaveBeenCalledTimes(1);

    button.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        shiftKey: true,
      }),
    );
    expect(reactive.onClick).toHaveBeenCalledTimes(1);
  });

  mouseButtonCases.forEach(({ modifier, button, mismatch }) => {
    it(`should support .${modifier} mouse button modifier`, () => {
      const reactive = new Reactive({ onClick: () => {} });
      reactive.onClick = mock();

      const eventManager = new EventManager({}, reactive);
      const target = document.createElement('div');

      eventManager.bindEventHandler(target, 'click', 'onClick($event)', [modifier]);

      target.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: mismatch,
        }),
      );
      expect(reactive.onClick).not.toHaveBeenCalled();

      target.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button,
        }),
      );
      expect(reactive.onClick).toHaveBeenCalledTimes(1);
    });
  });
});
