// src/utils/constants.js
export const STORAGE_KEY = 'timeline.meetings'

// API根地址自动适配开发/生产环境
export const API_ROOT = (typeof location !== 'undefined' && location.port && Number(location.port) !== 3000)
  ? `${location.protocol}//${location.hostname}:3000`
  : ''

// UI配置常量
export const TOAST_DURATION = 3200
export const TOAST_TRANSITION = 300
export const RIPPLE_RING_COUNT = 7
export const CALENDAR_DEBOUNCE = 100
export const HEART_BURST_COUNT = 12
export const HEART_POSITION_DELAY = 80

// 颜色配置
export const COLORS = {
  error: 'rgba(255,90,90,0.95)',
  info: 'rgba(0,0,0,0.7)',
  accent: 'rgba(255,92,138,0.18)'
}