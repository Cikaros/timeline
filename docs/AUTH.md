# 认证机制

## 概述

Timeline 使用“密码哈希 + Session Cookie”的轻量认证方案：

- 密码使用 Bun 内置 bcrypt，cost 为 12
- 旧版 SHA-256 哈希会在首次验证成功后自动升级为 bcrypt
- 浏览器保存原始 session token，数据库只保存该 token 的 SHA-256 摘要
- Cookie 为 `HttpOnly`、`SameSite=Lax`，生产环境追加 `Secure`
- 登录接口有进程内失败次数限制

## 密码存储

| 场景 | 处理方式 |
| --- | --- |
| 新数据库 | 使用 `DEFAULT_PASSWORD` 初始化，并记录 `password_is_default=1` |
| 旧 SHA-256 哈希 | 首次验证成功后自动重哈希为 bcrypt |
| 修改密码 | 写入新 bcrypt 哈希，并将 `password_is_default` 置为 `0` |

默认密码仍兼容 `DEFAULT_PASSWORD` 环境变量；未设置时使用 `REDACTED`。

## 默认密码强制修改

数据库会记录当前密码是否仍为默认密码：

- `password_is_default=1` 表示仍在使用默认密码
- 登录可以成功，但受保护接口只允许：
  - `GET /api/settings`（用于读取 `must_change_password`）
  - `POST /api/password`
- 前端读取 `must_change_password` 后会强制弹出修改密码表单
- 修改成功后才允许进入主界面

## 会话

1. 登录成功后生成 UUID token
2. Cookie 保存原始 token
3. 数据库保存 `SHA-256(token)`
4. 每次请求将 Cookie 中的 token 哈希后查询会话
5. 会话默认 24 小时有效
6. 过期会话每 6 小时清理一次

这种设计避免了数据库泄露后 session token 被直接复用。

## 登录限流

登录失败采用进程内限流：

- 15 分钟窗口内最多 5 次失败
- 达到上限后锁定 15 分钟
- 登录成功会清空失败计数
- 限流状态重启后重置

单实例部署下该方案足够；多实例部署建议改为共享存储。

## 修改密码

修改密码流程：

1. 验证当前密码
2. 写入新 bcrypt 哈希
3. 清除 `password_is_default`
4. 删除旧 session
5. 签发新 session 并更新 Cookie

## 安全特性

| 机制 | 目的 |
| --- | --- |
| bcrypt cost 12 | 降低明文密码被还原的风险 |
| session token 哈希存储 | 降低数据库泄露后的会话重放风险 |
| HttpOnly Cookie | 阻止 JavaScript 读取 session token |
| SameSite=Lax | 降低跨站请求携带 Cookie 的概率 |
| 登录限流 | 降低暴力破解风险 |
| Origin 校验 | 降低跨站伪造请求风险 |
| 默认密码强制修改 | 避免长期使用公开默认密码 |

## 已知限制

- 未实现显式 CSRF token；当前通过 `SameSite=Lax`、JSON 请求类型与 Origin 校验降低风险
- 登录限流存储在进程内存中，重启会清零
