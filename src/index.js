import Reactive from './core/reactive.js';
import ReactivePlugin from './plugin/index.js';

const version = '__VERSION__';
const build_time = '__BUILD_TIME__';

Reactive.info = () => {
  console.info(
    `%c Reactive %c v${version} %c ${build_time} `,
    'color: white; font-weight: bold; background: #0080fe',
    'color: white; background: darkgreen',
    'color: white; background: #0080fe;',
  );
};

export default Reactive;
export { Reactive, ReactivePlugin };
