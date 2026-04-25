# AI API HUB

中文说明。英文主文档见 [README.md](./README.md)。

## 当前项目的真实定位

这个项目现在是：

- 单工作区
- 本地优先
- 前端主导
- Python companion 可选

也就是说：

- `web/` 是真正的产品
- `server/` 只是可选的本地 companion service
- 浏览器直接请求 OpenAI / Azure OpenAI / DeepSeek
- 不再需要真实登录

项目现在不再需要真实登录，但仍然保留了一个独立的 `/login` 入口页，作为进入单工作区的启动页。

## 当前核心能力

- 多模型聊天
- 多模型生图
- 提示词模板管理
- 独立 `/settings` 设置中心
- 自动保存
- 主题切换
- 中英文 i18n
- 浏览器存储 fallback
- 可选 Python companion service

## 架构变化

现在的核心不是“前后端一体”。

而是：

1. 前端负责界面、路由、模型配置、聊天渲染、生图流程
2. 前端直接调用模型提供商
3. 数据通过 storage provider 落盘
4. `server/` 只在可用时提供 SQLite / 图片缓存 / 桌面包装

当前存储模式：

- `server`
  - companion 可用
- `browser`
  - companion 不可用，退化到浏览器存储
- `unknown`
  - 尚未确认

## 单工作区

项目已经从伪多用户模型切到单工作区模型。

当前工作区保存：

- 模型配置
- 提示词模板
- 会话与消息
- 会话参数
- 图片记录

不再依赖：

- 账号体系
- 用户登录
- 多用户隔离

## `server/` 现在还有什么价值

如果你需要下面这些能力，`server/` 仍然有意义：

- SQLite 持久化
- 图片下载与缓存
- 本地 HTTP API
- Windows `pywebview` 打包

但它已经不是项目中心。

## `server/` 新结构

现在 `server/` 已经按更现代的方式重排：

- `server/app/core/`
  - 配置与日志
- `server/app/routes/`
  - FastAPI 路由
- `server/app/schemas/`
  - Pydantic 请求 / 响应结构
- `server/app/storage/`
  - SQLite 存储层
- `server/app/utils/`
  - 少量通用工具
- `server/scripts/`
  - 兼容层，主要为了旧导入路径不立即失效

## 路由

当前主要路由：

- `/home`
- `/chat`
- `/image`
- `/settings`

兼容路由：

- `/`
  - 重定向到 `/login`
- `/login`
  - 工作区启动页

## `/login`

当前登录页不是账号登录页，而是工作区启动页。

它会：

- 探测 companion service 是否可用
- 显示当前是 companion 模式还是 browser storage 模式
- 进入单工作区

## 设置中心

`/settings` 现在是独立工作台页面，而不是弹窗。

分区：

- Prompt Templates
- Chat Models
- Image Models
- App

特点：

- 左侧列表 / 右侧详情
- 自动保存
- 导入 / 导出
- companion URL 管理

## 模型参数机制

聊天模型不再依赖固定模型名判断参数。

现在通过 `chatParamDefs` 定义“这个模型允许哪些参数”，聊天页会动态渲染：

- `number`
  - 滑块
- `string`
  - 输入框
- `boolean`
  - 开关
- `array`
  - JSON 文本输入

核心文件：

- `web/src/constants/model.js`
- `web/src/components/ModelEditCard.vue`
- `web/src/views/chat/ChatSettings.vue`

## 浏览器存储模式

浏览器存储不再只是临时 mock，而是正式 provider。

覆盖：

- 工作区初始化
- 模型配置
- 提示词模板
- 会话列表
- 消息
- 会话参数
- 图片记录

浏览器模式下：

- 图片会转成 `data:` URL
- 刷新后仍会回到同一个工作区
- 不支持 Python 相关能力

## 开发方式

完整本地开发：

```bash
python dev.py
```

纯前端开发：

```bash
cd web
npm run dev:mock
```

正常构建：

```bash
cd web
npm run build
```

mock 构建：

```bash
cd web
npm run build:mock
```

纯静态部署：

```bash
cd web
npm run build:mock
cd dist
python -m http.server 20098 --bind 0.0.0.0
```

## 推荐阅读顺序

建议按这个顺序理解项目：

1. `web/src/router/index.js`
2. `web/src/App.vue`
3. `web/src/views/home/HomePage.vue`
4. `web/src/views/chat/HomePage.vue`
5. `web/src/views/image/HomePage.vue`
6. `web/src/views/user/UserSettings.vue`
7. `web/src/services/storage/`
8. `web/src/services/api/`
9. `web/src/services/aigc/`
10. `server/app/routes/`

现在正确的理解方式是：

先理解前端和 storage provider，再理解 optional companion。
