# Cross-Border E-commerce AI Copilot

面向跨境电商运营人员的 AI 全栈业务应用。阶段 0 至阶段 14 已完成数据库认证/RBAC、商家商品 SKU、多店铺与商品刊登、订单管理、可复算的 Agent 运营工作台、具备生产力操作的 AI 会话、单商品 AI 优化闭环、受控 Agent Tool Calling、Redis/BullMQ 批量任务、带权限和引用的规则 RAG、AI 成果中心，以及 Request ID、CI、Docker 和交付文档。下一阶段将继续实现 CSV/XLSX 结构化导入和订单运营视图。

增强范围和逐阶段验收标准见 [产品体验增强路线](docs/product-enhancement-roadmap.md)。商品与 SKU 导入只支持结构化 CSV/XLSX，不支持 Markdown 商品导入；规则知识库原有的 Markdown/纯文本导入保持不变。

AI 业务 Agent 的每次运行、回答、用量和工具轨迹都会保存为 `AgentRun/AgentToolCall`。运营人员可从侧栏“AI 成果中心”按类型和状态查询 Agent 运行与商品优化草稿，直接进入准确商品草稿或原批量任务；工作台同时展示待人工确认草稿数量和最近成果。成果中心只做统一索引，商品草稿的最终状态仍以 `ProductOptimization` 为准。

## 工程结构

```text
apps/
├── web/       React 管理后台
├── api/       NestJS 业务 API
└── worker/    异步任务进程
packages/
└── shared/    共享环境 Schema、认证类型与基础类型
```

`ai-chat/` 与 `ecommerce-admin/` 仅作为只读参考，不属于新工程工作区。

## 本地运行

要求 Node.js 20 或更高版本，以及 MySQL 8 和 Redis 7。推荐使用仓库内的 Docker Compose 配置启动开发依赖：

```powershell
npm install
Copy-Item .env.example .env
npm run build --workspace @cross-border/shared
docker compose up -d mysql redis
npm run prisma:deploy --workspace @cross-border/api
npm run prisma:seed --workspace @cross-border/api
npm run dev:api
npm run dev:worker
npm run dev:web
```

若本机已有 MySQL 和 Redis，可跳过 `docker compose up`，并修改 `.env` 中的 `DATABASE_URL` 与 `REDIS_URL`。API 负责创建任务，独立 Worker 负责消费 BullMQ 队列；演示批量任务时两者都需要启动。`compose.yaml` 与种子账号中的密码仅供本地开发，不能用于生产环境。

API 健康检查地址为 `http://localhost:3000/api/health`，Swagger 文档地址为 `http://localhost:3000/api/docs`。

## 完整 Docker 演示

安装 Docker Desktop 后，可使用一个 profile 构建并启动 MySQL、Redis、数据库迁移、演示种子、API、Worker 和 Web：

```powershell
docker compose --profile app up --build -d
docker compose --profile app ps
```

Web 地址为 `http://localhost:5173`。`migrate` 和 `demo-seed` 是一次性初始化容器；API 只有在两者成功后才启动，Web 会等待 API 健康检查通过。未提供 `OPENAI_API_KEY` 时使用 Mock Provider。

默认执行 `docker compose up -d` 仍只启动 MySQL 和 Redis，适合本地源码开发。Compose 中的密钥和密码仅供演示，不能用于生产环境。

架构取舍和面试演示脚本：

- [架构与关键取舍](docs/architecture.md)
- [8 分钟面试演示指南](docs/interview-demo.md)
- [产品体验增强路线](docs/product-enhancement-roadmap.md)

## 演示账号

执行种子脚本后可使用：

| 角色     | 邮箱                     | 密码       |
| -------- | ------------------------ | ---------- |
| 管理员   | `admin@copilot.local`    | `Demo123!` |
| 运营人员 | `operator@copilot.local` | `Demo123!` |
| 只读用户 | `viewer@copilot.local`   | `Demo123!` |

登录页为 `http://localhost:5173/login`。访问令牌由前端保存在内存状态中；刷新令牌通过 `HttpOnly` Cookie 轮换，退出时由服务端撤销。`GET /api/users` 仅允许 `admin` 角色访问，可用于演示服务端 RBAC。

种子数据还会创建 `DEMO-US` 商家、三个演示商品及 SKU、Amazon 美国店和 Shopee 巴西店，并把三个演示账号关联到该商家：

