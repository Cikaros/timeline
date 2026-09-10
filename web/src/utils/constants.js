// API requests always use the current origin; the Vite dev server proxies /api.
export const API_ROOT = ''

// UI configuration
export const TOAST_DURATION = 3200
export const TOAST_TRANSITION = 300
export const RIPPLE_RING_COUNT = 7
export const CALENDAR_DEBOUNCE = 100
export const HEART_BURST_COUNT = 12
export const HEART_POSITION_DELAY = 80

export const COLORS = {
  error: 'rgba(255,90,90,0.95)',
  info: 'rgba(0,0,0,0.7)'
}

export const MEETING_CATEGORIES = [
  { id: 'meetings', name: '见面' },
  { id: 'travel', name: '旅行' },
  { id: 'dating', name: '约会' },
  { id: 'anniversary', name: '纪念日' },
  { id: 'birthday', name: '生日' }
]
