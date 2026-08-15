# 后端可靠性与可观测性增强 Spec（v1）

状态：已实现（2026-08-15）
目标阶段：37～41
范围：API 集成验证、BullMQ/MySQL 一致性补偿、健康检查、错误契约、安全基线与轻量指标

## 1. 背景与目标

当前系统已经具备模块化单体、JWT/RBAC、商家隔离、事务审计、AI Provider、RAG、BullMQ Worker、幂等消费和 Docker/CI。下一阶段不新增业务模块，而是补齐面试中最容易被继续追问的可靠性证据：

1. 核心业务链路必须经过真实 Nest HTTP、Guard、DTO、MySQL 约束和 Redis 队列验证；
2. MySQL 事务提交成功但 Redis 入队前进程退出时，任务必须能够自动恢复；
3. 存活检查与依赖就绪检查必须分离，错误响应必须可通过 requestId 追踪；
4. 登录和高成本 AI 接口需要明确的滥用保护；
5. 系统应暴露少量可解释的 HTTP、AI 和队列运行指标。

完成后统一表述为：系统采用 MySQL 保存业务事实，BullMQ 提供至少一次执行，通过确定性 Job ID、数据库条件抢占与周期对账实现最终可恢复；测试同时覆盖业务单元和真实基础设施集成链路；运行时通过 readiness、统一错误契约、精确限流和轻量指标形成可观测闭环。

## 2. 明确非目标

- 不拆分微服务，不引入 Kafka、服务网格或 Kubernetes；
- 不实现通用 Transactional Outbox 框架或分布式事务；
- 不引入 ELK、Jaeger、完整 OpenTelemetry Collector 或外部告警平台；
- 不把当前 SSE 数据库轮询改造成 Redis Pub/Sub；
- 不实现验证码、设备指纹、复杂风控或分布式限流中心；
- 不追求行覆盖率数字，不为测试清空开发数据库；
- 不修改 `ai-chat/` 和 `ecommerce-admin/`。

## 3. 阶段与验收标准

### 3.1 阶段 37：真实 API 集成测试（P0）

#### 设计

- 新增独立 `test:integration` 命令，不混入快速单元测试；
- 测试只有在显式 `RUN_INTEGRATION_TESTS=true` 且 `NODE_ENV=test` 时运行；
- 使用真实 `AppModule`、全局 ValidationPipe、Cookie、Guard 和异常过滤器；
- 使用真实 MySQL 与 Redis，测试数据使用唯一前缀并按自身 ID 清理，不执行全表 truncate；
- CI 在迁移完成后显式运行集成测试。

#### 最小矩阵

- 登录成功后可携带 JWT 访问 `/auth/me`；
- 未知 DTO 字段返回 400，且响应包含 requestId；
- viewer 调用商品写接口返回 403；
- 用户访问未授权 merchantId 返回 403；
- 相同幂等键创建批量任务不会产生重复业务记录；
- readiness 能真实反映 MySQL 与 Redis 状态。

### 3.2 阶段 38：异步任务对账补偿（P0）

#### 设计

- API 仍采用“先提交 MySQL，再投递 Redis”，不伪装为原子双写；
- Worker 启动时和固定间隔扫描已持久化但未进入终态的任务；
- 批量优化和结构化导入重新投递 `PENDING` Item；Agent 重新投递 `PLANNING` Run；
- 补偿只处理超过短暂安全窗口的记录，避免与正常请求入队争抢；
- 每轮有固定上限，禁止无界扫描；
- Job ID 继续等于业务记录 ID，数据库条件更新继续作为消费抢占边界；
- 单轮失败记录结构化日志，不终止 Worker，下一轮继续恢复。

#### 验收

- 模拟 DB 已提交但未调用 enqueue，补偿后可找到并投递任务；
- 重复补偿不会生成两个有效 Job；
- 已取消和终态记录不会重新入队；
- Worker 关闭时清理补偿定时器并关闭队列连接；
- 文档明确该方案是 at-least-once + 幂等 + 最终恢复，而非 exactly-once。

### 3.3 阶段 39：健康检查与统一错误契约（P1）

#### 接口

- `GET /api/health/live`：只证明 API 进程可响应；
- `GET /api/health/ready`：并行检查 MySQL 与 Redis，任一失败返回 503；
- 保留 `GET /api/health` 作为兼容入口，语义等同 liveness；
- 依赖结果只包含状态和耗时，不返回连接串、账号或原始异常。

#### 错误契约

所有 HTTP 异常返回：

