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

/**
 * 显示备注编辑弹窗
 * @param {string} dateStr - 日期字符串
 * @param {object|null} meeting - 会议对象
 * @param {function} onSave - 保存回调
 * @param {function} onDelete - 删除回调
 */
export function showNotePopup(dateStr, meeting, onSave, onDelete) {
  // 移除已存在的弹窗防止重复
  const existingOverlay = document.getElementById('calendar-note-modal')
  if (existingOverlay) existingOverlay.remove()

  const overlay = document.createElement('div')
  overlay.id = 'calendar-note-modal'
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '10000',
    background: 'rgba(0,0,0,0.28)'
  })

  const inner = document.createElement('div')
  Object.assign(inner.style, {
    width: '360px',
    maxWidth: '92%',
    background: 'white',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.12)'
  })

  // 标题
  const header = document.createElement('div')
  header.style.fontWeight = '700'
  header.style.marginBottom = '8px'
  header.textContent = dateStr
  inner.appendChild(header)

  // 备注输入框
  const textarea = document.createElement('textarea')
  textarea.rows = 4
  Object.assign(textarea.style, {
    width: '100%',
    boxSizing: 'border-box'
  })
  textarea.placeholder = '备注（可选）'
  textarea.value = meeting?.note || ''
  inner.appendChild(textarea)

  // 按钮容器
  const btnWrap = document.createElement('div')
  Object.assign(btnWrap.style, {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '12px'
  })

  // 取消按钮
  const cancelBtn = document.createElement('button')
  cancelBtn.className = 'btn ghost'
  cancelBtn.textContent = '取消'

  // 保存按钮
  const saveBtn = document.createElement('button')
  saveBtn.className = 'btn'
  saveBtn.textContent = '保存'

  // 删除按钮（仅当有会议记录时显示）
  if (meeting?.id) {
    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'btn ghost'
    deleteBtn.textContent = '删除'
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('确认删除该记录？')) return
      try {
        await onDelete(meeting.id)
        showToast('已删除')
        close()
      } catch (e) {
        showToast('删除失败', 'error')
      }
    })
    btnWrap.appendChild(deleteBtn)
  }

  btnWrap.appendChild(cancelBtn)
  btnWrap.appendChild(saveBtn)
  inner.appendChild(btnWrap)
  overlay.appendChild(inner)
  document.body.appendChild(overlay)

  // 自动聚焦输入框
  textarea.focus()

  // 关闭函数（自动移除事件监听防止内存泄漏）
  function close() {
    overlay.remove()
    document.removeEventListener('keydown', handleKeyDown)
  }

  // 键盘事件处理
  function handleKeyDown(e) {
    if (e.key === 'Escape') close()
  }
  document.addEventListener('keydown', handleKeyDown)

  // 事件绑定
  saveBtn.addEventListener('click', () => {
    const note = textarea.value.trim()
    onSave(note)
    close()
  })

  cancelBtn.addEventListener('click', close)
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) close()
  })
}