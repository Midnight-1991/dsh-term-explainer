/**
 * Offline smoke test for the term-glossary Client module.
 *
 * Loads client.js inside a VM with a fake `window.__ModuleLoader__`, a tiny
 * React stand-in (with hook state persistence, so click handlers can be
 * exercised across renders), a fake DOM for the overlay keydown listener, and
 * a fake Cordis client context. Exercises the scanner, both registered
 * components and the nested explanation views without a browser.
 *
 * Run: node scripts/smoke.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const clientUrl = new URL('../client.js', import.meta.url);
const source = fs.readFileSync(clientUrl, 'utf8');

let factory;
const sandbox = {
  console,
  window: {
    __TERM_GLOSSARY_DEV__: true,
    __ModuleLoader__: {
      load(definition) {
        factory = definition.factory;
      },
    },
  },
};
vm.runInNewContext(source, sandbox, { filename: 'client.js' });
assert.equal(typeof factory, 'function', 'client module should call the loader');

/* ---------------------------------------------------------------- React */

const h = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(4) });

let currentComponent = null;
let hookIndex = 0;
let renderDepth = 0;
let effectQueue = [];
const hookStores = new WeakMap();

const getHookStore = () => {
  let store = hookStores.get(currentComponent);
  if (!store) {
    store = { values: [], refs: [], memoValues: [], memoDeps: [], effectDeps: [] };
    hookStores.set(currentComponent, store);
  }
  return store;
};

const sameDeps = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (!Object.is(a[index], b[index])) return false;
  }
  return true;
};

const react = {
  createElement: h,
  useState(initial) {
    const store = getHookStore();
    const index = hookIndex;
    hookIndex += 1;
    if (!(index in store.values)) {
      store.values[index] = typeof initial === 'function' ? initial() : initial;
    }
    const setState = (next) => {
      store.values[index] = typeof next === 'function' ? next(store.values[index]) : next;
    };
    return [store.values[index], setState];
  },
  useEffect(effect, deps) {
    const store = getHookStore();
    const index = hookIndex;
    hookIndex += 1;
    const previous = store.effectDeps[index];
    if (previous && sameDeps(previous, deps)) return;
    store.effectDeps[index] = deps ? deps.slice() : null;
    effectQueue.push(effect);
  },
  useMemo(factory, deps) {
    const store = getHookStore();
    const index = hookIndex;
    hookIndex += 1;
    if (!(index in store.memoValues) || !sameDeps(store.memoDeps[index], deps)) {
      store.memoValues[index] = factory();
      store.memoDeps[index] = deps ? deps.slice() : null;
    }
    return store.memoValues[index];
  },
  useCallback(fn, deps) {
    return react.useMemo(() => fn, deps);
  },
  useRef(initial) {
    const store = getHookStore();
    const index = hookIndex;
    hookIndex += 1;
    if (!(index in store.refs)) store.refs[index] = { current: initial === undefined ? null : initial };
    return store.refs[index];
  },
};

const plugin = factory((name) => {
  if (name === 'react') return react;
  throw new Error('unexpected require: ' + name);
});

/* ------------------------------------------------------- fake Cordis ctx */

const registrations = new Map();
const ctx = {
  locale: {
    register(ns, dicts) {
      assert.equal(ns, 'term-glossary');
      assert.ok(dicts.zh && dicts.en, 'both locale dictionaries must be registered');
      assert.equal(dicts.zh['action.label'], '术语');
      assert.ok(dicts.zh['panel.explainTerm'], 'nested-explanation copy must be registered');
      return () => {};
    },
  },
  effect(fn) {
    const dispose = fn();
    return dispose;
  },
  slots: {
    inject(name, callback) {
      return callback();
    },
    register(options, Component) {
      assert.ok(options.name, 'registration needs a slot name');
      assert.equal(options.locale, 'term-glossary');
      registrations.set(options.id, { options, Component });
      return { id: options.id, dispose() {} };
    },
  },
};

assert.equal(JSON.stringify(plugin.inject), JSON.stringify(['slots', 'locale']));
plugin.apply(ctx);
assert.ok(registrations.has('term-glossary'), 'assistant-actions entry registered');
assert.ok(registrations.has('term-glossary-panel'), 'shell.overlay entry registered');
assert.equal(registrations.get('term-glossary').options.name, 'conversation.chat.assistant-actions');
assert.equal(registrations.get('term-glossary-panel').options.name, 'shell.overlay');

const dev = sandbox.window.__termGlossaryDev;
assert.ok(dev && typeof dev.explainSegments === 'function', 'dev hook should be exposed while testing');

/* ------------------------------------------------- fake DOM for the modal */

