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

# 启动 macOS 日历同步用的 HTTPS 开发服务器 (端口 5174)
bun run cert:dev
bun run dev:https

# 启动后端 API (Bun, 端口 3000)
bun run api

# 运行测试
bun test
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

通过反向代理访问时，请转发真实的公开地址。至少需要：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
```

服务端会用这些头推导 Origin，不再维护 `ALLOWED_ORIGINS` 白名单。

### 常用环境变量

| 变量 | 说明 |
| --- | --- |
| `PORT` | 后端端口，默认 `3000` |
| `DB_PATH` | SQLite 数据库路径，默认 `./data/timeline.db` |
| `SESSION_DURATION` | 会话有效期，单位毫秒，默认 24 小时 |
| `DEFAULT_PASSWORD` | 首次初始化时使用的密码，新库必须设置 |
| `PUBLIC_BASE_URL` | 可选的公网源地址，用于覆盖 `Host` / `X-Forwarded-*` 推导结果，并供 CalDAV 发现阶段生成完整 principal URL |

`PUBLIC_BASE_URL` 必须填写浏览器地址栏里的完整 Origin，例如
`https://timeline.example.com`，不要带路径和结尾斜杠。正常配置代理头后可以不设置。

## 功能

- 登录认证（首次密码由 `DEFAULT_PASSWORD` 提供，首次登录后强制修改）
- 账号管理（全局最多 2 个账号，默认账号名为 `owner`）
- 添加/删除见面记录，支持见面、旅行、约会、纪念日、生日分类
- 支持日期范围和多项输入（如 `20250101~20250105` 或逗号分隔）
- 日历视图查看历史记录，今日高亮
- 点击日期添加/编辑备注
- 设置第一次见面日期
- 显示从第一次见面到现在的天数
- 心形跳动与飞出爱心动画
- 修改密码
- 日历订阅链接管理
- 可将 Timeline 日程添加到手机系统日历
- CalDAV 双向同步（提供见面、旅行、约会、纪念日、生日日历集合）
- 响应式设计（适配 PC 和移动端）
- 心形 SVG favicon

## API 接口

认证: 数据接口需要通过 session cookie 认证；`health`、`login` 和 `logout` 除外。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/login` | 登录，设置 session cookie |
| POST | `/api/logout` | 登出，清除 session |
| GET | `/api/meetings` | 获取见面记录（需认证） |
| POST | `/api/meetings` | 添加见面记录（需认证） |
| POST | `/api/meetings/:id` | 更新某条记录的备注（需认证） |
| DELETE | `/api/meetings/:id` | 删除某条记录（需认证） |
| GET | `/api/settings` | 获取设置（需认证） |
| POST | `/api/first-meeting` | 设置第一次见面日期（需认证） |
| POST | `/api/password` | 修改密码（需认证） |
| GET | `/api/calendar-subscriptions` | 获取订阅链接列表（需认证） |
| POST | `/api/calendar-subscriptions` | 创建订阅链接（需认证） |
| POST | `/api/calendar-subscriptions/:id` | 更新名称或启用状态（需认证） |
| DELETE | `/api/calendar-subscriptions/:id` | 删除订阅链接（需认证） |
| GET | `/api/calendar/:token.ics` | 获取 ICS 订阅内容（无需登录） |
| GET | `/api/accounts` | 获取账号列表（需认证） |
| POST | `/api/accounts` | 创建账号（需认证，全局最多 2 个） |
| POST | `/api/accounts/password` | 修改当前账号密码（需认证） |
| DELETE | `/api/accounts/:id` | 删除账号（需认证，至少保留 1 个） |

**认证方式**：受保护接口需要在请求头中携带 `Cookie: session=xxx`（通过登录成功后自动设置 HttpOnly Cookie）。

## 手机日历订阅

1. 登录后在“日历订阅”面板点击“获取新链接”。
2. 点击“复制链接”，获得类似 `/api/calendar/<token>.ics` 的完整 URL。
3. 在 iOS 日历中依次进入“日历 → 账户 → 添加账户 → 其他 → 添加订阅日历”。
4. 在 Android 系统日历中选择“添加订阅日历”或“从 URL 添加”，粘贴链接。
5. 日历应用会按系统策略定期刷新；修改 Timeline 后，可手动刷新确认。

订阅 URL 包含访问凭证，请勿转发给无关人员。停用或删除链接后，旧 URL 会立即失效。

## CalDAV 同步

CalDAV 服务端地址：

```text
https://<你的访问地址>/caldav/
```

账号信息：

- 用户名：`owner` 或你在“账号管理”中创建的账号
- 密码：对应账号的 Timeline 密码

支持的路径：

| 路径 | 说明 |
| --- | --- |
| `/.well-known/caldav` | CalDAV 自动发现入口 |
| `/caldav/` | CalDAV 服务根路径 |
| `/caldav/calendars/<username>/` | Timeline 日历主页 |
| `/caldav/calendars/<username>/timeline/` | Timeline 日历集合 |

macOS 自带日历不允许 HTTP 携带 Basic 认证；本地同步必须使用 `bun run cert:dev` 生成证书、`bun run dev:https` 启动 Vite HTTPS 服务，并将 `.certs/localhost-cert.pem` 加入钥匙串信任。CalDAV 字段填：服务器地址 `localhost`、服务器路径 `/caldav/`、端口 `5174`、开启 SSL、关闭 Kerberos v5。

CalDAV 会把 Timeline 的每一天映射为全天事件。客户端新增或修改多日事件时，Timeline 会拆成多天记录；删除事件会删除相同 UID 下的全部日期。仅支持全天事件，不支持重复规则。

HTTP Basic Auth 会明文携带密码，请只在 HTTPS 或可信局域网中使用。删除账号后，该账号的 CalDAV 登录立即失效，但见面记录会保留。

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
- `meetings`: 见面记录（`date` + `category` 唯一, `note`, `created_at`）
- `settings`: 应用设置（`key` PRIMARY KEY, `value`, `updated_at`）
- `sessions`: 认证会话（`token` PRIMARY KEY, `expires`, `created_at`）

Schema 通过 `api/db/migrations.js` 版本化迁移管理，新增迁移需追加到 `migrations` 数组。

## 安全

- 密码: bcrypt（cost 12），自动升级旧版 SHA-256 哈希
- 默认密码: 首次登录后强制修改
- 会话: UUID token + HttpOnly Cookie（`SameSite=Lax`, 生产环境 `Secure`, 24h 有效期）
- 会话存储: 数据库仅保存 token 的 SHA-256 摘要
- 会话清理: 每 6 小时自动清除过期会话
- 登录限流: 15 分钟内 5 次失败后锁定 15 分钟
- Origin 校验: 通过代理头推导公开 Origin 后校验请求来源
- 修改密码: 旧 session 全部失效，并立即签发新 session

## 已知问题

- 未实现显式 CSRF token，当前依赖 `SameSite=Lax`、JSON 请求类型与 Origin 校验降低风险
- Docker 容器仍默认以 root 运行
- 登录限流是进程内状态，服务重启后清零
- 尚未内置数据库自动备份

## 计划功能

1. 统计图表：日期分布热力图、每月见面次数折线图
2. 分享功能：生成见面天数分享卡片、导出见面记录 PDF
