import { z } from 'zod'

export const createMeetingsSchema = z.object({
  input: z.string({ error: '请输入日期' }).min(1).max(500).optional(),
  date: z.string({ error: '请输入日期' }).min(1).max(500).optional(),
  note: z.string().max(500, '备注不能超过500个字符').optional(),
}).refine(data => data.input || data.date, {
  message: '请输入日期',
})

export const updateNoteSchema = z.object({
  note: z.string({ error: '请输入备注' }).max(500, '备注不能超过500个字符'),
})
