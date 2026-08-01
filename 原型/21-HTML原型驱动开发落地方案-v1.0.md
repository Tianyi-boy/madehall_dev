# Madehall HTML 原型驱动开发落地方案 v1.0

> 状态：可执行方案。适用于把当前统一 HTML 原型转化为“体验、数据、规则、测试可共同验收”的工程输入。
>
> 核心口号：**原型定义体验，契约定义事实，测试定义完成。**

## 1. 目标与边界

### 1.1 目标

将 `Madehall_unified_prototype_ZH_codex.html` 从单纯演示文件升级为可迁移、可验证、可追踪的“可执行规格”，使人或 AI 在实现正式系统时不必猜测 UI、实体关系、状态、权限和异常路径。

### 1.2 本阶段默认边界

- 当前原型继续作为视觉、语义和交互基线，不直接充当生产应用。
- **当前只执行第一步“语义化原型打磨”**：语义标签、稳定锚点、规则注释和浏览器业务路径；不创建 Schema、OpenAPI、数据库或正式应用。
- 当前原型及事实文档保持只读；语义化版本、专用校验器和核查报告均使用新文件名输出，不得覆盖原文件。
- 第一步不需要代码仓库、pnpm、Next.js 或外部服务；专用执行说明与提示词见 `22-语义化原型打磨执行说明-v1.0.md`。
- 正式工程技术栈已经选定，见 1.3，但只作为未来第二、三步的约束，不是当前工作的前置条件。
- 语义化改造可以调整内部 DOM，但必须保持稳定锚点、业务行为和视觉基线一致。
- HTML 注释只解释“为什么、依据什么、异常如何处理”，不能代替可运行规则。

### 1.3 后续阶段已选定工程技术栈

> 本节不参与当前语义化原型打磨。下列“已验证”来自负责人确认的未来工程基线；进入第二、三步后再在真实仓库复核。

| 层级 | 已选技术 | 状态与约束 |
|---|---|---|
| 工作区 | pnpm 11.7 单仓、pnpm workspace | 已验证；不得新建第二个 workspace |
| 运行时 | Node.js 24.x | 已验证 |
| 语言 | TypeScript 6.0，strict，目标 ES2022 | 已验证；契约类型必须纳入类型检查 |
| 前端 | React 19.2、Next.js 16.2 App Router、原生 CSS | 已验证；不引入 Tailwind 或 UI 组件库 |
| 后端 | Next.js Route Handlers＋服务层＋Ports/Adapters | 已验证；BFF/BE 同一应用，不另建 NestJS/Fastify 服务 |
| 内部 API | `/api/v1/*` HTTP API | 已验证；关键接口使用 OpenAPI 3.1 或等价机器可读契约 |
| 外部 API | Shopify 等 GraphQL/API | 已验证；隔离在 Adapter 边界 |
| 数据库 | Neon PostgreSQL | 已验证 |
| ORM/迁移 | Drizzle ORM 0.45、Drizzle Kit 0.31 | 已验证；迁移必须通过临时分支 DB 契约检查 |
| DB 驱动 | postgres.js 3.4 | 运行使用 pooled `DATABASE_URL`，迁移使用 direct `DIRECT_URL` |
| 多租户 | `company_id`＋PostgreSQL RLS＋`app_tenant` | 已验证；系统上下文必须在上线前完成最小权限收紧 |
| 身份认证 | Shopify Customer Accounts OAuth 2.0＋PKCE＋服务端 Session Cookie | 已验证 |
| 安全 | AES-256-GCM、scrypt、Webhook HMAC-SHA256、短签 URL | 已验证；凭据只从环境注入，不进入 fixture、日志或测试快照 |
| 测试 | Vitest 4＋V8 Coverage；Playwright 1.61＋Chromium | 已验证；契约、服务与 12 路径分别分层测试 |
| 质量闸门 | ESLint 9、TypeScript、Next build、Gitleaks、Python docs-lint/secret scan | 已验证；全部沿用现有命令，不复制闸门 |
| CI | GitHub Actions：Basic Gates、E2E、Neon 临时分支迁移/DB 契约测试 | 已验证；新增测试接入既有工作流 |

