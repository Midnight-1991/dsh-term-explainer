# dsh-term-explainer

Adds a **Terms** action to finished DeepSeek Harness assistant answers: it detects computer-science terms in the reply and opens a panel with Chinese explanations, occurrence counts and highlighted context.

为 DeepSeek Harness Web 界面增加「术语」入口：自动识别每条已完成回答中的计算机领域专有名词，一键弹出中文解释面板。

- **纯前端**：只注册 UI 槽位，不改宿主 DOM，不挂第二个 React 根节点。
- **离线词典**：内置 330 条术语（11 个分类），不调用模型、不发起网络请求、不产生 token 费用。
- **零干扰**：没有识别到术语时不渲染任何按钮；解释面板仅在你点击时打开。
- **主题与语言**：只用 Harness 主题令牌，深浅色自适应；界面文案跟随 `zh` / `en`。
- **可访问**：`role="dialog"` + `aria-labelledby`、焦点进入/归还、`Tab` 焦点循环、`Esc` 关闭、尊重 `prefers-reduced-motion`。

## 使用

1. 在一条已完成的技术回答的操作条里出现 `术语 N` 胶囊按钮（N = 唯一术语数）。
2. 点击打开面板：每个术语展示名称、英文全称、分类、提及次数、中文解释，以及最多 3 处可展开的原文上下文（术语高亮）。
3. `Esc`、点击遮罩或关闭按钮关闭面板。

入口只出现在**已完成**的 Assistant 消息上，行为与官方反馈按钮一致。

## 安装

方式一：插件市场（上架后）搜索 “Term Explainer” 安装。

方式二：从 npm 安装：

```sh
dsh plugin --profile web add dsh-term-explainer
```

方式三：从 GitHub 安装（需要本机已安装 dsh）：

```sh
dsh plugin --profile web add github:Midnight-1991/dsh-term-explainer
```

方式四：本地开发时直接用目录安装：

```sh
dsh plugin --profile web add /path/to/dsh-term-explainer
```

安装后刷新 Harness 页面即生效，插件管理页可随时禁用或卸载。

## 词典

内置 **330 条**计算机术语，分 11 类：编程语言与范式、前端与 Web、后端与架构、数据库与存储、网络与协议、云原生与 DevOps、安全与加密、AI 与大模型、系统与底层、工程实践、DeepSeek Harness。

扩展词条只需在 `client.js` 的 `GLOSSARY` 数组里加一行：

```js
// [规范名称, 英文全称, 分类, 中文解释, { aliases: ['别名'], cs: true }?]
['MCP', 'Model Context Protocol', 'ai', '模型上下文协议：让模型以标准方式调用外部工具与数据源。'],
```

匹配规则：

- 拉丁术语按**词边界**匹配（`API` 不会命中 `OpenAI`），默认大小写不敏感；`cs: true` 表示大小写敏感（`React` 不会命中小写 `react`）。
- 中文术语按子串匹配；同一位置重叠时**长词优先**（`缓存穿透` 优先于 `缓存`），不重复计数。
- 匹配器惰性构建并带小写预筛，40 KB 文本扫描约 25–40 ms；结果按消息文本缓存，聊天流更新不会重复扫描未变化的消息。

## 开发与测试

```sh
npm test        # node scripts/smoke.mjs
```

冒烟测试在 Node `vm` 中加载真实的 `client.js`，用极小的 React / Cordis 替身驱动两个组件，覆盖：locale 注册、槽位注册、词边界与大小写、重叠长词、Markdown 上下文清理、`aria-labelledby`、关闭逻辑、40 KB 文本性能。

目录：

| 文件 | 说明 |
| --- | --- |
| `package.json` | Bundle 清单（`dsh.bundle` + `dsh.client.platform = web`） |
| `cordis.patch.yml` | 向 Profile 插入插件行的组合补丁 |
| `index.js` | Host 半：空实现（能力全部在浏览器端） |
| `client.js` | Client 半：词典 + 扫描器 + 消息入口 + 解释面板（自包含，无构建步骤） |
| `PROMPT.md` | 驱动本实现的需求提示词（保留以便溯源） |
| `scripts/smoke.mjs` | 离线冒烟测试 |

## 隐私

插件不读取文件、不发起网络请求、不写本地存储，所有解释来自打包在 `client.js` 内的词典；扫描只处理当前消息的正文文本，并在内存中完成。

## License

MIT