- 管理员可以维护商家、商品、SKU 和库存；
- 运营人员可以维护其所属商家的商品、SKU 和库存；
- 只读用户只能查看所属商家的业务数据和使用只读 Agent 工具，不能创建草稿或任务；
- 商品与 SKU 写操作会与业务数据在同一事务中写入审计日志；
- 库存使用原子条件更新，禁止负库存，并能识别并发修改；
- 订单查询支持按状态筛选和订单号搜索，状态变更遵守状态机约束（PENDING → CONFIRMED → SHIPPED → DELIVERED → COMPLETED，以及 CANCELLED、REFUNDING 等旁路），角色权限在服务端校验；
- Agent 运营工作台支持店铺级近 7/14/30 天范围和等长上一周期对比，展示销售额、订单数、客单价、退款、趋势、状态分布、热销商品和低库存；
- 工作台聚合待处理订单、待确认草稿、失败任务、运行中 Agent/批量任务和近期成果；每条运营建议都展示业务依据和后续操作入口；
- 工作台快捷 Agent 会继承当前商家、店铺和时间范围，viewer 仅能使用只读工具，operator/admin 才能创建待人工确认草稿；
- Merchant 是权限和数据隔离租户，Store 是具体平台/市场；全局上下文切换器会同步影响工作台、商品刊登、订单和业务 Agent；
- 同一主商品可在多个店铺拥有独立的语言、价格、外部商品编号和发布状态；店铺、商品与订单使用商家复合外键防止跨商家错误关联；
- AI 运营助手支持服务端会话历史、消息父子关系、流式回复和停止生成；未配置模型密钥时自动使用不产生费用的 Mock Provider；
- 停止生成后会保存已经接收的部分回复，消息时间使用服务端时间戳持久化。
- AI 会话支持重命名、人工标题保护、置顶、标题/消息搜索、分组、归档/恢复，以及仅对已归档会话开放的二次确认永久删除；
- 单条消息可收藏，并可通过商品编码或订单号关联当前商家的业务对象；关联结果可直接跳转商品或订单页面；
- 会话可导出脱敏 Markdown/JSON，也可创建只授权当前商家指定登录用户的只读快照；分享支持有效期、撤销和访问审计，撤销或过期后立即返回 `410`；
- 商品列表的“AI 优化”入口支持英语、西班牙语和葡萄牙语结构化草稿，展示原文对比、卖点、合规风险、建议、置信度和 Token 用量；
- AI 只生成草稿。运营人员必须在确认框中人工确认后，服务端才会通过 Product Service 写回正式商品；写回使用商品版本做并发冲突校验，并保存前后版本与审计日志；
- 重复确认同一草稿不会重复修改商品；过期草稿返回 `409`，拒绝草稿不会改动正式商品。Mock Provider 的 Token 用量为 `0`，测试不会调用收费模型。
- AI 运营助手提供“普通对话”和“业务 Agent”两种模式。业务 Agent 只允许调用服务端白名单工具，模型返回的工具名和参数必须再次经过服务端校验；
- 当前 Agent 工具包括商品查询、SKU/库存查询、订单状态、今日经营概览、规则知识库检索和创建商品优化草稿；
- 所有工具必须调用现有业务 Service，并写入 `AGENT_TOOL_CALL` 审计记录。订单工具只返回运营所需的状态、金额和商品明细，不向模型传递客户邮箱或地址；
- 创建草稿工具只在用户明确要求“草稿、优化或翻译”时提供给模型，并且每次 Agent 请求最多执行一个草稿工具；Agent 不具备直接修改商品、库存或订单的工具；
- 规则知识库支持管理员导入 Markdown/纯文本原文，文档按标题和段落确定性切分并保存到 MySQL；文档可设为全局或仅当前商家，归档后不再参与检索；
- 规则检索使用可替换的中英文词法评分器，返回 `[R1]` 等引用编号、文档/分块 ID、平台、作用域、来源地址、原文摘录和相关度；检索不足时明确拒答；
- Agent 的规则工具调用同一规则业务 Service，只能看到全局文档和当前商家文档。当前实现刻意不引入向量数据库与复杂 rerank，固定评估集 Recall@3 为 1.0；
- “批量 AI 任务”支持一次选择最多 20 个商品，由 BullMQ 为每个商品创建独立任务，默认失败重试 3 次，并展示 MySQL 中持久化的进度、尝试次数和失败原因；
- 相同商家与幂等键不会创建重复批次，每个任务项也只关联一个优化草稿；重复消费会直接返回已有结果；
- 取消会立即终止尚未执行的项目，正在处理的项目允许安全收尾。Redis 只负责队列，最终任务状态、失败明细和草稿关联都保存在 MySQL；
- 批量任务只生成草稿，不自动写回商品。运营人员仍需回到商品管理逐个审阅和确认。

单商品 AI 优化演示步骤：

