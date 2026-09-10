export const MEETING_CATEGORIES = [
  { id: 'meetings', name: '见面', color: '#FF5C8A' },
  { id: 'travel', name: '旅行', color: '#59B3F3' },
  { id: 'dating', name: '约会', color: '#FF8FB1' },
  { id: 'anniversary', name: '纪念日', color: '#C77DFF' },
  { id: 'birthday', name: '生日', color: '#FFD166' }
]

export const CATEGORY_IDS = MEETING_CATEGORIES.map(category => category.id)

export function getMeetingCategory(categoryId) {
  return MEETING_CATEGORIES.find(category => category.id === categoryId) || null
}

export function isMeetingCategory(categoryId) {
  return CATEGORY_IDS.includes(categoryId)
}
