# AI API HUB

AI API HUB 是一个本地优先的 AI 工作区，覆盖聊天、图像生成和图像编辑。

`web/` 是主产品；`server/` 是可选的 Python companion service，负责补充 SQLite 持久化、图片缓存、生产环境静态资源托管，以及 Windows `pywebview` 包装入口。

英文文档见 [README.md](./README.md)。

## 当前产品形态

- 单工作区
- 不再有真实账号系统或多用户隔离
- 浏览器优先运行
- Python companion 可选
- 使用 hash 路由，静态部署更直接

现在的 `/login` 已经不是账号登录页，而是工作区启动页。它只负责探测 companion service 是否可达，然后进入工作区。

## 当前功能

- 聊天工作区，包含会话列表、流式输出和 Markdown 渲染
- 每个会话都会保存一份模型快照，避免老会话被后续模型配置改动影响
- 图像工作区拆分为生成和编辑两个模式
- 图像编辑支持输入图、蒙版画笔和结果图库联动
- 独立的设置工作区，支持自动保存
- 提示词模板管理
- 聊天模型、图像生成模型、图像编辑模型分别管理
- 应用设置支持 companion host 配置，以及配置导入 / 导出
- 内置 `zh-CN` / `en-US` i18n 和主题切换
- Python companion 不可用时自动回退到浏览器存储

### Provider 支持

当前 UI 内置的聊天模型 provider：

- `OpenAI`
- `Azure OpenAI`
- `Anthropic Direct`
- `Azure AI Foundry`

像 DeepSeek 这样的 OpenAI-compatible 服务，依然可以通过 OpenAI 风格模型配置手动填写 `baseURL` 和 `model` 来接入。

当前图像模型 provider：

- `OpenAI`
- `Azure OpenAI`

## 运行架构

### 浏览器优先的请求模型

前端负责：

- 路由
- 工作区初始化
- 模型配置
- 聊天渲染和流式输出
- 图像生成和图像编辑界面
- 主题和语言控制

真正的模型请求会直接从浏览器发往所选 provider，Python companion 不在模型推理的关键路径上。

### Storage Router

`web/src/services/transport/request.ts` 会调用 `web/src/services/storage/`，由它决定当前使用哪个持久化后端。

当前存储模式：

- `server`：FastAPI companion 可用，数据写入 SQLite
- `browser`：companion 不可用，自动回退到浏览器存储
- `unknown`：后端探测尚未完成

在浏览器模式下，应用会持久化：

- 模型配置
- 提示词模板
- 会话列表
- 会话消息
- 会话级设置
- 已保存图片

浏览器模式下的图片会被转换成 `data:` URL，因此刷新后图库仍然可用。

### Companion Service

`server/` 现在应被理解为本地 companion，而不是强依赖后端。

它目前负责：

- 提供工作区设置、会话和图片缓存相关的 FastAPI 路由
- 在 `server/app/storage/` 下提供 SQLite 持久化
- 通过 `/_api/image/get/<image_id>` 下载和回放缓存图片
- 托管生产环境前端静态资源
- 提供 Windows `pywebview` 打包入口

## 路由

前端路由定义在 `web/src/router/index.ts`，并使用 `createWebHashHistory()`，因此静态托管时不需要服务端 rewrite。

当前路由：

- `/`
  - 重定向到 `/login`
- `/login`
  - 工作区启动页和存储模式探测页
- `/home`
  - Chat / Image / Settings 三个入口
- `/chat`
  - 聊天工作区
- `/image`
  - 图像工作区，内含生成和编辑标签
- `/settings`
  - 全页设置工作区

## 仓库结构

```text
ai-api-hub/
├─ README.md
├─ README.CN-zh.md
├─ README_CN.md
├─ web/
│  ├─ package.json
│  ├─ vite.config.js
│  ├─ vite.mock.config.js
│  ├─ public/
│  └─ src/
│     ├─ assets/
│     ├─ components/
│     │  ├─ base/
│     │  └─ header/
│     ├─ constants/
│     ├─ i18n/
│     ├─ router/
│     ├─ services/
│     │  ├─ chat/
│     │  ├─ image/
│     │  ├─ markdown/
│     │  ├─ storage/
│     │  ├─ transport/
│     │  └─ user/
│     ├─ store/
│     ├─ types/
│     ├─ utils/
│     └─ views/
│        ├─ chat/
│        ├─ home/
│        ├─ image/
│        └─ setting/
└─ server/
   ├─ app/
   │  ├─ core/
   │  ├─ routes/
   │  ├─ schemas/
   │  ├─ storage/
   │  └─ utils/
   ├─ scripts/
   ├─ statics/
   ├─ config.json
   ├─ dev.py
   ├─ main.py
   ├─ requirements.txt
   └─ win_webview.py
```

推荐先读这些文件：

- `web/src/router/index.ts`
- `web/src/constants/model.ts`
- `web/src/services/`
- `web/src/views/setting/SettingsWorkspace.vue`
- `server/app/server.py`

## 模型配置说明

模型现在是“用户自定义”的，内置模型列表只是建议项，不是硬编码限制。

当前模型配置能力包括：

- 通过 `chatParamDefs` 动态定义聊天参数面板
- 通过 `imageParamDefs` 动态定义图像参数面板
- 分别保存聊天模型、图像生成模型、图像编辑模型
- 根据 provider 手动填写 `model`、`baseURL`、`endpoint`、`deployment`、`apiVersion` 等字段

设置工作区会自动保存，同时支持导入 / 导出整个工作区配置。

## 开发方式

### 仅前端模式

适合纯浏览器运行，直接使用本地存储回退。

```bash
cd web
npm install
npm run dev:mock
```

默认开发地址：`http://127.0.0.1:20090`

### 前端 + Python Companion

适合需要 SQLite 持久化和图片缓存的场景。

```bash
python -m pip install -r server/requirements.txt
python server/dev.py
```

另开一个终端：

```bash
cd web
npm install
npm run dev
```

默认 companion API：`http://127.0.0.1:20088`

默认前端开发地址：`http://127.0.0.1:20090`

companion 的 host 和 port 可以在 `server/config.json` 中覆盖。

### 类型检查

```bash
cd web
npm run typecheck
```

## 构建与运行

### 通过 Companion 托管生产包

把前端构建到 `server/statics/`，再由 FastAPI 一起托管：

```bash
cd web
npm install
npm run build
cd ..
python server/main.py
```

### 纯静态前端构建

构建一个依赖浏览器存储回退的静态前端：

```bash
cd web
npm install
npm run build:mock
cd dist
python -m http.server 20098 --bind 0.0.0.0
```

这里可以换成任意静态服务器，因为应用使用 hash 路由，并且在 `/_api` 不可用时会自动回退到浏览器存储。
