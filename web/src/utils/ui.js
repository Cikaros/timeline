// src/utils/ui.js
import { TOAST_DURATION, TOAST_TRANSITION, COLORS } from './constants.js'

/**
 * 显示Toast提示
 * @param {string} message - 提示内容
 * @param {string} type - 提示类型：info/error
 */
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container')

  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    Object.assign(container.style, {
      position: 'fixed',
      right: '20px',
      top: '20px',
      zIndex: '9999'
    })
    document.body.appendChild(container)
  }

  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = message

  Object.assign(toast.style, {
    marginTop: '8px',
    padding: '10px 14px',
    borderRadius: '8px',
    background: type === 'error' ? COLORS.error : COLORS.info,
    color: 'white',
    boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
    opacity: '0',
    transition: 'opacity 220ms ease, transform 220ms ease'
  })

  container.appendChild(toast)

  requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })

  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), TOAST_TRANSITION)
  }, TOAST_DURATION)
}
