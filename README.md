# Timeline — 见面记录

记录每一次见面日期、备注的轻量单页应用，提供日历视图、统计天数和心形动画效果。

- 前端: Vite 5 + 原生 JavaScript（支持响应式设计，适配 PC 和移动端）
- 后端: Bun.serve + SQLite
- 验证: Zod v4
- 部署: Docker 支持

## 快速开始

### 开发

```bash
# 安装依赖
bun install

# 启动前端开发服务器 (Vite, 端口 5174)
bun run dev

# 启动后端 API (Bun, 端口 3000)
bun run api
```

开发时需要同时运行 `dev` 和 `api`。Vite 会将 `/api` 请求代理到 `http://localhost:3000`。

### 生产构建

```bash
# 构建前端
bun run build

# 启动后端服务器 (生产模式，同时提供静态页面和 API)
NODE_ENV=production bun run api
```

构建产物输出到 `dist/` 目录。生产模式下后端自动提供静态页面和 API 处理。

### Docker 部署

```bash
# 构建并启动
docker compose build --no-cache
docker compose up -d
```

容器将宿主的 `data/timeline.db` 目录挂载到容器内以持久化数据库。

## 功能

- 登录认证（默认密码: `REDACTED`，建议首次登录后修改）
- 添加/删除见面记录
- 支持日期范围和多项输入（如 `20250101~20250105` 或逗号分隔）
- 日历视图查看历史记录，今日高亮
- 点击日期添加/编辑备注
- 设置第一次见面日期
- 显示从第一次见面到现在的天数
- 心形跳动与飞出爱心动画
- 修改密码
- 响应式设计（适配 PC 和移动端）
- 心形 SVG favicon

## API 接口

认证: 所有接口（除 `login`）需要通过 session cookie 认证。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 登录，设置 session cookie |
| POST | `/api/logout` | 登出，清除 session |
| GET | `/api/meetings` | 获取见面记录（需认证） |
| POST | `/api/meetings` | 添加见面记录（需认证） |
| POST | `/api/meetings/:id` | 更新某条记录的备注（需认证） |
| DELETE | `/api/meetings/:id` | 删除某条记录（需认证） |
| GET | `/api/settings` | 获取设置（需认证） |
| POST | `/api/first-meeting` | 设置第一次见面日期（需认证） |
| POST | `/api/password` | 修改密码（需认证） |

**认证方式**：除登录接口外，所有接口需要在请求头中携带 `Cookie: session=xxx`（通过登录成功后自动设置 HttpOnly Cookie）。

## 项目结构

```
timeline/
├── api/                    # 后端 (Bun + SQLite)
│   ├── config/             # 应用配置
│   ├── controllers/        # 请求处理器
│   ├── db/                 # 数据库层 (SQLite)
│   │   ├── index.js        # 数据库连接与初始化
│   │   ├── migrations.js   # 版本化迁移系统
│   │   └── statements.js   # SQL 语句集中管理
│   ├── middleware/          # 中间件 (认证 withAuth, CORS)
│   ├── routes/             # 路由注册
│   ├── services/           # 业务逻辑层
│   ├── validators/         # Zod v4 验证模式
│   ├── server.js           # 服务器入口
│   └── utils/              # 工具模块
│       ├── crypto.js       # 加密工具
│       ├── dateParser.js   # 日期解析 (与前端共享)
│       ├── response.js     # 统一响应格式
│       └── tasks.js        # 定时任务 (会话清理)
├── web/                    # 前端 (Vite + 原生 JS)
│   ├── index.html          # HTML 入口
│   ├── public/
│   │   └── favicon.svg     # 心形图标
│   ├── src/
│   │   ├── main.js         # 应用入口 (createApp, render, bindEvents)
│   │   ├── state.js        # 全局状态管理
│   │   ├── styles.css      # 全局样式 (CSS custom properties)
│   │   ├── auth/
│   │   │   └── login.js    # 登录界面
│   │   ├── calendar/
│   │   │   └── render.js   # 日历渲染 (今日高亮, 滑动切换)
│   │   ├── animations/
│   │   │   └── heart.js    # 心形动画 (心跳, 涟漪, 飘心)
│   │   ├── components/
│   │   │   ├── note-popup.js    # 备注编辑弹窗
│   │   │   └── prompt-modal.js  # 通用输入/提示弹窗
│   │   └── utils/
│   │       ├── api.js           # API 客户端 (10s 超时, 401 自动处理)
│   │       ├── constants.js     # 应用常量
│   │       ├── dateParser.js    # 日期解析 (与后端共享)
│   │       └── ui.js            # Toast 通知
│   └── vite.config.js
├── issues/                 # 问题追踪
│   └── 01-code-audit.md   # 代码审计报告
├── docs/                   # 文档
├── Dockerfile
├── docker-compose.yml
├── package.json
└── data/                   # 数据目录 (运行时自动创建, gitignored)
    └── timeline.db         # SQLite 数据库
```

## 后端架构

请求流程：**server.js** → **Routes** → **Controllers** → **Services** → **DB**

- `server.js` 一次性解析 URL，将 `{ method, pathname }` 传入路由函数
- 路由层使用 `withAuth(handler)` 保护需要认证的接口
- 控制器层解析请求体，通过 Zod 验证后调用服务层
- 服务层纯业务逻辑，使用预编译的 prepared statements
- 响应统一使用 `jsonResponse()` / `errorResponse()`

## 前端架构

- 全局状态通过 `state.js` 的 `getState()`/`setState()` 管理
- 事件监听使用 `AbortController` 防止登录/登出循环时累积
- 所有弹窗使用自定义模态框（`showPrompt`/`showMultiPrompt`/`showAlert`），无 `prompt()`/`alert()`
- API 请求通过 `apiFetch` 统一封装，支持 10s 超时和 401 自动处理

## 数据库

SQLite 数据库文件 `data/timeline.db`（由程序自动创建和管理）。

表结构:
- `meetings`: 见面记录（`date` UNIQUE, `note`, `created_at`）
- `settings`: 应用设置（`key` PRIMARY KEY, `value`, `updated_at`）
- `sessions`: 认证会话（`token` PRIMARY KEY, `expires`, `created_at`）

Schema 通过 `api/db/migrations.js` 版本化迁移管理，新增迁移需追加到 `migrations` 数组。

## 安全

- 密码: bcrypt（cost 12），自动升级旧版 SHA-256 哈希
- 会话: UUID token + HttpOnly Cookie（`SameSite=Lax`, 生产环境 `Secure`, 24h 有效期）
- 会话清理: 每 6 小时自动清除过期会话
- 修改密码会注销所有会话（含当前会话，已知限制）

## 已知问题

详见 `issues/01-code-audit.md`，主要未解决问题：

- 无 CSRF 防护
- 默认密码无强制修改机制
- 无登录速率限制
- Docker 容器以 root 运行
- 修改密码后当前会话失效

## 计划功能

1. 追加记录分类给见面记录添加标签（如：旅行、约会、纪念日）
2. 统计图表：日期分布热力图、每月见面次数折线图
3. 分享功能：生成见面天数分享卡片、导出见面记录 PDF