/* Installed after apply(), so installStyles() keeps taking its no-DOM path. */
const keydownListeners = [];
sandbox.document = {
  activeElement: null,
  addEventListener(type, fn) {
    if (type !== 'keydown') return;
    if (!keydownListeners.includes(fn)) keydownListeners.push(fn);
  },
  removeEventListener(type, fn) {
    const index = keydownListeners.indexOf(fn);
    if (index >= 0) keydownListeners.splice(index, 1);
  },
  querySelector() {
    return null;
  },
  contains() {
    return false;
  },
};
sandbox.setTimeout = (fn) => {
  if (typeof fn === 'function') {
    try {
      fn();
    } catch (error) {
      /* focus attempts are best effort */
    }
  }
  return 1;
};
sandbox.clearTimeout = () => {};

const pressEscape = () => {
  for (const listener of keydownListeners.slice()) {
    listener({ key: 'Escape', shiftKey: false, preventDefault() {}, stopPropagation() {} });
  }
};

/* ------------------------------------------------------- tiny renderer */

const t = (key, params) => {
  const copy = {
    'action.label': '术语',
    'action.aria': '解释术语 · 共 {count} 个',
    'action.title': '解释术语 · 共 {count} 个',
    'panel.title': '计算机术语解释',
    'panel.terminology': '术语',
  };
  let text = copy[key] || key;
  if (params) for (const [name, value] of Object.entries(params)) text = text.replaceAll('{' + name + '}', String(value));
  return text;
};

const flushEffects = () => {
  const queue = effectQueue;
  effectQueue = [];
  for (const effect of queue) {
    try {
      effect();
    } catch (error) {
      console.warn('effect failed', error);
    }
  }
};

const renderNodes = (tree) => {
  if (tree === null || tree === undefined || tree === false) return [];
  if (typeof tree === 'string' || typeof tree === 'number') return [{ text: String(tree) }];
  if (Array.isArray(tree)) return tree.flatMap(renderNodes);
  if (typeof tree.type === 'function') {
    const previousComponent = currentComponent;
    const previousIndex = hookIndex;
    currentComponent = tree.type;
    hookIndex = 0;
    let output;
    try {
      output = tree.type(tree.props);
    } finally {
      currentComponent = previousComponent;
      hookIndex = previousIndex;
    }
    return renderNodes(output);
  }
  const props = tree.props || {};
  const children = tree.children.flatMap(renderNodes);
  return [{ type: tree.type, props, children }];
};

const render = (tree) => {
  renderDepth += 1;
  const nodes = renderNodes(tree);
  renderDepth -= 1;
  if (renderDepth === 0) flushEffects();
  return nodes;
};

const flattenText = (nodes) =>
  nodes
    .map((node) => (node.text !== undefined ? node.text : flattenText(node.children || [])))
    .join('');

