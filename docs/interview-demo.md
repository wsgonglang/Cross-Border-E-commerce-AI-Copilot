# 面试演示指南

## 演示前准备

完整 Docker 演示：

```powershell
docker compose --profile app up --build -d
docker compose --profile app ps
```

打开：

- Web：`http://localhost:5173`
- Swagger：`http://localhost:3000/api/docs`
- 健康检查：`http://localhost:3000/api/health`

默认使用 Mock Provider，不需要模型密钥，也不会产生费用。

## 8 分钟演示顺序

### 1. 登录与权限（1 分钟）

- 使用 operator 登录，说明 JWT、HttpOnly Refresh Token 和服务端 RBAC。
- 切换 viewer，展示 AI 和写按钮受限；强调前端隐藏按钮不是安全边界。

### 2. 单商品 AI 优化闭环（3 分钟）

- 为 `P-DEMO-001` 生成西班牙语草稿。
- 展示结构化标题、描述、卖点、风险、建议和置信度。
- 强调此时正式商品版本未变化。
- 人工确认后写回，展示版本增长和审计。
- 可补充解释：过期草稿 409、重复确认幂等。

### 3. Agent 与规则引用（2 分钟）

- 在业务 Agent 中查询 `P-DEMO-001` 库存。
- 询问“充电器需要哪些认证和合规规则”。
- 展开工具轨迹，展示白名单参数、裁剪结果和 `[R1]` 引用。
- 在规则知识库搜索未知冷链问题，展示明确拒答。

### 4. 批量任务（1 分钟）

- 选择三个商品创建批量优化。
- 展示 BullMQ Worker、进度、尝试次数和草稿 ID。
- 强调 Redis 不是最终事实，MySQL 保存任务结果。

### 5. 工程化（1 分钟）

- 打开 Swagger、CI 和 Docker 配置。
- 使用自定义请求 ID 调用健康检查：

```powershell
$response = Invoke-WebRequest http://localhost:3000/api/health `
  -Headers @{ 'X-Request-Id' = 'interview-demo-001' }
$response.Headers['X-Request-Id']
```

- 在 API 日志中搜索 `interview-demo-001`，展示结构化耗时日志。

## 高频追问

### 为什么 AI 不能直接修改商品？

模型输出不稳定且不可作为权限主体。AI 只生成结构化草稿，正式写回必须经过服务端权限、版本校验、人工确认、事务和审计。

### 如何避免重复任务和重复写入？

批次使用商家级幂等键，Job 使用任务项 ID，任务项通过乐观领取和唯一草稿关联处理重复消费；正式商品写回还使用版本号和优化记录状态。

### Redis 丢数据怎么办？

Redis 负责调度，不是业务事实。任务状态、计数、错误和草稿关联都在 MySQL。入队失败可用相同幂等键重试。

### 为什么 RAG 没有使用向量数据库？

当前规则集小、关键词明确，确定性词法检索更容易评估、解释和部署。检索接口与存储边界可替换，数据规模和语义召回确有收益时再加入 embedding。

### 为什么不是微服务？

个人校招项目首先需要证明业务闭环、事务和安全边界。模块化单体更容易运行和讲清楚，Worker 已体现独立进程边界，未来可按真实部署需求拆分。

## 演示结束

停止容器但保留数据：

```powershell
docker compose --profile app down
```

只有明确要清空本地演示数据时才使用 `docker compose --profile app down -v`。
