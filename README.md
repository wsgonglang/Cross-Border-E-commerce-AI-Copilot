# Cross-Border E-commerce AI Copilot

面向跨境电商运营人员的 AI 全栈业务应用。当前已完成融合工程骨架、数据库认证/RBAC、商家商品 SKU 管理、订单与经营看板、AI 会话底座，以及单商品 AI 优化闭环；下一阶段将增加受控的 Agent Tool Calling。

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

要求 Node.js 20 或更高版本，以及 MySQL 8。推荐使用仓库内的 Docker Compose 配置启动开发数据库：

```powershell
npm install
Copy-Item .env.example .env
npm run build --workspace @cross-border/shared
docker compose up -d mysql
npm run prisma:deploy --workspace @cross-border/api
npm run prisma:seed --workspace @cross-border/api
npm run dev:api
npm run dev:web
```

若本机已有 MySQL，可跳过 `docker compose up`，并修改 `.env` 中的 `DATABASE_URL`。`compose.yaml` 与种子账号中的密码仅供本地开发，不能用于生产环境。

可选启动 Worker 骨架：

```powershell
npm run dev:worker
```

API 健康检查地址为 `http://localhost:3000/api/health`，Swagger 文档地址为 `http://localhost:3000/api/docs`。

## 演示账号

执行种子脚本后可使用：

| 角色     | 邮箱                     | 密码       |
| -------- | ------------------------ | ---------- |
| 管理员   | `admin@copilot.local`    | `Demo123!` |
| 运营人员 | `operator@copilot.local` | `Demo123!` |
| 只读用户 | `viewer@copilot.local`   | `Demo123!` |

登录页为 `http://localhost:5173/login`。访问令牌由前端保存在内存状态中；刷新令牌通过 `HttpOnly` Cookie 轮换，退出时由服务端撤销。`GET /api/users` 仅允许 `admin` 角色访问，可用于演示服务端 RBAC。

种子数据还会创建 `DEMO-US` 商家、一个演示商品及 SKU，并把三个演示账号关联到该商家：

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

单商品 AI 优化演示步骤：

1. 使用运营人员账号登录，进入“商品管理”；
2. 点击演示商品的“AI 优化”，选择目标语言并生成草稿；
3. 对照原内容与草稿，检查风险、建议和置信度；
4. 点击“人工确认并写回”，再次确认后刷新商品列表；
5. 可在审计接口 `GET /api/merchants/:merchantId/audit-logs` 查看 `CREATE_DRAFT`、`AI_DRAFT_APPLY` 或 `REJECT` 记录。

## 验证

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

当前自动化测试覆盖认证、角色守卫、商家隔离、商品分页隔离、负库存、订单状态机、看板聚合、AI 会话隔离、流式消息持久化、停止生成、三种目标语言结构化校验、Provider 失败落库、人工确认写回、重复确认幂等和商品版本冲突。生产构建仍有前端主包体积提示，后续阶段将结合路由懒加载处理。

依赖审计当前仍会报告 React Router 最新稳定版 `7.18.1` 的 RSC Action CSRF 公告；本项目使用普通 `BrowserRouter`，没有启用 RSC 或 Action 请求。暂不为消除告警降级到包含更多已知漏洞的旧版本，后续跟随上游安全版本更新。
