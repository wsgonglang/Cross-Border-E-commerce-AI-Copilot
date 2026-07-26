# Cross-Border E-commerce AI Copilot

面向跨境电商运营人员的 AI 全栈业务应用。当前仓库正在把两个只读原型中的可复用能力，逐步重建到统一的业务工程中。

## 工程结构

```text
apps/
├── web/       React 管理后台
├── api/       NestJS 业务 API
└── worker/    异步任务进程
packages/
└── shared/    共享环境 Schema 与基础类型
```

`ai-chat/` 与 `ecommerce-admin/` 仅作为只读参考，不属于新工程工作区。

## 本地运行

要求 Node.js 20 或更高版本。

```powershell
npm install
Copy-Item .env.example .env
npm run dev:api
npm run dev:web
```

可选启动 Worker 骨架：

```powershell
npm run dev:worker
```

API 健康检查地址为 `http://localhost:3000/api/health`。

## 验证

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```
