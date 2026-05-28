# AI API HUB

多 AI 模型提供商的统一聊天与图像生成界面，完全运行在浏览器中。

## 功能特性

- **多模型聊天** — 通过统一聊天界面支持 OpenAI、Azure OpenAI、Anthropic、Azure AI Foundry 和 DeepSeek，支持流式（SSE）输出。
- **图像生成与编辑** — 通过 OpenAI / Azure OpenAI 实现文生图和图像编辑，内置画笔蒙版编辑器，可精确标记编辑区域。
- **模型管理** — 支持自定义模型名称、连接地址、API Key 和部署参数。模型目录包括 GPT-5.5、GPT-4.1、GPT-4o、Claude Opus/Sonnet/Haiku 及 DeepSeek V4 系列。
- **提示词模板** — 创建、编辑并复用在对话中的系统指令模板。
- **会话管理** — 创建、重命名、删除和批量删除聊天及图像对话记录，侧边栏实时显示各会话运行状态。
- **Token 用量追踪** — 每次对话实时统计输入/输出 token 消耗。
- **主题与语言** — 5 种 DaisyUI 主题（浅色、深色、纸杯蛋糕、荧光、柠檬），界面支持简体中文和英文。
- **配置导入导出** — 支持通过 URL 参数、文件上传或行内 JSON 导入配置，导出为可移植的 JSON 配置包。
- **完全本地化** — 纯前端运行，数据持久化在浏览器 localStorage 中，无需账号和后台服务。

## 支持的模型提供商

| 提供商 | 对话 | 图像 |
|---|---|---|
| OpenAI | 流式 & 同步（`/chat/completions`），联网搜索（`/responses`） | 文生图 & 编辑（`/images/generations`、`/images/edits`） |
| Azure OpenAI | 流式 & 同步（Azure 部署端点） | 文生图 & 编辑（Azure 部署） |
| Anthropic Direct | 流式 & 同步（`/v1/messages`） | — |
| Azure AI Foundry | 流式 & 同步（Anthropic 协议） | — |
| DeepSeek | 流式 & 同步（`/chat/completions`，纯文本） | — |

## 技术栈

- **Vue 3**（组合式 API、单文件组件）
- **TypeScript**
- **Vite 6**（开发服务器 & 构建工具）
- **Vuex 4**（状态管理，4 个模块）
- **Vue Router 4**（Hash 模式路由）
- **vue-i18n 9**（国际化）
- **DaisyUI 4 + Tailwind CSS 3**（UI 组件 & 主题系统）
- **markdown-it + highlight.js**（消息渲染 & 代码高亮）
- **axios**（HTTP 客户端）

## 项目结构

```
src/
├── ai-capability/       # AI 提供商抽象层
│   ├── chat/            # 对话提供商（OpenAI、Azure、Anthropic、DeepSeek）
│   │   └── providers/   # 各提供商的客户端实现
│   ├── image/           # 图像提供商（OpenAI、Azure）
│   │   └── providers/
│   └── common/          # 共享类型、SSE 客户端、用量归一化
├── assets/              # SCSS 样式文件、SVG 图标
├── components/          # 可复用的 Vue 组件
├── constants/           # 应用元信息、模型目录、参数预设
├── i18n/                # 语言包（zh-CN、en-US）
├── models/              # 数据归一化与 API 参数构建
├── router/              # Hash 路由定义
├── services/            # 业务逻辑层
│   ├── app/             # 设置增删改查、配置导入、存储
│   ├── conversation/    # 聊天会话管理、运行时、消息渲染
│   ├── creation/        # 图像生成与图库管理
│   └── markdown/        # Markdown 解析与代码高亮
├── store/               # Vuex 状态管理（user、chat、image、modal 模块）
├── types/               # TypeScript 类型定义
├── utils/               # 工具函数
└── views/               # 页面组件
    ├── chat/            # 聊天界面（输入区、设置、模板）
    ├── image/           # 图像工作台（工作区、预览、画笔编辑器）
    ├── layout/          # 侧边栏和主视图布局
    └── setting/         # 设置页（模型、模板、应用）
```

## 快速开始

### 环境要求

- Node.js ≥ 18
- npm ≥ 9

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

开发服务器运行在 `http://127.0.0.1:20090`。

### 构建生产版本

```bash
npm run build
```

构建产物输出到 `dist/` 目录，使用任意静态文件服务器部署即可。

### 类型检查

```bash
npm run typecheck
```

### 预览构建结果

```bash
npm run preview
```

## 使用说明

1. 打开应用，在首页点击 **"进入工作区"**。
2. 前往 **设置** → **对话模型**，添加一个模型并填写 API Key 和连接地址。
3. 新建对话，开始发送消息。
4. 如需图像生成，在 **设置** → **图像模型** 中添加图像模型，然后切换到 **图像** 标签页。

### 通过 URL 导入配置

在 URL hash 中通过 `config` 参数传递配置：

```
http://127.0.0.1:20090/#/?config=BASE64_ENCODED_JSON
http://127.0.0.1:20090/#/?config=https://example.com/my-config.json
```

适用于快速分享配置或在无痕/隐私浏览模式下免去手动导入的麻烦。

## 开源许可

[MIT](LICENSE)
