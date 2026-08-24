// src/animations/heart.js
import { RIPPLE_RING_COUNT, HEART_BURST_COUNT } from '../utils/constants.js'

// 心形尺寸配置：[断点, 宽度比, 最大尺寸]
const HEART_SIZE_BREAKPOINTS = [
  { maxWidth: 480, widthRatio: 0.44, maxSize: 100 },
  { maxWidth: 768, widthRatio: 0.5, maxSize: 120 },
  { maxWidth: 1024, widthRatio: 0.45, maxSize: 160 },
  { maxWidth: Infinity, widthRatio: 0.5, maxSize: 260 },
]

const HEART_MIN_SIZE = 60
const HEART_MIN_SIZE_MOBILE = 40
const HEART_SIZE_PADDING = 12
const HEART_CENTER_OFFSET_Y = 5
const HEART_SCALE_DOWN = 0.95
const HEART_SCALE_UP = 1.15
const HEART_MARGIN_RATIO = 0.25
const HEART_Y_OFFSET_RATIO_NARROW = 0.06
const HEART_Y_OFFSET_RATIO_MEDIUM = 0.03
const HEART_BTN_SPACING = 12
const HEART_BTN_MIN_HALF = 20
const RIPPLE_SIZE_RATIO = 1.4
const RIPPLE_EMIT_RATIO = 0.6
const RIPPLE_MIN_BEAT_SEC = 0.2
const RIPPLE_MIN_DURATION = 1.2
// 心电图波形参数
const ECG_WAVE_RATIO = 1.5
const ECG_TRAIL_SPAN = 0.42

// 漂浮爱心分布配置：[断点, leftMin%, leftRange%, bottomMin%, bottomRange%]
const HEART_DISTRIBUTION_BREAKPOINTS = [
  { maxWidth: 480, leftMin: 10, leftRange: 80, bottomMin: 6, bottomRange: 28 },
  { maxWidth: 900, leftMin: 6, leftRange: 88, bottomMin: 6, bottomRange: 40 },
  { maxWidth: Infinity, leftMin: 2, leftRange: 96, bottomMin: 4, bottomRange: 60 },
]
const HEART_SIZE_MIN = 10
const HEART_SIZE_RANGE = 12
const HEART_DURATION_MIN = 2.0
const HEART_DURATION_RANGE = 1.6
const HEART_OPACITY_MIN = 0.7
const HEART_OPACITY_RANGE = 0.25
const HEART_ROTATION_MIN = -15
const HEART_ROTATION_RANGE = 30
const HEART_REMOVE_DELAY = 0.3

/**
 * 定位心形背景与生成涟漪环
 */