| 外部服务 | 事实边界 | 上线前仍需收口 |
|---|---|---|
| Shopify Advanced / B2B | Customer、Company、Catalog、Price List、Product、Draft Order、Order、Checkout、收款、退款、履约的交易真值源 | 生产店配置 |
| Neon | FF-DB PostgreSQL 与 CI 临时数据库分支 | 生产连接、RLS 与最小权限配置 |
| AWS S3 | CAD、图纸、效果图私有对象存储及 GET/PUT 短签 URL | IAM、Bucket Policy、成本治理 |
| AWS SES v2 | 审核、报价、状态变化事务邮件 | 发信域、DKIM/SPF/DMARC、production access |
| Vercel | Next.js Functions、环境变量、预览/生产部署、Cron 对账 | PM-706、`CRON_SECRET`、Cron 频率验证 |
| GitHub / Actions | 代码托管、PR、CI、secret 扫描 | 沿用现有流程 |
| Bitwarden | 人工管理真实凭据并单向注入环境 | 不是运行时依赖，应用不得调用 |

## 2. 三层可执行规格

| 层 | 唯一职责 | 推荐载体 | 禁止事项 |
|---|---|---|---|
| 体验规格 | 页面语义、信息层级、交互、路由、可见状态 | 语义化 HTML、`data-testid`、`data-flow`、浏览器基线 | 用截图或自然语言代替可操作页面 |
| 事实契约 | 实体结构、ID、枚举、关系、API、状态机、权限 | TypeScript/JSON Schema、OpenAPI、状态机与权限矩阵 | 在 HTML、测试和接口样例中各维护一份事实 |
| 验收规格 | 定义何时算完成 | 关系断言、浏览器路径测试、视觉快照、追踪矩阵 | 只检查字符串存在或只相信“校验通过” |

## 3. 事实源与优先级

发生冲突时按以下顺序裁决：

1. `00-需求差异矩阵-v2.3-终审通过.md` 中实际 v4.10 口径。
2. `17-业务路径核查手册-v1.3.md` 首页“v4.9＋v4.10 停用告示”。
3. 手册其余未停用条目。
4. `20-原型数据引用图-v1.0.md` 的实体职责、引用方向和不变量。
5. `Madehall_unified_prototype_ZH_codex.html` 的交互及页面文案。
6. 页面演示数据、旧稿静态内容和历史兼容镜像。

任何低优先级内容不得反向覆盖高优先级事实；出现无法裁决的冲突时，登记为待决问题，不得静默选择。

## 4. 目标交付结构

以下为逻辑结构。落地时先读取真实 pnpm workspace，再映射到现有包；不得因为示例目录名而创建第二个 Next.js 应用或重复基础设施。

```text
原型/
  Madehall_unified_prototype_ZH_codex.html
  contracts/
    entities.schema.json       # 实体结构与枚举的机器可读事实源
    entities.ts                # 若采用 TS，由 Schema 生成或与其做一致性校验
    openapi.yaml               # API 契约；未定后端时先覆盖关键路径
    state-machines.json        # 商户、RFQ、Quote、Order 等状态迁移
    role-policy.json           # 角色→区域→动作、maker/checker、root 边界
    invariants.json            # 金额、双向引用、唯一性等关系断言清单
  fixtures/
    madehall.fixture.json      # 原型、测试和接口样例共同引用的唯一演示事实
  tests/
    validate-contracts.mjs     # Schema、枚举、引用、金额与状态关系
    validate-prototype.mjs     # HTML 锚点与契约覆盖检查
    e2e/                       # 12 条业务路径的浏览器测试或测试说明
  traceability.md              # 需求→页面锚点→实体→API→断言→证据
```

生产仓库中的推荐映射：契约进入既有共享 package（没有时才新增 `packages/contracts`），Next.js 页面和 Route Handlers 进入现有应用，Drizzle schema/迁移进入既有数据包，Playwright/Vitest 测试进入已有测试目录。具体路径以真实 workspace 配置为准。

### 4.1 单一事实源原则

- `fixtures/madehall.fixture.json` 保存业务实体和演示对象；HTML 只通过加载或构建注入使用它。
- `SHARED` 只能是从统一实体模型派生的跨稿公共镜像，不得成为第二事实源。
- 聚合工作清单只保存索引与镜像字段，并通过断言证明与正式实体同源。
- 页面会话数据只用于演示交互，刷新可复位，不得宣称持久化事实。
- 快照必须深拷贝；金额相等不等于数组或对象可以共享可变引用。

## 5. 原型语义规范

### 5.1 HTML

