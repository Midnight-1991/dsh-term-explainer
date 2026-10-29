# dsh-term-explainer

Adds a **Terms** action to finished DeepSeek Harness assistant answers: it detects computer-science terms in the reply and opens a panel with Chinese explanations, occurrence counts and highlighted context. Explanations are themselves term-aware — click a dotted term inside any explanation to drill into its own explanation, and go back level by level. The same panel can search, filter and sort terms, star favorites, export the list as Markdown or CSV, and the full dictionary is available from the settings page.

为 DeepSeek Harness Web 界面增加「术语」入口：自动识别每条已完成回答中的计算机领域专有名词，一键弹出中文解释面板。

- **纯前端**：只注册 UI 槽位，不改宿主 DOM，不挂第二个 React 根节点。
- **离线词典**：内置 577 条术语（11 个分类，含来自 Kubernetes/CNCF 等上游词库的导入词条），不调用模型、不发起网络请求、不产生 token 费用。
- **次级解释**：解释文本里的其他术语会自动变成可点击链接，点开继续查看下一层；支持多层钻取、逐级返回，并防止同一术语自我循环。
- **检索与筛选**：面板顶部支持关键词搜索、按分类筛选、三种排序（提及最多 / 出现顺序 / 名称），并可直接只看收藏。
- **收藏与导出**：可给术语打星、从设置页导入导出收藏（导入与现有收藏合并并提示新增条数）、面板底部一键复制 Markdown 或下载 CSV。
- **独立词典**：设置页内置完整词典入口，可随时查询任意词条；`Alt+D` 打开词典、`Alt+T` 重新打开最近一条回答的术语面板。
- **零干扰**：没有识别到术语时不渲染任何按钮；解释面板仅在你点击时打开。
- **主题与语言**：只用 Harness 主题令牌，深浅色自适应；界面文案跟随 `zh` / `en`。
- **可访问**：`role="dialog"` + `aria-labelledby`、焦点随视图移动（进入下一层聚焦返回按钮，退回时聚焦来源术语）、`Tab` 焦点循环、`Esc` 逐级返回/关闭、尊重 `prefers-reduced-motion`。

## 使用

1. 在一条已完成的技术回答的操作条里出现 `术语 N` 胶囊按钮（N = 唯一术语数）。
2. 点击打开面板：每个术语展示名称、英文全称、分类、提及次数、中文解释，以及最多 3 处可展开的原文上下文（术语高亮）。
3. 解释中的其他术语带**虚线下划线**：点击它会把面板切到该术语的解释（标题换成它、左侧出现返回按钮），可以继续往下点，形成多层钻取。
4. `Esc` 或左上角返回按钮退回上一层；在术语列表页按 `Esc`、点击遮罩或关闭按钮关闭面板。
5. 面板顶部的工具条可按关键词搜索、按分类筛选、切换排序（提及最多 / 出现顺序 / 名称），点 ⭐ 只看收藏。
6. 卡片右上角的星标可收藏术语；底部按钮把当前列表复制为 Markdown 或下载为 CSV。
7. 设置页「术语」分区提供查词与完整词典入口、收藏管理、行为开关与快捷键说明。

入口只出现在**已完成**的 Assistant 消息上，行为与官方反馈按钮一致。

## 术语词典与设置

「设置 → 术语」分区提供：

- **查词**：输入术语、英文全称或释义关键词，即时查看词条解释；
- **完整词典**：打开全部 577 条词条的浏览视图（同样支持搜索、筛选、排序与收藏）；
- **行为**：是否在操作条显示「术语 N」按钮、上下文片段数量（1–3 条）、面板默认排序；
- **收藏**：导出 / 导入收藏 JSON、清空收藏；
- **快捷键**：`Alt+D` 词典、`Alt+T` 最近回答、`Esc` 关闭/返回；在输入框、可编辑区域内不触发，宿主弹窗打开时让位。macOS 上为 `Option` 组合键；部分 Windows/Linux 浏览器把 `Alt+D`/`Alt+T` 用作保留键，此时请改用消息操作条或设置页入口。

收藏与设置只保存在当前浏览器的 `localStorage` 中，不会上传；清除浏览器站点数据会同时清除它们。

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

内置 **577 条**计算机术语（人工维护 330 条 + 外部导入 247 条），分 11 类：编程语言与范式、前端与 Web、后端与架构、数据库与存储、网络与协议、云原生与 DevOps、安全与加密、AI 与大模型、系统与底层、工程实践、DeepSeek Harness。

扩展词条只需在 `client.js` 的 `GLOSSARY` 数组里加一行：

```js
// [规范名称, 英文全称, 分类, 中文解释, { aliases: ['别名'], cs: true }?]
['MCP', 'Model Context Protocol', 'ai', '模型上下文协议：让模型以标准方式调用外部工具与数据源。'],
```