export function positionHeartToCount() {
  const panel = document.querySelector('.panel.story-panel')
  const countWrap = panel?.querySelector('.count-wrap')
  if (!panel || !countWrap) return

  const panelRect = panel.getBoundingClientRect()
  const countRect = countWrap.getBoundingClientRect()
  const absCenterX = countRect.left + countRect.width / 2
  const absCenterY = countRect.top + countRect.height / 2

  let heartSize = Math.max(HEART_MIN_SIZE, Math.round(Math.max(countRect.width, countRect.height) + HEART_SIZE_PADDING))
  const vw = window.innerWidth || document.documentElement.clientWidth || 360

  // 响应式心形大小
  let maxSizeByVw
  for (const bp of HEART_SIZE_BREAKPOINTS) {
    if (vw <= bp.maxWidth) {
      maxSizeByVw = Math.round(Math.min(panelRect.width * bp.widthRatio, bp.maxSize))
      break
    }
  }

  heartSize = Math.min(heartSize, maxSizeByVw)
  if (vw <= 1024) heartSize = Math.max(HEART_MIN_SIZE_MOBILE, Math.round(heartSize * HEART_SCALE_DOWN))
  if (vw >= 1024) heartSize = Math.min(Math.round(heartSize * HEART_SCALE_UP), maxSizeByVw)

  // 避免与按钮重叠
  const actionBtn = panel.querySelector('#celebrate')
  if (actionBtn) {
    const btnRect = actionBtn.getBoundingClientRect()
    const distToBtnTop = btnRect.top - absCenterY
    if (distToBtnTop > 0) {
      const allowedHalf = Math.max(HEART_BTN_MIN_HALF, Math.floor(distToBtnTop - HEART_BTN_SPACING))
      heartSize = Math.min(heartSize, allowedHalf * 2)
    }
  }

  // 计算相对位置
  let relX = Math.round(absCenterX - panelRect.left)
  let relY = Math.round(absCenterY - panelRect.top) + HEART_CENTER_OFFSET_Y // 视觉居中微调

  const margin = Math.round(heartSize * HEART_MARGIN_RATIO)
  const minX = margin
  const maxX = Math.max(margin, Math.round(panelRect.width - margin))
  const minY = margin
  const maxY = Math.max(margin, Math.round(panelRect.height - margin))

  if (vw <= 768) relY -= Math.round(heartSize * HEART_Y_OFFSET_RATIO_NARROW)
  else if (vw <= 1024) relY -= Math.round(heartSize * HEART_Y_OFFSET_RATIO_MEDIUM)

  relX = Math.max(minX, Math.min(relX, maxX))
  relY = Math.max(minY, Math.min(relY, maxY))

  // 设置CSS变量
  panel.style.setProperty('--heart-left', `${relX}px`)
  panel.style.setProperty('--heart-top', `${relY}px`)
  panel.style.setProperty('--heart-size', `${heartSize}px`)

  // 心电图线：与心形同步搏动
  let ecg = panel.querySelector('.ecg-line')
  if (!ecg) {
    ecg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    ecg.setAttribute('class', 'ecg-line')
    ecg.setAttribute('viewBox', '0 0 300 60')
    ecg.setAttribute('preserveAspectRatio', 'none')
    ecg.setAttribute('aria-hidden', 'true')
    const ECG_D = 'M0 32 H88 L96 32 L101 26 L106 32 H128 L134 38 L139 12 L144 50 L149 28 L154 32 H196 L203 25 L210 32 H300'
    ecg.innerHTML =
      `<path class="ecg-base" fill="none" d="${ECG_D}"></path>` +
      `<path class="ecg-glow" fill="none" stroke-linejoin="round" pathLength="1000" d="${ECG_D}"></path>` +
      `<path class="ecg-core" fill="none" stroke-linejoin="round" pathLength="1000" d="${ECG_D}"></path>`
    panel.appendChild(ecg)
  }

  const ecgWidth = Math.round(heartSize * ECG_WAVE_RATIO)
  const rawBeatDuration = getComputedStyle(document.documentElement)
    .getPropertyValue('--heart-beat-duration') || '1s'
  const beatSec = Math.max(RIPPLE_MIN_BEAT_SEC, parseFloat(rawBeatDuration)) || 1
  const ecgDuration = beatSec
  ecg.style.setProperty('--ecg-dur', `${ecgDuration}s`)
  ecg.style.setProperty('--ecg-trail', `${(ECG_TRAIL_SPAN * ecgDuration).toFixed(3)}s`)
  ecg.style.left = `${relX}px`
  ecg.style.top = `${relY}px`
  ecg.style.width = `${ecgWidth}px`
  ecg.style.height = `${Math.round(ecgWidth / 5)}px`
  // 生成涟漪环
  const totalDur = Math.max(beatSec * (RIPPLE_RING_COUNT + 1) * RIPPLE_EMIT_RATIO, RIPPLE_MIN_DURATION)
  const emitSpacing = beatSec * RIPPLE_EMIT_RATIO

  for (let i = 1; i <= RIPPLE_RING_COUNT; i++) {
    let ring = panel.querySelector(`.ripple-ring.r${i}`)
    if (!ring) {
      ring = document.createElement('div')
      ring.className = `ripple-ring r${i}`
      panel.appendChild(ring)
    }

    Object.assign(ring.style, {
      left: `${relX}px`,
      top: `${relY}px`,
      width: `${Math.round(heartSize * RIPPLE_SIZE_RATIO)}px`,
      height: `${Math.round(heartSize * RIPPLE_SIZE_RATIO)}px`,
      animation: `ripple-ring ${totalDur}s infinite cubic-bezier(.22,.84,.31,1)`,
      animationDelay: `${(i - 1) * emitSpacing}s`,
      borderColor: 'rgba(255,92,138,0.18)'
    })
  }
}

/**
 * 生成漂浮爱心效果
 */
export function burstHearts(count = HEART_BURST_COUNT) {
  const container = document.getElementById('floating-hearts')
  if (!container) return

  for (let i = 0; i < count; i++) {
    const heart = document.createElement('div')
    heart.className = 'h animate'

    const vw = Math.max(window.innerWidth || 360, 360)
    const dist = HEART_DISTRIBUTION_BREAKPOINTS.find(bp => vw <= bp.maxWidth)
    if (dist) {
      heart.style.left = `${dist.leftMin + Math.random() * dist.leftRange}%`
      heart.style.bottom = `${dist.bottomMin + Math.random() * dist.bottomRange}%`
    }

    // 随机大小和动画时长
    const size = HEART_SIZE_MIN + Math.round(Math.random() * HEART_SIZE_RANGE)
    heart.style.width = `${size}px`
    heart.style.height = `${size}px`

    const duration = HEART_DURATION_MIN + Math.random() * HEART_DURATION_RANGE
    heart.style.animationDuration = `${duration}s`
    heart.style.opacity = (HEART_OPACITY_MIN + Math.random() * HEART_OPACITY_RANGE).toFixed(2)
    heart.style.transform = `rotate(${Math.round(HEART_ROTATION_MIN + Math.random() * HEART_ROTATION_RANGE)}deg)`

    // 内联SVG爱心
    heart.innerHTML = `<svg viewBox="0 0 32 29.6" aria-hidden="true"><path d="M23.6,0C20.4,0,17.9,1.8,16,4.1C14.1,1.8,11.6,0,8.4,0C3.8,0,0,3.8,0,8.4c0,9.8,16,21.2,16,21.2s16-11.4,16-21.2C32,3.8,28.2,0,23.6,0z"></path></svg>`

    container.appendChild(heart)

    // 动画结束后自动移除
    setTimeout(() => heart.remove(), (duration + HEART_REMOVE_DELAY) * 1000)
  }
}
