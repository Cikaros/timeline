# Timeline — 见面记录

记录每一次见面日期、备注的轻量单页应用，提供日历视图、统计天数和心形动画效果。

- 前端: Vite + 原生 JavaScript
- 后端: Bun.serve + SQLite

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
```

构建产物输出到 `web/dist/` 目录。

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
| GET | `/api/meetings` | 获取会议列表 (`?limit=50&offset=0`) |
| POST | `/api/meetings` | 添加会议，支持 `input` 和 `note` |
| POST | `/api/meetings/:id` | 更新备注 |
| DELETE | `/api/meetings/:id` | 删除记录 |
| GET | `/api/settings` | 获取设置 (包含 `first_meeting`) |
| POST | `/api/first-meeting` | 设置第一次见面日期 |
| POST | `/api/password` | 修改密码 |

## 项目结构

```
timeline/
├── web/              # 前端
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── main.js
│   │   ├── styles.css
│   │   └── shared/
│   │       └── dateParser.js
│   └── vite.config.js
├── api/              # 后端
│   ├── server.js
│   └── utils/
│       └── dateParser.js
├── docs/
│   ├── CLAUDE.md
│   └── README.md
├── Dockerfile
├── docker-compose.yml
├── package.json
└── data.sqlite       # SQLite 数据库 (运行时生成，请保留)
```

## 数据库

SQLite 数据库文件 `data.sqlite` 存储在项目根目录。数据持久化存储，部署时请保留此文件。

表结构:
- `meetings`: 见面记录 (id, date, note)
- `settings`: 设置 (key, value)
- `sessions`: 会话 (token, expires)