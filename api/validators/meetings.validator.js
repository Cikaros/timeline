import { z } from 'zod'

const categorySchema = z.enum(
  ['meetings', 'travel', 'dating', 'anniversary', 'birthday'],
  {
    error: '请选择有效分类'
  }
)

export const createMeetingsSchema = z.object({
  input: z.string({ error: '请输入日期' }).min(1).max(500).optional(),
  date: z.string({ error: '请输入日期' }).min(1).max(500).optional(),
  note: z.string().max(500, '备注不能超过500个字符').optional(),
  category: categorySchema.optional()
}).refine(data => data.input || data.date, {
  message: '请输入日期',
})

export const updateNoteSchema = z.object({
  note: z.string({ error: '请输入备注' }).max(500, '备注不能超过500个字符'),
  category: categorySchema.optional()
})