- 页面区块优先使用 `main`、`nav`、`section`、`article`、`form`、`fieldset`、`table`、`dialog` 等语义标签。
- 控件必须有可访问名称；表单必须有标签；状态不能只靠颜色表达。
- 关键元素使用稳定且唯一的 `data-testid`。
- 跨页流程入口使用 `data-flow="FLOW-ID"`；实体承载点可使用 `data-entity-type` 和 `data-entity-id`。
- 测试不得依赖数组第一项、易变文案、临时 CSS 层级或上次浏览状态。

### 5.2 注释

推荐格式：

```html
<!--
  @flow T2-PDP-TO-CONFIG
  @contract QuoteRequest.Create
  @rule INV-T2-REFERENCE-VARIANT
  @error INVALID_VARIANT_COMBINATION
  @source 00-v4.10/W8-01
-->
```

注释引用规则 ID，不复制整段规则。规则变化时应修改契约和断言，由检查器发现注释引用失效。

## 6. 分阶段实施

### 阶段 0：冻结基线与建立证据

1. 读取事实源优先级和当前 Git 状态，保留用户已有修改。
2. 运行 `validate-madehall-data.mjs` 并记录真实输出。
3. 通过 localhost 在浏览器中走通关键路径，建立修订前证据。
4. 建立 12 路径追踪矩阵，标明已验证、未验证或失败。

### 阶段 1：抽取事实契约

1. 从最终运行态抽取产品、参考变体、套餐、项目、RFQ、Quote、Order、SC、PO、商户、账号、设计资产、AuditLog 和人工例外。
2. 建立 ID 格式、枚举、必填字段和关联字段 Schema。
3. 将状态迁移、角色权限、maker/checker 和 root 硬边界改为机器可读结构。
4. 将金额恒等式、唯一性、双向引用和来源约束登记为稳定的 `INV-*` 断言 ID。

### 阶段 2：建立统一 fixtures

1. 将演示业务实体迁入单一 fixture。
2. 让原型、校验器和 API 示例从同一 fixture 派生。
3. 保留兼容镜像时，必须通过生成函数派生并冻结，禁止手工同步。
4. 每迁移一类实体立即运行静态检查和对应浏览器路径，避免一次性大改。

### 阶段 3：语义化原型

1. 在不改变已确认行为的前提下逐页替换无语义容器。
2. 为 12 条路径增加稳定锚点和流程 ID。
3. 将业务注释改为契约、规则和错误码引用。
4. 保留视觉基线；DOM 内部实现允许变化，但对外语义和行为必须一致。

### 阶段 4：形成验证闭环

1. Schema 校验：结构、枚举、格式和必填关系。
2. 关系校验：SKU 唯一、无悬空引用、Quote 双向引用、金额勾稽、镜像一致。
3. 浏览器校验：12 条路径中的页面跳转、预填、回链、角色显隐和异常分支。
4. 视觉校验：核心页面建立可复核截图或快照基线。
5. 追踪校验：每条需求都能追到页面锚点、契约、API 和至少一个断言。

### 阶段 5：迁移为正式应用

技术栈已确定，但必须先定位真实 pnpm 仓库。迁移采用纵向切片：React/Next 页面 → `/api/v1/*` Route Handler → 服务层 → Port → Shopify/Neon/S3/SES Adapter → Drizzle/RLS → Vitest/Playwright/CI。先完成一条业务路径并通过全部闸门，再扩展其余路径；不得机械复制原型中的单文件架构、演示状态或双事实源。

## 7. 必须固化的关系断言

- 产品 SKU 全局唯一，产品名称、目录卡、PDP 和配置器始终携带同一 SKU。
- `semiCustom` 准确覆盖且只覆盖支持 T2 的产品；每个参考变体指向真实产品。
- `packages[].lines`、`project.lines` 和 RFQ 产品引用不存在悬空 SKU。
- 项目行金额＋charges 严格等于项目总额和对应正式 Quote 总额。
- `rfqs[].quoteId` 与 `quotes[].sourceId` 在 Quote 已生成时双向一致。
- `workItems` 中的 Quote 镜像与正式 Quote 同来源、同状态、同金额。
- 只有已接受的正式 Quote 能生成 SO；同一 SO 下 SC 合计等于 SO 总额。
- PO 明确属于 Shopify 只读边界，不进入自研 SO 状态机。
- 商户七态、对客五档、Company GID 和 AuditLog 按同一 `applicationNo` 勾稽。
- A/B/C 展示的同一 RFQ、PRJ、Quote、Order 必须同号、同状态、同金额。
- 人工例外必须保存来源 ID、理由、操作者和审计事件。
- 任何断言必须计算真实关系，禁止只检查源代码中是否存在某个字符串。