```json
{
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "商品已被其他操作修改",
  "requestId": "...",
  "timestamp": "...",
  "path": "/api/..."
}
```

- 4xx 保留安全业务文案；
- 5xx 对客户端统一为安全文案，服务端日志保留 requestId 和异常类型；
- ValidationPipe 数组错误保持为字符串数组；
- 不将堆栈、SQL、Provider 响应体或密钥返回客户端。

### 3.4 阶段 40：安全基线与精确限流（P1）

- 使用 Helmet 设置常用安全响应头；
- 登录按 IP + 归一化邮箱限流；Refresh 按 IP 限流；
- Agent 启动和底层 AI 流式生成按用户限流；
- 限流键不记录原始密码、Token 或请求正文；
- 超限返回标准 429 错误契约和 `Retry-After`；
- 保留已有 Agent 同时运行数限制，两种限制分别解决瞬时请求洪峰和长任务并发；
- 生产环境默认不公开 Swagger，允许通过显式环境变量开启；
- 全局 JSON 请求体大小设置明确上限，文件上传继续使用现有 5 MB 限制。

第一版允许单实例内存限流，并在文档中说明多实例部署应替换为 Redis Store。

### 3.5 阶段 41：轻量指标与队列观测（P2）

- 提供 Prometheus 文本格式 `/api/metrics`；
- HTTP 指标至少包含请求总数、5xx 总数和耗时直方图；
- 业务指标至少包含 Agent 运行结果和模型 Token 用量；
- 队列指标包含 waiting、active、delayed、failed；
- 指标标签只使用低基数字段，不使用 userId、merchantId、requestId、URL ID；
- 路由标签必须归一化，禁止把动态 ID 直接作为 label；
- 指标接口不暴露业务内容、客户数据或密钥。

## 4. 实施约束

- 优先复用现有 `PrismaService`、BullMQ Queue 和 requestId；
- 新增配置必须进入共享 Zod Schema、`.env.example` 和环境测试；
- 定时器必须 `unref` 并在应用关闭时释放；
- 健康检查和指标采集设置短超时，不能反向拖垮 API；
- 原 145 项 API 单元测试和 RAG 固定评估不得退化。

## 5. 最终验证

```bash
npm run prisma:generate --workspace @cross-border/api
npm run test --workspace @cross-border/api
RUN_INTEGRATION_TESTS=true npm run test:integration --workspace @cross-border/api
npm run rag:eval
npm run format:check
npm run lint
npm run typecheck
npm run build
```

CI 必须使用真实 MySQL/Redis 执行迁移和集成测试。普通单元测试仍应在无数据库连接时快速完成。

## 6. 面试边界

- 可以说明已经识别并处理数据库与消息队列双写窗口；
- 不声称实现 exactly-once、分布式事务或生产级全链路追踪；
- 可以说明当前 SSE 轮询适合演示规模，并给出升级触发条件，但本阶段不为假设流量增加基础设施。

## 7. 实施结果

- 阶段 37：新增从正式 Nest 构建产物启动的真实 MySQL/Redis HTTP 集成脚本，覆盖登录/JWT、未知 DTO 字段、viewer 403、跨商家 403、批量任务幂等、Redis Job、readiness 和 metrics；CI 在迁移后显式执行。
- 阶段 38：新增 Worker 启动与每 30 秒运行的对账补偿，按固定上限重新投递超过 10 秒安全窗口的批量优化 `PENDING` Item、导入 `PENDING` Item 和 Agent `PLANNING` Run；确定性 Job ID 与现有数据库条件抢占继续承担防重。
- 阶段 39：保留兼容 `/api/health`，新增 liveness/readiness；MySQL 与 Redis 检查并行、带 1.5 秒超时，依赖失败返回 503。全局异常过滤器统一错误码、安全文案、requestId、时间和路径。
- 阶段 40：接入 Helmet、1 MB 默认 JSON Body 上限、生产 Swagger 默认关闭；登录、Refresh、AI Chat、Agent、readiness 和 metrics 使用端点级内存窗口限流，429 返回 `Retry-After`。
- 阶段 41：新增 Prometheus 文本指标，覆盖 HTTP 请求/5xx/耗时、持久化 Agent 状态与 Token、三条 BullMQ 队列的 waiting/active/delayed/failed；路由标签使用模板，未匹配路径统一折叠，动态 ID 不进入标签。
- 最终验证：152 项 API 快速测试、全仓 233 项快速测试、4 条真实基础设施集成检查、38 条 RAG 固定评测、格式、lint、类型检查和四工作区生产构建全部通过。
