# 认证机制详解

## 概述

Timeline 应用采用 **密码哈希存储 + Session Token** 的轻量级认证方案，通过 HTTPOnly Cookie 自动管理会话，无需前端手动处理 Token。最大优势是：前端零改动即可享受安全会话机制。

## 数据库表：sessions

- **token**: UUID 格式字符串，作为主键，可避免临时表创建
- **expires**: 登录成功后的当前时间 +24 小时
- **created_at**: 会话创建时间戳
- **索引**: `idx_sessions_expires` 用于过期会话查询

## 密码哈希存储

密码以 SHA-256 哈希形式存储，不会明文保存在数据库中。

**注**：使用原生 Web Crypto API 而非 bcrypt 库，满足 Bun 环境中 bcrypt 库不支持 ESM 的约束。

## 初始化默认密码

应用首次启动时，若数据库中不存在 `password_hash` 设置，则自动写入默认密码 `REDACTED` 的哈希值。

## 登录流程

1. **前端请求**: 用户输入密码，发送 POST 请求
2. **后端接收**: 路由 `/api/login` 将请求分发至登录控制器
3. **验证密码**: 从 settings 表读取存储的密码哈希，比对用户输入
   - 验证失败：返回 401 错误，不泄露密码是否正确
   - 验证成功：生成 UUID 作为会话 Token，写入 sessions 表
4. **设置 Cookie**: 返回 JSON 响应，同时设置 HttpOnly Cookie
   - Cookie 名称固定为 `session`
   - HttpOnly: 禁止 JavaScript 访问，防止 XSS 窃取
   - Path=/: 作用于整个域名
   - Max-Age=24 小时：转换为秒数
   - SameSite=Lax: 防止 CSRF（含顶级域名重定向）

## 会话验证

所有受保护接口均通过中间件拦截：

1. **解析 Cookie**: 从请求头读取 cookie 字符串，解析为键值对
2. **提取 Token**: 获取键为 `session` 的值
3. **查库验证**: 在 sessions 表查询 Token
   - Token 不存在：无会话，返回 401
   - Token 存在但已过期（当前时间 > expires）: 主动删除并返回 401
   - 其余情况：会话有效，放行请求

## 登出流程

1. **验证获取 Token**: 通过中间件从 Cookie 读取 Token
2. **删除会话**: 从 sessions 表删除该 Token 记录
3. **清除 Cookie**: 设置过期 Cookie，立即在浏览器端失效

**双保险机制**: 数据库删除 + 浏览器删除，无需等待 24 小时自然过期

## 修改密码流程

1. **更新哈希**: 将新密码哈希至 settings 表的 `password_hash` 设置
2. **清空会话**: 删除 sessions 表中所有记录，强制所有旧 Token 失效

## 安全特性

| 机制 | 防护目标 | 说明 |
|------|---------|------|
| SHA-256 哈希 | 密码泄露 | 即使数据库被拖库，明文密码不会暴露 |
| HttpOnly | XSS | JavaScript 无法读取 Cookie，窃取难度极高 |
| SameSite=Lax | CSRF | 限制跨站 Cookie 发送（含顶级域名重定向） |
| 自动过期清理 | 会话劫持 | 过期会话每 6 小时自动清理 |
| 修改密码清空会话 | 会话固定 | 强制用户重新登录，消除旧 Token 风险 |
| 密码错误统一响应 | 暴力破解 | 不泄露密码是否正确，仅返回 401 |

## 项目文件依赖

| 文件 | 作用 |
|------|------|
| `api/services/auth.service.js` | 密码哈希、登录、登出、修改密码 |
| `api/middleware/auth.js` | Cookie 解析、会话验证中间件 |
| `api/routes/auth.js` | `/login`, `/logout`, `/password` 路由注册 |
| `api/config/index.js` | 默认密码与会话时长配置 |
| `api/utils/crypto.js` | Web Crypto API 封装 |
| `api/db/index.js` | 初始化默认密码时机 |
| `api/utils/tasks.js` | 定时清理过期会话（每 6 小时） |
| `web/src/utils/api.js` | 前端 API 客户端，自动处理 401 与 Cookie 联动 |
