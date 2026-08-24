import { z } from 'zod'

export const loginSchema = z.object({
  password: z.string({ error: '请输入密码' }).min(1, '请输入密码').max(100),
})

export const changePasswordSchema = z.object({
  oldPassword: z.string({ error: '请输入当前密码' }).min(1, '请输入当前密码').max(100),
  newPassword: z.string({ error: '请输入新密码' }).min(6, '新密码至少需要6个字符').max(100),
})
