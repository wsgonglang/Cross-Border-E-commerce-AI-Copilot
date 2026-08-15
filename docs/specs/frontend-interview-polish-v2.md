# Frontend Interview Polish v2

状态：已完成
基线日期：2026-08-15

## 1. 目标

在不修改 AI Provider、Agent Loop、工具 Schema、RAG 检索和数据库模型的前提下，修复最容易影响面试演示可信度的前端一致性与可靠性问题。

本阶段只处理高收益、校招范围内的 P0/P1，不进行全站重构。

## 2. P0 范围

### P0-1：统一 viewer 与 AI 助手权限语义

- 以现有服务端权限为事实来源：AI 会话创建与整理仅允许 `admin/operator`；
- viewer 的侧栏继续不展示 AI 运营助手；
- viewer 的工作台不得出现会跳转到 `/ai-chat` 的快捷问题、输入框、最近会话或“让 AI 分析”动作；
- 工作台用只读提示替代不可执行入口，避免“页面宣称可用、点击后进入 403”；
- admin/operator 的统一 AI 入口、上下文预填和最近会话保持不变。

### P0-2：全局渲染错误兜底

- 在路由区域增加 Error Boundary；
- 页面渲染或懒加载失败时展示可理解的错误页，而不是白屏；
- 提供“重试当前页面”和“返回工作台”操作；
- 切换路由后自动解除旧错误状态；
- 开发环境可显示错误信息，生产环境不暴露堆栈。

## 3. P1 范围

### P1-1：清理遗留客户端状态

- 删除已经不被统一 AI 页面使用的 Redux `chat` slice；
- 测试 Store 与正式 Store 保持一致；
- 不修改当前 AI 会话 hooks 和服务端持久化行为。

### P1-2：状态文案一致性

- AI 质量页的运行状态、草稿状态和工具调用状态使用已有 i18n 资源；
- 中文界面不得直接显示 `DRAFT`、`COMPLETED`、`success` 等存储枚举；
- 英文界面仍显示自然语言状态，不依赖原始枚举兜底。

### P1-3：基础语义与轮询收口

- AI 对话主要内容区域使用 `main` 语义；
- Agent Run 进入 `CANCELLED` 终态后停止 Query 轮询；
- 不引入新的状态库、监控平台或复杂无障碍框架。

## 4. 明确冻结范围

- `apps/api/src/ai/`；
- `apps/api/prisma/`；
- `ai-chat/` 与 `ecommerce-admin/`；
- AI/RAG 服务端协议、Prompt、工具选择、引用校验与评测集；
- 用户指定不提交的 `docs/interview-frontend-qa.md` 与 `docs/interview-project-qa-with-code.md`。

## 5. 验收标准

| 编号  | 验收项        | 完成标准                                             |
| ----- | ------------- | ---------------------------------------------------- |
| AC-1  | viewer 权限   | 工作台无可点击 AI 入口，侧栏与路由权限保持一致       |
| AC-2  | operator 权限 | 快捷问题、自由输入、最近会话仍可进入统一 AI 助手     |
| AC-3  | 错误兜底      | 子页面抛错后显示恢复页，重试与返回工作台可用         |
| AC-4  | 路由恢复      | 路由变化后 Error Boundary 可恢复正常内容             |
| AC-5  | 状态清理      | Redux 不再注册或测试遗留 `chat` reducer              |
| AC-6  | 状态翻译      | AI 质量页列表、详情与工具轨迹不直接展示存储枚举      |
| AC-7  | 轮询终态      | Agent Run 的 `COMPLETED/FAILED/CANCELLED` 均停止轮询 |
| AC-8  | 语义结构      | AI 对话核心区域可通过 `main` landmark 定位           |
| AC-9  | 工程验证      | format、lint、typecheck、Web tests 和生产构建通过    |
| AC-10 | 冻结边界      | 本轮 diff 不包含 AI/RAG 服务端与两个只读原项目       |

## 6. 非目标

- 不开放 viewer 创建 AI 会话；
- 不重构 Dashboard、Imports、Stores 等全部长页面；
- 不将所有手写请求一次性迁移到 TanStack Query；
- 不新增微前端、PWA、Storybook、WebSocket 或多 Agent 编排。

## 7. 验收结果

- 以服务端现有权限为事实来源：viewer 侧栏不显示 AI 工作空间，工作台的 AI 卡片改为只读角色说明；待确认草稿、失败任务、批量任务和成果中心不再提供可跳转到受限路由的按钮，商品与订单入口保持可用；
- operator/admin 的快捷问题、自由输入和最近会话行为保持不变；真实浏览器验证快捷问题进入 `/ai-chat` 后只预填输入框，不自动发送；
- 新增路由级 Error Boundary，页面渲染失败时提供重试和返回工作台操作；3 项组件测试覆盖兜底展示、同路由重试和健康路由恢复；
- 删除未被统一 AI 页面使用的 Redux `chat` slice，正式 Store 与测试 Store 均只保留实际使用的认证状态；
- AI 质量页列表、运行详情和工具轨迹使用已有双语状态资源，真实中文页面将 `DRAFT` 显示为“待确认”；
- AI 对话主区域改为 `main` landmark，真实页面可通过语义快照定位；
- Agent Run 轮询在 `COMPLETED`、`FAILED` 和 `CANCELLED` 三种终态均停止，新增参数化测试覆盖终态与非终态；
- Playwright viewer 旅程增加工作台权限一致性断言；
- Web 共 23 个测试文件、65 项测试通过；根级 `verify` 共 217 项测试，format、lint、typecheck、i18n、测试和全仓生产构建全部通过；
- 生产构建最大业务页面 chunk 为 198.29 kB（gzip 60.75 kB），无 500 kB 大包警告；
- `apps/api/src/ai/`、Prisma、RAG 和两个只读原项目均无代码差异；两份用户自有面试问答文档未修改、未暂存。
