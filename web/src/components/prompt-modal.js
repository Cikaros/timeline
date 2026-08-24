// src/components/prompt-modal.js

/**
 * 显示单输入提示弹窗
 * @param {object} opts - 配置选项
 * @param {string} opts.title - 标题
 * @param {string} [opts.placeholder] - 输入占位符
 * @param {string} [opts.inputType='text'] - 输入类型
 * @param {string} [opts.defaultValue] - 默认值
 * @param {string} [opts.confirmText='确定'] - 确认按钮文字
 * @returns {Promise<string|null>} - 返回输入值，取消返回 null
 */
export function showPrompt(opts) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'

    const inner = document.createElement('div')
    inner.className = 'modal-inner'

    // 标题
    const title = document.createElement('div')
    title.className = 'modal-title'
    title.textContent = opts.title
    inner.appendChild(title)

    // 输入框
    const input = document.createElement('input')
    input.type = opts.inputType || 'text'
    input.className = 'modal-input'
    input.placeholder = opts.placeholder || ''
    input.value = opts.defaultValue || ''
    inner.appendChild(input)

    // 按钮容器
    const btnWrap = document.createElement('div')
    btnWrap.className = 'modal-actions'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'btn ghost'
    cancelBtn.textContent = '取消'

    const confirmBtn = document.createElement('button')
    confirmBtn.className = 'btn'
    confirmBtn.textContent = opts.confirmText || '确定'

    btnWrap.appendChild(cancelBtn)
    btnWrap.appendChild(confirmBtn)
    inner.appendChild(btnWrap)
    overlay.appendChild(inner)
    document.body.appendChild(overlay)

    // 自动聚焦
    input.focus()

    function close(result) {
      overlay.remove()
      resolve(result)
    }

    confirmBtn.addEventListener('click', () => {
      const value = input.value.trim()
      close(value || null)
    })

    cancelBtn.addEventListener('click', () => close(null))

    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) close(null)
    })

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const value = input.value.trim()
        close(value || null)
      } else if (e.key === 'Escape') {
        close(null)
      }
    })
  })
}

/**
 * 显示多输入提示弹窗
 * @param {object} opts - 配置选项
 * @param {string} opts.title - 标题
 * @param {Array<{placeholder?: string, type?: string, label?: string}>} opts.fields - 输入字段配置
 * @param {string} [opts.confirmText='确定'] - 确认按钮文字
 * @returns {Promise<string[]|null>} - 返回输入值数组，取消返回 null
 */
export function showMultiPrompt(opts) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'

    const inner = document.createElement('div')
    inner.className = 'modal-inner'

    // 标题
    const title = document.createElement('div')
    title.className = 'modal-title'
    title.textContent = opts.title
    inner.appendChild(title)

    // 输入框组
    const inputs = []
    for (const field of opts.fields) {
      if (field.label) {
        const label = document.createElement('div')
        label.className = 'modal-label'
        label.textContent = field.label
        inner.appendChild(label)
      }
      const input = document.createElement('input')
      input.type = field.type || 'text'
      input.className = 'modal-input'
      input.placeholder = field.placeholder || ''
      inner.appendChild(input)
      inputs.push(input)
    }

    // 按钮容器
    const btnWrap = document.createElement('div')
    btnWrap.className = 'modal-actions'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'btn ghost'
    cancelBtn.textContent = '取消'

    const confirmBtn = document.createElement('button')
    confirmBtn.className = 'btn'
    confirmBtn.textContent = opts.confirmText || '确定'

    btnWrap.appendChild(cancelBtn)
    btnWrap.appendChild(confirmBtn)
    inner.appendChild(btnWrap)
    overlay.appendChild(inner)
    document.body.appendChild(overlay)

    // 自动聚焦第一个输入框
    if (inputs.length) inputs[0].focus()

    function close(result) {
      overlay.remove()
      resolve(result)
    }

    confirmBtn.addEventListener('click', () => {
      const values = inputs.map(i => i.value.trim())
      close(values)
    })

    cancelBtn.addEventListener('click', () => close(null))

    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) close(null)
    })

    // 键盘事件
    inputs.forEach((input, idx) => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          if (idx < inputs.length - 1) {
            inputs[idx + 1].focus()
          } else {
            const values = inputs.map(i => i.value.trim())
            close(values)
          }
        } else if (e.key === 'Escape') {
          close(null)
        }
      })
    })
  })
}

/**
 * 显示确认弹窗
 * @param {string} message - 确认消息
 * @param {string} [title='确认'] - 标题
 * @param {string} [confirmText='确认'] - 确认按钮文字
 * @returns {Promise<boolean>} - 确认返回 true，取消返回 false
 */
export function showConfirm(message, title = '确认', confirmText = '确认') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'

    const inner = document.createElement('div')
    inner.className = 'modal-inner'

    // 标题
    const titleEl = document.createElement('div')
    titleEl.className = 'modal-title'
    titleEl.textContent = title
    inner.appendChild(titleEl)

    // 消息
    const msgEl = document.createElement('div')
    msgEl.className = 'modal-message'
    msgEl.textContent = message
    inner.appendChild(msgEl)

    // 按钮
    const btnWrap = document.createElement('div')
    btnWrap.className = 'modal-actions'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'btn ghost'
    cancelBtn.textContent = '取消'

    const confirmBtn = document.createElement('button')
    confirmBtn.className = 'btn'
    confirmBtn.textContent = confirmText

    btnWrap.appendChild(cancelBtn)
    btnWrap.appendChild(confirmBtn)
    inner.appendChild(btnWrap)
    overlay.appendChild(inner)
    document.body.appendChild(overlay)

    confirmBtn.focus()

    function close(result) {
      overlay.remove()
      resolve(result)
    }

    confirmBtn.addEventListener('click', () => close(true))
    cancelBtn.addEventListener('click', () => close(false))
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) close(false)
    })
    confirmBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close(false)
    })
  })
}

/**
 * 显示消息弹窗
 * @param {string} message - 消息内容
 * @param {string} [title='提示'] - 标题
 */
export function showAlert(message, title = '提示') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'

    const inner = document.createElement('div')
    inner.className = 'modal-inner'

    // 标题
    const titleEl = document.createElement('div')
    titleEl.className = 'modal-title'
    titleEl.textContent = title
    inner.appendChild(titleEl)

    // 消息
    const msgEl = document.createElement('div')
    msgEl.className = 'modal-message'
    msgEl.textContent = message
    inner.appendChild(msgEl)

    // 按钮
    const btnWrap = document.createElement('div')
    btnWrap.className = 'modal-actions'

    const okBtn = document.createElement('button')
    okBtn.className = 'btn'
    okBtn.textContent = '确定'
    btnWrap.appendChild(okBtn)
    inner.appendChild(btnWrap)
    overlay.appendChild(inner)
    document.body.appendChild(overlay)

    okBtn.focus()

    function close() {
      overlay.remove()
      resolve()
    }

    okBtn.addEventListener('click', close)
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) close()
    })
    okBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') close()
    })
  })
}