1. 使用运营人员账号登录，进入“商品管理”；
2. 点击演示商品的“AI 优化”，选择目标语言并生成草稿；
3. 对照原内容与草稿，检查风险、建议和置信度；
4. 点击“人工确认并写回”，再次确认后刷新商品列表；
5. 可在审计接口 `GET /api/merchants/:merchantId/audit-logs` 查看 `CREATE_DRAFT`、`AI_DRAFT_APPLY` 或 `REJECT` 记录。

Agent Tool Calling 演示步骤：

1. 使用运营人员账号进入“AI 运营助手”，切换到“业务 Agent”；
2. 依次尝试商品库存、演示订单、经营看板和规则检索快捷指令；
3. 查看回答下方的工具名、成功/失败状态、参数和经过裁剪的业务结果；
4. 执行“为 P-DEMO-001 创建西班牙语优化草稿”；
5. 确认页面只提示草稿已创建，再到商品管理中进行人工确认；正式商品不会被 Agent 直接修改。

AI 会话生产力演示步骤：

1. 在“AI 运营助手”中新建会话，完成重命名、分组和置顶，并用标题或消息内容搜索；
2. 发送一条普通对话，收藏消息，并使用商品编码 `P-DEMO-001` 或演示订单号关联业务对象；
3. 导出 Markdown/JSON，确认客户邮箱、电话和收货地址不会出现在文件中；
4. 将会话分享给同商家的只读用户，打开只读快照后撤销，确认原链接立即显示失效；
5. 归档会话，确认它从活动列表消失并进入“已归档”；只有此时才出现带二次确认的永久删除。

批量 AI 任务演示步骤：

1. 确认 MySQL、Redis、API、Worker 和 Web 均已启动；
2. 使用运营人员账号进入“批量 AI 任务”，点击“新建批量优化”；
3. 选择三个演示商品与目标语言，提交后观察任务进度自动刷新；
4. 打开任务详情，检查每个商品的尝试次数、状态、草稿编号或失败原因；
5. 在 Worker 停止时创建另一批任务并立即取消，可稳定演示取消未执行任务；
6. 回到商品管理查看草稿并逐个人工确认；未确认前正式商品版本不会变化。

规则 RAG 演示步骤：

1. 使用管理员账号进入“规则知识库”，选择 `DEMO-US` 商家；
2. 搜索“充电器需要核对哪些认证”，检查返回的引用编号、原文摘录、分块 ID、作用域和相关度；
3. 搜索“宠物食品冷链温度要求”，确认系统明确显示规则信息不足；
4. 导入一份“仅当前商家”的 Markdown 规则，检查切分数量并用文档内关键词测试检索；
5. 归档该文档后再次检索，确认它不再出现；导入和归档会写入 `RULE_DOCUMENT` 审计；
6. 进入 AI 运营助手的业务 Agent，询问充电器合规规则，检查 `search_platform_rules` 工具输出引用了同一知识库。

## 验证

```powershell
npm run verify
```

`verify` 会依次执行格式检查、lint、TypeScript、全部测试和生产构建。GitHub Actions 还会在真实 MySQL/Redis 服务上应用 migration，并分别构建 API、Worker、Web Docker target。

API 会接收符合格式的 `X-Request-Id`，否则生成 UUID；响应回传同一个 ID，请求完成后输出不包含查询参数和正文的结构化日志。Web API 错误会附带请求 ID，便于关联排障。

当前 88 项自动化测试覆盖认证、角色守卫、商家隔离、店铺与刊登隔离、店铺币种约束、订单/看板/Agent 店铺上下文、运营指标与上一周期复算、viewer 只读 Agent 边界、商品分页隔离、负库存、订单状态机、AI 会话隔离、流式消息持久化、停止生成、人工标题保护、归档与永久删除前置条件、消息收藏和业务关联、导出与分享脱敏、分享授权/过期/撤销、三种目标语言结构化校验、Provider 失败落库、人工确认写回、重复确认幂等、商品版本冲突、Agent 工具规划、参数拒绝、工具审计、AgentRun 成功/失败持久化、成果聚合与状态过滤、草稿授权边界、批量任务的商家隔离、幂等、取消、Worker 重试、最终失败与重复投递、规则 RAG 基础评估，以及 Request ID 和日志注入防护。生产构建仍有前端主包体积提示，后续可结合路由懒加载处理。

截至 2026-07-29，完整 `npm audit` 报告 9 个 high（其中 7 个来自 ESLint/Nest CLI 开发工具链的 `brace-expansion` 公告），`npm audit --omit=dev` 报告 2 个 high，均来自 React Router `7.18.1` 的 RSC Action CSRF 公告。本项目使用普通 `BrowserRouter`，没有启用 RSC 或 Action 请求；当前审计仅提供 `--force` 降级或跨主版本升级方案，因此暂不做破坏性自动修复，后续跟随无破坏性上游版本更新。
