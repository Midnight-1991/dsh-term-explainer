/**
 * Offline smoke test for the term-glossary Client module.
 *
 * Loads client.js inside a VM with a fake `window.__ModuleLoader__`, a tiny
 * React stand-in and a fake Cordis client context, then exercises the real
 * scanner and the two registered components without a browser.
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
const react = {
  createElement: h,
  useState(initial) {
    const state = { value: typeof initial === 'function' ? initial() : initial };
    const setState = (next) => {
      state.value = typeof next === 'function' ? next(state.value) : next;
    };
    return [state.value, setState];
  },
  useEffect() {},
  useMemo(fn) {
    return fn();
  },
  useCallback(fn) {
    return fn;
  },
  useRef() {
    return { current: null };
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

function render(tree) {
  if (tree === null || tree === undefined || tree === false) return [];
  if (typeof tree === 'string' || typeof tree === 'number') return [{ text: String(tree) }];
  if (Array.isArray(tree)) return tree.flatMap(render);
  if (typeof tree.type === 'function') return render(tree.type(tree.props));
  const props = tree.props || {};
  const children = tree.children.flatMap(render);
  return [{ type: tree.type, props, children }];
}

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
const dev = sandbox.window.__termGlossaryDev;
assert.ok(dev && typeof dev.cleanInline === 'function', 'dev hook should be exposed while testing');
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

console.log('OK — registry, scanner, action and panel all behave.');
