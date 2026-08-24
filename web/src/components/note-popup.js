// src/components/note-popup.js
import { showConfirm } from './prompt-modal.js'
import { showToast } from '../utils/ui.js'

// 记录当前弹窗的 keydown 处理器，确保替换时能清理
let currentKeyDownHandler = null

function cleanupExistingPopup() {
  const existingOverlay = document.getElementById('calendar-note-modal')
  if (!existingOverlay) return

  // 移除旧弹窗的 keydown 监听器
  if (currentKeyDownHandler) {
    document.removeEventListener('keydown', currentKeyDownHandler)
    currentKeyDownHandler = null
  }
  existingOverlay.remove()
}

/**
 * 显示备注编辑弹窗
 */
export function showNotePopup(dateStr, meeting, onSave, onDelete) {
  // 清理已存在的弹窗（包括其 keydown 监听器）
  cleanupExistingPopup()

  const overlay = document.createElement('div')
  overlay.id = 'calendar-note-modal'
  overlay.className = 'modal-overlay'

  const inner = document.createElement('div')
  inner.className = 'modal-inner'

  // 标题
  const header = document.createElement('div')
  header.className = 'modal-title'
  header.textContent = dateStr
  inner.appendChild(header)

  // 备注输入框
  const textarea = document.createElement('textarea')
  textarea.rows = 4
  textarea.className = 'modal-textarea'
  textarea.placeholder = '备注（可选）'
  textarea.value = meeting?.note || ''
  inner.appendChild(textarea)

  // 按钮容器
  const btnWrap = document.createElement('div')
  btnWrap.className = 'modal-actions'

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
      const confirmed = await showConfirm('确认删除该记录？')
      if (!confirmed) return
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

  // 关闭函数
  function close() {
    overlay.remove()
    if (currentKeyDownHandler) {
      document.removeEventListener('keydown', currentKeyDownHandler)
      currentKeyDownHandler = null
    }
  }

  // 键盘事件处理
  function handleKeyDown(e) {
    if (e.key === 'Escape') close()
  }
  currentKeyDownHandler = handleKeyDown
  document.addEventListener('keydown', handleKeyDown)

  // 保存：等待异步操作完成后再关闭
  saveBtn.addEventListener('click', async () => {
    const note = textarea.value.trim()
    saveBtn.disabled = true
    saveBtn.textContent = '保存中...'
    try {
      await onSave(note)
      close()
    } catch (e) {
      saveBtn.disabled = false
      saveBtn.textContent = '保存'
      showToast('保存失败', 'error')
    }
  })

  cancelBtn.addEventListener('click', close)
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) close()
  })
}
