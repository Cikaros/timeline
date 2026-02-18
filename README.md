# Timeline — 我们的见面记录

这是一个轻量的单页应用（前端使用 Vite + 原生 JS，后端使用 Bun + SQLite），用于记录每一次见面日期、备注，并提供日历视图与统计心形背景动画效果。
## 项目结构

- `index.html` — 应用入口。
- `src/` — 前端源码（`main.js`, `styles.css` 等）。
- `shared/` — 前端/后端共享的日期解析工具 `dateParser.js`。
- `server.js` — Bun API 服务器（含认证、会议 CRUD、设置）。
- `package.json` — 项目脚本和依赖声明。
- `Dockerfile`, `docker-compose.yml` — 容器化部署文件（可选）。
- `data.sqlite` — SQLite 数据库文件（运行时生成，请保留以保留数据）。

## 运行（开发）
前提：已安装 `node`、`bun`（可选）、`npm`。开发时常用操作：

启动前端开发服务器（Vite）：
```bash
npm run dev
```

启动后端（Bun）以本地开发模式：
# 在另一个终端
bun run server.js
```

开发时，Vite 已在 `vite.config.js` 中配置了代理，将 `/api` 转发到 `http://localhost:3000`。
## 运行（生产 / Docker）

已提供 `Dockerfile` 与 `docker-compose.yml`，可用于构建镜像并以容器运行整套服务（前端预构建为静态文件，后端使用 Bun 提供 API 并提供静态文件）。
构建并启动：
```bash
docker compose build --no-cache
docker compose up -d
```

容器会把宿主的 `data.sqlite` 挂载到容器内以持久化数据库。
## API 说明（概要）

- `POST /api/login` — 登录；成功后服务器会设置 `session` HttpOnly cookie。
- `POST /api/meetings` — 插入记录，支持日期范围与多项（使用共享解析器）。
- `GET /api/meetings` — 列表（支持 `limit`/`offset`）。
- `POST /api/meetings/:id` — 更新备注。
- `DELETE /api/meetings/:id` — 删除记录。
- `POST /api/first-meeting`、`GET /api/settings` 等用于初次见面设置。

接口需要认证（除 `login` 以外），认证由后端通过 `session` cookie 管理。
## 日期解析

日期解析逻辑位于 `shared/dateParser.js`，前后端共享相同实现，支持：

- 单个日期（`20250101`, `2025-01-01` 等）
- 范围（`20250101~20250105`）
- 多项分隔（逗号/分号/换行/空格等）

请不要在前端重复实现解析逻辑，以免与后端不一致。
## 清理与移除的文件

- 已删除项目根目录下的临时文件：`payload.json`（如你仍需删除其他构建产物，请说明）。

## 常见问题
- MIME 错误（CSS 被当作 ES module）：在未用 Vite 构建静态资源时，直接将源码 `src/main.js` 提供给浏览器会触发 CSS import 作为模块的行为。生产镜像使用 `npm run build` 输出的 `dist` 来避免此问题；开发时使用 Vite (`npm run dev`)。

## 贡献
如果你想继续改进：

- 在 `src/styles.css` 中调整主题变量以快速修改配色。
- 在 `shared/dateParser.js` 增加更多解析用例（注意同步前后端）。

如需我帮你移除额外文件或把 README 内容改得更精简，请告诉我具体需求。
后端 (可选，部署时使用 SQLite 存储)

项目包含简单的 API 服务器 `server.js`（Express + sqlite3），可将数据持久化到 `data.sqlite`：
启动 API：

```bash
# 安装依赖（如果使用 bun）
bun install

# 启动后端 API
bun run api
```

或者使用 node：

```bash
npm install
npm run api
```

API 端点：

- `GET /api/meetings` — 列出所有会议（按日期降序）
- `POST /api/meetings` — 添加会议，JSON 体：`{ "date": "YYYY-MM-DD", "note": "..." }`
- `DELETE /api/meetings/:id` — 删除记录

注意：前端当前默认使用 `localStorage`，部署时可改为将前端请求改为调用上述 API（这是一个小的前端改造）。
# 我们的见面记录（Timeline）

一个用来记录与女朋友见面时间的轻量前端项目，主题偏爱意风格，含爱心动画。

运行（推荐使用 Bun）：

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev
```

如果没有 Bun，可使用 npm：

```bash
npm install
npm run dev
```

主要文件：

- `index.html` — 入口页面
- `src/main.js` — 应用逻辑
- `src/styles.css` — 主题样式与爱心动画
- `vite.config.js` — Vite 配置

功能：

- 添加/删除见面记录（日期、备注）
- 本地存储（localStorage）持久化
- 显示从第一次见面到现在的天数
- 心形跳动与飞出爱心动画

下一步建议：

- 若需多设备同步，可接入后端或使用云存储
- 增加导出/导入功能（JSON/CSV）
