# Timeline — 见面记录

记录每一次见面日期、备注的轻量单页应用，提供日历视图、统计天数和心形动画效果。

- 前端: Vite + 原生 JavaScript
- 后端: Bun.serve + SQLite
- 部署: Docker 支持

## 快速开始

### 开发

```bash
# 安装依赖
bun install

# 启动前端开发服务器 (Vite, 端口 5173)
bun run dev

# 启动后端 API (Bun, 端口 3000)
bun run api
```

开发时，Vite 会将 `/api` 请求代理到 `http://localhost:3000`。

### 生产构建

```bash
# 构建前端
bun run build

# 启动后端服务器 (生产模式，运行在 3000 端口)
bun run api
```

构建产物输出到 `web/dist/` 目录。服务会自动提供静态页面和 API 处理。

### Docker 部署

```bash
# 构建并启动
docker compose build --no-cache
docker compose up -d
```

容器将宿主的 `data.sqlite` 挂载到容器内以持久化数据库。

## 功能

- 登录认证 (默认密码: `REDACTED`)
- 添加/删除见面记录
- 支持日期范围和多项输入 (如 `20250101~20250105` 或逗号分隔)
- 日历视图查看历史记录
- 点击日期添加/编辑备注
- 设置第一次见面日期
- 显示从第一次见面到现在的天数
- 心形跳动与飞出爱心动画
- 修改密码

## API 接口

认证: 所有接口 (除 `login`) 需要通过 session cookie 认证。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 登录，设置 session cookie |
| POST | `/api/logout` | 登出，清除 session |
| GET | `/api/meetings` | 获取见面记录 |
| POST | `/api/meetings` | 添加见面记录 |
| POST | `/api/meetings/:id` | 更新备注 |
| DELETE | `/api/meetings/:id` | 删除记录 |
| GET | `/api/settings` | 获取设置 |
| POST | `/api/first-meeting` | 设置第一次见面日期 |
| POST | `/api/password` | 修改密码 |

## 项目结构

```
timeline/
├── api/              # 后端 (Bun + SQLite)
│   ├── config/            # 应用配置
│   ├── controllers/       # 请求处理器
│   ├── db/                # 数据库层 (SQLite)
│   ├── middleware/        # 中间件 (认证, CORS)
│   ├── routes/            # 路由注册
│   ├── services/          # 业务逻辑层
│   ├── server.js          # 服务器入口
│   └── utils/             # 工具模块
│       ├── crypto.js      # 加密工具
│       ├── dateParser.js  # 日期解析 (与前端共享)
│       ├── response.js    # 统一响应格式
│       └── tasks.js       # 定时任务 (会话清理)
├── web/              # 前端 (Vite)
│   ├── index.html
│   ├── src/
│   │   ├── main.js
│   │   ├── styles.css
│   │   └── utils/
│   │       ├── api.js      # API 客户端
│   │       ├── constants.js  # 应用常量
│   │       ├── dateParser.js  # 日期工具 (与后端共享)
│   │       └── ui.js        # UI 组件辅助
│   └── vite.config.js
├── CLAUDE.md     # 开发者文档 (Claude Code 专用)
├── docs/
│   ├── CLAUDE.md
│   └── README.md
├── Dockerfile
├── docker-compose.yml
├── package.json
├── data/             # 数据目录 (由程序自动创建)
│   └── timeline.db   # SQLite 数据库 (运行时生成)
```

## 数据库

SQLite 数据库文件 `data/timeline.db` 存储在 `data/` 子目录中（由 `api/db/index.js` 自动创建和管理）。

表结构:
- `meetings`: 见面记录 (id, date, note, created_at)
- `settings`: 设置 (key, value, updated_at)
- `sessions`: 会话 (token, expires, created_at)

索引:
- `idx_meetings_date` on `meetings(date)`
- `idx_sessions_expires` on `sessions(expires)`

**注意**: 数据库文件路径配置在 `api/config/index.js` 中（`DB_PATH: './data/timeline.db'`），启动时会自动创建 `data/` 目录。

## 计划功能

1. 追加记录分类给见面记录添加标签（如：旅行、约会、纪念日）
2. 统计图表：日期分布热力图、每月见面次数折线图
3. 分享功能：生成见面天数分享卡片、导出见面记录 PDF
