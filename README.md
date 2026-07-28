# Cross-Border E-commerce AI Copilot

面向跨境电商运营人员的 AI 全栈业务应用。当前已完成融合工程骨架、数据库认证/RBAC、商家商品 SKU 管理、订单与经营看板、AI 会话底座、单商品 AI 优化闭环、受控的 Agent Tool Calling，以及 Redis/BullMQ 批量 AI 任务；下一阶段将完善规则 RAG。

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

## 演示账号

执行种子脚本后可使用：

| 角色     | 邮箱                     | 密码       |
| -------- | ------------------------ | ---------- |
| 管理员   | `admin@copilot.local`    | `Demo123!` |
| 运营人员 | `operator@copilot.local` | `Demo123!` |
| 只读用户 | `viewer@copilot.local`   | `Demo123!` |

登录页为 `http://localhost:5173/login`。访问令牌由前端保存在内存状态中；刷新令牌通过 `HttpOnly` Cookie 轮换，退出时由服务端撤销。`GET /api/users` 仅允许 `admin` 角色访问，可用于演示服务端 RBAC。

种子数据还会创建 `DEMO-US` 商家、三个演示商品及 SKU，并把三个演示账号关联到该商家：

- 管理员可以维护商家、商品、SKU 和库存；
- 运营人员可以维护其所属商家的商品、SKU 和库存；
- 只读用户只能查看所属商家的商品数据；
- 商品与 SKU 写操作会与业务数据在同一事务中写入审计日志；
- 库存使用原子条件更新，禁止负库存，并能识别并发修改；
- 订单查询支持按状态筛选和订单号搜索，状态变更遵守状态机约束（PENDING → CONFIRMED → SHIPPED → DELIVERED → COMPLETED，以及 CANCELLED、REFUNDING 等旁路），角色权限在服务端校验；
- 经营看板展示今日订单/销售额/商品总数/库存预警，以及近 14 天订单与销售额趋势图；
- AI 运营助手支持服务端会话历史、消息父子关系、流式回复和停止生成；未配置模型密钥时自动使用不产生费用的 Mock Provider；
- 停止生成后会保存已经接收的部分回复，消息时间使用服务端时间戳持久化。
- 商品列表的“AI 优化”入口支持英语、西班牙语和葡萄牙语结构化草稿，展示原文对比、卖点、合规风险、建议、置信度和 Token 用量；
- AI 只生成草稿。运营人员必须在确认框中人工确认后，服务端才会通过 Product Service 写回正式商品；写回使用商品版本做并发冲突校验，并保存前后版本与审计日志；
- 重复确认同一草稿不会重复修改商品；过期草稿返回 `409`，拒绝草稿不会改动正式商品。Mock Provider 的 Token 用量为 `0`，测试不会调用收费模型。
- AI 运营助手提供“普通对话”和“业务 Agent”两种模式。业务 Agent 只允许调用服务端白名单工具，模型返回的工具名和参数必须再次经过服务端校验；
- 当前 Agent 工具包括商品查询、SKU/库存查询、订单状态、今日经营概览、最小规则检索和创建商品优化草稿；
- 所有工具必须调用现有业务 Service，并写入 `AGENT_TOOL_CALL` 审计记录。订单工具只返回运营所需的状态、金额和商品明细，不向模型传递客户邮箱或地址；
- 创建草稿工具只在用户明确要求“草稿、优化或翻译”时提供给模型，并且每次 Agent 请求最多执行一个草稿工具；Agent 不具备直接修改商品、库存或订单的工具；
- 规则工具当前使用带来源编号的最小演示目录，检索不足时明确返回信息不足。它不等于阶段 9 的正式规则 RAG，也不能代替真实平台规则复核。
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

批量 AI 任务演示步骤：

1. 确认 MySQL、Redis、API、Worker 和 Web 均已启动；
2. 使用运营人员账号进入“批量 AI 任务”，点击“新建批量优化”；
3. 选择三个演示商品与目标语言，提交后观察任务进度自动刷新；
4. 打开任务详情，检查每个商品的尝试次数、状态、草稿编号或失败原因；
5. 在 Worker 停止时创建另一批任务并立即取消，可稳定演示取消未执行任务；
6. 回到商品管理查看草稿并逐个人工确认；未确认前正式商品版本不会变化。

## 验证

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

当前自动化测试覆盖认证、角色守卫、商家隔离、商品分页隔离、负库存、订单状态机、看板聚合、AI 会话隔离、流式消息持久化、停止生成、三种目标语言结构化校验、Provider 失败落库、人工确认写回、重复确认幂等、商品版本冲突、Agent 工具规划、参数拒绝、工具审计、草稿授权边界、规则检索不足，以及批量任务的商家隔离、幂等、取消、Worker 重试、最终失败与重复投递。生产构建仍有前端主包体积提示，AI 会话列表仍有 Ant Design `List` 弃用提示，后续阶段将结合路由懒加载和组件升级处理。

截至 2026-07-29，完整 `npm audit` 报告 9 个 high（其中 7 个来自 ESLint/Nest CLI 开发工具链的 `brace-expansion` 公告），`npm audit --omit=dev` 报告 2 个 high，均来自 React Router `7.18.1` 的 RSC Action CSRF 公告。本项目使用普通 `BrowserRouter`，没有启用 RSC 或 Action 请求；当前审计仅提供 `--force` 降级或跨主版本升级方案，因此暂不做破坏性自动修复，后续跟随无破坏性上游版本更新。
