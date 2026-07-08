import Reactive from '/src/index.js';

let devToolsInstance = null;

const removeDevToolsUi = () => {
  const ids = ['reactive-devtools-panel', 'reactive-dev-tools-toggle-button', 'reactive-devtools-time-travel-dialog'];

  ids.forEach((id) => {
    const node = document.getElementById(id);
    if (node) {
      node.remove();
    }
  });
};

const app = new Reactive(
  {
    now: new Date().toLocaleTimeString('uk-UA'),
    counter: 0,
    step: 1,
    counterChanges: 0,
    lastAction: 'Система готова',
    devToolsStarted: false,

    user: {
      name: 'Оксана',
      city: 'Львів',
      role: 'Frontend Developer',
    },

    preferences: {
      newsletter: true,
    },

    newTodoTitle: '',
    newTodoPriority: 'normal',
    search: '',

    todos: [
      { title: 'Описати API в README', done: true, priority: 'normal' },
      { title: 'Додати тести для data-bind', done: false, priority: 'high' },
      { title: 'Перевірити edge cases циклів', done: false, priority: 'low' },
    ],

    gallery: {
      current: 0,
      images: [
        {
          src: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1400&q=80',
          alt: 'Code editor on laptop',
        },
        {
          src: 'https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=1400&q=80',
          alt: 'Circuit board close-up',
        },
        {
          src: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1400&q=80',
          alt: 'Programmer workspace',
        },
      ],
    },

    newsletterText() {
      return this.preferences.newsletter ? 'Увімкнено' : 'Вимкнено';
    },

    counterState() {
      return (
        this.counter === 0 ? 'standby'
        : this.counter > 0 ? 'growth'
        : 'rollback'
      );
    },

    filteredTodos() {
      const query = this.search.trim().toLowerCase();
      if (!query) {
        return this.todos;
      }

      return this.todos.filter((todo) => todo.title.toLowerCase().includes(query));
    },

    statsMap() {
      const total = this.todos.length;
      const done = this.todos.filter((todo) => todo.done).length;
      const open = total - done;
      return {
        total,
        done,
        open,
        progress: total === 0 ? '0%' : `${Math.round((done / total) * 100)}%`,
      };
    },

    isClearDisabled() {
      return !this.todos.some((todo) => todo.done);
    },

    currentImageSrc() {
      return this.gallery.images[this.gallery.current]?.src || '';
    },

    currentImageAlt() {
      return this.gallery.images[this.gallery.current]?.alt || 'Demo image';
    },

    galleryPosition() {
      return this.gallery.current + 1;
    },

    gallerySize() {
      return this.gallery.images.length;
    },

    snapshotUnavailable() {
      return !globalThis.__snapshot;
    },

    devToolsActionText() {
      return this.devToolsStarted ? 'Stop DevTools' : 'Run DevTools';
    },
  },
  {
    debug: false,
    useSimpleExpressions: true,
  },
);

app.addFormatter('user.name', (value) => String(value).replace(/\s+/g, ' ').trimStart());
app.addFormatter('user.city', (value) => String(value).trimStart());
app.addValidator('counter', (value) => Number.isFinite(Number(value)) && Number(value) <= 999 && Number(value) >= -999);

app.use(async (context, next) => {
  if (context.prop === 'newTodoTitle' && typeof context.newValue === 'string') {
    context.newValue = context.newValue.replace(/\s+/g, ' ').trimStart();
  }

  await next();
});

app.watch('counter', () => {
  app.data.counterChanges += 1;
});

app.init('#app');

setInterval(() => {
  app.data.now = new Date().toLocaleTimeString('uk-UA');
}, 1000);

globalThis.addTodo = () => {
  const title = app.data.newTodoTitle.trim();

  if (!title) {
    app.data.lastAction = 'Порожню задачу не додано';
    return;
  }

  app.batch(() => {
    app.data.todos.push({
      title,
      done: false,
      priority: app.data.newTodoPriority,
    });
    app.data.newTodoTitle = '';
    app.data.lastAction = `Додано задачу: ${title}`;
  });
};

globalThis.toggleLastTodo = () => {
  const lastIndex = app.data.todos.length - 1;

  if (lastIndex < 0) {
    app.data.lastAction = 'Немає задач для оновлення';
    return;
  }

  app.data.todos[lastIndex].done = !app.data.todos[lastIndex].done;
  app.data.lastAction = `Перемкнуто останню задачу (#${lastIndex + 1})`;
};

globalThis.removeCompletedTodos = () => {
  const before = app.data.todos.length;
  const filtered = app.data.todos.filter((todo) => !todo.done);

  app.data.todos = filtered;
  app.data.lastAction = `Видалено ${before - filtered.length} виконаних задач`;
};

globalThis.nextImage = () => {
  const total = app.data.gallery.images.length;
  app.data.gallery.current = (app.data.gallery.current + 1) % total;
  app.data.lastAction = 'Перемкнено зображення вперед';
};

globalThis.prevImage = () => {
  const total = app.data.gallery.images.length;
  app.data.gallery.current = (app.data.gallery.current - 1 + total) % total;
  app.data.lastAction = 'Перемкнено зображення назад';
};

globalThis.saveState = () => {
  const result = app.save();
  app.data.lastAction = result ? 'Стан збережено в localStorage' : 'Не вдалося зберегти стан';
};

globalThis.restoreState = () => {
  const result = app.restore();
  app.data.lastAction = result ? 'Стан відновлено з localStorage' : 'Немає збереженого стану';
};

globalThis.takeSnapshot = () => {
  globalThis.__snapshot = app.snapshot();
  app.data.lastAction = 'Snapshot створено';
};

globalThis.restoreSnapshot = () => {
  if (!globalThis.__snapshot) {
    app.data.lastAction = 'Snapshot ще не створено';
    return;
  }

  app.snapshot(globalThis.__snapshot);
  app.data.lastAction = 'Snapshot відновлено';
};

globalThis.startDevTools = () => {
  if (!devToolsInstance) {
    devToolsInstance = app.runDevTools({
      enabled: true,
      timeTravel: true,
      maxSnapshots: 50,
    });

    app.data.devToolsStarted = true;
    app.data.lastAction = 'DevTools запущено';
    return;
  }

  if (app.data.devToolsStarted) {
    devToolsInstance.options.enabled = false;
    removeDevToolsUi();
    app.data.devToolsStarted = false;
    app.data.lastAction = 'DevTools вимкнено';
    return;
  }

  devToolsInstance.options.enabled = true;
  if (!document.getElementById('reactive-devtools-panel')) {
    devToolsInstance.createDevToolsPanel();
  }
  devToolsInstance.updateDisplay();
  app.data.devToolsStarted = true;
  app.data.lastAction = 'DevTools увімкнено';
};
