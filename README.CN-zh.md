# AI API HUB

AI API HUB 现在是一个纯前端、本地优先的工作区应用。
项目不再依赖额外本地服务，工作区配置、会话、消息和图片列表统一持久化到浏览器 `localStorage`。

## 当前架构

- 单工作区模式，无账号登录
- 聊天与图片请求直接从浏览器发往模型提供方
- 工作区数据统一保存在 `localStorage`
- 使用 hash 路由，适合静态部署

## 主要目录

```text
ai-api-hub/
├─ public/
├─ src/
│  ├─ components/
│  ├─ i18n/
│  ├─ models/
│  ├─ router/
│  ├─ services/
│  │  ├─ chat/
│  │  ├─ image/
│  │  ├─ markdown/
│  │  ├─ storage.ts
│  │  └─ settings.ts
│  ├─ store/
│  ├─ types/
│  ├─ utils/
│  └─ views/
├─ package.json
└─ vite.config.js
```

## 存储说明

存储入口统一在 `src/services/storage.ts`。
当前实现只有一套本地持久化逻辑：

- 模型配置
- 提示词模板
- 会话列表
- 会话消息
- 会话设置
- 图片记录

图片如果是远程 URL，会在写入时转换为 `data:` URL，这样刷新页面后仍可直接回显。

## 开发

```bash
npm install
npm run dev
```

## 类型检查

```bash
npm run typecheck
```

## 构建

```bash
npm run build
```