const findByClass = (nodes, className) => {
  const hits = [];
  const walk = (list) => {
    for (const node of list) {
      if (node.props && node.props.className === className) hits.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return hits;
};

/* ------------------------------------------------------------- fixtures */

const SAMPLE = [
  '这条链路里，API 网关做了限流和熔断，后端服务通过 gRPC 调用向量数据库。',
  '',
  '检索先用 HNSW 做近似最近邻，再用 RAG 把上下文拼进 Prompt，交给 LLM 生成答案；',
  '流式输出用 SSE 推送，避免长连接阻塞。注意 SQL 注入与 XSS 风险，也别忘了 CSRF Token。',
  '',
  '前端用 TypeScript 加 React 18，打包器是 Vite；构建走 CI 流水线，用 Docker 镜像部署到 Kubernetes。',
  '配置通过环境变量注入，敏感凭据放在密钥管理里。这个 rest 只是普通英文单词，REST 才是接口风格。',
  '',
  '排查问题看链路追踪和 P99 延迟，同时关注 P95 与 P50；缓存穿透用布隆过滤器挡住，会话的投影由上下文压缩维护。',
].join('\n');

const node = { kind: 'assistant', messageId: 'msg-1', blocks: [{ kind: 'text', text: SAMPLE }] };
const chat = { legacy: { nodes: [node] } };

const Action = registrations.get('term-glossary').Component;
const Panel = registrations.get('term-glossary-panel').Component;

const actionProps = { messageId: 'msg-1', useChat: (selector) => selector(chat), t };
const actionTree = render(h(Action, actionProps));
assert.equal(actionTree.length, 1, 'action should render for a message with terms');
const button = actionTree[0];
assert.equal(button.type, 'button');
assert.equal(button.props.className, 'tg-action');
assert.ok(Number(button.props['aria-label'].match(/(\d+)/)[1]) > 0, 'aria-label carries the term count');

/* The scanner must ignore terms when the message has none. */
const emptyAction = render(h(Action, { messageId: 'msg-2', useChat: (selector) => selector({ legacy: { nodes: [] } }), t }));
assert.equal(emptyAction.length, 0, 'no action for unknown message');

/* Open the panel through the action's real click handler. */
button.props.onClick();

const panelTree = render(h(Panel, { t }));
assert.equal(panelTree.length, 1, 'panel should render while open');
assert.equal(panelTree[0].props.role, 'presentation');
const cards = findByClass(panelTree, 'tg-term');
assert.ok(cards.length >= 25, 'expected a rich term list, got ' + cards.length);

const panelText = flattenText(panelTree);
for (const term of ['API 网关', '限流', '熔断', 'gRPC', '向量数据库', 'HNSW', 'RAG', 'LLM', 'SSE', 'SQL 注入', 'XSS', 'CSRF', 'React', 'Vite', 'Docker', 'Kubernetes', '环境变量', '链路追踪', '布隆过滤器', '投影', '上下文压缩']) {
  assert.ok(panelText.includes(term), 'panel should explain ' + term);
}

/* Case-sensitive entries: lowercase "react"/"rest" must not be matched. */
assert.ok(!panelText.includes('react 18'), 'lowercase react must not match the case-sensitive React entry');
assert.ok(panelText.includes('REST'), 'uppercase REST should match');
assert.ok(panelText.includes('P99'), 'P99 should be detected');
assert.ok(panelText.includes('99 分位延迟'), 'P99 keeps its own explanation');
assert.ok(panelText.includes('95 分位延迟'), 'P95 gets its own explanation, not the P99 one');
assert.ok(panelText.includes('中位数'), 'P50 gets the median explanation');

/* Dialog accessibility: the title element is the accessible name. */
const dialog = findByClass(panelTree, 'tg-card')[0];
assert.equal(dialog.props['aria-labelledby'], 'term-glossary-panel-title');
const title = findByClass(panelTree, 'tg-title')[0];
assert.equal(title.props.id, 'term-glossary-panel-title');

/* ------------------------------------------- nested (drill-down) views */

/* Every dictionary term inside an explanation becomes a button. */
const explainSource = '缓存穿透可用布隆过滤器或空值缓存兜底';
const explainSegments = dev.explainSegments(explainSource, '缓存穿透');
assert.equal(explainSegments.map((segment) => segment.text).join(''), explainSource, 'segments must reproduce the explanation');
assert.ok(explainSegments.some((segment) => segment.entry && segment.entry.term === '布隆过滤器'), '布隆过滤器 should be clickable inside an explanation');
assert.ok(explainSegments.some((segment) => segment.entry && segment.entry.term === '缓存'), '缓存 should be clickable too');
assert.ok(!explainSegments.some((segment) => segment.entry && segment.entry.term === '缓存穿透'), 'a term must not link to itself');
assert.ok(dev.explainSegments('没有术语的句子', '缓存').every((segment) => !segment.entry), 'plain sentences stay plain');

const listInline = findByClass(panelTree, 'tg-inline-term');
assert.ok(listInline.length >= 20, 'explanations should expose clickable terms, got ' + listInline.length);

/* A card never links to its own term. */
for (const card of cards) {
  const cardName = flattenText(findByClass([card], 'tg-term-name'));
  for (const link of findByClass([card], 'tg-inline-term')) {
    assert.notEqual(link.props['data-term'], cardName, 'term ' + cardName + ' must not link to itself');
  }
}

/* Pick a term whose own explanation mentions other dictionary terms. */
const seed = listInline.find((link) => {
  const entry = dev.findEntry(link.props['data-term']);
  if (!entry) return false;
  return dev.explainSegments(entry.explanation, entry.term).some((segment) => segment.entry);
});
assert.ok(seed, 'expected an explanation that mentions another dictionary term');
const firstTerm = seed.props['data-term'];
seed.props.onClick({ currentTarget: null });

const detailTree = render(h(Panel, { t }));
assert.equal(flattenText(findByClass(detailTree, 'tg-title')), firstTerm, 'clicking a term inside an explanation opens its own explanation');
assert.equal(findByClass(detailTree, 'tg-back').length, 1, 'drill-down view offers a back button');
assert.equal(findByClass(detailTree, 'tg-term').length, 1, 'drill-down shows one focused term card');
assert.ok(flattenText(detailTree).includes('panel.escBack'), 'footer advertises Esc as "back" inside a drill-down');
const firstEntry = dev.findEntry(firstTerm);
assert.ok(flattenText(detailTree).includes(firstEntry.explanation.slice(0, 10)), 'drill-down shows the secondary explanation');

/* A second level of drill-down must work too. */
const detailInline = findByClass(detailTree, 'tg-inline-term');
assert.ok(detailInline.length >= 1, 'the secondary explanation should keep offering deeper terms');
const secondTerm = detailInline[0].props['data-term'];
detailInline[0].props.onClick({ currentTarget: null });
const deepTree = render(h(Panel, { t }));
assert.equal(flattenText(findByClass(deepTree, 'tg-title')), secondTerm, 'second-level drill-down opens');
assert.equal(findByClass(deepTree, 'tg-back').length, 1);

/* Back button pops one level. */
findByClass(deepTree, 'tg-back')[0].props.onClick();
const afterBack = render(h(Panel, { t }));
assert.equal(flattenText(findByClass(afterBack, 'tg-title')), firstTerm, 'back returns to the previous explanation');

/* Esc pops a drill-down, and only closes the panel on the term list. */
pressEscape();
const afterEsc = render(h(Panel, { t }));
assert.equal(flattenText(findByClass(afterEsc, 'tg-title')), '计算机术语解释', 'Esc from a drill-down returns to the term list');
assert.ok(flattenText(afterEsc).includes('panel.escHint'), 'footer advertises Esc as "close" on the term list');
pressEscape();
assert.equal(render(h(Panel, { t })).length, 0, 'Esc on the term list closes the panel');

/* Substring safety: REST must not match inside RESTful-style Latin words. */
const boundaryTree = render(h(Action, {
  messageId: 'msg-3',
  useChat: (selector) => selector({ legacy: { nodes: [{ kind: 'assistant', messageId: 'msg-3', blocks: [{ kind: 'text', text: 'RESTful 与 reactjs 与 async/await 与 Node.js' }] }] } }),
  t,
}));
assert.equal(boundaryTree.length, 1);
boundaryTree[0].props.onClick();
const boundaryText = flattenText(render(h(Panel, { t })));
assert.ok(!boundaryText.includes('REST'), 'REST must not match inside RESTful');
assert.ok(boundaryText.includes('async/await'), 'async/await should be detected');
assert.ok(boundaryText.includes('Node.js'), 'Node.js should be detected');

/* Markdown noise must be stripped from rendered context snippets. */
const cleaned = dev.cleanInline('**幂等**与[术语表](https://example.com/glossary)，重试用 `指数退避`\n> 引用 `a`');
assert.ok(!cleaned.includes('**'), 'markdown emphasis markers must be stripped');
assert.ok(!cleaned.includes('](http'), 'markdown link syntax must be stripped');
assert.ok(!cleaned.includes('`'), 'inline code backticks must be stripped');
assert.ok(!cleaned.includes('> '), 'blockquote markers must be stripped');
assert.ok(cleaned.includes('幂等') && cleaned.includes('术语表') && cleaned.includes('指数退避'));
assert.equal(cleaned, '幂等与术语表，重试用 指数退避 引用 a');

/* Conservative cleaning: code identifiers and glob patterns must survive untouched. */
assert.equal(dev.cleanInline('调用 `__ModuleLoader__.load` 并匹配 **/*.ts'), '调用 __ModuleLoader__.load 并匹配 **/*.ts');

/* The scanner itself stays raw: offsets and hit text are never rewritten. */
const rawSource = '前缀 **加粗** API 网关 后缀';
const rawStart = rawSource.indexOf('API 网关');
const rawSnippet = dev.contextSnippet(rawSource, rawStart, rawStart + 'API 网关'.length);
assert.equal(rawSnippet.hit, 'API 网关');
assert.ok(rawSnippet.before.includes('**'), 'scanner keeps raw markdown for offsets');

/* Close button must clear the panel. */
const panelRoot = render(h(Panel, { t }))[0];
const closeButton = findByClass(panelRoot.children, 'tg-close')[0];
closeButton.props.onClick();
assert.equal(render(h(Panel, { t })).length, 0, 'panel should unmount after close');

/* Long text throughput: 200 KB / ~340 dictionary terms. */
const big = SAMPLE.repeat(120);
const started = Date.now();
render(h(Action, {
  messageId: 'msg-big',
  useChat: (selector) => selector({ legacy: { nodes: [{ kind: 'assistant', messageId: 'msg-big', blocks: [{ kind: 'text', text: big }] }] } }),
  t,
}));
const elapsed = Date.now() - started;
console.log('scan of', big.length, 'chars took', elapsed, 'ms');
assert.ok(elapsed < 1500, 'scan too slow: ' + elapsed + 'ms');

console.log('OK — registry, scanner, action, panel and nested explanations all behave.');
