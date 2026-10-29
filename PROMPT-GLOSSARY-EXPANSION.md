# 提示词：为术语解释插件扩充更大规模的术语库

> 本文档是需求方原始一句话需求「在 GitHub 搜索更大的术语库」的工程化改写版本，执行结果见
> [`GLOSSARY-SOURCES.md`](./GLOSSARY-SOURCES.md)。后续如再扩充词库，可直接按本文档执行。

## 1. 角色与任务

你是 `dsh-term-explainer`（DeepSeek Harness 术语解释插件）的维护者。当前内置词典为人工编写的
330 条计算机术语（11 个分类，中文释义）。请**在 GitHub 上检索、评估可复用的计算机术语库**，把
其中**许可宽松、数据可机读、中文释义质量可用**的部分并入内置词典，同时保证插件仍然离线、
自包含、可发布（npm / GitHub / DSH 插件市场）。

## 2. 输入与范围

- 现有实现：本仓库（`client.js` 单文件
  Client 模块，词典为 `GLOSSARY` 数组，行格式 `[中文名, 英文全称, 分类, 中文释义, { aliases?, cs? }?]`）。
- 检索渠道：GitHub Search API、GitHub raw / sparse clone、必要时的项目文档页。
- 范围外：改写插件架构、引入网络请求、引入模型调用、改动术语扫描/面板交互逻辑。

## 3. 任务分解

1. **检索**：至少覆盖三类关键词——`术语库 / 术语解释 / 名词解释`、`glossary / terminology / dictionary`、
   `computer science chinese / IT terms EN-CN`；同时检查已知权威来源（Kubernetes、CNCF、MDN、
   Microsoft Terminology 等）是否以仓库形式提供机读数据。
2. **评估**：对候选来源逐项记录：仓库规模/星数、**许可证**、数据格式（JSON/YAML/MD 表格）、
   词条数量、是否含中文释义、是否含英文全称/别名、可维护性（是否持续更新）。
3. **准入筛选**：只接受宽松许可证：MIT / Apache-2.0 / CC-BY-4.0 / CC0 / 公有领域。
   **禁止** CC-BY-SA（传染性 share-alike）、CC-BY-NC（禁止商用）、无 LICENSE / `NOASSERTION` 来源；
   被排除的来源必须写入调研报告并注明原因。
4. **接入**：新增可复现的同步脚本与嵌入脚本：
   - 从上游 sparse clone 读取；
   - 解析 frontmatter / JSON，清洗 Markdown 与链接，截断释义、补全中文句号；
   - 分类映射到现有 11 类；英文名/缩写进入 `aliases`；
   - 与现有 330 条（含别名）做规范化去重（忽略大小写、括号内英文、空格），**人工词条优先**；
   - 产出 `data/external-glossary.json`（含来源、许可证、upstream commit、条数），再嵌入 `client.js`
     的标记块内，保证运行期零网络请求、零构建步骤。
5. **合规**：新增 `THIRD_PARTY_NOTICES.md`，逐来源给出仓库、许可证、版权与修改说明；README 与
   `PROMPT.md` 同步词库规模、来源与重新生成命令。
6. **验证**：`npm test` 通过；新增断言覆盖「合并后无重复」「外部词条可被扫描器识别」「词典模式
   渲染全部词条」；真实浏览器截图确认词典模式与搜索展示扩展后的词条。
7. **交付**：版本号按 semver 升 MINOR（1.2.1 → 1.3.0），提交 GitHub 并发布 npm。

## 4. 硬性约束

- 词典必须**内嵌在 client 模块**里，运行时不发请求、不读文件、不调用模型。
- 外部词条不得覆盖或篡改人工词条；冲突时人工词条胜出。
- 所有新增来源必须有明确许可证，打包体积与加载性能可接受（词典总量控制在 ~1000 条内，
  单条释义 ≤ 150 字）。
- 同步/嵌入脚本必须可在本地重复执行，产物可 diff；缺失上游目录时给出清晰报错与准备命令。

## 5. 验收标准

1. 词典总量 ≥ 500 条，且新增条目全部具备中文释义、分类与可用的英文别名。
2. 合并结果无重复词条（规范化比较）；人工 330 条全部保留。
3. `npm test` 全绿，新增断言覆盖合并去重、外部词条扫描、词典全量渲染。
4. `THIRD_PARTY_NOTICES.md` 列出每个外部来源的许可证与修改说明；无 NC/SA/无许可证来源。
5. 真实界面（深色 + 浅色）中词典模式与搜索能展示新增词条，条数与数据一致。
6. 版本 1.3.0 已提交 GitHub、发布 npm，CI 通过。

## 6. 交付物

- `data/external-glossary.json`、`scripts/sync-external-glossary.mjs`、`scripts/embed-external-glossary.mjs`
- 更新后的 `client.js`（含生成标记块）、`README.md`、`PROMPT.md`、`THIRD_PARTY_NOTICES.md`
- `GLOSSARY-SOURCES.md`（候选评估表 + 排除原因 + 接入结果）
- 发布：GitHub commit、npm 版本、市场条目说明（如需要）
