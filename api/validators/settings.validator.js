import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const setFirstMeetingSchema = z.object({
  date: z.string({ error: '请输入日期' })
    .min(1, '请输入日期')
    .regex(DATE_REGEX, '日期格式应为 YYYY-MM-DD'),
})