## 8. 完成闸门

| 闸门 | 完成条件 |
|---|---|
| G0 基线 | 输入文件、版本优先级、Git 状态和原始命令输出已记录 |
| G1 契约 | 实体、状态、权限、API 和不变量有机器可读载体且职责不重叠 |
| G2 单一事实源 | 原型、测试、API 示例不再手工维护同一业务实体的多份副本 |
| G3 静态关系 | Schema、引用、金额、镜像、状态迁移断言零失败 |
| G4 浏览器路径 | 12 条路径均有实际操作证据；无法执行的项目明确标“未验证” |
| G5 可追踪 | 每条路径可追到事实源、DOM 锚点、实体、API、断言和结果 |
| G6 交付 | 无 P0/P1；P2 有明确处置；命令、输出、代价和回滚方式齐全 |
| G7 工程切片 | 至少一条路径贯通 Next 页面、Route Handler、服务、Port/Adapter、租户隔离与 Vitest/Playwright；随后按同一模板迁移剩余路径 |

## 9. 可直接使用的“目标模式”提示词

本节是未来完整落地提示词，包含契约与正式应用迁移；**当前第一步不要使用本节**。当前请使用 `22-语义化原型打磨执行说明-v1.0.md` 中的目标模式提示词。

```text
请使用目标模式持续执行以下目标，不要只给方案；在达到全部完成闸门前持续进行“实施→核查→修复→再核查”。不要设置 token 预算。

【目标】
以 Madehall 当前统一原型为体验基线，以需求矩阵、业务路径手册和数据引用图为事实依据，落地“原型定义体验，契约定义事实，测试定义完成”的 HTML 原型驱动开发体系。

目标技术栈：pnpm 11.7 单仓；Node.js 24.x；TypeScript 6.0 strict / ES2022；React 19.2；Next.js 16.2 App Router＋原生 CSS；Next Route Handlers＋服务层＋Ports/Adapters；内部 `/api/v1/*`；Neon PostgreSQL＋Drizzle ORM 0.45 / Kit 0.31＋postgres.js 3.4；`company_id`＋RLS＋`app_tenant`；Shopify Customer Accounts OAuth 2.0＋PKCE；Vitest 4＋Playwright 1.61；现有 ESLint/TS/Next build/Gitleaks/docs-lint/secret scan/GitHub Actions 闸门。禁止引入 Tailwind、UI 组件库、NestJS、Fastify 或第二个 Next.js 应用。

【必须读取的输入】
1. D:\file_factory\fabbrio软件开发\原型\00-需求差异矩阵-v2.3-终审通过.md
2. D:\file_factory\fabbrio软件开发\原型\17-业务路径核查手册-v1.3.md
3. D:\file_factory\fabbrio软件开发\原型\20-原型数据引用图-v1.0.md
4. D:\file_factory\fabbrio软件开发\原型\Madehall_unified_prototype_ZH_codex.html
5. D:\file_factory\fabbrio软件开发\原型\validate-madehall-data.mjs
6. D:\file_factory\fabbrio软件开发\原型\21-HTML原型驱动开发落地方案-v1.0.md

【事实优先级】
《00》实际 v4.10 > 《17》首页 v4.9＋v4.10 停用告示 > 《17》其余未停用条目 > 《20》引用规则 > 原型页面文案 > 页面演示数据或历史兼容内容。

【R｜结果】
在现有工作区中建立并实际接入：
1. 机器可读实体契约；
2. OpenAPI 或明确的请求/响应契约；
3. 状态机、角色权限和不变量清单；
4. 原型、校验器和接口样例共同使用的唯一 fixtures；
5. 12 条业务路径的自动或可复核浏览器验收；
6. 需求→DOM 锚点→实体→API→断言→证据的追踪矩阵。
7. 在真实 pnpm 仓库内完成至少一条端到端纵向切片，并按已验证模板迁移剩余路径。

【A｜行动】
1. 先只读盘点仓库、AGENTS.md、Git 状态、pnpm workspace、现有依赖和六个输入文件，记录基线命令与真实输出；若找不到 `pnpm-workspace.yaml` 与生产应用 `package.json`，将“生产仓库未提供”列为阻塞，不得在原型目录另起脚手架。
2. 按《17》的 12 条路径建立实施矩阵；所有结论标记已验证、未验证或失败。
3. 先从当前最终运行态抽取契约和 fixtures，再逐类替换 HTML 内重复事实；不得一次性重写整个原型。
4. 使用语义化 HTML；关键节点增加唯一 `data-testid`、`data-flow`，必要时增加 `data-entity-type`、`data-entity-id`。
5. HTML 注释只引用 `@flow`、`@contract`、`@rule`、`@error`、`@source` ID；业务规则必须落为可执行断言。
6. 保证 `SHARED` 只从统一实体事实源派生并冻结，不形成第二事实源。
7. 补齐 Schema、引用、金额、状态、权限和镜像断言，尤其检查 SKU、semiCustom、套餐/项目悬空引用、Quote 双向引用、workItems 镜像、SO/SC 金额及 A/B/C 跨稿一致性。
8. 每完成一小类迁移，立即运行现有校验器、独立关系检查和受影响的浏览器路径；发现失败就修复并重跑。
9. 浏览器验证必须通过 localhost 打开当前原型；不能执行的范围标为未验证，不得表述为通过。
10. 只在现有 Next.js 16.2 应用中实现：App Router 页面、Route Handlers、服务层和 Ports/Adapters；复用原生 CSS，不引入 Tailwind/UI 库，不另建后端服务。
11. 数据持久化使用现有 Drizzle/Neon 设施；所有租户实体带 `company_id`，查询与写入同时接受 RLS 和服务层授权校验。运行与迁移连接不得混用。
12. Shopify 是交易真值源；S3、SES、Shopify 都通过既有 Port/Adapter。测试使用受控 fake/mock，已配置的 CI 契约测试可访问临时环境；不得读取或输出真实凭据。
13. 先选择一条能贯通 UI、API、服务、Adapter、数据库/RLS 和 E2E 的纵向切片；通过全部闸门后，按 12 路径矩阵逐批迁移，不做横向大爆炸重写。
14. 将新增 Vitest、Playwright、类型、lint、build、迁移和 secret 检查接入现有脚本与 GitHub Actions，禁止复制一套平行质量闸门。
15. 保留用户已有修改，不使用破坏性 Git 命令，不提交或推送，除非我另行授权。

【核心约束】
- 业务实体、聚合工作清单、页面演示数据和跨稿公共镜像必须分层，禁止因名称相似而合并。
- 类型只定义结构；状态迁移、权限和金额关系必须有独立机器可读契约和断言。
- 正式实现保持语义、稳定测试锚点、行为和视觉基线一致，不要求机械复制内部 DOM。
- 校验器必须计算运行态关系，禁止只检查代码字符串存在。
- 任何“完成/通过”都必须附命令、真实输出、运行位置和浏览器操作证据。

【W｜结束条件】
仅在以下条件全部满足后将目标标记为完成：
1. 12 条业务路径都有事实源、DOM 锚点、实体、API/契约、断言和验证状态；
2. 单一 fixture 已被原型和校验器实际使用，不存在人工同步的双事实源；
3. 所有结构与关系断言零失败；
4. 关键浏览器路径已在 localhost 实际执行并有证据；
5. 无 P0/P1，P2 均有处置；
6. 至少一条纵向切片已通过 Next build、Vitest、Playwright、RLS/DB 契约和既有 CI 本地等价闸门，并已按同一模式处理剩余 12 路径范围；
7. 交付报告包含改动文件、代价、连带影响、回滚方式、命令、真实输出和未验证范围。

最终输出先给一句总体结论，再给：实施结果、12 路径矩阵、问题与修复、验证证据、未验证范围、代价与回滚、唯一待决点。若真实 pnpm 生产仓库未出现在工作区，唯一待决点应是提供仓库路径；不得把“另起项目”列为默认方案。
```

## 10. 使用建议

- 第一次执行该提示词时，先让契约、fixtures、断言和追踪矩阵稳定，再完成一条纵向切片；不要直接横向铺满所有页面。
- 第一条纵向切片通过全部工程闸门后，按相同模板扩展剩余 12 路径，并持续保持可运行主干。
- 每次需求变更必须同时回答四个问题：事实源改哪里、哪些页面受影响、哪些断言需更新、哪条浏览器路径必须重跑。
