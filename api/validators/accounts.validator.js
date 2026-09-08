import { z } from 'zod'

export const createAccountSchema = z.object({
  username: z.string({ error: '请输入用户名' })
    .trim()
    .min(2, '用户名至少需要2个字符')
    .max(32, '用户名不能超过32个字符')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含英文、数字、下划线和连字符'),
  password: z.string({ error: '请输入密码' })
    .min(6, '密码至少需要6个字符')
    .max(128, '密码不能超过128个字符'),
})