外部词条来源与许可证：Kubernetes website（CC-BY-4.0，162 条）、CNCF Glossary（Apache-2.0，63 条）、
ai-heihua-zh（MIT，91 条），详见 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) 与调研报告
[`GLOSSARY-SOURCES.md`](./GLOSSARY-SOURCES.md)。生成物为 `data/external-glossary.json`，由
`npm run glossary:sync` 从上游 sparse clone 重新生成、`npm run glossary:embed` 嵌入 `client.js`
的 `EXTERNAL-GLOSSARY` 标记块（人工词条优先，规范化去重）。

匹配规则：

- 拉丁术语按**词边界**匹配（`API` 不会命中 `OpenAI`），默认大小写不敏感；`cs: true` 表示大小写敏感（`React` 不会命中小写 `react`）。
- 中文术语按子串匹配；同一位置重叠时**长词优先**（`缓存穿透` 优先于 `缓存`），不重复计数。
- 匹配器惰性构建并带小写预筛，40 KB 文本扫描约 30–120 ms（随文本长度线性增长）；结果按消息文本缓存，聊天流更新不会重复扫描未变化的消息。
- 英文术语允许常见复数后缀（`APIs`、`tokens`），搜索同时匹配别名（`k8s`、`OOP`、`E2E`）。

## 开发与测试

```sh
npm test        # node scripts/smoke.mjs
```

冒烟测试在 Node `vm` 中加载真实的 `client.js`，用极小的 React / Cordis 替身驱动三个组件（操作条按钮、解释面板、设置分区），覆盖：locale 注册、三个槽位注册、词边界与大小写、英文复数、别名搜索、重叠长词、Markdown 上下文清理、`aria-labelledby`、释义内术语链接（含自我引用排除）、两层钻取与返回、`Esc` 逐级退栈、搜索/筛选/排序、收藏持久化与导入合并、合并词典去重与外部词条扫描、Markdown/CSV 导出（BOM 与公式注入防护）、相关术语跳转、词典模式、设置页开关与快捷键守卫、会话作用域的最近回答、关闭逻辑、40 KB 文本性能。

目录：

| 文件 | 说明 |
| --- | --- |
| `package.json` | Bundle 清单（`dsh.bundle` + `dsh.client.platform = web`） |
| `cordis.patch.yml` | 向 Profile 插入插件行的组合补丁 |
| `index.js` | Host 半：空实现（能力全部在浏览器端） |
| `client.js` | Client 半：词典 + 扫描器 + 消息入口 + 解释面板（自包含，无构建步骤） |
| `PROMPT.md` | 驱动本实现的需求提示词（保留以便溯源） |
| `scripts/smoke.mjs` | 离线冒烟测试 |
| `scripts/sync-external-glossary.mjs` | 从上游词库生成 `data/external-glossary.json` |
| `scripts/embed-external-glossary.mjs` | 将外部词条嵌入 `client.js` 标记块 |
| `data/external-glossary.json` | 外部词条生成物（含来源、许可证、upstream commit） |
| `THIRD_PARTY_NOTICES.md` | 外部词条来源与许可证声明 |
| `GLOSSARY-SOURCES.md` | 术语库调研、候选评估与排除原因 |

## 更新日志

- **1.3.0**：词典从 330 条扩充到 577 条——接入 Kubernetes website（CC-BY-4.0）、CNCF Glossary（Apache-2.0）与 ai-heihua-zh（MIT）三个宽松许可词库，新增可复现的 `glossary:sync` / `glossary:embed` 脚本、来源许可证声明与调研报告；人工词条优先、规范化去重，英语全称与缩写进入别名。
- **1.2.1**：修复独立审查发现的问题：别名搜索（`k8s` / `OOP` / `E2E`）、英文复数识别、跨 Markdown 边界的上下文片段残留、导入收藏改为合并并提示、CSV 加 UTF-8 BOM 与公式注入防护、Markdown 全单元格转义、快捷键在输入框/宿主弹窗内不再触发、最近回答按会话隔离、分类计数随筛选更新、设置页词典展示完整 330 条、发布包包含测试与提示词文件。
- **1.2.0**：面板搜索 / 分类筛选 / 排序、收藏与 Markdown·CSV 导出、相关术语推荐、完整词典入口、设置页与 `Alt+D` / `Alt+T` 快捷键。
- **1.1.0**：解释文本中的术语可点击，支持多层次级解释与逐级返回。
- **1.0.0**：首个版本：术语识别、消息入口、解释面板、330 条离线词典。

## 隐私

插件不读取文件、不发起网络请求、不上传任何内容；所有解释来自打包在 `client.js` 内的词典，扫描只处理当前消息的正文文本并在内存中完成。收藏与设置只写入当前浏览器 `localStorage` 的两个键（`dsh-term-explainer/favorites`、`dsh-term-explainer/settings`），可随时在设置页清空。

## License

代码与人工词条以 MIT 发布（`LICENSE`）；外部导入词条保留各自许可证，见
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)。
