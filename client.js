/**
 * dsh-term-explainer — Client half.
 *
 * Adds a 「术语」 action to every finalized assistant message. The action scans
 * the message's text blocks against a built-in offline dictionary of computer
 * science terms and opens an overlay panel that lists each detected term with
 * a Chinese explanation, its occurrence count and inline context snippets.
 *
 * Everything runs in the browser: no Host service, no model call, no network,
 * no persistence. The Host half of this bundle is an empty plugin.
 */
(() => {
  'use strict';

  const loader = typeof window === 'undefined' ? undefined : window.__ModuleLoader__;
  if (!loader || typeof loader.load !== 'function') return;

  const PACKAGE_ID = 'dsh-term-explainer';
  const NS = 'term-glossary';
  const ACTION_CLASS = 'tg-action';
  const TITLE_ID = 'term-glossary-panel-title';
  const MAX_SNIPPETS = 3;
  const CONTEXT_PAD = 90;

  loader.load({
    id: PACKAGE_ID,
    factory(require) {
      const React = require('react');
      const h = React.createElement;

      /* ================================================================== *
       * Dictionary
       * ================================================================== */

      /** Category key -> localized label. */
      const CATEGORIES = {
        lang: { zh: '编程语言与范式', en: 'Languages & paradigms' },
        web: { zh: '前端与 Web', en: 'Frontend & Web' },
        server: { zh: '后端与架构', en: 'Backend & architecture' },
        db: { zh: '数据库与存储', en: 'Databases & storage' },
        net: { zh: '网络与协议', en: 'Network & protocols' },
        devops: { zh: '云原生与 DevOps', en: 'Cloud & DevOps' },
        security: { zh: '安全与加密', en: 'Security & crypto' },
        ai: { zh: 'AI 与大模型', en: 'AI & LLMs' },
        system: { zh: '系统与底层', en: 'Systems & internals' },
        practice: { zh: '工程实践', en: 'Engineering practice' },
        harness: { zh: 'DeepSeek Harness', en: 'DeepSeek Harness' },
      };

      /**
       * Compact term rows:
       *   [term, englishFullName, category, chineseExplanation, options?]
       * options: { aliases?: string[], cs?: boolean }
       *   aliases — extra spellings matched as the same term;
       *   cs      — case-sensitive matching (default: case-insensitive for
       *             Latin terms, always exact for Chinese terms).
       */
      const GLOSSARY = [
        // ---- 编程语言与范式 ------------------------------------------------
        ['DSL', 'Domain-Specific Language', 'lang', '领域特定语言：为某一特定领域设计的编程或描述语言（如 SQL、正则、YAML），比通用语言更简洁，但适用范围窄。'],
        ['AST', 'Abstract Syntax Tree', 'lang', '抽象语法树：源代码经解析后得到的树形结构，是编译器、格式化工具、静态分析和代码改写的基础中间表示。'],
        ['闭包', 'Closure', 'lang', '函数与其定义时所在词法环境的组合：内部函数即使在外部函数返回后，仍能访问外部变量。'],
        ['回调', 'Callback', 'lang', '把函数作为参数传给另一段代码、在特定时机被调用；异步编程的基础，但层层嵌套容易形成回调地狱。'],
        ['泛型', 'Generics', 'lang', '用类型参数表示"任意类型"，让容器和算法在保持类型安全的前提下复用，避免重复代码和强制类型转换。'],
        ['正则表达式', 'Regular Expression', 'lang', '用元字符描述字符串匹配模式的语法，广泛用于校验、提取与替换文本；不同语言的正则方言存在差异。'],
        ['柯里化', 'Currying', 'lang', '把接受多个参数的函数转换成一系列只接受一个参数的函数，便于复用和组合。'],
        ['函数式编程', 'Functional Programming', 'lang', '以纯函数和不可变数据为核心的编程范式，强调无副作用、可组合、易于推理和测试。'],
        ['面向对象编程', 'Object-Oriented Programming', 'lang', '以对象（数据与行为）为基本单位组织代码的范式，依赖封装、继承和多态。', { aliases: ['OOP'] }],
        ['SOLID', 'SOLID principles', 'lang', '面向对象设计的五条原则：单一职责、开闭、里氏替换、接口隔离、依赖倒置，用于提升可维护性。'],
        ['设计模式', 'Design Pattern', 'lang', '对反复出现的软件设计问题的可复用解决方案模板，如工厂、观察者、策略模式。'],
        ['中间件', 'Middleware', 'lang', '位于请求与业务处理之间、可串联的通用处理层，用于鉴权、日志、限流等横切逻辑。'],
        ['依赖注入', 'Dependency Injection', 'lang', '对象不自己创建依赖，而由外部容器传入，降低耦合、便于替换实现和测试。'],
        ['装饰器', 'Decorator', 'lang', '在不修改原代码的情况下包裹函数或类，为其添加日志、缓存、权限等横切行为。'],
        ['反射', 'Reflection', 'lang', '程序在运行时检查、调用或修改自身结构（类型、方法、属性）的能力。'],
        ['序列化', 'Serialization', 'lang', '把内存中的对象转换成字节流或文本（如 JSON）以便存储或传输；反向过程称为反序列化。'],
        ['反序列化', 'Deserialization', 'lang', '把存储或传输格式（如 JSON、二进制）还原成内存对象；对不可信数据的反序列化是常见安全风险。'],
        ['钩子', 'Hook', 'lang', '运行时预留的扩展点：框架在特定时机回调注册的函数，让插件不改核心代码即可介入流程。', { aliases: ['Hook'] }],
        ['副作用', 'Side Effect', 'lang', '函数除返回值外对外部世界产生的影响，如改全局变量、写文件、发请求；纯函数不应有副作用。', { aliases: ['Effect'] }],
        ['生命周期', 'Lifecycle', 'lang', '组件或对象从创建、更新到销毁的全过程；框架在各阶段提供钩子以插入逻辑。'],
        ['状态机', 'State Machine', 'lang', '用有限状态和状态间迁移描述行为的模型，能替代复杂条件分支，让状态流转清晰可验证。'],
        ['声明式', 'Declarative', 'lang', '只描述"想要什么结果"、由框架决定"怎么做"的写法（如 SQL、React），与命令式相对。'],
        ['惰性求值', 'Lazy Evaluation', 'lang', '表达式推迟到真正需要时才求值，可避免无用计算，并支持无限数据结构。'],
        ['类型推导', 'Type Inference', 'lang', '编译器根据上下文自动推断变量类型，无需手写类型标注，兼顾简洁与类型安全。'],
        ['鸭子类型', 'Duck Typing', 'lang', '不关心对象的具体类型，只检查它是否具备所需的方法（"走起来像鸭子就是鸭子"）；常见于动态语言。'],
        ['单例模式', 'Singleton', 'lang', '保证一个类在进程内只有一个实例并提供全局访问点的设计模式。'],
        ['事件驱动', 'Event-Driven', 'lang', '以事件（消息）驱动、通过发布/订阅解耦的系统模型，生产者无需知道谁消费。'],
        ['响应式编程', 'Reactive Programming', 'lang', '以数据流和变化传播为核心的编程范式：状态变化自动推动下游更新。'],
        ['流式输出', 'Streaming', 'lang', '服务端边生成边返回、客户端边收边渲染（如 SSE），不必等全部完成；大模型回答常见。'],
        ['并发', 'Concurrency', 'lang', '多个任务在同一时间段内交替推进（不等于同时执行），需要处理共享状态和竞态。'],
        ['并行', 'Parallelism', 'lang', '真正同时执行多个任务，通常依赖多核 CPU 或多台机器。'],
        ['阻塞', 'Blocking', 'lang', '调用在结果返回前一直占用线程/协程，期间无法处理其他任务。'],
        ['异步', 'Asynchronous', 'lang', '发起操作后不阻塞等待结果，完成时通过回调、Promise 或 await 通知。'],
        ['Promise', 'Promise', 'lang', '表示异步操作最终结果的对象，有 pending / fulfilled / rejected 三种状态，可用 then 或 await 组合。'],
        ['async/await', 'Async / Await', 'lang', '用接近同步的写法组织异步流程的语法糖，底层仍是 Promise 或协程。'],
        ['Lambda', 'Lambda', 'lang', '匿名函数：没有名字、可作为值传递的函数；在 AWS 里也指无服务器函数计算服务 Lambda。'],
        // ---- 前端与 Web ----------------------------------------------------
        ['DOM', 'Document Object Model', 'web', '浏览器把 HTML 解析成的树形对象模型，脚本通过它读写页面的结构与样式。'],
        ['虚拟 DOM', 'Virtual DOM', 'web', '用 JS 对象描述界面树，通过 diff 算出最小更新再批量应用到真实 DOM，提升渲染效率与可维护性。'],
        ['SPA', 'Single Page Application', 'web', '单页应用：首次加载后由前端路由切换视图，不再整页刷新，交互更流畅。'],
        ['SSR', 'Server-Side Rendering', 'web', '服务端渲染：在服务器生成 HTML 首屏，改善首屏速度与 SEO，之后由前端接管（水合）。'],
        ['CSR', 'Client-Side Rendering', 'web', '客户端渲染：浏览器下载 JS 后在客户端渲染页面，交互丰富但首屏依赖脚本加载。'],
        ['水合', 'Hydration', 'web', '前端框架在服务端渲染的 HTML 上绑定事件与状态，使其变成可交互应用的过程。', { aliases: ['Hydration'] }],
        ['HMR', 'Hot Module Replacement', 'web', '热模块替换：开发时修改代码无需刷新页面即可替换模块，并尽量保留当前状态。'],
        ['Tree-shaking', 'Tree Shaking', 'web', '打包时移除未被使用的代码，减小产物体积，依赖 ES Module 的静态分析。'],
        ['打包器', 'Bundler', 'web', '把源码、样式和依赖合并优化成浏览器可加载资源的工具，如 Vite、Webpack、esbuild。'],
        ['Vite', 'Vite', 'web', '基于原生 ESM 与 Rollup 的前端构建工具，开发时按需编译、启动快，生产构建优化好。'],
        ['Webpack', 'Webpack', 'web', '老牌前端打包工具，生态庞大，通过 loader 与 plugin 扩展能力。'],
        ['React', 'React', 'web', '声明式 UI 库，以组件和单向数据流为核心，生态庞大；React 只是视图层，路由与状态需另配。', { cs: true }],
        ['Vue', 'Vue.js', 'web', '渐进式前端框架，模板语法友好、响应式系统易上手。', { cs: true }],
        ['TypeScript', 'TypeScript', 'web', 'JavaScript 的类型化超集，在编译期检查类型，显著提升大型项目的可维护性。'],
        ['JavaScript', 'JavaScript', 'web', '浏览器脚本语言，也通过 Node.js 用于服务端；单线程加事件循环是其运行模型。'],
        ['Node.js', 'Node.js', 'web', '基于 V8 的 JavaScript 运行时，让 JS 能写服务端程序，擅长 I/O 密集型场景。', { aliases: ['Nodejs'] }],
        ['npm', 'Node Package Manager', 'web', 'Node 的包管理器与生态仓库，负责依赖安装、版本管理与脚本执行。'],
        ['PWA', 'Progressive Web App', 'web', '渐进式 Web 应用：用 Service Worker、离线缓存和安装能力，让网页接近原生应用体验。'],
        ['WASM', 'WebAssembly', 'web', '可在浏览器中以接近原生速度运行的二进制指令格式，支持把 C/C++/Rust 等编译到 Web。'],
        ['状态管理', 'State Management', 'web', '集中管理跨组件共享状态的方案（如 Redux、Zustand），避免状态层层传递。'],
        ['跨域', 'Cross-Origin', 'web', '浏览器中源（协议、域名、端口）不同时的访问限制，需要 CORS 响应头或同源代理解决。'],
        ['埋点', 'Tracking', 'web', '在关键行为处采集事件数据，用于分析与实验；需关注统计口径、隐私与性能开销。'],
        // ---- 工程实践 ------------------------------------------------------
        ['IDE', 'Integrated Development Environment', 'practice', '集成开发环境：把编辑、编译、调试、版本控制等能力集成在一个工具里。'],
        ['Git', 'Git', 'practice', '分布式版本控制系统，记录代码历史、支持分支与协作，是现代研发的基础设施。'],
        ['提交', 'Commit', 'practice', '版本控制中把一次改动记录为快照的操作；也泛指提交表单或任务。'],
        ['分支', 'Branch', 'practice', '版本控制中从主线拉出的独立开发线，用于隔离特性与修复；也泛指流程的分叉。'],
        ['变基', 'Rebase', 'practice', '把一个分支的提交在另一基点上重放，得到线性历史；会改写提交哈希，勿用于已共享的分支。'],
        ['Pull Request', 'Pull Request', 'practice', '请求把某分支的改动合入目标分支的评审单元，会触发 CI、代码审查与讨论。', { aliases: ['PR'] }],
        ['代码审查', 'Code Review', 'practice', '提交者之外的人检查改动的正确性、可读性与风险，是质量保障与知识共享的关键环节。'],
        ['Linter', 'Linter', 'practice', '静态代码检查工具：按规则发现风格问题与潜在错误，常与格式化工具配合使用。'],
        ['静态分析', 'Static Analysis', 'practice', '不运行代码，通过分析源码发现类型错误、漏洞与坏味道。'],
        ['单元测试', 'Unit Test', 'practice', '针对最小可测单元（函数、类）的自动化测试，快速定位问题，是回归安全网的基础。'],
        ['集成测试', 'Integration Test', 'practice', '验证多个模块或服务协同工作的测试，比单元测试更接近真实，也更慢更脆弱。'],
        ['端到端测试', 'End-to-End Test', 'practice', '从用户视角驱动完整流程的测试（如浏览器自动化），最接近真实但成本最高。', { aliases: ['E2E'] }],
        ['回归测试', 'Regression Test', 'practice', '验证改动没有破坏既有功能的测试；修完 bug 应补一条用例防止复发。'],
        ['测试覆盖', 'Test Coverage', 'practice', '测试执行到的代码比例，是参考指标而非质量目标，高覆盖不代表测试有效。'],
        ['Mock', 'Mock', 'practice', '测试替身：用可控的假实现替代真实依赖，隔离被测逻辑，让测试稳定且快速。'],
        ['冒烟测试', 'Smoke Test', 'practice', '只验证核心链路能否跑通的快速测试，用于上线前或部署后的健康确认。'],
        ['TDD', 'Test-Driven Development', 'practice', '测试驱动开发：先写失败测试再写实现，最后重构，能倒逼出可测试的设计。'],
        ['重构', 'Refactoring', 'practice', '在不改变外部行为的前提下改进代码结构，通常依赖测试保障，小步进行。'],
        ['技术债', 'Technical Debt', 'practice', '为短期交付而做的妥协设计，未来需要额外成本偿还；应显式记录并规划偿还。'],
        ['代码坏味道', 'Code Smell', 'practice', '代码中暗示设计问题的表层迹象，如重复、过长函数、过度耦合，提示可重构处。'],
        ['可维护性', 'Maintainability', 'practice', '代码被理解、修改和扩展的容易程度，取决于清晰度、耦合度与测试保障。'],
        ['语义化版本', 'Semantic Versioning', 'practice', '版本号 MAJOR.MINOR.PATCH 的约定：不兼容变更升主版本，新增功能升次版本，修复升补丁版本。', { aliases: ['SemVer'] }],
        ['Monorepo', 'Monorepo', 'practice', '单仓库：把多个包或项目放在同一个代码仓库统一管理，便于共享与原子提交，也需处理构建与权限。'],
        ['格式化', 'Formatting', 'practice', '代码格式化：统一空格、缩进与换行，减少无意义 diff，通常交给工具自动完成。'],
        ['依赖', 'Dependency', 'practice', '项目运行或构建所需的外部库与组件；应锁定版本并审计其安全性与许可证。'],
        ['锁文件', 'Lockfile', 'practice', '固定依赖精确版本的文件（如 package-lock.json、pnpm-lock.yaml），保证不同环境安装结果一致。'],
        ['环境变量', 'Environment Variable', 'practice', '进程级键值配置，常用于注入密钥、连接串等运行时配置，避免写死在代码里。'],
        ['A/B 测试', 'A/B Testing', 'practice', '把流量随机分到多个方案，用统计指标比较效果，是数据驱动决策的核心方法。'],
        ['无障碍', 'Accessibility', 'practice', '让残障用户也能使用产品的设计与实现实践：语义标签、键盘操作、对比度、ARIA 等。', { aliases: ['a11y'] }],
        // ---- 后端与架构 ----------------------------------------------------
        ['API', 'Application Programming Interface', 'server', '应用程序编程接口：软件之间预先约定的调用契约，定义请求格式、参数、返回值与错误，让不同系统或模块解耦协作。'],
        ['SDK', 'Software Development Kit', 'server', '软件开发工具包：把一组 API 封装成特定语言可调用的库、工具和文档，降低接入成本。'],
        ['REST', 'Representational State Transfer', 'server', '一种基于 HTTP 的接口风格：用 URL 标识资源、用方法（GET/POST/PUT/DELETE）表达操作，无状态且易于缓存。', { cs: true }],
        ['GraphQL', 'GraphQL', 'server', '由客户端声明所需字段的 API 查询语言，一次请求即可取回嵌套数据，避免过度获取或多次请求。'],
        ['gRPC', 'gRPC', 'server', '基于 HTTP/2 与 Protobuf 的高性能 RPC 框架，支持双向流与多语言代码生成。'],
        ['RPC', 'Remote Procedure Call', 'server', '远程过程调用：像调用本地函数一样调用远端服务，把网络通信细节隐藏起来。'],
        ['微服务', 'Microservices', 'server', '把应用拆成多个独立部署、围绕业务能力组织的小服务，通过接口协作；提升扩展性也带来分布式复杂度。'],
        ['单体架构', 'Monolith', 'server', '所有功能打包成一个部署单元的应用架构，简单直接，但规模变大后耦合与发布效率变差。'],
        ['API 网关', 'API Gateway', 'server', '统一入口：负责路由、鉴权、限流、协议转换与监控，把跨服务的横切逻辑集中管理。'],
        ['服务发现', 'Service Discovery', 'server', '服务实例启动后注册自身，调用方据此动态获得可用地址，以适配弹性伸缩与实例漂移。'],
        ['注册中心', 'Registry', 'server', '存储服务实例列表与元数据的组件（如 Consul、Nacos），是服务发现与配置下发的基础。'],
        ['负载均衡', 'Load Balancing', 'server', '把请求按策略分配到多个实例，提升吞吐、可用性与容灾能力。'],
        ['反向代理', 'Reverse Proxy', 'server', '代表服务器接收请求并转发给内部服务，可实现负载均衡、TLS 终止、缓存与安全防护。'],
        ['正向代理', 'Forward Proxy', 'server', '代表客户端访问外部网络，常用于统一出口、缓存与访问控制。'],
        ['熔断', 'Circuit Breaker', 'server', '下游故障率过高时快速失败并暂停调用，避免故障扩散和资源耗尽，随后逐步恢复探测。'],
        ['限流', 'Rate Limiting', 'server', '限制单位时间内的请求量以防过载，常用令牌桶、漏桶等算法。'],
        ['降级', 'Graceful Degradation', 'server', '系统压力过大或依赖故障时关闭非核心功能、返回兜底结果，保证核心链路可用。'],
        ['背压', 'Backpressure', 'server', '消费速度跟不上生产速度时向上游传递压力（缓冲、丢弃或暂停生产），防止内存被撑爆。'],
        ['重试', 'Retry', 'server', '失败后再次尝试；必须配合幂等与退避策略，否则可能放大故障。'],
        ['指数退避', 'Exponential Backoff', 'server', '每次重试的等待时间按指数增长并加随机抖动，避免大量请求同时重试造成雪崩。'],
        ['超时', 'Timeout', 'server', '为操作设置最长等待时间，超时即放弃，防止无限挂起与资源被长期占用。'],
        ['消息队列', 'Message Queue', 'server', '在生产者与消费者之间异步传递消息的中间件，用于解耦、削峰填谷和可靠投递。', { aliases: ['MQ'] }],
        ['生产者-消费者', 'Producer-Consumer', 'server', '生产者投递任务、消费者并行处理的并发模型，通过队列缓冲解耦两边的速度差异。'],
        ['死信队列', 'Dead Letter Queue', 'server', '存放多次重试仍失败的消息的队列，便于人工排查与补偿处理。'],
        ['事务', 'Transaction', 'server', '一组要么全部成功、要么全部回滚的操作，用来保证数据一致性。'],
        ['分布式事务', 'Distributed Transaction', 'server', '跨多个服务或数据库的事务，需要 2PC、Saga、事务消息等协议来保证一致性。'],
        ['两阶段提交', 'Two-Phase Commit', 'server', '先询问所有参与者能否提交、再统一提交或回滚的分布式事务协议；简单但阻塞且协调者单点。', { aliases: ['2PC'] }],
        ['Saga', 'Saga', 'server', '把长事务拆成一系列本地事务，失败时按反向顺序执行补偿操作，适合微服务场景。'],
        ['最终一致性', 'Eventual Consistency', 'server', '允许多副本短暂不一致，但保证最终收敛到相同状态，是可用性优先系统的常见取舍。'],
        ['CAP 定理', 'CAP Theorem', 'server', '分布式系统在一致性（C）、可用性（A）和分区容错性（P）中最多同时满足两项；网络分区不可避免，因此常需在 C 与 A 间权衡。'],
        ['BASE', 'Basically Available, Soft state, Eventual consistency', 'server', '对可用性优先的工程化总结：基本可用、软状态、最终一致，是 CAP 权衡的落地思路。'],
        ['一致性哈希', 'Consistent Hashing', 'server', '把键和节点映射到哈希环上，扩缩容时只影响相邻区间的数据，显著减少数据迁移量。'],
        ['分布式锁', 'Distributed Lock', 'server', '跨进程、跨机器的互斥机制，常基于 Redis 或 ZooKeeper 实现，需处理锁超时与脑裂。'],
        ['Raft', 'Raft', 'server', '易于理解的分布式一致性算法，通过选举与日志复制让多个副本达成一致，etcd 等系统采用。'],
        ['Paxos', 'Paxos', 'server', '经典的分布式共识算法，是许多一致性协议的理论基础。'],
        ['缓存穿透', 'Cache Penetration', 'server', '查询不存在的数据导致请求绕过缓存直达数据库；可用布隆过滤器或空值缓存挡掉。'],
        ['缓存雪崩', 'Cache Avalanche', 'server', '大量缓存同时失效，请求瞬间压垮数据库；通过随机过期时间与多级缓存缓解。'],
        ['布隆过滤器', 'Bloom Filter', 'server', '用位数组和多个哈希判断元素"可能存在或一定不存在"的概率型结构，常用于防缓存穿透。'],
        ['高可用', 'High Availability', 'server', '通过冗余、故障转移等手段保证服务持续可用的能力，常用多副本与多可用区部署。', { aliases: ['HA'] }],
        ['容灾', 'Disaster Recovery', 'server', '面向机房级故障的备份与切换方案，目标是数据不丢、业务可恢复。'],
        ['无状态', 'Stateless', 'server', '服务不在本地保存会话状态，任意实例都能处理请求，便于水平扩展与故障转移。'],
        ['水平扩展', 'Horizontal Scaling', 'server', '通过增加实例数量提升系统能力；与之相对的垂直扩展是提升单机配置。'],
        ['弹性伸缩', 'Auto Scaling', 'server', '根据负载自动增减实例数量，在性能与成本之间取得平衡。'],
        ['优雅停机', 'Graceful Shutdown', 'server', '停止服务前先摘除流量、处理完在途请求再退出，避免请求失败或数据丢失。'],
        ['健康检查', 'Health Check', 'server', '定期探测服务实例是否可用，用于负载均衡摘除与自动重启。'],
        ['蓝绿部署', 'Blue-Green Deployment', 'server', '准备两套环境，新版上线后一次性切换流量，出问题可快速切回旧环境。'],
        ['灰度发布', 'Canary Release', 'server', '先向小比例用户放量新版本，观察指标后逐步扩大，降低发布风险。'],
        ['特性开关', 'Feature Flag', 'server', '用配置开关控制功能对用户是否可见，无需重新发布即可灰度或回滚。'],
        ['配置中心', 'Config Center', 'server', '集中管理配置并支持动态推送，避免改配置就要重启服务。'],
        ['幂等', 'Idempotent', 'server', '同一操作执行一次与执行多次的结果相同，是重试、去重与消息投递语义的基础。', { aliases: ['幂等性'] }],
        ['缓存', 'Cache', 'server', '把访问昂贵的数据暂存到更快的存储层以加速后续读取；需要处理失效、穿透与雪崩等问题。'],
        // ---- 数据库与存储 --------------------------------------------------
        ['索引', 'Index', 'db', '为加快查询而建立的辅助数据结构（如 B+ 树），用额外的存储与写入开销换取读取速度。'],
        ['主键', 'Primary Key', 'db', '唯一标识表中一行的字段或字段组合，天然唯一且非空，是数据定位的基础。'],
        ['外键', 'Foreign Key', 'db', '建立表间引用关系的约束，保证引用完整性；分布式场景常改为应用层校验。'],
        ['ACID', 'Atomicity, Consistency, Isolation, Durability', 'db', '原子性、一致性、隔离性、持久性，是关系数据库事务的四个保证。'],
        ['隔离级别', 'Isolation Level', 'db', '控制并发事务间可见性的级别（读未提交、读已提交、可重复读、串行化），在一致性与性能间权衡。'],
        ['MVCC', 'Multi-Version Concurrency Control', 'db', '多版本并发控制：读操作访问历史快照而非加锁，实现读写不互相阻塞。'],
        ['WAL', 'Write-Ahead Logging', 'db', '预写日志：先写日志再改数据文件，崩溃后可重放日志恢复，是数据库持久性的常用手段。'],
        ['B+ 树', 'B+ Tree', 'db', '一种多路平衡搜索树，叶子节点按键有序并相互链接，是关系数据库索引的经典结构，适合范围查询。'],
        ['LSM 树', 'Log-Structured Merge Tree', 'db', '写入先进入内存表并顺序落盘、再由后台合并，写吞吐高，适合写多读少场景（如 RocksDB）。'],
        ['分片', 'Sharding', 'db', '按规则把数据拆分到多个节点（即分库分表），突破单机容量与吞吐瓶颈，代价是跨分片查询与事务变复杂。'],
        ['分区', 'Partitioning', 'db', '把大表按范围或哈希切分成多个物理块，逻辑上仍是一张表，便于管理与并行扫描。'],
        ['主从复制', 'Replication', 'db', '主库写入、从库同步并承担读流量，提升读吞吐与可用性。'],
        ['读写分离', 'Read-Write Splitting', 'db', '写请求走主库、读请求走从库，缓解单库压力，但需要容忍复制延迟。'],
        ['复制延迟', 'Replication Lag', 'db', '从库落后主库的时间，可能导致刚写入的数据读不到，影响读写分离下的体验。'],
        ['乐观锁', 'Optimistic Locking', 'db', '假设冲突少，提交时用版本号或 CAS 校验，冲突则失败重试，避免长时间持锁。'],
        ['悲观锁', 'Pessimistic Locking', 'db', '假设冲突多，读取时就加锁排他，简单可靠但并发度低、容易死锁。'],
        ['倒排索引', 'Inverted Index', 'db', '从词项映射到包含它的文档列表，是全文检索的核心结构（如 Elasticsearch）。'],
        ['OLTP', 'Online Transaction Processing', 'db', '联机事务处理：面向高并发短事务的业务场景，如订单、支付系统。'],
        ['OLAP', 'Online Analytical Processing', 'db', '联机分析处理：面向大规模扫描与聚合分析的场景，如报表与数据仓库。'],
        ['数据仓库', 'Data Warehouse', 'db', '面向分析、从各业务系统抽取整合的集中式数据存储，支持历史数据与多维分析。'],
        ['数据湖', 'Data Lake', 'db', '以原始格式集中存放海量结构化与非结构化数据，使用时再加工建模。'],
        ['ETL', 'Extract, Transform, Load', 'db', '从源系统抽取数据、清洗转换后加载到目标仓库的数据集成流程。'],
        ['ORM', 'Object-Relational Mapping', 'db', '对象关系映射：把数据库表映射成程序对象，减少手写 SQL，但需注意 N+1 查询等性能陷阱。'],
        ['N+1 查询', 'N+1 Query', 'db', '先查主列表再逐条查关联数据，导致 1+N 次查询；用批量加载或 JOIN 优化。'],
        ['连接池', 'Connection Pool', 'db', '复用数据库连接，避免频繁建连的开销，同时限制并发连接数保护数据库。'],
        ['慢查询', 'Slow Query', 'db', '执行时间超过阈值的 SQL，通常需要通过索引、改写或分析执行计划来优化。'],
        ['回表', 'Back to Table', 'db', '使用二级索引查询后再按主键回主表取其他列，需要额外 I/O；覆盖索引可避免。'],
        ['覆盖索引', 'Covering Index', 'db', '索引中已包含查询所需的全部列，无需回表，可显著减少 I/O。'],
        ['Redis', 'Redis', 'db', '内存键值数据库，常用于缓存、计数器、分布式锁与轻量消息队列，以高性能著称。'],
        ['Kafka', 'Apache Kafka', 'db', '高吞吐分布式消息流平台，用于日志采集、事件驱动与解耦削峰。'],
        ['Elasticsearch', 'Elasticsearch', 'db', '基于 Lucene 的分布式搜索与分析引擎，靠倒排索引支撑全文检索和日志分析。'],
        ['向量数据库', 'Vector Database', 'db', '面向向量相似度检索的数据库，支撑语义搜索与 RAG，常见索引有 HNSW、IVF。'],
        ['HNSW', 'Hierarchical Navigable Small World', 'db', '分层可导航小世界图索引，是高维向量近似最近邻搜索的主流算法。'],
        ['近似最近邻', 'Approximate Nearest Neighbor', 'db', '牺牲少量精度换取检索速度的向量搜索方法，适合大规模向量库。', { aliases: ['ANN'] }],
        ['缓冲', 'Buffer', 'db', '临时存放数据的区域，用于平衡生产与消费的速度差异，或减少底层 I/O 次数。'],
        // ---- 网络与协议 ----------------------------------------------------
        ['TCP', 'Transmission Control Protocol', 'net', '面向连接、可靠有序的传输层协议，提供重传、流量控制与拥塞控制。'],
        ['UDP', 'User Datagram Protocol', 'net', '无连接、不保证可靠但延迟低的传输层协议，适合音视频、游戏和 QUIC 等场景。'],
        ['HTTP', 'HyperText Transfer Protocol', 'net', '应用层的请求-响应协议，是 Web 通信的基础，本身无状态、可扩展。'],
        ['HTTPS', 'HTTP Secure', 'net', 'HTTP over TLS：用 TLS 加密传输内容并校验服务器身份，防止窃听与篡改。'],
        ['TLS', 'Transport Layer Security', 'net', '传输层安全协议，提供加密、完整性校验与身份认证，是 HTTPS 的加密底座。'],
        ['mTLS', 'Mutual TLS', 'net', '双向 TLS：客户端与服务端互相验证证书，常用于服务网格与零信任架构。'],
        ['SSH', 'Secure Shell', 'net', '加密的远程登录与命令执行协议，同时支持端口转发和文件传输。'],
        ['DNS', 'Domain Name System', 'net', '把域名解析成 IP 地址的分布式系统；解析结果与缓存会影响访问延迟和容灾切换。'],
        ['CDN', 'Content Delivery Network', 'net', '内容分发网络：把静态资源缓存到离用户近的边缘节点，降低延迟、分担源站压力。'],
        ['CORS', 'Cross-Origin Resource Sharing', 'net', '跨源资源共享：在同源策略下，服务端通过响应头声明允许哪些源访问接口。'],
        ['CSP', 'Content Security Policy', 'net', '内容安全策略：通过响应头白名单限制页面可加载的脚本等资源，缓解 XSS 攻击。'],
        ['WebSocket', 'WebSocket', 'net', '基于 TCP 的全双工通信协议，适合实时推送、聊天和协同编辑。'],
        ['SSE', 'Server-Sent Events', 'net', '服务器单向推送事件流，比 WebSocket 轻量，常用于大模型流式输出与通知。'],
        ['HTTP/2', 'HTTP/2', 'net', '二进制分帧、多路复用与头部压缩，解决了 HTTP/1.1 的队头阻塞问题。'],
        ['HTTP/3', 'HTTP/3', 'net', '基于 QUIC（UDP）的新一代 HTTP，进一步降低握手的建立时长与丢包重传延迟。'],
        ['QUIC', 'QUIC', 'net', '基于 UDP 的传输协议，集成 TLS 1.3、多路复用与连接迁移，是 HTTP/3 的底层。'],
        ['VPN', 'Virtual Private Network', 'net', '在公共网络上建立加密隧道，实现远程安全接入内网。'],
        ['NAT', 'Network Address Translation', 'net', '网络地址转换：把私有地址映射为公网地址，缓解 IPv4 地址短缺并隐藏内网结构。'],
        ['子网', 'Subnet', 'net', '按掩码从大网段中划出的地址范围，用于网络隔离与路由规划。'],
        ['VPC', 'Virtual Private Cloud', 'net', '云上逻辑隔离的私有网络，可自定义网段、子网与路由。'],
        ['安全组', 'Security Group', 'net', '云上实例级别的虚拟防火墙，按规则允许或拒绝进出流量。'],
        ['域名', 'Domain Name', 'net', '互联网上易读的地址标识，通过 DNS 解析到具体 IP；证书签发也与域名绑定。'],
        // ---- 云原生与 DevOps -----------------------------------------------
        ['Docker', 'Docker', 'devops', '容器化平台：把应用及其依赖打包成镜像，实现环境一致、快速分发与运行。'],
        ['容器', 'Container', 'devops', '基于内核命名空间与 cgroups 的轻量隔离运行环境，比虚拟机启动快、开销小。'],
        ['镜像', 'Image', 'devops', '容器的只读模板，包含应用代码、依赖和运行时配置；容器由镜像实例化而来。'],
        ['Kubernetes', 'Kubernetes', 'devops', '容器编排系统，负责自动部署、扩缩容、服务发现和故障自愈。', { aliases: ['K8s'] }],
        ['Pod', 'Pod', 'devops', 'Kubernetes 中最小的调度单元，可包含一个或多个共享网络与存储的容器。'],
        ['Helm', 'Helm', 'devops', 'Kubernetes 的包管理工具，用 Chart 模板化管理应用及其依赖。'],
        ['Serverless', 'Serverless', 'devops', '无服务器架构：开发者只写函数或服务代码，平台自动扩缩容并按用量计费，无需管理服务器。'],
        ['FaaS', 'Function as a Service', 'devops', '函数即服务：把单个函数作为部署单元、事件触发执行，是 Serverless 的主要形态。'],
        ['CI', 'Continuous Integration', 'devops', '持续集成：每次提交都自动构建并运行测试，尽早发现集成问题。', { aliases: ['CI/CD'] }],
        ['流水线', 'Pipeline', 'devops', '把构建、测试、部署等步骤串成自动化流程，每次提交自动执行。', { aliases: ['Pipeline'] }],
        ['IaC', 'Infrastructure as Code', 'devops', '基础设施即代码：用配置文件而非手工操作定义和管理服务器、网络等资源，可版本化、可复现。'],
        ['Terraform', 'Terraform', 'devops', '主流的 IaC 工具：用 HCL 声明云资源，支持多云与状态管理。'],
        ['Ansible', 'Ansible', 'devops', '无代理的配置管理与自动化部署工具，用 YAML playbook 描述目标状态。'],
        ['Nginx', 'Nginx', 'devops', '高性能 Web 服务器与反向代理，常用于静态资源服务、负载均衡和网关。'],
        ['可观测性', 'Observability', 'devops', '通过日志、指标、链路追踪等信号推断系统内部状态的能力，便于定位复杂故障。', { aliases: ['Observability'] }],
        ['链路追踪', 'Distributed Tracing', 'devops', '为请求分配唯一 trace id 并记录各服务耗时，用于跨服务排障和性能分析。'],
        ['指标', 'Metric', 'devops', '可聚合的数值型观测数据（如 QPS、延迟、错误率），用于监控告警与趋势分析。'],
        ['SLO', 'Service Level Objective', 'devops', '服务等级目标：对可用性或延迟设定的内部目标，用于驱动可靠性与发布决策。'],
        ['SLA', 'Service Level Agreement', 'devops', '服务等级协议：对客户承诺的可用性与性能指标，以及未达标的补偿条款。'],
        ['P99', '99th percentile latency', 'devops', '99 分位延迟：99% 的请求都快于该耗时，比平均值更能暴露长尾抖动，是尾部体验的核心指标。'],
        ['P95', '95th percentile latency', 'devops', '95 分位延迟：95% 的请求都快于该耗时，常见的性能目标（SLO）口径，比 P99 更关注主流请求。'],
        ['P50', '50th percentile latency', 'devops', '50 分位延迟即中位数：一半请求快于该耗时，通常明显低于平均值，用于衡量典型用户体验。'],
        ['QPS', 'Queries Per Second', 'devops', '每秒查询数，衡量服务吞吐量的常用指标。'],
        ['TPS', 'Transactions Per Second', 'devops', '每秒事务数，衡量事务型系统处理能力的指标。'],
        ['压测', 'Stress Testing', 'devops', '模拟高负载验证系统容量、瓶颈与稳定性，为扩容和优化提供依据。'],
        ['混沌工程', 'Chaos Engineering', 'devops', '主动注入故障（杀进程、断网、延迟）验证系统容错能力，让失败变得可预期。'],
        ['回滚', 'Rollback', 'devops', '出问题时把系统恢复到上一个可用版本；要求发布制品可追溯、数据变更向后兼容。'],
        ['热更新', 'Hot Reload', 'devops', '不重启进程即可加载新代码或配置，提升迭代效率，但需处理状态与兼容性。'],
        ['热修复', 'Hotfix', 'devops', '绕过正常发布流程紧急修复线上问题，事后需把改动补回主线并补测试。'],
        ['部署', 'Deployment', 'devops', '把构建产物发布到目标环境并启动服务的过程，通常包含配置注入、健康检查与流量切换。'],
        ['构建', 'Build', 'devops', '把源码编译、打包、生成可部署产物的过程；产物应可复现并带版本标识。'],
        ['制品', 'Artifact', 'devops', '构建输出的可部署文件（镜像、压缩包、二进制），通常存入制品库并带版本号。'],
        ['灰度', 'Canary', 'devops', '按比例逐步放量新版本的发布方式，边观测指标边扩大范围，降低风险。'],
        // ---- 安全与加密 ----------------------------------------------------
        ['XSS', 'Cross-Site Scripting', 'security', '跨站脚本攻击：攻击者向页面注入可执行脚本，窃取会话或篡改内容；靠输出转义与 CSP 防御。'],
        ['CSRF', 'Cross-Site Request Forgery', 'security', '跨站请求伪造：诱导用户在已登录状态下发出非预期请求；用 CSRF Token 与 SameSite Cookie 防御。'],
        ['SQL 注入', 'SQL Injection', 'security', '把恶意 SQL 拼进查询语句以读取或篡改数据库；用参数化查询和最小权限防御。', { aliases: ['SQL注入'] }],
        ['提示注入', 'Prompt Injection', 'security', '把恶意指令藏在给大模型的输入（含网页、文件）中，诱使模型违背系统指令；需隔离与校验模型输出。'],
        ['沙箱', 'Sandbox', 'security', '受限执行环境：限制代码可访问的资源与系统调用，用于安全地运行不可信代码。'],
        ['加密', 'Encryption', 'security', '用密钥把明文变换成密文，防止未授权读取；分为对称加密与非对称加密两类。'],
        ['对称加密', 'Symmetric Encryption', 'security', '加密和解密使用同一密钥，速度快，适合批量数据加密（如 AES）。'],
        ['非对称加密', 'Asymmetric Encryption', 'security', '公钥加密、私钥解密（或反向签名），解决密钥分发问题，但速度较慢（如 RSA、ECC）。'],
        ['哈希', 'Hash', 'security', '把任意长度输入映射为固定长度摘要，单向且抗碰撞；用于校验完整性与存储密码。'],
        ['加盐', 'Salting', 'security', '为每个密码拼接随机值后再哈希，使相同密码得到不同摘要，抵御彩虹表攻击。'],
        ['数字签名', 'Digital Signature', 'security', '用私钥对摘要签名、用公钥验证，保证内容来源身份与完整性。'],
        ['JWT', 'JSON Web Token', 'security', '用 JSON 承载声明并签名的令牌，服务端可无状态校验，但难以主动吊销。'],
        ['OAuth', 'OAuth 2.0', 'security', '授权框架：让第三方在用户不暴露密码的前提下，获得有限权限的访问令牌。'],
        ['OIDC', 'OpenID Connect', 'security', '基于 OAuth 2.0 的身份认证层，用 ID Token 提供用户身份信息，常用于单点登录。'],
        ['SSO', 'Single Sign-On', 'security', '单点登录：一次登录即可访问多个相互信任的系统。'],
        ['RBAC', 'Role-Based Access Control', 'security', '基于角色的访问控制：把权限授予角色，再把角色授予用户，便于集中管理。'],
        ['ABAC', 'Attribute-Based Access Control', 'security', '基于属性的访问控制：按用户、资源、环境等属性动态判断权限，更灵活也更复杂。'],
        ['零信任', 'Zero Trust', 'security', '不默认信任内网：任何访问都需持续验证身份与权限，遵循最小权限与加密通信。'],
        ['凭据', 'Credential', 'security', '证明身份的材料（密码、密钥、令牌），必须安全存储与传输，避免泄漏。'],
        ['密钥', 'Secret Key', 'security', '用于加密、签名或认证的秘密材料；应通过密钥管理服务或环境变量注入，不入代码、不入库。'],
        ['证书', 'Certificate', 'security', '由 CA 签发的公钥与身份绑定文件，用于 HTTPS 与服务间认证，需关注有效期与吊销状态。'],
        ['同源策略', 'Same-Origin Policy', 'security', '浏览器安全模型：不同源的脚本不能随意读写彼此资源，跨域访问需要显式授权。'],
        ['提权', 'Privilege Escalation', 'security', '攻击者利用漏洞获得更高权限；防御核心是最小权限原则与及时修补。'],
        ['供应链安全', 'Supply Chain Security', 'security', '防范依赖包与构建流程被篡改投毒，需锁定版本、校验签名并审计依赖。'],
        ['审计日志', 'Audit Log', 'security', '记录关键操作与访问的不可篡改日志，用于安全追溯与合规检查。'],
        // ---- AI 与大模型 ---------------------------------------------------
        ['LLM', 'Large Language Model', 'ai', '大语言模型：在海量文本上训练、以预测下一个 token 为核心的模型，具备理解与生成能力。'],
        ['Token', 'Token', 'ai', '模型处理文本的最小单位（词或子词片段）；也指认证场景中的令牌。上下文窗口与计费通常按 token 计。'],
        ['上下文窗口', 'Context Window', 'ai', '模型一次能处理的最大 token 数（输入加输出），决定可容纳的对话历史与文档长度。'],
        ['Prompt', 'Prompt', 'ai', '提示词：发给模型的输入指令与上下文；清晰、具体的提示会显著影响输出质量。', { aliases: ['提示词'] }],
        ['提示词工程', 'Prompt Engineering', 'ai', '通过设计指令、示例、格式约束与任务拆解来稳定提升模型输出质量的方法。'],
        ['幻觉', 'Hallucination', 'ai', '模型生成看似合理但与事实不符的内容；可通过检索增强、引用与校验机制缓解。'],
        ['RAG', 'Retrieval-Augmented Generation', 'ai', '检索增强生成：先检索相关资料再让模型基于资料回答，降低幻觉并支持私有知识。'],
        ['嵌入向量', 'Embedding', 'ai', '把文本或图片映射成高维稠密向量，使语义相近的内容在向量空间中距离更近。', { aliases: ['Embedding', '嵌入'] }],
        ['微调', 'Fine-tuning', 'ai', '在预训练模型上用领域数据继续训练，使模型更贴合特定任务或风格。', { aliases: ['Fine-tuning'] }],
        ['LoRA', 'Low-Rank Adaptation', 'ai', '低秩适配：冻结原模型权重、只训练少量低秩矩阵，大幅降低微调的成本与显存占用。'],
        ['RLHF', 'Reinforcement Learning from Human Feedback', 'ai', '用人类偏好训练奖励模型，再用强化学习优化模型输出，使回答更符合人类期望。'],
        ['SFT', 'Supervised Fine-Tuning', 'ai', '监督微调：用人工标注的输入-输出对训练模型，让它学会遵循指令。'],
        ['DPO', 'Direct Preference Optimization', 'ai', '直接用偏好数据优化模型、无需单独训练奖励模型的偏好对齐方法。'],
        ['对齐', 'Alignment', 'ai', '让模型行为符合人类意图与价值观（有用、诚实、无害）的一系列技术。'],
        ['Function Calling', 'Function Calling', 'ai', '函数调用：模型按约定格式输出结构化调用请求，由外部执行工具并把结果回传。', { aliases: ['函数调用'] }],
        ['MCP', 'Model Context Protocol', 'ai', '模型上下文协议：统一模型与外部工具、数据源连接的开放协议，让工具接入标准化。'],
        ['多模态', 'Multimodal', 'ai', '同时处理文本、图像、音频、视频等多种输入或输出模态的模型能力。'],
        ['Transformer', 'Transformer', 'ai', '以自注意力为核心的神经网络架构，是当今大语言模型的基础。'],
        ['注意力机制', 'Attention Mechanism', 'ai', '让模型按相关性动态关注输入不同位置的机制，是 Transformer 的核心组件。', { aliases: ['Attention'] }],
        ['MoE', 'Mixture of Experts', 'ai', '混合专家：每次推理只激活部分专家网络，在扩大参数量的同时控制计算量。'],
        ['量化', 'Quantization', 'ai', '用更低精度（如 8bit、4bit）表示模型权重，减少显存占用、提升推理速度，可能带来精度损失。'],
        ['蒸馏', 'Distillation', 'ai', '用大模型（教师）的输出训练小模型（学生），让小模型获得接近的能力。'],
        ['剪枝', 'Pruning', 'ai', '移除模型中不重要的权重或结构以压缩体积、加速推理。'],
        ['批处理', 'Batch', 'ai', '把多条样本合并成一批一起计算以提升 GPU 利用率；批大小会影响吞吐与显存占用。', { aliases: ['Batch'] }],
        ['过拟合', 'Overfitting', 'ai', '模型过度拟合训练数据的细节，训练集表现好但泛化差。'],
        ['正则化', 'Regularization', 'ai', '通过惩罚模型复杂度、数据增强等手段抑制过拟合。'],
        ['梯度下降', 'Gradient Descent', 'ai', '沿损失函数梯度的反方向迭代更新参数以最小化损失的优化方法。'],
        ['反向传播', 'Backpropagation', 'ai', '用链式法则从输出层向输入层逐层计算梯度，是神经网络训练的核心算法。'],
        ['损失函数', 'Loss Function', 'ai', '衡量预测值与目标之间差距的可微函数，训练过程就是最小化损失。'],
        ['推理', 'Inference', 'ai', '在 AI 语境指用训练好的模型对新输入做预测或生成（与训练相对）；日常语境也指逻辑推理。'],
        ['训练', 'Training', 'ai', '用数据调整模型参数使损失下降的过程，与推理相对，通常需要大量算力与数据。'],
        ['预训练', 'Pre-training', 'ai', '在大规模无标注语料上学习通用表示的第一阶段训练，之后通常再做微调与对齐。'],
        ['参数', 'Parameter', 'ai', '模型中可学习的权重数值，参数量是衡量模型规模的主要指标。'],
        ['Agent', 'AI Agent', 'ai', '智能体：能自主规划、调用工具、执行多步任务并根据反馈调整的 AI 系统。', { aliases: ['智能体'] }],
        ['思维链', 'Chain of Thought', 'ai', '让模型显式写出推理步骤以提升复杂问题准确率的技术，也用于展示推理过程。', { aliases: ['Chain of Thought', 'CoT'] }],
        ['温度', 'Temperature', 'ai', '采样参数：温度越低输出越确定、越集中；越高越随机多样。'],
        ['扩散模型', 'Diffusion Model', 'ai', '通过逐步去噪从随机噪声生成图像或视频的生成模型，是文生图的主流架构。', { aliases: ['Diffusion'] }],
        ['CNN', 'Convolutional Neural Network', 'ai', '卷积神经网络：用卷积核提取局部特征，擅长图像等网格结构数据。'],
        ['RNN', 'Recurrent Neural Network', 'ai', '循环神经网络：按序列逐步处理并传递隐藏状态，适合变长序列，但难并行且长依赖较弱。'],
        ['LSTM', 'Long Short-Term Memory', 'ai', '带门控机制的循环网络，缓解梯度消失问题，能捕捉较长依赖。'],
        ['GAN', 'Generative Adversarial Network', 'ai', '生成对抗网络：生成器与判别器对抗训练，生成逼真的样本。'],
        // ---- 系统与底层 ----------------------------------------------------
        ['CLI', 'Command-Line Interface', 'system', '命令行界面：通过文本命令操作程序的交互方式，便于脚本化和自动化。'],
        ['GC', 'Garbage Collection', 'system', '垃圾回收：自动回收不再被引用的内存对象，避免手动释放，代价是可能引入停顿。'],
        ['JIT', 'Just-In-Time Compilation', 'system', '即时编译：运行时把热点代码编译成机器码，兼顾启动速度与执行性能（如 JVM、V8）。'],
        ['AOT', 'Ahead-Of-Time Compilation', 'system', '提前编译：运行前把源码编译成机器码或字节码，启动快但缺少运行时优化信息。'],
        ['字节码', 'Bytecode', 'system', '由虚拟机解释或 JIT 执行的中间指令集，兼具跨平台与较高执行效率（如 Java、Python）。'],
        ['编译器', 'Compiler', 'system', '把源码翻译成目标代码（机器码或字节码）的程序，通常经历词法、语法、语义分析与优化等阶段。'],
        ['解释器', 'Interpreter', 'system', '逐条读取并执行源码、无需先整体编译的程序，启动快、执行相对慢。'],
        ['链接器', 'Linker', 'system', '把多个目标文件和库合并成可执行文件的工具，负责符号解析与重定位。'],
        ['线程', 'Thread', 'system', '操作系统调度的最小执行单元；同一进程内的线程共享内存，需要同步保护。'],
        ['进程', 'Process', 'system', '操作系统资源分配与隔离的基本单位，拥有独立的地址空间。'],
        ['协程', 'Coroutine', 'system', '用户态轻量级线程，切换由程序调度，开销远小于系统线程；如 goroutine、Kotlin 协程。'],
        ['死锁', 'Deadlock', 'system', '多个线程互相持有对方所需的资源并无限等待，导致全部无法推进。'],
        ['竞态条件', 'Race Condition', 'system', '结果的正确性依赖多个线程的执行时序，缺少同步时会产生随机错误。'],
        ['内存泄漏', 'Memory Leak', 'system', '已不再使用的内存仍被引用而无法回收，长期运行会逐渐耗尽内存。'],
        ['虚拟内存', 'Virtual Memory', 'system', '操作系统为每个进程提供的抽象地址空间，通过页表映射到物理内存并实现隔离。'],
        ['上下文切换', 'Context Switch', 'system', 'CPU 从一个线程或进程切换到另一个时保存与恢复运行状态的开销。'],
        ['系统调用', 'System Call', 'system', '用户态程序请求内核完成特权操作（读写文件、创建进程）的接口。'],
        ['内核', 'Kernel', 'system', '操作系统的核心，管理进程、内存、文件系统与设备，运行在高特权态。'],
        ['GPU', 'Graphics Processing Unit', 'system', '图形处理器：最初用于图形渲染，因强大的并行计算能力，现已成为深度学习训练与推理的核心硬件。'],
        ['TPU', 'Tensor Processing Unit', 'system', '张量处理器：为矩阵运算专门设计的 AI 加速芯片，适合大规模训练与推理。'],
        ['CUDA', 'Compute Unified Device Architecture', 'system', '英伟达的 GPU 并行计算平台与编程接口，是深度学习生态的重要基础。'],
        ['显存', 'Video RAM', 'system', '显卡自带的内存；模型参数量、激活值与批大小共同决定显存占用，是推理部署的关键约束。', { aliases: ['VRAM'] }],
        // ---- DeepSeek Harness 平台概念 -------------------------------------
        ['Harness', 'DeepSeek Harness', 'harness', '本产品的运行平台：把模型、工具、插件与界面组合成可扩展的 Agent 运行时。'],
        ['Cordis', 'Cordis', 'harness', 'Harness 底层的依赖注入与插件框架：能力以插件形式挂载，可热插拔、可组合。'],
        ['插件', 'Plugin', 'harness', '以独立包形式接入 Harness 的扩展单元，可提供工具、服务、页面或界面槽位。'],
        ['Bundle', 'Bundle', 'harness', 'Harness 的安装单元：包含插件代码、补丁与元数据的 npm 包，安装后可整体启用或禁用。'],
        ['Profile', 'Profile', 'harness', 'Harness 的配置档案：一组插件、补丁与用户设置的组合，决定某次启动加载哪些能力。'],
        ['补丁', 'Patch', 'harness', 'Harness 的组合层：以 YAML 声明式地插入、覆盖或禁用插件行，组合出最终配置。', { aliases: ['Patch'] }],
        ['槽位', 'Slot', 'harness', '界面上的可扩展挂载点：插件向槽位注册组件即可在指定位置渲染，无需改动宿主代码。', { aliases: ['Slot'] }],
        ['投影', 'Projection', 'harness', 'Harness 中把会话事件流实时归约为界面状态的数据层，组件订阅投影即可获得响应式视图。'],
        ['会话', 'Session', 'harness', '一次完整的对话上下文：包含消息、工具调用、运行状态与工作区绑定。', { aliases: ['Session'] }],
        ['工具调用', 'Tool Call', 'harness', '模型请求执行某个工具（读文件、执行命令）并等待结果回传的交互过程。'],
        ['技能', 'Skill', 'harness', '可复用的任务说明与流程知识包；Agent 在任务匹配时加载并遵循其中的步骤与规范。'],
        ['工作区', 'Workspace', 'harness', '会话绑定的文件目录，是 Agent 读写文件与执行命令的默认范围。'],
        ['子代理', 'Subagent', 'harness', '由主 Agent 派生、拥有独立上下文的任务执行者，用于并行或隔离地完成子任务。'],
        ['上下文压缩', 'Compaction', 'harness', '当对话超出上下文窗口时，把较早的内容总结成摘要以腾出空间，同时保留关键信息。'],
      ];

            /* EXTERNAL-GLOSSARY:BEGIN generated by scripts/embed-external-glossary.mjs - do not edit by hand */
      /* Sources: kubernetes-website (CC-BY-4.0, 162 entries @ be44f0fb), cncf-glossary (Apache-2.0, 63 entries @ c6493fa4), ai-heihua-zh (MIT, 91 entries @ 16e0c3a0). See THIRD_PARTY_NOTICES.md and data/external-glossary.json. */
      const EXTERNAL_GLOSSARY = [
        ["附加组件","Add-ons","devops","扩展 Kubernetes 功能的资源。",{"aliases":["Add-ons"]}],
        ["准入控制器","Admission Controller","devops","在对象持久化之前拦截 Kubernetes API 服务器请求的一段代码。",{"aliases":["Admission Controller"]}],
        ["亲和性","Affinity","system","调度程序用于确定在何处放置 Pod（亲和性）的规则。",{"aliases":["Affinity"]}],
        ["聚合层","Aggregation Layer","devops","聚合层允许你在自己的集群上安装额外的 Kubernetes 风格的 API。",{"aliases":["Aggregation Layer"]}],
        ["注解","Annotation","system","注解是以键值对的形式给资源对象附加随机的无法标识的元数据。",{"aliases":["Annotation"]}],
        ["API 发起的驱逐","API-initiated eviction","devops","API 发起的驱逐是一个先调用 Eviction API 创建驱逐对象，再由该对象体面地中止 Pod 的过程。",{"aliases":["API-initiated eviction"]}],
        ["API Group","API Group","system","Kubernetes API 中的一组相关路径。",{"aliases":["API 组"]}],
        ["API 资源","API resource","devops","Kubernetes 实体，表示 Kubernetes API 服务器上的端点。",{"aliases":["API resource","Resource"]}],
        ["应用容器","App Container","devops","用于运行部分工作负载的容器。与 Init 容器比较而言。",{"aliases":["App Container"]}],
        ["应用架构师","Application Architect","devops","应用架构师是负责应用高级设计的人。",{"aliases":["Application Architect"]}],
        ["应用开发者","Application Developer","devops","编写可以在 Kubernetes 集群上运行的应用的人。",{"aliases":["Application Developer"]}],
        ["应用","Applications","system","各种容器化应用运行所在的层。",{"aliases":["Applications","Application"]}],
        ["批准者","Approver","practice","可以审核并批准 Kubernetes 代码贡献的人。",{"aliases":["Approver"]}],
        ["cAdvisor","cAdvisor","devops","帮助理解容器的资源用量与性能特征的工具。"],
        ["容器设备接口","Container Device Interface (CDI)","devops","一种 CNCF 规范，用于描述容器运行时在创建容器时应用的设备配置。",{"aliases":["Container Device Interface (CDI)","CDI"]}],
        ["通用表达式语言","Common Expression Language","devops","一种为安全执行用户代码而设计的表达式语言。",{"aliases":["Common Expression Language","CEL"]}],
        ["控制组","cgroup (control group)","system","一组具有可选资源隔离、审计和限制的 Linux 进程。",{"aliases":["cgroup (control group)","cgroup；control group"]}],
        ["CIDR","CIDR","net","CIDR 是一种描述 IP 地址块的符号，被广泛使用于各种网络配置中。"],
        ["贡献者许可协议","CLA (Contributor License Agreement)","practice","贡献者对他们在开源项目中所贡献的代码的授权许可条款。",{"aliases":["CLA (Contributor License Agreement)","CLA；Contributor License Agreement"]}],
        ["云控制器管理器","Cloud Controller Manager","devops","将 Kubernetes 与第三方云提供商进行集成的控制平面组件。",{"aliases":["Cloud Controller Manager"]}],
        ["云提供商","Cloud Provider","practice","一个提供云计算平台的组织。",{"aliases":["Cloud Provider","云服务提供商（Cloud Service Provider）"]}],
        ["集群架构师","Cluster Architect","devops","设计涉及一个或多个 Kubernetes 集群的基础设施的人。",{"aliases":["Cluster Architect"]}],
        ["集群基础设施","Cluster Infrastructure","devops","基础设施层提供并维护虚拟机、网络、安全组及其他资源。",{"aliases":["Cluster Infrastructure"]}],
        ["集群操作","Cluster Operations","devops","管理 Kubernetes 集群所涉及的相关工作。",{"aliases":["Cluster Operations"]}],
        ["集群操作者","Cluster Operator","devops","配置、控制、监控集群的人。",{"aliases":["Cluster Operator"]}],
        ["集群","Cluster","system","一组工作机器，称为节点，会运行容器化应用程序。每个集群至少有一个工作节点。",{"aliases":["Cluster"]}],
        ["云原生计算基金会","Cloud Native Computing Foundation (CNCF)","practice","云原生计算基金会（Cloud Native Computing Foundation）。",{"aliases":["Cloud Native Computing Foundation (CNCF)","CNCF；Cloud Native Computing Foundation"]}],
        ["容器网络接口","Container network interface (CNI)","net","容器网络接口 (Container network interface；CNI) 插件是遵循 appc/CNI 协议的一类网络插件。",{"aliases":["Container network interface (CNI)","Container network interface；CNI"]}],
        ["代码贡献者","Code Contributor","practice","为 Kubernetes 开源代码库开发并贡献代码的人。",{"aliases":["Code Contributor"]}],
        ["状况","Condition","system","状况表示 Kubernetes 资源的当前状态，提供资源某些方面是否为真的信息。",{"aliases":["Condition"]}],
        ["ConfigMap","ConfigMap","devops","ConfigMap 是一种 API 对象，用来将非机密性的数据保存到键值对中。使用时可以用作环境变量、命令行参数或者存储卷中的配置文件。"],
        ["容器环境变量","Container Environment Variables","system","容器环境变量提供了 name=value 形式的、运行容器化应用所必须的一些重要信息。",{"aliases":["Container Environment Variables"]}],
        ["容器生命周期钩子","Container Lifecycle Hooks","devops","生命周期钩子暴露容器管理生命周期中的事件，允许用户在事件发生时运行代码。",{"aliases":["Container Lifecycle Hooks"]}],
        ["容器运行时","Container Runtime","system","容器运行时是负责运行容器的软件。",{"aliases":["Container Runtime"]}],
        ["containerd","containerd","devops","强调简单性、健壮性和可移植性的一种容器运行时。"],
        ["贡献者","Contributor","practice","通过贡献代码、文档或者投入时间等方式来帮助 Kubernetes 项目或社区的人。",{"aliases":["Contributor"]}],
        ["控制平面","Control Plane","system","控制平面是指容器编排层，它暴露 API 和接口来定义、部署容器和管理容器的生命周期。",{"aliases":["Control Plane"]}],
        ["控制器","Controller","devops","控制器通过 API 服务器监控集群的公共状态，并致力于将当前状态转变为期望的状态。",{"aliases":["Controller"]}],
        ["CRI-O","CRI-O","devops","专用于 Kubernetes 的轻量级容器运行时软件。"],
        ["容器运行时接口","Container Runtime Interface (CRI)","system","在 kubelet 和本地容器运行时之间通讯的协议。",{"aliases":["Container Runtime Interface (CRI)","Container Runtime Interface；CRI"]}],
        ["周期调度任务","CronJob","devops","周期调度的任务（作业）。",{"aliases":["CronJob"]}],
        ["容器存储接口","Container Storage Interface (CSI)","devops","容器存储接口 （CSI）定义了存储系统暴露给容器的标准接口。",{"aliases":["Container Storage Interface (CSI)","Container Storage Interface；CSI"]}],
        ["CustomResourceDefinition","CustomResourceDefinition","system","通过定制化的代码给你的 Kubernetes API 服务器增加资源对象，而无需编译完整的定制 API 服务器。"],
        ["DaemonSet","DaemonSet","system","确保 Pod 的副本在集群中的一组节点上运行。"],
        ["数据平面","Data Plane","system","提供诸如 CPU、内存、网络和存储的能力，以便容器可以运行并连接到网络。",{"aliases":["Data Plane"]}],
        ["开发者","Developer (disambiguation)","practice","指的是：应用开发者、代码贡献者或平台开发者。",{"aliases":["Developer (disambiguation)","Developer"]}],
        ["设备插件","Device Plugin","system","一种软件扩展，可以使 Pod 访问由特定厂商初始化或者安装的设备。",{"aliases":["Device Plugin"]}],
        ["设备","Device","devops","直接或间接挂接到集群节点上的所有资源，例如 GPU 或电路板。",{"aliases":["Device"]}],
        ["DeviceClass","DeviceClass","devops","集群中设备的一种分类。使用户可以申领 DeviceClass 中的特定设备。"],
        ["干扰","Disruption","system","导致 Pod 服务停止的事件。",{"aliases":["Disruption"]}],
        ["Dockershim","Dockershim","system","Dockershim 是 Kubernetes v1.23 及之前版本中的一个组件，Kubernetes 系统组件通过它与 Docker Engine 通信。"],
        ["下游","Downstream (disambiguation)","practice","可以指：Kubernetes 生态系统中依赖于核心 Kubernetes 代码库或分支代码库的代码。",{"aliases":["Downstream (disambiguation)","Downstream"]}],
        ["Downward API","Downward API","devops","将 Pod 和容器字段值暴露给容器中运行的代码的机制。"],
        ["动态资源分配","Dynamic Resource Allocation","devops","Kubernetes 提供的一项特性，用于在 Pod 之间请求和共享资源，例如硬件加速器。",{"aliases":["Dynamic Resource Allocation","DRA"]}],
        ["腾空","Drain","system","从 Node 中安全地驱逐 Pod，为节点维护或移除做好准备。",{"aliases":["Drain"]}],
        ["Duration","Duration","system","表示时间量的字符串值。"],
        ["动态卷制备","Dynamic Volume Provisioning","devops","允许用户请求自动创建存储卷。",{"aliases":["Dynamic Volume Provisioning"]}],
        ["EndpointSlice","EndpointSlice","net","EndpointSlices 跟踪提供 Service 的 Pod 的 IP 地址。"],
        ["端点","Endpoints","net","表示 Service 端点的 API（已弃用）。",{"aliases":["Endpoints"]}],
        ["临时容器","Ephemeral Container","system","你可以在 Pod 中临时运行的一种容器类型。",{"aliases":["Ephemeral Container"]}],
        ["etcd","etcd","devops","一致且高可用的键值存储，用作 Kubernetes 所有集群数据的后台数据库。"],
        ["事件","Event","devops","描述集群中某些状态变化的 Kubernetes 对象。",{"aliases":["Event"]}],
        ["驱逐","Eviction","devops","终止节点上一个或多个 Pod 的过程。",{"aliases":["Eviction"]}],
        ["扩展组件","Extensions","system","扩展组件（Extension）是扩展并与 Kubernetes 深度集成以支持新型硬件的软件组件。",{"aliases":["Extensions","Extension"]}],
        ["特性门控","Feature gate","system","一种控制是否启用某特定 Kubernetes 特性的方法。",{"aliases":["Feature gate"]}],
        ["Finalizer","Finalizer","system","一个带有命名空间的键，告诉 Kubernetes 等到特定的条件被满足后， 再完全删除被标记为删除的资源。"],
        ["FlexVolume","FlexVolume","devops","FlexVolume 是一个已弃用的接口，用于创建树外卷插件。 是一个更新的接口，它解决了 FlexVolume 的一些问题。"],
        ["Gateway API","Gateway API","net","Kubernetes 中服务网络建模所用的 API。"],
        ["组版本资源","Group Version Resource","devops","Kubernetes API 的 API 组、API 版本和名称。",{"aliases":["Group Version Resource"]}],
        ["Helm Chart","Helm Chart","devops","Helm Chart 是一组预先定义的 Kubernetes 配置所构成的包，可以使用 Helm 工具对其进行管理。"],
        ["Pod 水平自动扩缩器","Horizontal Pod Autoscaler","devops","此对象根据目标资源利用率或自定义度量目标自动扩缩 Pod 副本的数量。",{"aliases":["Horizontal Pod Autoscaler","HPA"]}],
        ["HostAliases","HostAliases","devops","主机别名 (HostAliases) 是一组 IP 地址和主机名的映射，用于注入到 Pod 内的 hosts 文件。"],
        ["不可变基础设施","Immutable Infrastructure","devops","不可变基础设施指的是一旦部署就不能变更的计算机基础设施（虚拟机、容器和网络设施）。",{"aliases":["Immutable Infrastructure"]}],
        ["Ingress","Ingress","net","Ingress 是对集群中服务的外部访问进行管理的 API 对象，典型的访问方式是 HTTP。"],
        ["Init 容器","Init Container","system","应用容器运行前必须先运行完成的一个或多个 Init 容器（Init Container）。",{"aliases":["Init Container"]}],
        ["Istio","Istio","net","Istio 是一个（非 Kubernetes 特有的）开放平台，提供了一种统一的方式来集成微服务、管理流量、实施策略和汇总度量数据。"],
        ["Job","Job","system","Job 是需要运行完成的确定性的或批量的任务。"],
        ["kOps","kOps (Kubernetes Operations)","devops","kOps 不仅会帮助你创建、销毁、升级和维护生产级、高可用性的 Kubernetes 集群， 还会提供必要的云基础设施。",{"aliases":["kOps (Kubernetes Operations)","Kubernetes Operations"]}],
        ["API 服务器","API server","devops","提供 Kubernetes API 服务的控制面组件。",{"aliases":["API server","kube-apiserver"]}],
        ["kube-controller-manager","kube-controller-manager","devops","运行控制器进程的控制平面组件。"],
        ["kube-proxy","kube-proxy","system","kube-proxy 是集群中每个节点上运行的网络代理。"],
        ["kube-scheduler","kube-scheduler","devops","控制平面组件，负责监视新创建的、未指定运行节点的 Pod，选择节点让 Pod 在上面运行。"],
        ["Kubeadm","Kubeadm","devops","用来快速安装 Kubernetes 并搭建安全稳定的集群的工具。"],
        ["Kubectl","Kubectl","devops","kubectl 是用来和 Kubernetes 集群进行通信的命令行工具。",{"aliases":["kubectl"]}],
        ["Kubelet","Kubelet","system","一个在集群中每个节点上运行的代理。它保证容器都运行在 Pod 中。"],
        ["Kubernetes API","Kubernetes API","system","Kubernetes API 是通过 RESTful 接口提供 Kubernetes 功能服务并负责集群状态存储的应用程序。"],
        ["标签","Label","system","用来为对象设置可标识的属性标记；这些标记对用户而言是有意义且重要的。",{"aliases":["Label"]}],
        ["LimitRange","LimitRange","devops","提供约束来限制命名空间中每个容器或 Pod 的资源消耗。"],
        ["日志","Logging","devops","日志是集群或应用记录的事件列表。",{"aliases":["Logging"]}],
        ["托管服务","Managed Service","devops","由第三方供应商负责维护的一种软件产品。",{"aliases":["Managed Service"]}],
        ["清单","Manifest","system","一个或多个 Kubernetes API 对象的序列化规范。",{"aliases":["Manifest"]}],
        ["Master","Master","system","遗留术语，作为运行控制平面的节点的同义词使用。"],
        ["成员","Member","practice","K8s 社区中持续活跃的贡献者。",{"aliases":["Member"]}],
        ["Minikube","Minikube","system","Minikube 是用来在本地运行 Kubernetes 的一种工具。"],
        ["镜像 Pod","Mirror Pod","devops","API 服务器中的一个对象，用于跟踪 kubelet 上的静态 pod。",{"aliases":["Mirror Pod"]}],
        ["混合版本代理","Mixed Version Proxy (MVP)","devops","此特性使 kube-apiserver 能够将资源请求代理到另一个对等 API 服务器。",{"aliases":["Mixed Version Proxy (MVP)"]}],
        ["名称","Name","system","客户端提供的字符串，用来指代资源 URL 中的对象，如 /api/v1/pods/some-name。",{"aliases":["Name"]}],
        ["名字空间","Namespace","system","名字空间是 Kubernetes 用来支持隔离单个集群中的资源组的一种抽象。",{"aliases":["Namespace"]}],
        ["网络策略","Network Policy","net","网络策略是一种规范，规定了允许 Pod 组之间、Pod 与其他网络端点之间以怎样的方式进行通信。",{"aliases":["Network Policy"]}],
        ["节点压力驱逐","Node-pressure eviction","devops","节点压力驱逐是 kubelet 主动使 Pod 失败以回收节点上 的过程。",{"aliases":["Node-pressure eviction","kubelet eviction"]}],
        ["节点","Node","devops","Kubernetes 中的工作机器称作节点。",{"aliases":["Node"]}],
        ["对象","Object","devops","Kubernetes 系统中的实体，代表了集群的部分状态。",{"aliases":["Object"]}],
        ["Operator 模式","Operator pattern","devops","一种用于管理自定义资源的专用控制器。",{"aliases":["Operator pattern"]}],
        ["持久卷申领","Persistent Volume Claim","devops","声明在持久卷中定义的存储资源，以便可以将其挂载为容器中的卷。",{"aliases":["Persistent Volume Claim"]}],
        ["持久卷","Persistent Volume","devops","持久卷是代表集群中一块存储空间的 API 对象。",{"aliases":["Persistent Volume"]}],
        ["平台开发人员","Platform Developer","devops","定制 Kubernetes 平台以满足自己的项目需求的人。",{"aliases":["Platform Developer"]}],
        ["Pod 干扰预算","Pod Disruption Budget","devops","PDB 是这样一种对象：它保证在出现主动干扰时，多实例应用的 Pod 不会少于一定的数量。",{"aliases":["Pod Disruption Budget","PDB"]}],
        ["Pod 干扰","Pod Disruption","devops","自愿或非自愿地终止节点上的 Pod 的过程。",{"aliases":["Pod Disruption"]}],
        ["Pod 生命周期","Pod Lifecycle","system","Pod 在其生命周期中经历的状态序列。",{"aliases":["Pod Lifecycle"]}],
        ["Pod 优先级","Pod Priority","devops","Pod 优先级表示一个 Pod 相对于其他 Pod 的重要性。",{"aliases":["Pod Priority"]}],
        ["Pod 安全策略","Pod Security Policy","security","移除了强制执行 Pod 安全限制的 API。",{"aliases":["Pod Security Policy"]}],
        ["PodTemplate","PodTemplate","devops","创建 Pod 所用的模板。",{"aliases":["Pod 模板"]}],
        ["PodGroup","PodGroup","devops","PodGroup 表示一组具有共同调度策略和约束的 Pod。"],
        ["抢占","Preemption","devops","Kubernetes 中的抢占逻辑通过驱逐节点上的低优先级 Pod 来帮助悬决的 Pod 找到合适的节点。",{"aliases":["Preemption"]}],
        ["PriorityClass","PriorityClass","devops","从类别名称到 Pod 本身调度优先级的映射。"],
        ["探针","Probe","devops","由 kubelet 定期对 Pod 中的容器定期执行的一项检查。",{"aliases":["Probe"]}],
        ["代理","Proxy","net","充当客户端和服务器之间的中介的应用程序。",{"aliases":["Proxy"]}],
        ["QoS 类","QoS Class","system","QoS 类（Quality of Service Class）为 Kubernetes 提供了一种将集群中的 Pod 分为几个类并做出有关调度和驱逐决策的方法。",{"aliases":["QoS Class"]}],
        ["量纲","Quantity","system","使用全数字来表示较小数值或使用 SI 后缀表示较大数值的表示法。",{"aliases":["Quantity"]}],
        ["ReplicaSet","ReplicaSet","system","ReplicaSet 确保一次运行指定数量的 Pod 副本。"],
        ["副本","Replica","system","Replica 是 Pod 的副本，通过维护相同的实例确保可用性、可扩缩性和容错性。",{"aliases":["Replica"]}],
        ["副本控制器","ReplicationController","devops","一种管理多副本应用的（已弃用）的 API 对象。",{"aliases":["ReplicationController"]}],
        ["资源配额","ResourceQuota","system","资源配额提供了限制每个命名空间的资源消耗总和的约束。",{"aliases":["ResourceQuota"]}],
        ["ResourceClaim","ResourceClaim","devops","描述工作负载所需的资源，例如设备。ResourceClaim 可以针对某些 DeviceClass 请求设备。"],
        ["ResourceClaimTemplate","ResourceClaimTemplate","devops","定义一个模板，Kubernetes 据此创建 ResourceClaim。 此模板用于为每个 Pod 或 PodGroup 提供对一些独立、相似的资源的访问权限。"],
        ["ResourceSlice","ResourceSlice","devops","用一个相似资源所构成的池来表示一个或多个基础设施资源（如设备）。"],
        ["评审者","Reviewer","practice","评审者是负责评审项目的某部分代码以便提高代码质量和正确性的人。",{"aliases":["Reviewer"]}],
        ["主题备用名称","Subject Alternative Name","security","X.509 证书的扩展字段，用于标识证书所适用的主机名或 IP 地址。",{"aliases":["Subject Alternative Name"]}],
        ["Secret","Secret","devops","Secret 用于存储敏感信息，如密码、 OAuth 令牌和 SSH 密钥。"],
        ["安全上下文","Security Context","security","securityContext 字段定义 Pod 或容器的特权和访问控制设置，包括运行时 UID 和 GID。",{"aliases":["Security Context"]}],
        ["选择算符","Selector","system","选择算符允许用户通过标签对一组资源对象进行筛选过滤。",{"aliases":["Selector"]}],
        ["ServiceAccount","ServiceAccount","system","为在 Pod 中运行的进程提供标识。"],
        ["服务目录","Service Catalog","devops","服务目录是一种扩展 API，它能让 Kubernetes 集群中运行的应用易于使用外部托管的软件服务，例如云供应商提供的数据仓库服务。",{"aliases":["Service Catalog"]}],
        ["服务","Service","system","将运行在一组 Pod 上的应用程序公开为网络服务的抽象方法。",{"aliases":["Service"]}],
        ["混排切片","Shuffle-sharding","system","一种将请求指派给队列的技术，其隔离性好过对队列个数哈希取模的方式。",{"aliases":["Shuffle-sharding","Shuffle Sharding"]}],
        ["边车容器","Sidecar Container","system","在 Pod 的整个生命期内保持运行的辅助容器。",{"aliases":["Sidecar Container"]}],
        ["特别兴趣小组","SIG (special interest group)","practice","共同管理大范畴 Kubernetes 开源项目中某组件或方面的一组社区成员。",{"aliases":["SIG (special interest group)","SIG"]}],
        ["规约","Spec","system","在 Kubernetes 清单中的此字段用来定义预期状态或预期配置。",{"aliases":["Spec"]}],
        ["StatefulSet","StatefulSet","system","StatefulSet 用来管理某 Pod 集合的部署和扩缩，并为这些 Pod 提供持久存储和持久标识符。"],
        ["静态 Pod","Static Pod","system","静态 Pod（Static Pod）是指由特定节点上的 kubelet 守护进程直接管理的 Pod。",{"aliases":["Static Pod"]}],
        ["StorageClass","Storage Class","devops","StorageClass 是管理员用来描述可用的不同存储类型的一种方法。",{"aliases":["Storage Class"]}],
        ["sysctl","sysctl","devops","用于获取和设置 Unix 内核参数的接口。"],
        ["污点","Taint","system","污点是一种核心对象，包含三个必需的属性：key、value 和 effect。 污点会阻止在节点或节点组上调度 Pod。",{"aliases":["Taint"]}],
        ["容忍度","Toleration","devops","容忍度是一种核心对象，包含三个必需的属性：key、value 和 effect。 容忍度允许将 Pod 调度到具有对应污点的节点或节点组上。",{"aliases":["Toleration"]}],
        ["UID","UID","system","由 Kubernetes 系统生成、用来唯一标识对象的字符串。"],
        ["上游","Upstream (disambiguation)","practice","可以指代核心 Kubernetes 仓库或作为当前仓库派生来源的仓库。",{"aliases":["Upstream (disambiguation)","Uptream"]}],
        ["用户名字空间","user namespace","security","一种让非特权用户模拟超级用户特权的 Linux 内核特性。",{"aliases":["user namespace"]}],
        ["卷插件","Volume Plugin","devops","卷插件可以让 Pod 集成存储。",{"aliases":["Volume Plugin"]}],
        ["卷","Volume","system","包含可被 Pod 中容器访问的数据的目录。",{"aliases":["Volume"]}],
        ["监视","Watch","system","用于以流的形式跟踪 Kubernetes 中对象变化的动词。",{"aliases":["Watch"]}],
        ["工作组","WG (working group)","practice","工作组是为了方便讨论和（或）推进执行一些短周期、窄范围、或者从委员会和 SIG 分离出来的项目、以及跨 SIG 的活动。",{"aliases":["WG (working group)","Working Group，WG"]}],
        ["工作负载","Workload","system","工作负载是在 Kubernetes 上运行的应用。",{"aliases":["Workload"]}],
        ["抽象","Abstraction","system","在计算的上下文中，抽象是一种对 服务 的消费者（消费者可以是计算机程序或人类）隐藏其细节的表示法，使系统更通用也更容易理解。 你的笔记本电脑的操作系统就是一个很好的例子。它把计算机工作的所有细节都抽象出来了。 你不需要知道任何关于CPU、内存以及程序如何被运行，你只需操作操作系统。",{"aliases":["Abstraction"]}],
        ["敏捷软件开发","Agile Software Development","devops","强调迭代式开发和自组织团队的一组实践。 与只有在项目结束时才产生价值的瀑布式项目不同，敏捷软件开发更关注于持续的、增量的价值交付，以及交付流程本身的演进和提升。",{"aliases":["Agile Software Development"]}],
        ["裸机","Bare Metal Machine","devops","裸机是指一台物理计算机，更具体地说是一台服务器，它只有一个操作系统。这样区分在现代计算环境中很重要，因为许多（甚至可以说大部分）服务器都是虚拟机。物理服务器通常是一台相当大的计算机，内置强大的硬件。直接在该物理硬件上安装操作系统并运行应用程序，无需虚拟化，称为在“裸机”上运行。",{"aliases":["Bare Metal Machine"]}],
        ["金丝雀部署","Canary Deployment","devops","金丝雀部署是一种部署策略，开始时有两个环境：一个有实时流量，另一个包含没有实时流量的更新代码。 流量逐渐从应用程序的原始版本转移到更新版本。 它可以从移动 1% 的实时流量开始，然后是 10%，25%，以此类推，直到所有流量都通过更新的版本运行。 企业可以在生产中测试新版本的软件，获得反馈。",{"aliases":["Canary Deployment"]}],
        ["主从式架构","Client-Server Architecture","devops","在主从式架构（客户端-服务器架构）中，构成应用程序的逻辑（或代码）会被分成两个或多个组件： 一个期望工作被完成的客户端（例如，运行在你的 web 浏览器中的 Gmail web 应用程序）， 以及一个或多个满足该请求的服务器（例如，运行在云中心的谷歌计算机上的“发送电子邮件”服务）。 在这个例子中。",{"aliases":["Client-Server Architecture"]}],
        ["云计算","Cloud Computing","devops","云计算是一种通过互联网按需提供计算资源（如 CPU、网络和磁盘功能）的模型。 云计算使用户能够在远程物理位置访问和使用计算能力。 云计算通常分为私有云和公有云，具体取决于云基础设施是专门用于某个组织还是分享开放的公共服务。",{"aliases":["Cloud Computing"]}],
        ["云原生应用程序","Cloud Native Apps","devops","云原生应用程序专门设计用于利用 云计算 中的创新。 这些应用程序可以轻松地与其各自的云架构集成，充分利用云的资源和 可伸缩性 功能。 它还指利用云计算驱动的基础设施创新的应用程序。 今天的云原生应用程序包括在云提供商的数据中心和本地云原生平台上运行的应用程序。",{"aliases":["Cloud Native Apps"]}],
        ["云原生安全","Cloud Native Security","security","云原生安全是一种将安全性构建到 云原生应用程序 中的方法。 它确保安全是从开发到生产的整个应用程序生命周期的一部分。 云原生安全旨在确保与传统安全模型相同的标准，同时适应云原生环境的特殊性，即快速的代码更改和高度短暂的基础设施。 云原生安全与称为 测试左移 的实践高度相关。",{"aliases":["Cloud Native Security"]}],
        ["云原生技术","Cloud Native Technology","devops","云原生技术，也称为云原生技术栈，是用于构建 云原生应用程序 的技术。 使组织能够在公共云、私有云和混合云等现代动态环境中构建和运行可伸缩的应用程序，他们坚持“云的承诺”并充分利用云计算的优势。 它们从头开始设计，以利用云计算和容器的功能，服务网格、微服务和不可变的基础设施就是这种方法的例证。",{"aliases":["Cloud Native Technology"]}],
        ["容器镜像","Container Image","devops","容器镜像是一个不可改变的静态文件，包含创建容器的依赖性。 这些依赖可能包括一个可执行的二进制文件、系统库、系统工具、环境变量和其他必要的平台设置。 容器镜像是应用程序容器化的结果，通常存储在容器注册表中，在那里可以下载并使用容器运行时接口（CRI）作为一个孤立的进程运行。",{"aliases":["Container Image"]}],
        ["容器编排","Container Orchestration","devops","容器编排指的是在动态的环境中自动管理容器化应用的生命周期。 这通过一个容器编排器（大多是 Kubernetes）来执行，实现部署、（自动）扩缩、自愈和监控。 编排是一个比喻用词：编排工具像乐队指挥一样指挥众多容器，确保每个容器（或乐手）各行其是。",{"aliases":["Container Orchestration"]}],
        ["容器化","Containerization","devops","容器化是将一个应用程序及其依赖关系捆绑到 容器镜像中的过程。 容器构建过程需要遵守 开放容器倡议(OCI) 标准。 只要输出的是一个符合这个标准的容器镜像，使用哪种容器化工具并不重要。",{"aliases":["Containerization"]}],
        ["容器即服务 (CaaS)","Containers as a Service","devops","容器即服务（CaaS）是一种云服务，有助于使用基于 容器 的 抽象 管理和部署应用程序。 这项服务可以部署在企业内部或云中。",{"aliases":["Containers as a Service"]}],
        ["持续交付 (CD)","Continuous Delivery (CD)","devops","持续交付，通常缩写为 CD，是一套实践，其中代码的变化被自动部署到验收环境中（或者，在持续部署的情况下，部署到生产中）。 CD 关键是包括确保软件在部署前得到充分测试的程序，并提供一种在认为必要时回滚修改的方法。 持续集成（CI）是实现持续交付的第一步（也就是说，在测试和部署之前。",{"aliases":["Continuous Delivery (CD)"]}],
        ["持续部署 (CD)","Continuous Deployment (CD)","devops","持续部署，通常缩写为 CD，通过将已经完成的软件直接部署到生产环境，比持续交付更进了一步。持续部署 (CD) 与持续集成(CI) 一起，通常被称为 CI/CD。 CI 流程测试给定应用程序的修改是否正确，CD 流程自动部署企业测试环境的代码更改到生产环境。",{"aliases":["Continuous Deployment (CD)"]}],
        ["数据中心","Datacenter","devops","数据中心是专门设计用于容纳计算机（通常是服务器）的专用建筑物或设施。 数据中心往往连接到高速互联网线路，尤其是专注于 云计算 的数据中心。 数据中心所在的建筑物还配备了即使在发生负面事件时也能维持服务的设备，例如在停电期间提供电力的发电机，以及处理计算机产生的废热的强大空调。",{"aliases":["Datacenter"]}],
        ["数据库即服务 (DBaaS)","Database as a Service (DBaaS)","devops","数据库即服务 (DBaaS) 是由云运营商（公共或私有）管理的服务，它支持应用程序，而无需应用程序团队执行传统的数据库管理功能。 DBaaS 允许应用程序开发人员利用数据库，而无需成为专家或聘请数据库管理员 (DBA) 来保持数据库最新状态。",{"aliases":["Database as a Service (DBaaS)"]}],
        ["调试","Debugging","devops","调试是从计算机程序、软件或系统中查找并解决故障（或错误） 以获得预期结果的过程或活动。 故障是导致不正确或不符合预期结果的缺陷或问题。",{"aliases":["Debugging"]}],
        ["开发运维 (DevOps)","DevOps","devops","开发运维是一种方法论，其中团队拥有从应用程序开发到生产操作的整个过程，因此 DevOps，它不仅仅是实施一套技术，还需要文化和流程的彻底转变。 DevOps 需要一组工程师来处理小组件（相对于整个功能），从而减少交接——一个常见的错误来源。",{"aliases":["DevOps"]}],
        ["分布式应用","Distributed Apps","devops","分布式应用是一种应用，其功能被分解成多个较小的独立部分。 分布式应用通常由单独的 微服务 组成，处理更广泛应用中的不同问题。 在云原生环境中，各个组件通常作为 容器 在 集群 上运行。",{"aliases":["Distributed Apps"]}],
        ["分布式系统","Distributed System","devops","分布式系统是通过网络连接的自主计算元素的集合，在用户看来是一个单一的连贯系统。 一般被称为 节点，这些组件可以是硬件设备（如电脑、手机）或软件进程。 节点被编程以实现一个共同的目标，为了协作，它们通过网络交换信息。",{"aliases":["Distributed System"]}],
        ["边缘计算","Edge Computing","devops","边缘计算是一种分布式系统方法，它将一些存储和计算容量从主数据中心转移到其他数据源。 采集的数据在本地（例如在工厂车间、商店或整个城市）进行计算，而不是发送到集中的数据中心进行处理和分析。 这些本地处理单元或设备代表系统的边缘，而数据中心是这些边缘的中心。 边缘计算的输出被发送回主数据中心进一步处理。",{"aliases":["Edge Computing"]}],
        ["事件驱动架构","Event-Driven Architecture","devops","事件驱动架构是一种提倡事件的创建、处理和消费的软件架构。 事件是对应用程序状态的任何更改。 例如，在拼车应用上叫车代表一个事件。 这种架构创建了一个结构，在该结构中，事件可以从它们的源（请求乘车的应用程序）正确地路由到所需的接收器（附近可用司机的应用程序）。",{"aliases":["Event-Driven Architecture"]}],
        ["防火墙","Firewall","security","防火墙是一个基于特定规则过滤网络流量的系统。防火墙可以是硬件、软件，或者是两者的组合。",{"aliases":["Firewall"]}],
        ["基础设施即服务 (IaaS)","Infrastructure as a Service (IaaS)","devops","基础设施即服务，或者 IaaS ，是一种 云计算 服务模型， 它提供 物理 或 虚拟 的计算、存储和网络资源，使用按需按量的计费模式。 云提供商拥有和管理软件和硬件设施，可供消费者在公共、私有或混合云部署和使用。",{"aliases":["Infrastructure as a Service (IaaS)"]}],
        ["负载均衡器","Load Balancer","devops","负载均衡器是一种在后端的一组服务器之间分配传入网络流量的方法。 该解决方案可以是基于软件或硬件的。",{"aliases":["Load Balancer"]}],
        ["松耦合架构","Loosely Coupled Architecture","system","松耦合架构（紧耦合架构的相反范式）是一种架构风格， 其中应用程序的各个组件彼此独立构建。 每个组件，有时称为 微服务，都是为了执行特定功能而构建的， 以便被任意数量的其他服务使用。 这种模式的实现通常比紧耦合架构慢。 但有许多好处，特别是随着应用程序的不断扩展。",{"aliases":["Loosely Coupled Architecture"]}],
        ["单体应用","Monolithic Apps","devops","单体应用在一个简单可部署的程序中包含所有的功能。在制作一个应用程序时，这通常是最简单和最容易的开始。 然而，一旦应用程序的复杂性增加，单体式就会变得难以维护。随着更多的开发人员在同一个代码库上工作，发生冲突性变化的可能性和开发人员之间的人际沟通的需要就会增加。",{"aliases":["Monolithic Apps"]}],
        ["多租户模式","Multitenancy","system","多租户模式指的是通过单次软件安装为多个租户提供服务。 租户是一个用户、应用程序或一组用户/应用程序，租户们使用各自的数据集来操控同一个软件。 这些租户不共享数据（除非软件的所有者明确授权），甚至可能未意识到彼此的存在。",{"aliases":["Multitenancy"]}],
        ["双向传输层安全性协议（mTLS）","Mutual Transport Layer Security (mTLS)","security","双向 TLS (mTLS) 是一种用于对两个服务之间发送的消息进行身份验证和加密的技术。 双向 TLS (mTLS) 是标准的传输层安全性协议(TLS) ， 但不是仅验证一个连接的身份，而是验证双方。",{"aliases":["Mutual Transport Layer Security (mTLS)"]}],
        ["平台即服务 (PaaS)","Platform as a Service (PaaS)","devops","平台即服务（PaaS）是应用程序开发团队部署和运行其应用程序的外部平台。 Heroku、Cloud Foundry、App Engine 是 PaaS 产品的示例。",{"aliases":["Platform as a Service (PaaS)"]}],
        ["策略即代码 (PaC)","Policy as Code (PaC)","devops","策略即代码是将一些策略的定义存储为一个或多个机器可读和可处理格式文件的做法。 这取代了在传统模型中，以人类可读的形式记录在单独文档中的策略。",{"aliases":["Policy as Code (PaC)"]}],
        ["可移植性","Portability","system","可移植性是一种软件特征，一种可重用性的形式，有助于避免“锁定”到某些操作环境， 例如云提供商、操作系统或供应商。",{"aliases":["Portability"]}],
        ["可靠性","Reliability","system","从云原生的角度来看，可靠性是指系统对故障的响应能力。 如果我们有一个可以在基础架构更改和单个组件发生故障时继续工作的分布式系统 ，那么它是可靠的。 另一方面，如果它很容易出现故障，并且需要操作人员手动干预以保持其运行，则它是不可靠的。 云原生应用程序 的目标是构建内在可靠的系统。",{"aliases":["Reliability"]}],
        ["可伸缩性","Scalability","system","可伸缩性指的是一个系统能有多大的发展。这就是增加做任何系统应该做的事情的能力。 例如，Kubernetes 集群 通过增加或减少 容器化 应用程序的数量来进行伸缩，但这种可伸缩性取决于几个因素。 它有多少节点，每个节点可以处理多少个容器，控制平面可以支持多少条记录和操作？",{"aliases":["Scalability"]}],
        ["安全混沌工程","Security Chaos Engineering","security","安全混沌工程（SCE） 是基于混沌工程的学科。 SCE 是指在分布式系统上执行主动安全实验，以建立对系统抵御动荡和恶意条件能力的信心。安全混沌工程师使用科学方法来不断实现这一点，这些方法包括稳态、假设、持续验证、经验教训和缓解实施。",{"aliases":["Security Chaos Engineering"]}],
        ["自愈","Self Healing","system","一个自愈系统无需任何人为干预就能从某些类型的故障中恢复。 这种系统有一个“收敛”或“控制”循环，可以主动查看系统的实际状态并将其与操作员最初期望的状态进行比较。 如果有所差异（例如运行的应用程序实例数少于预期实例数），它将采取修正措施（例如启动新的实例）。",{"aliases":["Self Healing"]}],
        ["服务网格","Service Mesh","net","在 微服务 的理念里，应用程序被分解成多个较小的 服务，通过网络进行通信。 就像你的 WIFI 网络一样，计算机网络本质上是不可靠的，可被黑客攻击的，而且往往很慢。 服务网格通过管理服务之间的流量（即通信），并在所有服务中统一添加 可靠性、可观察性 和安全功能来解决这一系列新的挑战。",{"aliases":["Service Mesh"]}],
        ["服务代理","Service Proxy","net","服务代理拦截进出某项 服务 的流量，对其应用一些逻辑，然后将该流量转发给另一项服务。 它本质上是一个“中间人”，收集有关网络流量的信息，并决定是否对其应用规则。",{"aliases":["Service Proxy"]}],
        ["左移 (Shift Left)","Shift Left","devops","如果将软件开发的生命周期视为一个从左到右执行的阶段线，左移中的左指的是这个生命周期的早期阶段。 左移是在软件开发生命周期的早期阶段实施测试、安全或其他开发实践，而不是朝着结尾方向（右移）进行的实践。",{"aliases":["Shift Left"]}],
        ["网站可靠性工程（SRE)","Site Reliability Engineering","devops","网站可靠性工程（SRE） 是一门结合运营和软件工程的学科。 后者特别适用于基础设施和运营问题。 这意味着，网站可靠性工程师不是构建产品功能，而是构建系统来运行应用程序。 与 DevOps 有相似之处，但 DevOps 专注于将代码投入生产环境， 而 SRE 是确保在生产环境中运行的代码正常工作。",{"aliases":["Site Reliability Engineering"]}],
        ["有状态应用","Stateful Apps","devops","当我们说到有状态（和无状态）应用时， 状态是指应用需要存储以便其按设计运行的任何数据。 例如，任何能记住您购物车的在线商店都是有状态应用。",{"aliases":["Stateful Apps"]}],
        ["无状态应用","","devops","无状态应用不会在应用所在的服务器上保存任何客户端会话（状态）数据。 每个会话都像第一次一样执行，响应不依赖于前一个会话的数据并提供使用打印服务、内容分发网络（CDN）或 Web 服务器的功能，以处理每个短期请求。 例如，有人在搜索引擎中搜索某个问题并按下了回车键。"],
        ["紧耦合架构","","system","紧耦合架构（松耦合架构的相反范式）是一种架构风格， 其中许多应用程序组件相互依赖。 这意味着一个组件的更改可能会影响其他组件。 它通常比松耦合架构更容易实现， 但会使系统更容易受到级联故障的影响。 它还意味着需要协调各个组件的部署， 这可能会拖累开发人员的生产力。"],
        ["版本控制","Version Control","devops","源代码管理（或版本控制）是一种跟踪和管理文档更改的行为。 它是一个持续记录单个文件或一组文件变化的系统，以便你在以后可以回退到特定版本。",{"aliases":["Version Control"]}],
        ["垂直伸缩","Vertical Scaling","devops","垂直伸缩，也称为“向上和向下伸缩”，是一种通过在工作负载增加时向单个节点添加CPU和内存来增加系统容量的技术。 假设您有一台 4GB RAM 的计算机，并且想要将其容量增加到 16GB RAM，垂直伸缩就意味着切换到 16GB RAM 系统。 （请参阅水平伸缩了解不同的伸缩方法。）。",{"aliases":["Vertical Scaling"]}],
        ["虚拟机","Virtual Machine","devops","虚拟机（VM）是一台计算机及其操作系统，不受特定硬件的约束。 虚拟机依靠 虚拟化 将一台物理计算机分割成多个虚拟计算机。 这种分离使组织和基础设施供应商能够轻松地创建和销毁虚拟机，而不影响底层硬件。",{"aliases":["Virtual Machine"]}],
        ["虚拟化","Virtualization","devops","虚拟化，在云原生计算的背景下，是指将一台物理计算机，有时称为服务器，并允许它运行多个隔离的操作系统的过程。 这些隔离的操作系统及其专用的计算资源（CPU、内存和网络）被称为虚拟机或VM。 当我们谈论虚拟机时，我们在谈论一个软件定义的计算机。 它看起来和行动都像一台真正的计算机。",{"aliases":["Virtualization"]}],
        ["零信任架构","Zero Trust Architecture","security","零信任架构规定了一种完全消除信任的IT系统设计和实施方法。其核心原则是 \"永不信任，永远验证\"，设备或系统本身在与系统的其他组件进行通信时，总是先验证自己。 在今天的许多网络中，在企业网络中，内部的系统和设备可以自由地相互通信，因为它们在企业网络外围的信任边界内。 零信任架构采取了相反的方法。",{"aliases":["Zero Trust Architecture"]}],
        ["GitHub","GitHub","practice","全球最大的代码托管与开源协作平台，程序员的「代码朋友圈」。"],
        ["Star","Star","practice","给项目点赞收藏，表示「这个有用」。",{"aliases":["星星"]}],
        ["Fork","Fork","practice","复制别人的仓库到你账号下，可自由修改。",{"aliases":["复刻"]}],
        ["Issue","Issue","practice","提 Bug、提需求、讨论问题的工单。",{"aliases":["议题"]}],
        ["Clone","Clone","practice","把远程仓库完整下载到本机。",{"aliases":["克隆"]}],
        ["Merge","Merge","practice","把分支改动合进主分支。",{"aliases":["合并"]}],
        ["Repository","Repository","practice","存放项目全部文件与历史的文件夹。",{"aliases":["仓库"]}],
        ["开源","Open Source","practice","公开源代码，他人可查看、使用、贡献。",{"aliases":["Open Source"]}],
        ["开源协议","License","practice","规定别人如何使用你的代码。",{"aliases":["License"]}],
        ["README","README","practice","项目首页说明，第一眼看到的内容。"],
        ["Release","Release","practice","打包标记的稳定版本，方便下载。",{"aliases":["发行版"]}],
        ["系统提示","System Prompt","ai","设定 AI 角色与行为边界的隐藏指令。",{"aliases":["System Prompt"]}],
        ["氛围编程","Vibe Coding","ai","用自然语言描述意图，让 AI 写大部分代码。",{"aliases":["Vibe Coding"]}],
        ["工具使用","Tool Use","ai","AI 调用搜索、代码执行等外部能力。",{"aliases":["Tool Use"]}],
        ["护栏","Guardrails","ai","限制 AI 输出范围的安全规则。",{"aliases":["Guardrails"]}],
        ["Cursor","Cursor","ai","内置 AI 的代码编辑器，基于 VS Code。"],
        ["Copilot","Copilot","ai","AI 在编码时实时补全与建议。",{"aliases":["副驾驶"]}],
        ["Claude Code","Claude Code","ai","Anthropic 的终端 AI 编程 Agent。"],
        ["Claude Desktop","Claude Desktop","ai","Anthropic 官方桌面聊天客户端。"],
        ["Rules","Rules","ai","持久化告诉 AI 项目规范与偏好。",{"aliases":["规则"]}],
        ["Composer","Composer","ai","Cursor 中多文件协同编辑的 AI 模式。"],
        ["Tab 补全","Tab Completion","ai","按 Tab 接受 AI 生成的代码建议。",{"aliases":["Tab Completion"]}],
        ["代码库索引","Codebase Index","ai","AI 理解整个项目结构的预处理。",{"aliases":["Codebase Index"]}],
        ["MCP 服务器","MCP Server","ai","对外暴露工具能力，供 AI 客户端连接。",{"aliases":["MCP Server"]}],
        ["Agent 模式","Agent Mode","ai","AI 自动多步执行：读文件、改代码、跑命令。",{"aliases":["Agent Mode"]}],
        ["HTML","HTML","web","网页结构的标记语言。"],
        ["CSS","CSS","web","控制网页样式与布局。"],
        ["SEO","SEO","web","让搜索引擎更好收录网站。"],
        ["本地主机","Localhost","web","本机地址 127.0.0.1。",{"aliases":["Localhost"]}],
        ["A2A","Agent2Agent","ai","多个 AI Agent 互相通信的协议。",{"aliases":["Agent2Agent"]}],
        ["Computer Use","Computer Use","ai","AI 直接操控鼠标键盘操作电脑。"],
        ["推理模型","Reasoning Model","ai","花更多思考步骤换更高正确率。",{"aliases":["Reasoning Model"]}],
        ["上下文工程","Context Engineering","ai","设计喂给模型的信息与结构。",{"aliases":["Context Engineering"]}],
        ["评测","Evals","ai","系统化测试 AI 输出质量。",{"aliases":["Evals"]}],
        ["事实锚定","Grounding","ai","让回答基于可验证事实而非纯生成。",{"aliases":["Grounding"]}],
        ["AI 工作流","AI Workflow","ai","多个 AI 步骤串联的自动化流程。",{"aliases":["AI Workflow"]}],
        ["GitHub Actions","GitHub Actions","practice","在 GitHub 上自动跑 CI/CD 流水线。"],
        ["Discussions","Discussions","practice","仓库内的论坛式讨论区。"],
        ["Gist","Gist","practice","GitHub 的代码片段分享。"],
        ["Markdown","Markdown","practice","轻量标记语言，README 常用。"],
        ["MDC 规则","MDC Rules","ai","Cursor 的规则文件格式 .mdc。",{"aliases":["MDC Rules"]}],
        ["上下文","Context","ai","AI 当前能看到的代码与对话。",{"aliases":["Context"]}],
        ["Diff","Diff","ai","修改前后的代码对比。"],
        ["行内编辑","Inline Edit","ai","在编辑器里直接让 AI 改选中代码。",{"aliases":["Inline Edit"]}],
        ["后台 Agent","Background Agent","ai","在云端继续跑的 Agent 任务。",{"aliases":["Background Agent"]}],
        ["Bearer Token","Bearer Token","web","HTTP 头里带令牌的身份验证。"],
      ];
      const EXTERNAL_GLOSSARY_TOTAL = EXTERNAL_GLOSSARY.length;
      /* EXTERNAL-GLOSSARY:END */

const EMPTY_OPTIONS = Object.freeze({});
      /** Normalised identity used to merge curated and generated entries (case and parenthesised Latin suffixes ignored). */
      const termIdentity = (value) =>
        String(value || '')
          .toLowerCase()
          .replace(/[（(][^）)]*[）)]/g, '')
          .replace(/[\s_-]/g, '');
      const TERMS = [];
      const TERM_KEYS = new Set();
      for (const row of GLOSSARY.concat(EXTERNAL_GLOSSARY)) {
        const options = row[4] || EMPTY_OPTIONS;
        const entry = {
          term: row[0],
          full: row[1] || '',
          category: row[2],
          explanation: row[3],
          aliases: options.aliases || [],
          caseSensitive: options.cs === true,
        };
        const keys = [entry.term, entry.full, ...entry.aliases].map(termIdentity).filter(Boolean);
        if (keys.some((key) => TERM_KEYS.has(key))) continue;
        for (const key of keys) TERM_KEYS.add(key);
        TERMS.push(entry);
      }

      /** Canonical term -> dictionary entry, used when an explanation link is opened. */
      const TERM_INDEX = new Map();
      for (const entry of TERMS) TERM_INDEX.set(entry.term, entry);

      /** Display order of dictionary categories (mirrors the CATEGORIES map above). */
      const CATEGORY_ORDER = [
        'lang',
        'web',
        'server',
        'db',
        'net',
        'devops',
        'security',
        'ai',
        'system',
        'practice',
        'harness',
      ];

      /* ================================================================== *
       * User state: favorites and preferences (localStorage, never leaves the page)
       * ================================================================== */

      const STORAGE_KEYS = {
        favorites: 'dsh-term-explainer/favorites',
        settings: 'dsh-term-explainer/settings',
      };

      const DEFAULT_SETTINGS = Object.freeze({ showAction: true, contextLimit: 3, defaultSort: 'mentions' });
      const SORT_MODES = ['mentions', 'order', 'alpha'];

      function readJson(key, fallback) {
        try {
          if (typeof window === 'undefined' || !window.localStorage) return fallback;
          const raw = window.localStorage.getItem(key);
          if (!raw) return fallback;
          const parsed = JSON.parse(raw);
          return parsed == null ? fallback : parsed;
        } catch (error) {
          return fallback;
        }
      }

      function writeJson(key, value) {
        try {
          if (typeof window === 'undefined' || !window.localStorage) return false;
          window.localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (error) {
          return false;
        }
      }

      function createFavoritesStore() {
        const stored = readJson(STORAGE_KEYS.favorites, []);
        let terms = new Set(
          (Array.isArray(stored) ? stored : []).filter((term) => typeof term === 'string' && TERM_INDEX.has(term)),
        );
        const listeners = new Set();
        const emit = () => {
          for (const listener of listeners) {
            try {
              listener();
            } catch (error) {
              console.error('[term-glossary] favorites listener failed', error);
            }
          }
        };
        const persist = () => writeJson(STORAGE_KEYS.favorites, Array.from(terms));
        return {
          list: () => Array.from(terms),
          count: () => terms.size,
          has: (term) => terms.has(term),
          toggle(term) {
            if (!TERM_INDEX.has(term)) return false;
            if (terms.has(term)) terms.delete(term);
            else terms.add(term);
            persist();
            emit();
            return terms.has(term);
          },
          replace(list) {
            terms = new Set(
              (Array.isArray(list) ? list : []).filter((term) => typeof term === 'string' && TERM_INDEX.has(term)),
            );
            persist();
            emit();
          },
          /** Union the given terms into the bookmarks; returns how many were new. */
          merge(list) {
            const before = terms.size;
            for (const term of Array.isArray(list) ? list : []) {
              if (typeof term === 'string' && TERM_INDEX.has(term)) terms.add(term);
            }
            const added = terms.size - before;
            if (added > 0) {
              persist();
              emit();
            }
            return added;
          },
          clear() {
            if (terms.size === 0) return;
            terms = new Set();
            persist();
            emit();
          },
          subscribe(listener) {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          },
        };
      }

      function createSettingsStore() {
        const stored = readJson(STORAGE_KEYS.settings, {});
        const base = stored && typeof stored === 'object' ? stored : {};
        let settings = {
          showAction: base.showAction !== false,
          contextLimit: [1, 2, 3].includes(base.contextLimit) ? base.contextLimit : DEFAULT_SETTINGS.contextLimit,
          defaultSort: SORT_MODES.includes(base.defaultSort) ? base.defaultSort : DEFAULT_SETTINGS.defaultSort,
        };
        const listeners = new Set();
        const emit = () => {
          for (const listener of listeners) {
            try {
              listener();
            } catch (error) {
              console.error('[term-glossary] settings listener failed', error);
            }
          }
        };
        return {
          get: () => settings,
          update(patch) {
            if (!patch || typeof patch !== 'object') return settings;
            settings = {
              ...settings,
              ...(typeof patch.showAction === 'boolean' ? { showAction: patch.showAction } : null),
              ...([1, 2, 3].includes(patch.contextLimit) ? { contextLimit: patch.contextLimit } : null),
              ...(SORT_MODES.includes(patch.defaultSort) ? { defaultSort: patch.defaultSort } : null),
            };
            writeJson(STORAGE_KEYS.settings, settings);
            emit();
            return settings;
          },
          subscribe(listener) {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          },
        };
      }

      /** Re-render the calling component whenever the given store changes. */
      function useStoreVersion(store) {
        const [, setVersion] = React.useState(0);
        React.useEffect(
          () => store.subscribe(() => setVersion((version) => version + 1)),
          [store],
        );
      }

      /* ================================================================== *
       * Related terms, search, filtering, sorting and export helpers
       * ================================================================== */

      // Hand-picked neighbours for the most common clusters; everything else
      // falls back to the same dictionary category.
      const RELATED_TERMS = Object.freeze({
        HTTP: ['HTTPS', 'TLS', 'HTTP/2', 'HTTP/3', 'CORS'],
        HTTPS: ['TLS', '证书', 'CSP', 'HTTP'],
        TLS: ['HTTPS', '证书', 'mTLS', '数字签名', '密钥'],
        mTLS: ['TLS', '证书', '零信任'],
        SSH: ['TLS', '密钥', '证书'],
        DNS: ['域名', 'CDN', 'HTTPS'],
        CDN: ['DNS', '缓存', '负载均衡'],
        CORS: ['同源策略', 'CSP', 'HTTP'],
        CSP: ['XSS', '同源策略', 'CORS'],
        WebSocket: ['SSE', 'HTTP/2', 'QUIC'],
        SSE: ['WebSocket', 'HTTP/2', '流式输出'],
        QUIC: ['HTTP/3', 'UDP', 'TCP'],
        'HTTP/2': ['HTTP', 'HTTPS', 'QUIC', 'TLS'],
        'HTTP/3': ['QUIC', 'HTTP/2', 'UDP'],
        TCP: ['UDP', 'QUIC', 'HTTP/2'],
        VPN: ['NAT', '子网', 'VPC'],
        NAT: ['子网', 'VPC', 'VPN'],
        VPC: ['子网', '安全组', 'NAT'],
        安全组: ['VPC', '子网', '零信任'],
        域名: ['DNS', 'HTTPS', '证书'],
        Docker: ['容器', '镜像', 'Kubernetes', 'Pod'],
        容器: ['Docker', '镜像', 'Kubernetes', 'Pod'],
        镜像: ['Docker', '容器', '制品'],
        Kubernetes: ['Pod', 'Helm', '容器', '服务发现', 'Docker'],
        Pod: ['Kubernetes', '容器', 'Docker'],
        Helm: ['Kubernetes', '制品', '部署'],
        CI: ['流水线', '构建', '制品', '测试覆盖'],
        流水线: ['CI', '构建', '制品'],
        IaC: ['Terraform', 'Ansible', '配置中心'],
        Terraform: ['IaC', 'Ansible', '构建'],
        Ansible: ['IaC', 'Terraform', '配置中心'],
        Nginx: ['反向代理', '负载均衡', '正向代理'],
        可观测性: ['链路追踪', '指标', 'SLO'],
        链路追踪: ['可观测性', '指标', 'QPS'],
        指标: ['可观测性', '链路追踪', 'SLO', 'SLA'],
        SLO: ['SLA', '指标', 'QPS'],
        SLA: ['SLO', '指标', '容灾'],
        灰度: ['蓝绿部署', '灰度发布', '特性开关'],
        蓝绿部署: ['灰度发布', '灰度', '回滚'],
        灰度发布: ['灰度', '蓝绿部署', '回滚'],
        回滚: ['灰度发布', '蓝绿部署', '热修复'],
        热更新: ['热修复', '部署', '回滚'],
        热修复: ['热更新', '回滚', '部署'],
        部署: ['构建', '制品', '灰度发布', '回滚'],
        构建: ['制品', '部署', 'CI', '打包器'],
        制品: ['构建', '部署', '镜像'],
        服务发现: ['注册中心', '负载均衡', 'Kubernetes'],
        注册中心: ['服务发现', '配置中心', '负载均衡'],
        负载均衡: ['反向代理', '服务发现', '注册中心', '高可用'],
        反向代理: ['正向代理', '负载均衡', 'Nginx'],
        正向代理: ['反向代理', 'VPN'],
        'API 网关': ['反向代理', '限流', '微服务'],
        微服务: ['API 网关', '服务发现', '单体架构', '分布式事务'],
        熔断: ['限流', '降级', '重试', '背压'],
        限流: ['熔断', '降级', '背压'],
        降级: ['熔断', '限流', '容灾'],
        背压: ['限流', '消息队列', '熔断'],
        消息队列: ['生产者-消费者', '死信队列', '背压'],
        死信队列: ['消息队列', '重试', '指数退避'],
        重试: ['指数退避', '超时', '熔断'],
        指数退避: ['重试', '超时', '限流'],
        缓存: ['缓存穿透', '缓存雪崩', 'Redis', '缓冲'],
        缓存穿透: ['缓存雪崩', '布隆过滤器', '缓存'],
        缓存雪崩: ['缓存穿透', '布隆过滤器', '缓存', '熔断'],
        布隆过滤器: ['缓存穿透', '缓存雪崩', '哈希'],
        Redis: ['缓存', '主从复制', '连接池'],
        Kafka: ['消息队列', '死信队列', '事务'],
        Elasticsearch: ['倒排索引', '索引', '向量数据库'],
        索引: ['覆盖索引', '回表', '慢查询', 'B+ 树'],
        覆盖索引: ['索引', '回表', '慢查询'],
        回表: ['覆盖索引', '索引', 'B+ 树'],
        慢查询: ['索引', '连接池', 'N+1 查询'],
        连接池: ['慢查询', '缓冲', '分片'],
        事务: ['分布式事务', '隔离级别', 'ACID', '幂等'],
        分布式事务: ['两阶段提交', 'Saga', '最终一致性', '事务'],
        两阶段提交: ['Saga', '分布式事务', '最终一致性'],
        Saga: ['两阶段提交', '分布式事务', '最终一致性'],
        最终一致性: ['BASE', 'CAP 定理', '分布式事务'],
        'CAP 定理': ['BASE', '最终一致性', '一致性哈希'],
        BASE: ['CAP 定理', '最终一致性', 'ACID'],
        ACID: ['隔离级别', 'MVCC', '事务'],
        隔离级别: ['MVCC', 'ACID', '乐观锁'],
        MVCC: ['隔离级别', 'ACID', 'WAL'],
        WAL: ['MVCC', '主从复制', 'ACID'],
        主从复制: ['读写分离', '复制延迟', '分片'],
        读写分离: ['主从复制', '复制延迟', '负载均衡'],
        复制延迟: ['主从复制', '读写分离', '最终一致性'],
        分片: ['分区', '一致性哈希', '水平扩展'],
        分区: ['分片', '数据仓库', '水平扩展'],
        乐观锁: ['悲观锁', 'MVCC', '事务'],
        悲观锁: ['乐观锁', '事务', '隔离级别'],
        倒排索引: ['Elasticsearch', '索引', '向量数据库'],
        OLTP: ['OLAP', '数据仓库', '事务'],
        OLAP: ['OLTP', '数据仓库', '数据湖'],
        数据仓库: ['数据湖', 'OLAP', 'ETL'],
        数据湖: ['数据仓库', 'ETL', 'OLAP'],
        ETL: ['数据仓库', '数据湖', '流水线'],
        ORM: ['N+1 查询', '连接池', '索引'],
        'N+1 查询': ['ORM', '慢查询', '连接池'],
        向量数据库: ['HNSW', '近似最近邻', '嵌入向量', 'RAG'],
        HNSW: ['近似最近邻', '向量数据库', '嵌入向量'],
        近似最近邻: ['HNSW', '向量数据库', '嵌入向量'],
        'B+ 树': ['LSM 树', '索引', '覆盖索引'],
        'LSM 树': ['B+ 树', 'WAL', '索引'],
        缓冲: ['缓存', '连接池', 'WAL'],
        RAG: ['嵌入向量', '向量数据库', 'LLM', '幻觉'],
        LLM: ['Token', '上下文窗口', 'Prompt', 'Agent'],
        Token: ['上下文窗口', 'LLM', '批处理'],
        上下文窗口: ['Token', 'LLM', '上下文压缩'],
        Prompt: ['提示词工程', 'LLM', '温度'],
        提示词工程: ['Prompt', '思维链', '幻觉'],
        幻觉: ['RAG', '提示注入', 'LLM'],
        嵌入向量: ['向量数据库', 'RAG', 'HNSW', 'Transformer'],
        微调: ['LoRA', 'SFT', 'RLHF', '预训练'],
        LoRA: ['微调', 'SFT', '参数'],
        RLHF: ['SFT', 'DPO', '对齐', '微调'],
        SFT: ['微调', 'RLHF', 'DPO'],
        DPO: ['RLHF', 'SFT', '对齐'],
        对齐: ['RLHF', 'DPO', '幻觉'],
        'Function Calling': ['工具调用', 'MCP', 'Agent'],
        MCP: ['Function Calling', '工具调用', 'Agent'],
        多模态: ['扩散模型', 'Transformer', '嵌入向量'],
        Transformer: ['注意力机制', '嵌入向量', 'LLM'],
        注意力机制: ['Transformer', '思维链', '参数'],
        MoE: ['量化', '蒸馏', '剪枝', '参数'],
        量化: ['蒸馏', '剪枝', 'MoE'],
        蒸馏: ['量化', '剪枝', '微调'],
        剪枝: ['量化', '蒸馏', 'MoE'],
        批处理: ['推理', '训练', '参数'],
        过拟合: ['正则化', '梯度下降', '训练'],
        正则化: ['过拟合', '梯度下降', '损失函数'],
        梯度下降: ['反向传播', '损失函数', '正则化'],
        反向传播: ['梯度下降', '损失函数', '训练'],
        损失函数: ['梯度下降', '反向传播', '过拟合'],
        推理: ['训练', '预训练', '量化', '上下文窗口'],
        训练: ['预训练', '微调', '推理'],
        预训练: ['训练', '微调', 'LLM'],
        参数: ['微调', '预训练', '量化'],
        Agent: ['工具调用', 'LLM', '子代理', '技能'],
        思维链: ['Prompt', '推理', 'Agent'],
        温度: ['Prompt', 'LLM', '推理'],
        扩散模型: ['多模态', 'GAN', 'CNN'],
        CNN: ['RNN', 'LSTM', 'GAN'],
        RNN: ['LSTM', 'Transformer', 'CNN'],
        LSTM: ['RNN', 'Transformer', 'CNN'],
        GAN: ['扩散模型', 'CNN', '多模态'],
        GC: ['JIT', 'AOT', '内存泄漏'],
        JIT: ['AOT', '字节码', '编译器'],
        AOT: ['JIT', '编译器', '字节码'],
        字节码: ['JIT', '编译器', '解释器'],
        编译器: ['解释器', '字节码', '链接器'],
        解释器: ['编译器', '字节码', 'JIT'],
        链接器: ['编译器', '字节码', 'AOT'],
        线程: ['进程', '协程', '死锁', '竞态条件'],
        进程: ['线程', '协程', '上下文切换'],
        协程: ['线程', '进程', '异步'],
        死锁: ['竞态条件', '线程', '分布式锁'],
        竞态条件: ['死锁', '线程', '并发'],
        内存泄漏: ['GC', '虚拟内存', '进程'],
        虚拟内存: ['内存泄漏', '上下文切换', '内核'],
        上下文切换: ['线程', '进程', '协程'],
        系统调用: ['内核', '虚拟内存', '进程'],
        内核: ['系统调用', '虚拟内存', '上下文切换'],
        GPU: ['TPU', 'CUDA', '显存'],
        TPU: ['GPU', 'CUDA', '显存'],
        CUDA: ['GPU', '显存', 'TPU'],
        显存: ['GPU', 'CUDA', 'TPU'],
        闭包: ['回调', '函数式编程', '副作用'],
        回调: ['闭包', 'Promise', '事件驱动'],
        泛型: ['类型推导', '鸭子类型', 'DSL'],
        正则表达式: ['DSL', 'AST', 'Linter'],
        柯里化: ['函数式编程', '闭包', 'Lambda'],
        函数式编程: ['闭包', '副作用', '声明式', '柯里化'],
        面向对象编程: ['SOLID', '设计模式', '单例模式'],
        SOLID: ['面向对象编程', '设计模式', '依赖注入'],
        设计模式: ['面向对象编程', '单例模式', '依赖注入'],
        中间件: ['依赖注入', '插件', '反向代理'],
        依赖注入: ['中间件', '装饰器', '反射'],
        装饰器: ['反射', '依赖注入', '泛型'],
        反射: ['装饰器', '依赖注入', '类型推导'],
        序列化: ['反序列化', '类型推导', 'RPC'],
        反序列化: ['序列化', 'RPC', '反射'],
        钩子: ['副作用', '生命周期', '事件驱动'],
        副作用: ['函数式编程', '闭包', '钩子'],
        生命周期: ['钩子', '状态机', '副作用'],
        状态机: ['生命周期', '事件驱动', '声明式'],
        声明式: ['响应式编程', '函数式编程', '状态机'],
        惰性求值: ['函数式编程', '声明式', '柯里化'],
        类型推导: ['泛型', '鸭子类型', '声明式'],
        鸭子类型: ['类型推导', '泛型', '面向对象编程'],
        单例模式: ['设计模式', '面向对象编程', '依赖注入'],
        事件驱动: ['回调', '钩子', '响应式编程'],
        响应式编程: ['声明式', '流式输出', '事件驱动'],
        流式输出: ['响应式编程', 'SSE', '异步'],
        并发: ['并行', '异步', '竞态条件', '线程'],
        并行: ['并发', '异步', '线程'],
        阻塞: ['异步', '并发', '协程'],
        异步: ['阻塞', '并发', 'Promise', '回调'],
        Promise: ['异步', 'async/await', '回调'],
        'async/await': ['Promise', '异步', '协程'],
        Lambda: ['函数式编程', '柯里化', '闭包'],
        DOM: ['虚拟 DOM', '水合', 'SPA'],
        '虚拟 DOM': ['DOM', '水合', 'React'],
        SPA: ['SSR', 'CSR', '水合'],
        SSR: ['CSR', '水合', 'SPA'],
        CSR: ['SSR', 'SPA', '水合'],
        水合: ['SSR', 'DOM', '虚拟 DOM'],
        HMR: ['Vite', 'Webpack', '热更新'],
        'Tree-shaking': ['打包器', 'Webpack', 'Vite'],
        打包器: ['Tree-shaking', 'Vite', 'Webpack', '构建'],
        Vite: ['打包器', 'HMR', 'Webpack'],
        Webpack: ['打包器', 'Vite', 'Tree-shaking'],
        React: ['虚拟 DOM', '水合', 'Vue', '状态管理'],
        Vue: ['React', '状态管理', '虚拟 DOM'],
        TypeScript: ['JavaScript', '泛型', '类型推导'],
        JavaScript: ['TypeScript', 'Node.js', 'DOM'],
        'Node.js': ['npm', '异步', 'JavaScript'],
        npm: ['Node.js', '语义化版本', '依赖'],
        PWA: ['WASM', 'SPA', '缓存'],
        WASM: ['PWA', 'JavaScript', 'JIT'],
        状态管理: ['React', 'Vue', '响应式编程'],
        跨域: ['CORS', '同源策略', 'CSP'],
        埋点: ['可观测性', '指标', '审计日志'],
        IDE: ['CLI', 'Linter', '静态分析'],
        Git: ['提交', '分支', '变基', 'Pull Request'],
        提交: ['Git', '分支', 'Pull Request'],
        分支: ['Git', '提交', '变基'],
        变基: ['分支', '提交', 'Git'],
        'Pull Request': ['代码审查', 'Git', '分支'],
        代码审查: ['Pull Request', 'Linter', '技术债'],
        Linter: ['静态分析', '格式化', '代码审查'],
        静态分析: ['Linter', '格式化', '类型推导'],
        单元测试: ['集成测试', '测试覆盖', 'TDD'],
        集成测试: ['单元测试', '端到端测试', '测试覆盖'],
        端到端测试: ['集成测试', '单元测试', '冒烟测试'],
        回归测试: ['单元测试', '测试覆盖', '冒烟测试'],
        测试覆盖: ['单元测试', '集成测试', 'TDD'],
        Mock: ['单元测试', '集成测试', '端到端测试'],
        冒烟测试: ['回归测试', '端到端测试', '单元测试'],
        TDD: ['单元测试', '重构', '测试覆盖'],
        重构: ['技术债', '代码坏味道', 'TDD'],
        技术债: ['重构', '代码坏味道', '可维护性'],
        代码坏味道: ['重构', '技术债', '可维护性'],
        可维护性: ['重构', '技术债', '代码坏味道'],
        语义化版本: ['npm', '锁文件', '依赖'],
        Monorepo: ['依赖', '锁文件', '构建'],
        格式化: ['Linter', '静态分析', '代码审查'],
        依赖: ['锁文件', 'npm', '语义化版本'],
        锁文件: ['依赖', 'npm', '语义化版本'],
        环境变量: ['配置中心', '凭据', '密钥'],
        'A/B 测试': ['压测', '指标', '灰度发布'],
        无障碍: ['DOM', '指标', '可观测性'],
        Harness: ['Cordis', '插件', 'Bundle', 'Profile'],
        Cordis: ['Harness', '插件', '槽位'],
        插件: ['Bundle', '槽位', 'Cordis', 'Harness'],
        Bundle: ['插件', '补丁', 'Profile'],
        Profile: ['Bundle', '补丁', 'Harness'],
        补丁: ['Bundle', 'Profile', '插件'],
        槽位: ['插件', '投影', 'Cordis'],
        投影: ['槽位', '会话', 'Bundle'],
        会话: ['工作区', '投影', '技能'],
        工具调用: ['Function Calling', 'Agent', '技能'],
        技能: ['Agent', '工具调用', '工作区', '子代理'],
        工作区: ['会话', '技能', '子代理'],
        子代理: ['Agent', '工作区', '技能'],
        上下文压缩: ['上下文窗口', 'Token', '会话'],
      });

      function relatedTerms(entry) {
        if (!entry) return [];
        const seen = new Set([entry.term]);
        const related = [];
        const add = (term) => {
          if (related.length >= 4 || seen.has(term)) return;
          const target = TERM_INDEX.get(term);
          if (!target) return;
          seen.add(term);
          related.push(target);
        };
        for (const term of RELATED_TERMS[entry.term] || []) add(term);
        if (related.length >= 4) return related;
        const start = TERMS.indexOf(entry);
        for (let offset = 1; offset <= TERMS.length && related.length < 4; offset += 1) {
          const candidate = TERMS[(start + offset + TERMS.length) % TERMS.length];
          if (candidate.category === entry.category) add(candidate.term);
        }
        return related;
      }

      function matchesQuery(item, query) {
        if (!query) return true;
        const needle = String(query).trim().toLowerCase();
        if (!needle) return true;
        const text = (value) => String(value == null ? '' : value).toLowerCase();
        if (text(item.term).includes(needle) || text(item.full).includes(needle) || text(item.explanation).includes(needle)) {
          return true;
        }
        // Scan results carry no aliases, so fall back to the dictionary entry.
        const fallback = TERM_INDEX.get(item.term);
        const aliases = Array.isArray(item.aliases) ? item.aliases : (fallback && fallback.aliases) || [];
        return aliases.some((alias) => text(alias).includes(needle));
      }

      function filterTerms(items, filters) {
        const query = filters && filters.query;
        const category = filters && filters.category;
        const onlyFavorites = filters && filters.onlyFavorites;
        const favorites = filters && filters.favorites;
        return (Array.isArray(items) ? items : []).filter((item) => {
          if (category && item.category !== category) return false;
          if (onlyFavorites && !(favorites && favorites.has && favorites.has(item.term))) return false;
          return matchesQuery(item, query);
        });
      }

      function sortTerms(items, sort) {
        const list = (Array.isArray(items) ? items : []).slice();
        if (sort === 'alpha') {
          list.sort((a, b) => String(a.term).localeCompare(String(b.term), 'zh-Hans-CN'));
        } else if (sort === 'mentions') {
          list.sort((a, b) => (b.count || 0) - (a.count || 0));
        }
        return list;
      }

      function categoryCounts(items) {
        const counts = {};
        for (const item of items) counts[item.category] = (counts[item.category] || 0) + 1;
        return counts;
      }

      function csvCell(value) {
        let text = value == null ? '' : String(value);
        // Spreadsheet apps treat these as formulas; a leading quote keeps the text literal.
        if (/^[=+\-@\t]/.test(text)) text = "'" + text;
        return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
      }

      function snippetLine(item) {
        const snippet = item && Array.isArray(item.snippets) ? item.snippets[0] : null;
        if (!snippet) return '';
        return cleanInline(
          (snippet.prefix || '') + snippet.before + snippet.hit + snippet.after + (snippet.suffix || ''),
        ).trim();
      }

      function exportMarkdown(items) {
        const rows = ['| 术语 | 英文全称 | 分类 | 提及次数 | 释义 |', '| --- | --- | --- | --- | --- |'];
        for (const item of items) {
          const cells = [item.term, item.full || '', item.category || '', item.count || 0, item.explanation || ''].map((value) =>
            String(value == null ? '' : value).replace(/\|/g, '\\|'),
          );
          rows.push('| ' + cells.join(' | ') + ' |');
        }
        return rows.join('\n');
      }

      function exportCsv(items) {
        const rows = ['term,explanation,context,full_name,category,mentions'];
        for (const item of items) {
          rows.push(
            [item.term, item.explanation, snippetLine(item), item.full || '', item.category || '', item.count || 0]
              .map(csvCell)
              .join(','),
          );
        }
        return '\uFEFF' + rows.join('\r\n');
      }

      function copyText(text) {
        try {
          if (
            typeof navigator !== 'undefined' &&
            navigator.clipboard &&
            typeof navigator.clipboard.writeText === 'function'
          ) {
            return Promise.resolve(navigator.clipboard.writeText(text)).then(
              () => true,
              () => false,
            );
          }
        } catch (error) {
          /* fall through to unsupported */
        }
        return Promise.resolve(false);
      }

      function downloadText(filename, text, mime) {
        try {
          if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof document === 'undefined') return false;
          const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.rel = 'noopener';
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => {
            try {
              URL.revokeObjectURL(url);
            } catch (error) {
              /* ignore */
            }
          }, 1000);
          return true;
        } catch (error) {
          return false;
        }
      }

      /* ================================================================== *
       * Scanner
       * ================================================================== */

      const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;
      const WORD_CHAR = /[A-Za-z0-9_]/;
      const CJK_CHAR = /[\u3400-\u9fff\uf900-\ufaff]/;
      let matchers = null;

      function escapeRegExp(value) {
        return value.replace(REGEX_SPECIAL, '\\$&');
      }

      function buildMatcher(source, forceCaseSensitive) {
        const latinStart = WORD_CHAR.test(source.charAt(0));
        const latinEnd = WORD_CHAR.test(source.charAt(source.length - 1));
        const chinese = CJK_CHAR.test(source);
        const caseInsensitive = !chinese && forceCaseSensitive !== true;
        return {
          value: source,
          lower: caseInsensitive ? source.toLowerCase() : source,
          caseInsensitive,
          latinStart,
          latinEnd,
          regex: new RegExp(escapeRegExp(source), caseInsensitive ? 'gi' : 'g'),
        };
      }

      function getMatchers() {
        if (matchers) return matchers;
        matchers = [];
        for (const entry of TERMS) {
          const sources = [entry.term].concat(entry.aliases);
          const aliases = [];
          for (const source of sources) {
            if (typeof source !== 'string' || source === '') continue;
            aliases.push(buildMatcher(source, entry.caseSensitive));
          }
          if (aliases.length > 0) matchers.push({ entry, aliases });
        }
        return matchers;
      }

      function boundaryOk(text, start, end, alias) {
        if (alias.latinStart && start > 0 && WORD_CHAR.test(text.charAt(start - 1))) return false;
        if (alias.latinEnd && end < text.length && WORD_CHAR.test(text.charAt(end))) {
          // Common English plurals (APIs, tokens, containers) still name the term.
          if (!/^(?:es|s)(?![A-Za-z0-9_])/.test(text.slice(end))) return false;
        }
        return true;
      }

      function collectMatches(text) {
        const found = [];
        const lower = text.toLowerCase();
        for (const matcher of getMatchers()) {
          for (const alias of matcher.aliases) {
            const haystack = alias.caseInsensitive ? lower : text;
            const needle = alias.caseInsensitive ? alias.lower : alias.value;
            // Cheap pre-filter: most of the ~200 terms never occur in a message.
            if (haystack.indexOf(needle) === -1) continue;
            const regex = alias.regex;
            regex.lastIndex = 0;
            let match = regex.exec(text);
            while (match !== null) {
              const start = match.index;
              const end = start + match[0].length;
              if (end > start && boundaryOk(text, start, end, alias)) {
                found.push({ start, end, entry: matcher.entry });
              }
              regex.lastIndex = end > start ? end : start + 1;
              match = regex.exec(text);
            }
          }
        }
        return found;
      }

      function contextSnippet(text, start, end) {
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        let lineEnd = text.indexOf('\n', end);
        if (lineEnd === -1) lineEnd = text.length;
        const from = Math.max(lineStart, start - CONTEXT_PAD);
        const to = Math.min(lineEnd, end + CONTEXT_PAD);
        const before = text.slice(from, start).replace(/\s+/g, ' ').replace(/^\s+/, '');
        const after = text.slice(end, to).replace(/\s+/g, ' ').replace(/\s+$/, '');
        return {
          before,
          hit: text.slice(start, end),
          after,
          prefix: from > lineStart ? '…' : '',
          suffix: to < lineEnd ? '…' : '',
        };
      }

      function acceptMatches(matches) {
        // Longest match wins at overlap points, so 向量数据库 is not also 数据库.
        matches.sort((a, b) => a.start - b.start || b.end - a.end);
        const accepted = [];
        let cursor = 0;
        for (const match of matches) {
          if (match.start < cursor) continue;
          accepted.push(match);
          cursor = match.end;
        }
        return accepted;
      }

      const explainCache = new Map();

      /**
       * Split an explanation into plain segments and clickable dictionary terms.
       * `skipTerm` keeps a term from linking to itself inside its own explanation.
       */
      function explainSegments(text, skipTerm) {
        if (typeof text !== 'string' || text === '') return [];
        const cacheKey = skipTerm ? skipTerm + '\u0000' + text : '\u0000' + text;
        const cached = explainCache.get(cacheKey);
        if (cached) return cached;

        const segments = [];
        let cursor = 0;
        for (const match of acceptMatches(collectMatches(text))) {
          if (match.entry.term === skipTerm) continue;
          if (match.start > cursor) {
            segments.push({ text: text.slice(cursor, match.start) });
          }
          segments.push({
            text: text.slice(match.start, match.end),
            term: match.entry.term,
            entry: match.entry,
          });
          cursor = match.end;
        }
        if (cursor < text.length) segments.push({ text: text.slice(cursor) });
        explainCache.set(cacheKey, segments);
        return segments;
      }

      function summarize(text, matches) {
        const accepted = acceptMatches(matches);

        const groups = new Map();
        for (const match of accepted) {
          let group = groups.get(match.entry);
          if (!group) {
            group = { entry: match.entry, count: 0, first: match.start, snippets: [], seen: new Set() };
            groups.set(match.entry, group);
          }
          group.count += 1;
          if (group.snippets.length < MAX_SNIPPETS) {
            const snippet = contextSnippet(text, match.start, match.end);
            const key = snippet.before + '\u0000' + snippet.hit + '\u0000' + snippet.after;
            if (!group.seen.has(key)) {
              group.seen.add(key);
              group.snippets.push(snippet);
            }
          }
        }

        const unique = Array.from(groups.values())
          .sort((a, b) => a.first - b.first)
          .map((group) => ({
            term: group.entry.term,
            full: group.entry.full,
            category: group.entry.category,
            explanation: group.entry.explanation,
            count: group.count,
            snippets: group.snippets,
          }));

        return { unique, total: accepted.length, chars: text.length };
      }

      function scanText(text) {
        return summarize(text, collectMatches(text));
      }

      function extractText(node) {
        if (!node || !Array.isArray(node.blocks)) return '';
        const parts = [];
        for (const block of node.blocks) {
          if (!block || block.kind !== 'text') continue;
          if (typeof block.text !== 'string') continue;
          if (block.text.trim() === '') continue;
          parts.push(block.text);
        }
        return parts.join('\n\n');
      }

      /* ================================================================== *
       * Localized copy
       * ================================================================== */

      const COPY_ZH = {
        'action.label': '术语',
        'action.aria': '解释这条回答中的计算机术语（{count} 个）',
        'action.title': '解释回答中的计算机术语 · 共 {count} 个',
        'panel.title': '计算机术语解释',
        'panel.subtitle': '本条回答识别到 {count} 个术语，共 {total} 处提及',
        'panel.close': '关闭',
        'panel.occurrences': '提及 {count} 次',
        'panel.context': '上下文 · {count} 处',
        'panel.contextShort': '上下文',
        'panel.hideContext': '收起上下文',
        'panel.dictionary': '内置计算机术语词典 · {count} 条 · 离线释义',
        'panel.languageNote': '释义以中文提供',
        'panel.escHint': '关闭',
        'panel.downloadFailed': '下载失败，请检查浏览器权限',
        'panel.empty': '这条回答中没有识别到已收录的计算机术语。',
        'panel.back': '返回',
        'panel.escBack': '返回上一级',
        'panel.explainTerm': '查看「{term}」的解释',
        'panel.detailHint': '释义中带虚线的术语可点击继续查看',
        'cat.lang': '编程语言与范式',
        'cat.web': '前端与 Web',
        'cat.server': '后端与架构',
        'cat.db': '数据库与存储',
        'cat.net': '网络与协议',
        'cat.devops': '云原生与 DevOps',
        'cat.security': '安全与加密',
        'cat.ai': 'AI 与大模型',
        'cat.system': '系统与底层',
        'panel.search': '搜索术语…',
        'panel.sort': '排序',
        'panel.sortMentions': '提及最多',
        'panel.sortOrder': '出现顺序',
        'panel.sortAlpha': '名称',
        'panel.filterAll': '全部',
        'panel.favoritesOnly': '只看收藏',
        'panel.favorite': '收藏此术语',
        'panel.unfavorite': '取消收藏',
        'panel.related': '相关术语',
        'panel.copyMarkdown': '复制 Markdown',
        'panel.downloadCsv': '下载 CSV',
        'panel.copied': '已复制',
        'panel.copyFailed': '复制失败，请手动选择',
        'panel.showing': '显示 {shown} / {total} 条',
        'panel.dictionaryTitle': '术语词典',
        'panel.dictionarySubtitle': '共 {count} 条 · 已收藏 {favorites} 条',
        'panel.noMatch': '没有匹配的术语，换个关键词试试。',
        'panel.favoritesEmpty': '还没有收藏术语，点击卡片右上角的星标即可收藏。',
        'settings.nav': '术语',
        'settings.title': '术语解释',
        'settings.desc': '解释回答中的计算机术语，内置离线词典；设置与收藏仅保存在本机浏览器，不会上传。',
        'settings.shortcuts': '快捷键',
        'settings.shortcutDict': '打开术语词典',
        'settings.shortcutPanel': '打开最近一条回答的术语面板',
        'settings.shortcutClose': '关闭面板 / 返回上一级',
        'settings.shortcutDialogHint': '设置弹窗内请使用上方的「打开术语词典」按钮。',
        'settings.behavior': '行为',
        'settings.showAction': '在已完成回答的操作条显示「术语 N」按钮',
        'settings.contextLimit': '上下文片段数量',
        'settings.contextLimitUnit': '条',
        'settings.defaultSort': '面板默认排序',
        'settings.openDict': '打开术语词典',
        'settings.closeDict': '收起词典',
        'settings.dictHint': '显示 {shown} / {total} 条匹配',
        'settings.recentHint': '最近一条回答已就绪：按 Alt+T 可直接打开它的术语面板。',
        'settings.favoritesSection': '收藏与导出',
        'settings.favoritesCount': '已收藏 {count} 条',
        'settings.exportFavorites': '导出收藏（JSON）',
        'settings.importFavorites': '导入收藏（JSON）',
        'settings.clearFavorites': '清空收藏',
        'settings.clearConfirm': '确定清空全部收藏？',
        'settings.importFailed': '导入失败：文件格式不正确。',
        'settings.importMerged': '已合并导入 {count} 条收藏',
        'settings.lookup': '查词',
        'settings.lookupPlaceholder': '输入术语、英文全称或释义关键词',
        'settings.lookupEmpty': '没有匹配的术语。',
        'cat.practice': '工程实践',
        'cat.harness': 'DeepSeek Harness',
      };

      const COPY_EN = {
        'action.label': 'Terms',
        'action.aria': 'Explain computer terms in this answer ({count})',
        'action.title': 'Explain computer terms in this answer · {count} detected',
        'panel.title': 'Computer Terms',
        'panel.subtitle': '{count} terms, {total} mentions in this answer',
        'panel.close': 'Close',
        'panel.occurrences': '{count} mentions',
        'panel.context': 'Context · {count}',
        'panel.contextShort': 'Context',
        'panel.hideContext': 'Hide context',
        'panel.dictionary': 'Built-in dictionary · {count} terms · offline',
        'panel.languageNote': 'Explanations are in Chinese',
        'panel.escHint': 'to close',
        'panel.downloadFailed': 'Download failed — check browser permissions',
        'panel.empty': 'No dictionary terms were detected in this answer.',
        'panel.back': 'Back',
        'panel.escBack': 'to go back',
        'panel.explainTerm': 'Explain "{term}"',
        'panel.detailHint': 'Click an underlined term to keep exploring',
        'cat.lang': 'Languages & paradigms',
        'cat.web': 'Frontend & Web',
        'cat.server': 'Backend & architecture',
        'cat.db': 'Databases & storage',
        'cat.net': 'Network & protocols',
        'cat.devops': 'Cloud & DevOps',
        'cat.security': 'Security & crypto',
        'cat.ai': 'AI & LLMs',
        'cat.system': 'Systems & internals',
        'panel.search': 'Search terms…',
        'panel.sort': 'Sort',
        'panel.sortMentions': 'Most mentioned',
        'panel.sortOrder': 'Answer order',
        'panel.sortAlpha': 'Name',
        'panel.filterAll': 'All',
        'panel.favoritesOnly': 'Favorites only',
        'panel.favorite': 'Save this term',
        'panel.unfavorite': 'Remove from favorites',
        'panel.related': 'Related terms',
        'panel.copyMarkdown': 'Copy Markdown',
        'panel.downloadCsv': 'Download CSV',
        'panel.copied': 'Copied',
        'panel.copyFailed': 'Copy failed, select manually',
        'panel.showing': 'Showing {shown} / {total}',
        'panel.dictionaryTitle': 'Term dictionary',
        'panel.dictionarySubtitle': '{count} terms · {favorites} saved',
        'panel.noMatch': 'No matching terms. Try another keyword.',
        'panel.favoritesEmpty': 'No saved terms yet. Use the star on a term card to save one.',
        'settings.nav': 'Terms',
        'settings.title': 'Term explainer',
        'settings.desc': 'Explains computer-science terms found in assistant answers with a built-in offline dictionary. Preferences and favorites stay in this browser and are never uploaded.',
        'settings.shortcuts': 'Shortcuts',
        'settings.shortcutDict': 'Open the term dictionary',
        'settings.shortcutPanel': 'Open the terms panel of the latest answer',
        'settings.shortcutClose': 'Close the panel / go back one level',
        'settings.shortcutDialogHint': 'Inside the Settings sheet use the dictionary button above.',
        'settings.behavior': 'Behaviour',
        'settings.showAction': 'Show the “Terms N” button on finished answers',
        'settings.contextLimit': 'Context snippets',
        'settings.contextLimitUnit': 'snippets',
        'settings.defaultSort': 'Default panel sorting',
        'settings.openDict': 'Open term dictionary',
        'settings.closeDict': 'Close dictionary',
        'settings.dictHint': 'Showing {shown} of {total} matches',
        'settings.recentHint': 'The latest answer is ready: press Alt+T to open its term panel.',
        'settings.favoritesSection': 'Favorites & export',
        'settings.favoritesCount': '{count} saved',
        'settings.exportFavorites': 'Export favorites (JSON)',
        'settings.importFavorites': 'Import favorites (JSON)',
        'settings.clearFavorites': 'Clear favorites',
        'settings.clearConfirm': 'Clear all saved terms?',
        'settings.importFailed': 'Import failed: invalid file.',
        'settings.importMerged': 'Merged {count} favorite(s)',
        'settings.lookup': 'Lookup',
        'settings.lookupPlaceholder': 'Search a term, full name or explanation',
        'settings.lookupEmpty': 'No matching terms.',
        'cat.practice': 'Engineering practice',
        'cat.harness': 'DeepSeek Harness',
      };

      /* ================================================================== *
       * Styles (theme tokens only)
       * ================================================================== */

      const STYLE_ID = 'term-glossary/styles';
      const CSS = `
.${ACTION_CLASS}{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px 0 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12px;font-weight:500;line-height:1;cursor:pointer;transition:color .15s ease,border-color .15s ease,background .15s ease;white-space:nowrap}
.${ACTION_CLASS}:hover{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.${ACTION_CLASS}:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.${ACTION_CLASS} svg{flex:none}
.tg-action-count{opacity:.85;font-variant-numeric:tabular-nums}
.tg-backdrop{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:32px 24px;background:rgba(0,0,0,.44);animation:tg-fade .16s ease-out}
.tg-card{display:flex;flex-direction:column;width:min(760px,100%);max-height:min(84vh,780px);border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 24px 72px rgba(0,0,0,.36),0 2px 8px rgba(0,0,0,.18);overflow:hidden;animation:tg-pop .18s cubic-bezier(.2,.8,.3,1)}
.tg-head{display:flex;align-items:flex-start;gap:12px;padding:18px 20px 14px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.tg-head-icon{flex:none;width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary)}
.tg-back{flex:none;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer}
.tg-back:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.tg-back:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tg-head-text{flex:1;min-width:0}
.tg-title{margin:0;font-size:15px;font-weight:600;line-height:1.45;color:var(--dsw-alias-label-primary)}
.tg-subtitle{margin:4px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
.tg-close{flex:none;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.tg-close:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.tg-close:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tg-body{flex:1;min-height:0;overflow-y:auto;padding:14px 20px 20px;display:flex;flex-direction:column;gap:10px}
.tg-term{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-base);padding:12px 14px}
.tg-term-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.tg-term-name{font-size:14px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}
.tg-term-full{font-size:11.5px;line-height:1.4;color:var(--dsw-alias-label-secondary);opacity:.85}
.tg-term-meta{margin-left:auto;display:flex;align-items:center;gap:6px}
.tg-chip{font-size:11px;line-height:1;padding:4px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.tg-count{font-variant-numeric:tabular-nums}
.tg-desc{margin:8px 0 0;font-size:13px;line-height:1.65;color:var(--dsw-alias-label-secondary)}
.tg-inline-text{display:inline}
.tg-inline-term{display:inline;margin:0;padding:0 1px;border:none;background:none;font:inherit;color:var(--dsw-alias-brand-primary);text-decoration:underline dotted;text-decoration-thickness:1px;text-underline-offset:2px;cursor:pointer;border-radius:3px}
.tg-inline-term:hover{background:var(--dsw-alias-bg-layer-2);text-decoration-style:solid}
.tg-inline-term:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.tg-toggle{margin:10px 0 0;padding:0;border:none;background:none;color:var(--dsw-alias-brand-primary);font-family:inherit;font-size:12px;line-height:1.4;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
.tg-toggle:hover{text-decoration:underline}
.tg-toggle:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;border-radius:4px}
.tg-snippets{margin:10px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}
.tg-snippet{margin:0;padding:8px 10px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);border-left:2px solid var(--dsw-alias-border-l2);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word}
.tg-snippet mark{background:transparent;color:var(--dsw-alias-brand-primary);font-weight:600}
.tg-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;border-top:1px solid var(--dsw-alias-border-l1);font-size:11.5px;line-height:1.4;color:var(--dsw-alias-label-secondary)}
.tg-foot kbd{font-family:inherit;font-size:10.5px;padding:2px 5px;border-radius:5px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.tg-empty{margin:16px 0;font-size:13px;color:var(--dsw-alias-label-secondary)}
.tg-toolbar{display:flex;flex-direction:column;gap:8px;margin:0 0 12px}
.tg-toolbar-row{display:flex;align-items:center;gap:8px}
.tg-search{flex:1;min-width:0;height:30px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12.5px;line-height:1}
.tg-search::placeholder{color:var(--dsw-alias-label-secondary);opacity:.8}
.tg-search:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;border-color:var(--dsw-alias-brand-primary)}
.tg-select{height:30px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;cursor:pointer}
.tg-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.tg-filter{height:30px;display:inline-flex;align-items:center;gap:5px;padding:0 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12px;line-height:1;cursor:pointer;white-space:nowrap}
.tg-filter[data-active="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
.tg-filter:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.tg-cats{display:flex;flex-wrap:wrap;gap:6px}
.tg-cat{padding:4px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:11.5px;line-height:1.2;cursor:pointer;white-space:nowrap}
.tg-cat:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.tg-cat[data-active="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
.tg-cat:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.tg-star{flex:none;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.tg-star:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary)}
.tg-star[data-on="true"]{color:var(--dsw-alias-brand-primary)}
.tg-star:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.tg-related{margin:14px 0 0;display:flex;flex-direction:column;gap:6px}
.tg-related-title{margin:0;font-size:11.5px;color:var(--dsw-alias-label-secondary);opacity:.9}
.tg-related-list{display:flex;flex-wrap:wrap;gap:6px}
.tg-related-chip{padding:4px 9px;border:1px dashed var(--dsw-alias-border-l1);border-radius:999px;background:transparent;color:var(--dsw-alias-brand-primary);font-family:inherit;font-size:11.5px;line-height:1.2;cursor:pointer}
.tg-related-chip:hover{border-style:solid;background:var(--dsw-alias-bg-layer-2)}
.tg-related-chip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.tg-foot-actions{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}
.tg-btn{height:24px;display:inline-flex;align-items:center;gap:4px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:11.5px;line-height:1;cursor:pointer;white-space:nowrap}
.tg-btn:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.tg-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.tg-btn[data-kind="primary"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.tg-btn[data-copied="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.tg-empty-state{display:flex;flex-direction:column;align-items:center;gap:6px;padding:28px 12px;color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center}
.tg-settings{display:flex;flex-direction:column;gap:18px;padding:2px 0 6px;max-width:720px}
.tg-set-head{display:flex;flex-direction:column;gap:6px}
.tg-set-title{margin:0;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}
.tg-set-desc{margin:0;font-size:12.5px;line-height:1.6;color:var(--dsw-alias-label-secondary)}
.tg-set-group{display:flex;flex-direction:column;gap:10px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l1)}
.tg-set-group-title{margin:0;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);opacity:.9}
.tg-set-row{display:flex;align-items:center;justify-content:space-between;gap:14px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}
.tg-set-row label{display:flex;align-items:center;gap:8px;cursor:pointer}
.tg-set-hint{font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-secondary);opacity:.9}
.tg-set-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tg-set-field{display:flex;flex-direction:column;gap:6px}
.tg-set-list{display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;padding-right:2px}
.tg-set-item{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);padding:8px 10px}
.tg-set-item-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.tg-set-item-name{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.tg-set-item-full{font-size:11px;color:var(--dsw-alias-label-secondary);opacity:.85}
.tg-set-item-desc{margin:4px 0 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary)}
.tg-set-item-meta{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary);opacity:.85}
.tg-kbd-list{display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.tg-kbd-list kbd{font-family:inherit;font-size:10.5px;padding:2px 5px;border-radius:5px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.tg-list{display:flex;flex-direction:column;gap:10px}
.tg-detail{display:flex;flex-direction:column;gap:12px}
@keyframes tg-fade{from{opacity:0}}
@keyframes tg-pop{from{opacity:0;transform:translateY(6px) scale(.985)}}
@media (prefers-reduced-motion:reduce){.tg-backdrop,.tg-card{animation:none}}
`;

      /* ================================================================== *
       * Panel store (shared between the message action and the overlay host)
       * ================================================================== */

      function createPanelStore() {
        let state = { open: false, payload: null };
        const listeners = new Set();
        const emit = () => {
          for (const listener of listeners) {
            try {
              listener();
            } catch (error) {
              // A broken overlay must never take down the action that opened it.
              console.error('[term-glossary] panel listener failed', error);
            }
          }
        };
        return {
          getState: () => state,
          open(payload) {
            state = { open: true, payload };
            emit();
          },
          close() {
            if (!state.open) return;
            state = { open: false, payload: null };
            emit();
          },
          subscribe(listener) {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          },
        };
      }

      function usePanelState(store) {
        const [state, setState] = React.useState(store.getState);
        React.useEffect(() => store.subscribe(() => setState(store.getState())), [store]);
        return state;
      }

      function installStyles() {
        if (typeof document === 'undefined') return;
        if (document.querySelector('style[data-plugin-style="' + STYLE_ID + '"]')) return;
        const style = document.createElement('style');
        style.setAttribute('data-plugin-style', STYLE_ID);
        style.textContent = CSS;
        document.head.appendChild(style);
      }

      /* ================================================================== *
       * Icons
       * ================================================================== */

      function svgProps(size) {
        return {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
        };
      }

      function IconBook({ size = 14 }) {
        return h(
          'svg',
          svgProps(size),
          h('path', { key: 'a', d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' }),
          h('path', { key: 'b', d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' }),
        );
      }

      function IconClose({ size = 15 }) {
        return h(
          'svg',
          svgProps(size),
          h('path', { key: 'a', d: 'M18 6 6 18' }),
          h('path', { key: 'b', d: 'm6 6 12 12' }),
        );
      }

      function IconChevron({ size = 12, expanded = false }) {
        return h('svg', svgProps(size), h('path', { d: expanded ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6' }));
      }

      function IconArrowLeft({ size = 16 }) {
        return h('svg', svgProps(size), h('path', { key: 'a', d: 'M19 12H5' }), h('path', { key: 'b', d: 'm12 19-7-7 7-7' }));
      }

      function IconStar({ size = 13, filled = false }) {
        return h(
          'svg',
          { ...svgProps(size), fill: filled ? 'currentColor' : 'none' },
          h('path', {
            key: 'a',
            d: 'm12 3 2.7 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17.3 6.5 20.2l1.1-6.2L3 9.6l6.3-.9z',
          }),
        );
      }

      /* ================================================================== *
       * Components
       * ================================================================== */

      function translate(props) {
        const t = props && props.t;
        return typeof t === 'function' ? t : (key) => key;
      }

      function categoryLabel(t, category) {
        const key = 'cat.' + category;
        const label = t(key);
        return label === key ? category : label;
      }

      /**
       * Assistant answers are Markdown, so snippets would otherwise show `**bold**`,
       * `` `code` `` and `[label](url)` verbatim. Strip the inline syntax for display only -
       * the scanned text and match offsets are never modified. Deliberately conservative:
       * `__dunder__` names and `**\/*.ts` globs are left untouched.
       */
      function cleanInline(value) {
        if (typeof value !== 'string' || value === '') return '';
        return value
          .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
          .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
          .replace(/`([^`\n]+)`/g, '$1')
          .replace(/\*\*(?!\/)([^*\n]+?)\*\*/g, '$1')
          .replace(/^\s{0,3}#{1,6}\s+/gm, '')
          .replace(/^\s*>\s?/gm, '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      function Snippet({ snippet }) {
        // Clean the concatenated window first: inline markers such as **term** span
        // the before/hit/after slices and would otherwise leak as literal characters.
        const raw = (snippet.prefix || '') + snippet.before + snippet.hit + snippet.after + (snippet.suffix || '');
        const cleaned = cleanInline(raw);
        const hitText = cleanInline(snippet.hit) || snippet.hit;
        const approx = cleanInline((snippet.prefix || '') + snippet.before).length;
        let at = -1;
        let best = Infinity;
        let from = 0;
        while (hitText) {
          const index = cleaned.indexOf(hitText, from);
          if (index === -1) break;
          const distance = Math.abs(index - approx);
          if (distance < best) {
            best = distance;
            at = index;
          }
          from = index + 1;
        }
        if (at < 0) return h('li', { className: 'tg-snippet' }, cleaned);
        return h(
          'li',
          { className: 'tg-snippet' },
          cleaned.slice(0, at),
          h('mark', null, cleaned.slice(at, at + hitText.length)),
          cleaned.slice(at + hitText.length),
        );
      }

      function normalizedName(value) {
        return typeof value === 'string' ? value.replace(/\s+/g, '').toLowerCase() : '';
      }

      /** The English full name is redundant when it repeats the term (e.g. `Token Token`). */
      function showFull(item) {
        return Boolean(item.full) && normalizedName(item.full) !== normalizedName(item.term);
      }

      /**
       * Explanation text with the dictionary terms inside it turned into buttons.
       * Clicking one opens that term's own explanation on top of the current view.
       */
      function InlineTerms({ text, t, skipTerm, onSelect }) {
        const segments = explainSegments(text, skipTerm);
        if (segments.length === 0) return text;
        const nodes = segments.map((segment, index) => {
          if (!segment.entry) return segment.text;
          return h(
            'button',
            {
              key: 'inline-' + index,
              type: 'button',
              className: 'tg-inline-term',
              'data-term': segment.entry.term,
              title: t('panel.explainTerm', { term: segment.entry.term }),
              onClick: (event) => onSelect(segment.entry, event),
            },
            segment.text,
          );
        });
        return h('span', { className: 'tg-inline-text' }, nodes);
      }

      /** Merge a dictionary entry with what the current answer says about it. */
      function buildDetailItem(entry, items) {
        let count = 0;
        let snippets = [];
        for (const item of items) {
          if (item.term === entry.term) {
            count = item.count;
            snippets = item.snippets;
            break;
          }
        }
        return {
          term: entry.term,
          full: entry.full,
          category: entry.category,
          explanation: entry.explanation,
          count,
          snippets,
        };
      }

      // The most recently rendered answer (used by the Alt+T shortcut and the settings panel).
      let latestScan = null;
      let activeSessionId = null;

      function rememberScan(payload) {
        latestScan = payload;
      }

      /** Latest scan only when it came from the session that is currently on screen. */
      function currentLatestScan() {
        if (!latestScan) return null;
        if (activeSessionId && latestScan.sessionId && latestScan.sessionId !== activeSessionId) return null;
        return latestScan;
      }

      function TermCard({ item, t, onSelect, favorites, contextLimit }) {
        const [expanded, setExpanded] = React.useState(false);
        const limit = Math.max(1, Math.min(3, contextLimit || 3));
        const snippets = (Array.isArray(item.snippets) ? item.snippets : []).slice(0, limit);
        const hasSnippets = snippets.length > 0;
        const saved = favorites ? favorites.has(item.term) : false;
        return h(
          'article',
          { className: 'tg-term' },
          h(
            'div',
            { className: 'tg-term-head' },
            h('span', { className: 'tg-term-name' }, item.term),
            showFull(item) ? h('span', { className: 'tg-term-full' }, item.full) : null,
            h(
              'span',
              { className: 'tg-term-meta' },
              h('span', { className: 'tg-chip' }, categoryLabel(t, item.category)),
              item.count > 1
                ? h('span', { className: 'tg-chip tg-count' }, t('panel.occurrences', { count: item.count }))
                : null,
              favorites
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'tg-star',
                      'data-on': saved ? 'true' : 'false',
                      'aria-pressed': saved,
                      'aria-label': t(saved ? 'panel.unfavorite' : 'panel.favorite'),
                      title: t(saved ? 'panel.unfavorite' : 'panel.favorite'),
                      onClick: () => favorites.toggle(item.term),
                    },
                    h(IconStar, { filled: saved }),
                  )
                : null,
            ),
          ),
          h(
            'p',
            { className: 'tg-desc' },
            h(InlineTerms, { text: item.explanation, t, skipTerm: item.term, onSelect }),
          ),
          hasSnippets
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'tg-toggle',
                  'aria-expanded': expanded,
                  onClick: () => setExpanded((value) => !value),
                },
                h(IconChevron, { expanded }),
                expanded
                  ? t('panel.hideContext')
                  : snippets.length > 1
                    ? t('panel.context', { count: snippets.length })
                    : t('panel.contextShort'),
              )
            : null,
          expanded && hasSnippets
            ? h(
                'ul',
                { className: 'tg-snippets' },
                snippets.map((snippet, index) => h(Snippet, { key: index, snippet })),
              )
            : null,
        );
      }

      function Toolbar({
        t,
        baseItems,
        query,
        onQueryChange,
        category,
        onCategoryChange,
        sort,
        onSortChange,
        onlyFavorites,
        onToggleFavorites,
        favoritesCount,
        favorites,
      }) {
        // Counts respect the other active filters so a chip never promises an empty list.
        const filteredItems = filterTerms(baseItems, { query, onlyFavorites, favorites });
        const counts = categoryCounts(filteredItems);
        const filteredTotal = filteredItems.length;
        const chips = CATEGORY_ORDER.filter((key) => counts[key]).map((key) =>
          h(
            'button',
            {
              key,
              type: 'button',
              className: 'tg-cat',
              'data-active': category === key ? 'true' : 'false',
              onClick: () => onCategoryChange(category === key ? null : key),
            },
            categoryLabel(t, key) + ' ' + counts[key],
          ),
        );
        return h(
          'div',
          { className: 'tg-toolbar' },
          h(
            'div',
            { className: 'tg-toolbar-row' },
            h('input', {
              className: 'tg-search',
              type: 'search',
              value: query,
              placeholder: t('panel.search'),
              'aria-label': t('panel.search'),
              onChange: (event) => onQueryChange(event.target.value),
            }),
            h(
              'select',
              {
                className: 'tg-select',
                value: sort,
                'aria-label': t('panel.sort'),
                title: t('panel.sort'),
                onChange: (event) => onSortChange(event.target.value),
              },
              h('option', { value: 'mentions' }, t('panel.sortMentions')),
              h('option', { value: 'order' }, t('panel.sortOrder')),
              h('option', { value: 'alpha' }, t('panel.sortAlpha')),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'tg-filter',
                'data-active': onlyFavorites ? 'true' : 'false',
                'aria-pressed': onlyFavorites,
                onClick: onToggleFavorites,
              },
              '★ ' + t('panel.favoritesOnly') + (favoritesCount ? ' ' + favoritesCount : ''),
            ),
          ),
          h(
            'div',
            { className: 'tg-cats' },
            h(
              'button',
              {
                type: 'button',
                className: 'tg-cat',
                'data-active': category ? 'false' : 'true',
                onClick: () => onCategoryChange(null),
              },
              t('panel.filterAll') + ' ' + filteredTotal,
            ),
            chips,
          ),
        );
      }

      function RelatedSection({ entry, t, onSelect }) {
        const related = relatedTerms(entry);
        if (related.length === 0) return null;
        return h(
          'section',
          { className: 'tg-related' },
          h('p', { className: 'tg-related-title' }, t('panel.related')),
          h(
            'div',
            { className: 'tg-related-list' },
            related.map((item) =>
              h(
                'button',
                {
                  key: item.term,
                  type: 'button',
                  className: 'tg-related-chip',
                  onClick: () => onSelect(item),
                },
                item.term,
              ),
            ),
          ),
        );
      }

      function createPanelHost(store, favorites, settings) {
        return function PanelHost(props) {
          const t = translate(props);
          const state = usePanelState(store);
          useStoreVersion(favorites);
          useStoreVersion(settings);
          const open = state.open && state.payload !== null;
          const payload = state.payload;
          const mode = payload && payload.mode === 'dictionary' ? 'dictionary' : 'scan';
          const cardRef = React.useRef(null);
          const closeRef = React.useRef(null);
          const backRef = React.useRef(null);
          const [stack, setStack] = React.useState([]);
          const stackRef = React.useRef(stack);
          stackRef.current = stack;
          const depthRef = React.useRef(0);
          const pendingFocusRef = React.useRef(null);
          const [query, setQuery] = React.useState('');
          const [category, setCategory] = React.useState(null);
          const [onlyFavorites, setOnlyFavorites] = React.useState(false);
          const [sort, setSort] = React.useState(settings.get().defaultSort);
          const [copied, setCopied] = React.useState('');
          const copyTimerRef = React.useRef(null);

          const close = React.useCallback(() => store.close(), [store]);

          // Opening a message (or the dictionary) always starts on its list view.
          React.useEffect(() => {
            const config = settings.get();
            setQuery('');
            setCategory(null);
            setOnlyFavorites(false);
            setCopied('');
            setSort(SORT_MODES.includes(config.defaultSort) ? config.defaultSort : 'mentions');
            pendingFocusRef.current = null;
            setStack([]);
          }, [open, payload, settings]);

          React.useEffect(
            () => () => {
              if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            },
            [],
          );

          const focusTermButton = React.useCallback((term) => {
            const card = cardRef.current;
            if (!card || !term || typeof card.querySelectorAll !== 'function') return false;
            const buttons = card.querySelectorAll('[data-term]');
            for (let index = 0; index < buttons.length; index += 1) {
              const candidate = buttons[index];
              const value =
                candidate && typeof candidate.getAttribute === 'function'
                  ? candidate.getAttribute('data-term')
                  : null;
              if (value === term) {
                try {
                  candidate.focus();
                } catch (error) {
                  /* focus is best effort */
                }
                return true;
              }
            }
            return false;
          }, []);

          const pushTerm = React.useCallback((entry) => {
            if (!entry || !entry.term) return;
            const previous = stackRef.current;
            const index = previous.findIndex((item) => item.term === entry.term);
            const next = index >= 0 ? previous.slice(0, index + 1) : previous.concat([entry]);
            pendingFocusRef.current = entry.term;
            setStack(next);
          }, []);

          const popTerm = React.useCallback(() => {
            const previous = stackRef.current;
            if (previous.length === 0) return;
            pendingFocusRef.current = previous[previous.length - 1].term;
            setStack(previous.slice(0, -1));
          }, []);

          // Focus follows the view: the back button when diving in, the clicked term when coming out.
          React.useEffect(() => {
            if (!open) {
              depthRef.current = 0;
              return undefined;
            }
            const depth = stack.length;
            const previousDepth = depthRef.current;
            depthRef.current = depth;
            if (depth > previousDepth) {
              const timer = setTimeout(() => {
                if (backRef.current) backRef.current.focus();
              }, 0);
              return () => clearTimeout(timer);
            }
            if (depth < previousDepth) {
              const target = pendingFocusRef.current;
              const timer = setTimeout(() => {
                pendingFocusRef.current = null;
                if (!focusTermButton(target) && closeRef.current) closeRef.current.focus();
              }, 0);
              return () => clearTimeout(timer);
            }
            return undefined;
          }, [open, stack.length, focusTermButton]);

          React.useEffect(() => {
            if (!open) return undefined;
            const previous = typeof document === 'undefined' ? null : document.activeElement;
            const onKeyDown = (event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                if (stackRef.current.length > 0) popTerm();
                else close();
                return;
              }
              if (event.key !== 'Tab') return;
              const card = cardRef.current;
              if (!card) return;
              const focusable = card.querySelectorAll(
                'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
              );
              if (focusable.length === 0) return;
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              } else if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              }
            };
            document.addEventListener('keydown', onKeyDown, true);
            const body = typeof document !== 'undefined' && document.body && document.body.style ? document.body : null;
            const previousOverflow = body ? body.style.overflow : '';
            if (body) body.style.overflow = 'hidden';
            const timer = setTimeout(() => {
              if (closeRef.current && stackRef.current.length === 0) closeRef.current.focus();
            }, 0);
            return () => {
              document.removeEventListener('keydown', onKeyDown, true);
              clearTimeout(timer);
              if (body) body.style.overflow = previousOverflow;
              if (previous && typeof previous.focus === 'function') {
                try {
                  previous.focus();
                } catch (error) {
                  /* focus can fail after the trigger is removed from the document */
                }
              }
            };
          }, [open, close, popTerm]);

          // Projecting the dictionary is only needed while the panel is open, but hooks
          // must run unconditionally, so memoise before the early return.
          const dictionaryItems = React.useMemo(
            () =>
              TERMS.map((entry) => ({
                term: entry.term,
                full: entry.full,
                category: entry.category,
                explanation: entry.explanation,
                count: 0,
                snippets: [],
              })),
            [],
          );

          if (!open || !payload) return null;

          const config = settings.get();
          const contextLimit = config.contextLimit;
          const scan = payload.scan;
          const scanItems = scan && Array.isArray(scan.unique) ? scan.unique : [];
          const baseItems = mode === 'dictionary' ? dictionaryItems : scanItems;
          const items = sortTerms(filterTerms(baseItems, { query, category, onlyFavorites, favorites }), sort);
          const favoritesCount = favorites.count();
          const detail = stack.length > 0 ? stack[stack.length - 1] : null;
          const detailItem = detail ? buildDetailItem(detail, scanItems) : null;

          const title = detail
            ? detail.term
            : mode === 'dictionary'
              ? t('panel.dictionaryTitle')
              : t('panel.title');
          const subtitle = detail
            ? [showFull(detail) ? detail.full : '', categoryLabel(t, detail.category), t('panel.detailHint')]
                .filter(Boolean)
                .join(' · ')
            : mode === 'dictionary'
              ? t('panel.dictionarySubtitle', { count: TERMS.length, favorites: favoritesCount })
              : t('panel.subtitle', { count: scanItems.length, total: scan ? scan.total : 0 });

          const flashCopied = (value) => {
            setCopied(value);
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            copyTimerRef.current = setTimeout(() => setCopied(''), 1800);
          };
          const copyMarkdown = () => {
            copyText(exportMarkdown(items)).then((okay) => flashCopied(okay ? t('panel.copied') : t('panel.copyFailed')));
          };
          const downloadCsv = () => {
            const okay = downloadText('dsh-term-explainer.csv', exportCsv(items), 'text/csv;charset=utf-8');
            if (!okay) flashCopied(t('panel.downloadFailed'));
          };

          const footerLeft =
            mode === 'dictionary'
              ? t('panel.dictionary', { count: TERMS.length })
              : t('panel.showing', { shown: items.length, total: baseItems.length });

          return h(
            'div',
            {
              className: 'tg-backdrop',
              role: 'none',
              onMouseDown: (event) => {
                if (event.target === event.currentTarget) close();
              },
            },
            h(
              'div',
              {
                className: 'tg-card',
                ref: cardRef,
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': TITLE_ID,
                onMouseDown: (event) => event.stopPropagation(),
              },
              h(
                'header',
                { className: 'tg-head' },
                detail
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'tg-back',
                        ref: backRef,
                        'aria-label': t('panel.back'),
                        title: t('panel.back'),
                        onClick: popTerm,
                      },
                      h(IconArrowLeft, { size: 16 }),
                    )
                  : h('span', { className: 'tg-head-icon' }, h(IconBook, { size: 17 })),
                h(
                  'div',
                  { className: 'tg-head-text' },
                  h('h2', { className: 'tg-title', id: TITLE_ID }, title),
                  h('p', { className: 'tg-subtitle' }, subtitle),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'tg-close',
                    ref: closeRef,
                    'aria-label': t('panel.close'),
                    title: t('panel.close'),
                    onClick: close,
                  },
                  h(IconClose, { size: 15 }),
                ),
              ),
              h(
                'div',
                { className: 'tg-body' },
                detail
                  ? h(
                      'div',
                      { className: 'tg-detail' },
                      h(TermCard, {
                        key: 'detail-' + detail.term,
                        item: detailItem,
                        t,
                        onSelect: pushTerm,
                        favorites,
                        contextLimit,
                      }),
                      h(RelatedSection, { entry: detail, t, onSelect: pushTerm }),
                    )
                  : h(
                      'div',
                      { className: 'tg-list' },
                      h(Toolbar, {
                        t,
                        baseItems,
                        query,
                        onQueryChange: setQuery,
                        category,
                        onCategoryChange: setCategory,
                        sort,
                        onSortChange: setSort,
                        onlyFavorites,
                        onToggleFavorites: () => setOnlyFavorites((value) => !value),
                        favoritesCount,
                        favorites,
                      }),
                      baseItems.length === 0
                        ? h('p', { className: 'tg-empty' }, t('panel.empty'))
                        : items.length === 0
                          ? h(
                              'div',
                              { className: 'tg-empty-state' },
                              onlyFavorites && favoritesCount === 0 ? t('panel.favoritesEmpty') : t('panel.noMatch'),
                            )
                          : items.map((item) =>
                              h(TermCard, {
                                key: item.term,
                                item,
                                t,
                                onSelect: pushTerm,
                                favorites,
                                contextLimit,
                              }),
                            ),
                    ),
              ),
              h(
                'footer',
                { className: 'tg-foot' },
                h(
                  'span',
                  null,
                  footerLeft + ' · ' + t('settings.favoritesCount', { count: favoritesCount }) + ' · ' + t('panel.languageNote'),
                ),
                h(
                  'span',
                  { className: 'tg-foot-actions' },
                  detail
                    ? null
                    : h(
                        'button',
                        {
                          type: 'button',
                          className: 'tg-btn',
                          'data-copied': copied ? 'true' : 'false',
                          onClick: copyMarkdown,
                        },
                        copied || t('panel.copyMarkdown'),
                      ),
                  detail ? null : h('button', { type: 'button', className: 'tg-btn', onClick: downloadCsv }, t('panel.downloadCsv')),
                  h('span', null, h('kbd', null, 'Esc'), ' ', detail ? t('panel.escBack') : t('panel.escHint')),
                ),
              ),
            ),
          );
        };
      }

      function useNoopSelector() {
        return undefined;
      }

      function createTermAction(store, settings) {
        return function TermAction(props) {
          const t = translate(props);
          const messageId = props && props.messageId;
          const sessionId = props && props.sessionId;
          const useChat = props && props.useChat;
          const useChatHook = typeof useChat === 'function' ? useChat : useNoopSelector;

          const node = useChatHook((chat) => {
            const nodes = chat && chat.legacy && chat.legacy.nodes;
            if (!nodes) return undefined;
            for (let index = 0; index < nodes.length; index += 1) {
              const candidate = nodes[index];
              if (candidate && candidate.kind === 'assistant' && candidate.messageId === messageId) {
                return candidate;
              }
            }
            return undefined;
          });

          const text = React.useMemo(() => {
            try {
              return extractText(node);
            } catch (error) {
              return '';
            }
          }, [node]);

          const scan = React.useMemo(() => {
            if (!text) return null;
            try {
              return scanText(text);
            } catch (error) {
              console.warn('[term-glossary] failed to scan message', error);
              return null;
            }
          }, [text]);

          useStoreVersion(settings);
          const showAction = settings.get().showAction;

          React.useEffect(() => {
            if (scan && scan.unique.length > 0) {
              // The slot only renders for the visible conversation, so it also tells us
              // which session Alt+T should target.
              if (sessionId) activeSessionId = sessionId;
              rememberScan({ sessionId, messageId, text, scan });
            }
          }, [sessionId, messageId, text, scan]);

          const openPanel = React.useCallback(() => {
            if (!scan) return;
            store.open({ mode: 'scan', messageId, text, scan });
          }, [messageId, text, scan]);

          if (!showAction || !scan || scan.unique.length === 0) return null;

          return h(
            'button',
            {
              type: 'button',
              className: ACTION_CLASS,
              'aria-label': t('action.aria', { count: scan.unique.length }),
              title: t('action.title', { count: scan.unique.length }),
              onClick: openPanel,
            },
            h(IconBook, { size: 13 }),
            h('span', null, t('action.label')),
            h('span', { className: 'tg-action-count' }, String(scan.unique.length)),
          );
        };
      }

      function createSettingsSection({ favorites, settings }) {
        return function SettingsSection(props) {
          const t = translate(props);
          useStoreVersion(favorites);
          useStoreVersion(settings);
          const config = settings.get();
          const [lookupQuery, setLookupQuery] = React.useState('');
          const [dictOpen, setDictOpen] = React.useState(false);
          const [importError, setImportError] = React.useState(false);
          const [importNotice, setImportNotice] = React.useState('');
          const fileRef = React.useRef(null);
          const favoritesCount = favorites.count();
          const latest = currentLatestScan();
          const lookupMatches = filterTerms(TERMS, { query: lookupQuery });
          const lookup = lookupMatches.slice(0, dictOpen ? lookupMatches.length : 8);

          const exportFavorites = () => {
            downloadText(
              'dsh-term-explainer-favorites.json',
              JSON.stringify({ version: 1, terms: favorites.list() }, null, 2),
              'application/json;charset=utf-8',
            );
          };

          const importFavorites = (event) => {
            const target = event && event.target;
            const file = target && target.files && target.files[0];
            const resetInput = () => {
              // Allow re-importing the same file twice.
              if (target) target.value = '';
            };
            if (!file || typeof FileReader !== 'function') {
              resetInput();
              return;
            }
            try {
              setImportError(false);
              setImportNotice('');
              const reader = new FileReader();
              reader.onload = () => {
                resetInput();
                try {
                  const parsed = JSON.parse(String(reader.result == null ? '' : reader.result));
                  const terms = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.terms) ? parsed.terms : null;
                  if (!terms) throw new Error('invalid');
                  // Merge instead of replace so importing an old backup never drops recent bookmarks.
                  const added = favorites.merge(terms);
                  setImportNotice(t('settings.importMerged', { count: added }));
                } catch (error) {
                  setImportError(true);
                }
              };
              reader.onerror = () => {
                resetInput();
                setImportError(true);
              };
              reader.readAsText(file);
            } catch (error) {
              resetInput();
              setImportError(true);
            }
          };

          const clearFavorites = () => {
            const confirmed =
              typeof window !== 'undefined' && typeof window.confirm === 'function'
                ? window.confirm(t('settings.clearConfirm'))
                : true;
            if (confirmed) favorites.clear();
          };

          const toggleDictionary = () => setDictOpen((open) => !open);

          return h(
            'div',
            { className: 'tg-settings' },
            h(
              'div',
              { className: 'tg-set-head' },
              h('h3', { className: 'tg-set-title' }, t('settings.title')),
              h('p', { className: 'tg-set-desc' }, t('settings.desc')),
            ),
            h(
              'div',
              { className: 'tg-set-group' },
              h('p', { className: 'tg-set-group-title' }, t('settings.lookup')),
              h(
                'div',
                { className: 'tg-set-field' },
                h('input', {
                  className: 'tg-search',
                  type: 'search',
                  value: lookupQuery,
                  placeholder: t('settings.lookupPlaceholder'),
                  'aria-label': t('settings.lookup'),
                  onChange: (event) => setLookupQuery(event.target.value),
                }),
                lookupQuery && lookup.length === 0
                  ? h('p', { className: 'tg-set-hint' }, t('settings.lookupEmpty'))
                  : null,
                lookup.length > 0
                  ? h(
                      'div',
                      { className: 'tg-set-list' },
                      lookup.map((entry) =>
                        h(
                          'article',
                          { key: entry.term, className: 'tg-set-item' },
                          h(
                            'div',
                            { className: 'tg-set-item-head' },
                            h('span', { className: 'tg-set-item-name' }, entry.term),
                            showFull(entry) ? h('span', { className: 'tg-set-item-full' }, entry.full) : null,
                            h('span', { className: 'tg-set-item-meta' }, categoryLabel(t, entry.category)),
                          ),
                          h('p', { className: 'tg-set-item-desc' }, entry.explanation),
                        ),
                      ),
                    )
                  : null,
              ),
              h(
                'div',
                { className: 'tg-set-actions' },
                h(
                  'button',
                  { type: 'button', className: 'tg-btn', 'data-kind': dictOpen ? 'primary' : null, onClick: toggleDictionary },
                  dictOpen ? t('settings.closeDict') : t('settings.openDict'),
                ),
                h('span', { className: 'tg-set-hint' }, t('settings.dictHint', { shown: lookup.length, total: lookupMatches.length })),
              ),
              dictOpen && latest
                ? h('p', { className: 'tg-set-hint' }, t('settings.recentHint'))
                : null,
            ),
            h(
              'div',
              { className: 'tg-set-group' },
              h('p', { className: 'tg-set-group-title' }, t('settings.behavior')),
              h(
                'div',
                { className: 'tg-set-row' },
                h(
                  'label',
                  null,
                  h('input', {
                    type: 'checkbox',
                    checked: config.showAction,
                    onChange: (event) => settings.update({ showAction: Boolean(event.target.checked) }),
                  }),
                  h('span', null, t('settings.showAction')),
                ),
              ),
              h(
                'div',
                { className: 'tg-set-row' },
                h('label', null, h('span', null, t('settings.contextLimit'))),
                h(
                  'div',
                  { className: 'tg-set-actions' },
                  [1, 2, 3].map((value) =>
                    h(
                      'button',
                      {
                        key: value,
                        type: 'button',
                        className: 'tg-btn',
                        'data-kind': config.contextLimit === value ? 'primary' : null,
                        onClick: () => settings.update({ contextLimit: value }),
                      },
                      String(value) + ' ' + t('settings.contextLimitUnit'),
                    ),
                  ),
                ),
              ),
              h(
                'div',
                { className: 'tg-set-row' },
                h('label', null, h('span', null, t('settings.defaultSort'))),
                h(
                  'select',
                  {
                    className: 'tg-select',
                    value: config.defaultSort,
                    onChange: (event) => settings.update({ defaultSort: event.target.value }),
                  },
                  h('option', { value: 'mentions' }, t('panel.sortMentions')),
                  h('option', { value: 'order' }, t('panel.sortOrder')),
                  h('option', { value: 'alpha' }, t('panel.sortAlpha')),
                ),
              ),
            ),
            h(
              'div',
              { className: 'tg-set-group' },
              h('p', { className: 'tg-set-group-title' }, t('settings.favoritesSection')),
              h('p', { className: 'tg-set-hint' }, t('settings.favoritesCount', { count: favoritesCount })),
              h(
                'div',
                { className: 'tg-set-actions' },
                h('button', { type: 'button', className: 'tg-btn', onClick: exportFavorites }, t('settings.exportFavorites')),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'tg-btn',
                    onClick: () => {
                      if (fileRef.current) fileRef.current.click();
                    },
                  },
                  t('settings.importFavorites'),
                ),
                h('button', { type: 'button', className: 'tg-btn', onClick: clearFavorites }, t('settings.clearFavorites')),
                h('input', {
                  type: 'file',
                  accept: 'application/json,.json',
                  ref: fileRef,
                  style: { display: 'none' },
                  onChange: importFavorites,
                }),
              ),
              importError ? h('p', { className: 'tg-set-hint' }, t('settings.importFailed')) : null,
              importNotice ? h('p', { className: 'tg-set-hint' }, importNotice) : null,
            ),
            h(
              'div',
              { className: 'tg-set-group' },
              h('p', { className: 'tg-set-group-title' }, t('settings.shortcuts')),
              h(
                'div',
                { className: 'tg-kbd-list' },
                h('span', null, h('kbd', null, 'Alt+D'), ' ', t('settings.shortcutDict')),
                h('span', null, h('kbd', null, 'Alt+T'), ' ', t('settings.shortcutPanel')),
                h('span', null, h('kbd', null, 'Esc'), ' ', t('settings.shortcutClose')),
              ),
              h('p', { className: 'tg-set-hint' }, t('settings.shortcutDialogHint')),
            ),
          );
        };
      }

      /* ================================================================== *
       * Plugin entry
       * ================================================================== */

      // Opt-in test hook, used by scripts/smoke.mjs. Never enabled by the host.
      if (typeof window !== 'undefined' && window.__TERM_GLOSSARY_DEV__ === true) {
        window.__termGlossaryDev = {
          cleanInline,
          contextSnippet,
          summarize,
          scanText,
          explainSegments,
          findEntry: (term) => TERM_INDEX.get(term),
          relatedTerms,
          matchesQuery,
          filterTerms,
          sortTerms,
          categoryCounts,
          exportMarkdown,
          exportCsv,
          createFavoritesStore,
          createSettingsStore,
          CATEGORY_ORDER,
          DEFAULT_SETTINGS,
          STORAGE_KEYS,
          rememberScan,
          setActiveSession: (sessionId) => {
            activeSessionId = sessionId;
          },
          getLatestScan: () => currentLatestScan(),
          termTotal: TERMS.length,
          externalTotal: EXTERNAL_GLOSSARY_TOTAL,
          termList: () => TERMS.map((entry) => entry.term),
        };
      }

      function isEditableTarget(target) {
        if (!target || target.nodeType === 3) return false;
        if (target.isContentEditable === true) return true;
        const tag = target.tagName ? String(target.tagName) : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
        return Boolean(target.closest && target.closest('[contenteditable=""],[contenteditable="true"],input,textarea,select'));
      }

      /** True when a host modal (e.g. the settings sheet) would cover our overlay layer. */
      function hostDialogOpen() {
        if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return false;
        const nodes = document.querySelectorAll('[aria-modal="true"],[role="dialog"]');
        for (let index = 0; index < nodes.length; index += 1) {
          const node = nodes[index];
          if (node && node.closest && node.closest('.tg-backdrop')) continue;
          return true;
        }
        return false;
      }

      return {
        inject: ['slots', 'locale'],
        apply(ctx) {
          const store = createPanelStore();
          const favorites = createFavoritesStore();
          const settings = createSettingsStore();
          const boundT = typeof ctx.locale.bind === 'function' ? ctx.locale.bind(NS) : (key) => key;

          ctx.effect(() => ctx.locale.register(NS, { zh: COPY_ZH, en: COPY_EN }), 'term-glossary: copy');

          ctx.effect(() => {
            installStyles();
            return () => {
              if (typeof document === 'undefined') return;
              const style = document.querySelector('style[data-plugin-style="' + STYLE_ID + '"]');
              if (style) style.remove();
            };
          }, 'term-glossary: styles');

          // Alt+D opens the dictionary; Alt+T re-opens the latest answer's terms panel.
          ctx.effect(() => {
            if (typeof document === 'undefined') return undefined;
            const onKeyDown = (event) => {
              if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
              if (event.isComposing === true || event.defaultPrevented === true) return;
              if (isEditableTarget(event.target)) return;
              // Our overlay lives inside the host overlay layer, so a host modal such as
              // Settings would hide it; do not open an invisible dialog underneath.
              if (hostDialogOpen()) return;
              const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
              const code = typeof event.code === 'string' ? event.code : '';
              // macOS renders Option+D / Option+T as "∂" / "†", so fall back to the physical code.
              if (key === 'd' || code === 'KeyD') {
                event.preventDefault();
                store.open({ mode: 'dictionary' });
                return;
              }
              const latest = currentLatestScan();
              if ((key === 't' || code === 'KeyT') && latest) {
                event.preventDefault();
                store.open({ mode: 'scan', messageId: latest.messageId, text: latest.text, scan: latest.scan });
              }
            };
            document.addEventListener('keydown', onKeyDown, true);
            return () => document.removeEventListener('keydown', onKeyDown, true);
          }, 'term-glossary: shortcuts');

          ctx.slots.inject('conversation.chat.assistant-actions', () =>
            ctx.slots.register(
              {
                name: 'conversation.chat.assistant-actions',
                id: 'term-glossary',
                order: 20,
                locale: NS,
              },
              createTermAction(store, settings),
            ),
          );

          ctx.slots.inject('shell.overlay', () =>
            ctx.slots.register(
              {
                name: 'shell.overlay',
                id: 'term-glossary-panel',
                order: 40,
                locale: NS,
              },
              createPanelHost(store, favorites, settings),
            ),
          );

          ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              {
                name: 'settings.section',
                id: 'term-glossary-settings',
                order: 20,
                locale: NS,
                label: () => boundT('settings.nav'),
              },
              createSettingsSection({ favorites, settings }),
            ),
          );
        },
      };
    },
  });
})();
