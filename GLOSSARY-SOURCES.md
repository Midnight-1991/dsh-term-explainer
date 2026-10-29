# 术语库调研与接入报告（1.3.0）

调研目标：为 `dsh-term-explainer` 的离线词典寻找**许可宽松、可机读、含中文释义**的 GitHub 术语库，
把内置词典从 330 条扩充到更大规模。执行提示词见 [`PROMPT-GLOSSARY-EXPANSION.md`](./PROMPT-GLOSSARY-EXPANSION.md)。

## 结论

| 指标 | 1.2.1 | 1.3.0 |
| --- | --- | --- |
| 词典总量 | 330 | **577** |
| 其中人工维护 | 330 | 330 |
| 其中外部导入 | 0 | 247（来自 316 条候选，去重 69 条） |
| 来源许可证 | — | CC-BY-4.0 / Apache-2.0 / MIT |

## 候选评估

| 仓库 | 星数 | 许可证 | 数据规模/格式 | 中文释义 | 结论 |
| --- | --- | --- | --- | --- | --- |
| `kubernetes/website` | 大型官方仓库 | **CC-BY-4.0** | `content/zh-cn/docs/reference/glossary` 163 个 md，frontmatter 含 `title`/`short_description`/`aka`/`tags` | ✅ 官方中文一句话释义 | **接入（162 条）** |
| `cncf/glossary` | 726 | **Apache-2.0** | `content/{en,zh-cn}` 96/77 个 md，frontmatter 含 `title`/`category`/`tags`，正文分「是什么/解决的问题/如何帮助」 | ✅ 多段中文定义（截取首段） | **接入（63 条）** |
| `YqqLikeGit/ai-heihua-zh` | 1 | **MIT** | `glossary/index.json`，133 词条，字段 `{id,cat,zh,en,one,analogy}` | ✅ 一句话「人话」解释 | **接入（91 条，跳过与人工词典重叠的基础 CS 词）** |
| `EarsEyesMouth/computerese-cross-references` | 1040 | MIT | 单个 README.md（144 KB、1204 行）Markdown 表格，EN → 中文译名 | ❌ 只有译名，无释义 | 仅作对照参考；若将来需要扩充别名映射可用 |
| `jiqizhixin/Artificial-Intelligence-Terminology-Database` | 2041 | **CC BY-NC-SA 4.0** | `data/*.md` 词表 | ❌ 主要是英中对照 | 排除：NC 禁止商用 + SA 传染 |
| `mdn/translated-content` | 2041 | NOASSERTION（MDN 内容 CC-BY-SA） | `files/zh-cn/glossary` **602** 条 md，含中文定义 | ✅ 质量高、数量大 | 排除：SA 与 MIT 发布冲突；列为 v2 候选（需双许可方案） |
| `dahlia/cjk-compsci-terms` | 160 | CC-BY-SA-4.0 | 多语言对照表 | ❌ 无释义 | 排除：SA |
| `gaearon/whatthefuck.is` | 3036 | NOASSERTION（posts: All rights reserved） | MDX 英文词条 | ❌ 英文 | 排除：保留所有权利 |
| `parADITE/frontend-encyclopedia` | 249 | MIT | Markdown 表格，英文一句话定义 | ❌ 英文 | 暂不接入（英文释义，需翻译） |
| `hemanth/functional-programming-jargon` | 18744 | MIT | 英文 FP 术语 | ❌ 英文 | 暂不接入 |
| `rust-lang-cn/english-chinese-glossary-of-rust` | 156 | CC0-1.0 | Rust 术语中英对照 | ❌ 无释义 | 可作别名来源 |
| `JuanitoFatas/Computer-Science-Glossary` | 400 | 无 LICENSE | `dict.textile` 94 KB | ❌ 译名 | 排除：无许可证 |
| `jeffreybaoshenlee/IT-Terms-EN-CN` | 59 | NOASSERTION | 分卷 Markdown 中英对照 | ❌ 译名 | 排除：许可证不明 |
| `nirholas/cloud-computing` | 23 | NOASSERTION | README 英文云术语表 153 条 | ❌ 英文 | 排除：许可证不明 |
| `Shrbuz/JargonBuster` | 1 | MIT | 静态站 + 数据 | 部分 | 未采用（数据未结构化，规模小于已选来源） |

## 接入实现

```
scripts/sync-external-glossary.mjs    # 从上游 sparse clone 生成 data/external-glossary.json
scripts/embed-external-glossary.mjs   # 把 JSON 嵌入 client.js 的 EXTERNAL-GLOSSARY 标记块
data/external-glossary.json           # 生成物：316 条候选 + 每个来源的 repo/license/commit/条数
```

重新生成：

```sh
mkdir -p /tmp/glossary-src && cd /tmp/glossary-src
git clone --depth 1 --filter=blob:none --sparse https://github.com/kubernetes/website.git k8s-website
(cd k8s-website && git sparse-checkout set content/zh-cn/docs/reference/glossary content/en/docs/reference/glossary LICENSE)
git clone --depth 1 --filter=blob:none --sparse https://github.com/cncf/glossary.git cncf-glossary
(cd cncf-glossary && git sparse-checkout set content/zh-cn content/en LICENSE)
git clone --depth 1 https://github.com/YqqLikeGit/ai-heihua-zh.git ai-heihua

cd <repo>/term-glossary
node scripts/sync-external-glossary.mjs /tmp/glossary-src
node scripts/embed-external-glossary.mjs
```

处理规则：

- **清洗**：剥离 HTML 注释 / Markdown 链接与强调 / 短代码，压缩空白；释义截断到 ≤150 字并补中文句号。
- **分类映射**：Kubernetes 按 `tags`（security→安全、networking→网络、tool/operation/core-object/architecture/workload→云原生与 DevOps、fundamental→系统、community→工程实践）；CNCF 先按 frontmatter `category`，网络/安全标签优先；AI 黑话按 `cat`（ai/cursor→AI、web→前端、github→工程实践）。
- **去重**：规范化键 = 小写 + 去括号内英文 + 去空格/下划线/连字符；人工词条与已有别名优先，重复 69 条被跳过。
- **别名**：英文全称、`aka`、缩写自动进入 `aliases`，使中英文都能命中扫描器。

## 合规

- Kubernetes 网站文档：CC-BY-4.0，需署名与标注修改（已截断释义、重映射分类）。
- CNCF Glossary：Apache-2.0，保留版权与许可声明。
- ai-heihua-zh：MIT，保留版权声明。
- 完整声明见 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)。

## 后续可选项

1. **MDN 602 条**：质量最高的一批 Web 术语；需为数据文件单独采用 CC-BY-SA 2.5 或重写释义后才能并入 MIT 包。
2. **computerese 1000+ 中英对照**：可用于生成别名（同一概念的多种中文译名），提升中文命中率。
3. 继续扩充人工词条（数据库/算法/操作系统等当前稀疏分类），优先补高热度术语。
