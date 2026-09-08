import { z } from 'zod'

export const createSubscriptionSchema = z.object({
  name: z.string({ error: '请输入订阅名称' })
    .trim()
    .min(1, '订阅名称不能为空')
    .max(50, '订阅名称不能超过50个字符')
    .optional(),
})

export const updateSubscriptionSchema = z.object({
  name: z.string({ error: '请输入订阅名称' })
    .trim()
    .min(1, '订阅名称不能为空')
    .max(50, '订阅名称不能超过50个字符')
    .optional(),
  enabled: z.boolean({ error: '订阅状态必须是布尔值' }).optional(),
}).refine(data => data.name !== undefined || data.enabled !== undefined, {
  message: '请提供要更新的内容',
})
