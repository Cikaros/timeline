// src/animations/heart.js
import { RIPPLE_RING_COUNT, HEART_BURST_COUNT } from '../utils/constants.js'

const HEART_MOBILE_MAX_SIZE = 160
// 桌面端以故事面板容器为基准；低于阈值后才线性缩小
const HEART_CONTAINER_STABLE_WIDTH = 320
const HEART_CONTAINER_MIN_WIDTH = 220
const HEART_CONTAINER_MIN_RATIO = 0.55
const HEART_DESKTOP_WIDTH_RATIO = 0.44
const HEART_DESKTOP_MAX_SIZE = 146

const HEART_MIN_SIZE = 72
const HEART_MIN_SIZE_MOBILE = 72
const HEART_COUNT_GAP_RATIO = 0.2
const HEART_EDGE_SPACING = 14
const RIPPLE_SIZE_RATIO = 1.4
const RIPPLE_EMIT_RATIO = 0.6
const RIPPLE_MIN_BEAT_SEC = 0.2
const RIPPLE_MIN_DURATION = 1.2
// 心电图波形参数
const ECG_WAVE_RATIO = 1.0
const ECG_TRAIL_HALF_SPAN = 6

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
  const countBlock = panel?.querySelector('.count-block')
  if (!panel || !countBlock) return

  const panelRect = panel.getBoundingClientRect()
  const vw = window.innerWidth || document.documentElement.clientWidth || 360

  // 心形尺寸只从父容器宽度推导，文字和间距再按同一比例缩放。
  let desiredSize
  if (vw <= 768) {
    desiredSize = Math.round(Math.min(
      panelRect.width * 0.32,
      HEART_MOBILE_MAX_SIZE
    ))
  } else {
    const shrinkRatio = panelRect.width >= HEART_CONTAINER_STABLE_WIDTH
      ? 1
      : Math.max(
          HEART_CONTAINER_MIN_RATIO,
          (panelRect.width - HEART_CONTAINER_MIN_WIDTH) /
            (HEART_CONTAINER_STABLE_WIDTH - HEART_CONTAINER_MIN_WIDTH)
        )
    desiredSize = Math.round(Math.min(
      panelRect.width * HEART_DESKTOP_WIDTH_RATIO,
      HEART_DESKTOP_MAX_SIZE
    ) * shrinkRatio)
  }

  let heartSize = Math.max(vw <= 768 ? HEART_MIN_SIZE_MOBILE : HEART_MIN_SIZE, desiredSize)

  panel.style.setProperty('--heart-size', `${heartSize}px`)
  panel.style.setProperty('--count-gap', `${Math.round(heartSize * HEART_COUNT_GAP_RATIO + HEART_EDGE_SPACING)}px`)
  countBlock.classList.add('heart-ready')

  // 心电图线：线段沿白色轨道从左至右单向流动，跟随波形切线（SVG animateMotion）
  const ecgWidth = Math.round(heartSize * ECG_WAVE_RATIO)
  const rawBeatDuration = getComputedStyle(document.documentElement)
    .getPropertyValue('--heart-beat-duration') || '1s'
  const beatSec = Math.max(RIPPLE_MIN_BEAT_SEC, parseFloat(rawBeatDuration)) || 1
  const ecgDuration = beatSec * 2
  const ECG_D = 'M0 32 H88 L96 32 L101 26 L106 32 H128 L134 38 L139 12 L144 50 L149 28 L154 32 H196 L203 25 L210 32 H300'

  let ecg = panel.querySelector('.ecg-line')
  if (!ecg) {
    ecg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    ecg.setAttribute('class', 'ecg-line')
    ecg.setAttribute('viewBox', '0 0 300 60')
    ecg.setAttribute('preserveAspectRatio', 'none')
    ecg.setAttribute('aria-hidden', 'true')
    ecg.innerHTML =
      `<path class="ecg-base" fill="none" d="${ECG_D}"></path>` +
      `<line class="ecg-seg ecg-seg-glow" x1="-${ECG_TRAIL_HALF_SPAN}" y1="0" x2="${ECG_TRAIL_HALF_SPAN}" y2="0"><animateMotion dur="${ecgDuration}s" repeatCount="indefinite" path="${ECG_D}" rotate="auto"/></line>` +
      `<line class="ecg-seg" x1="-${ECG_TRAIL_HALF_SPAN}" y1="0" x2="${ECG_TRAIL_HALF_SPAN}" y2="0"><animateMotion dur="${ecgDuration}s" repeatCount="indefinite" path="${ECG_D}" rotate="auto"/></line>`
    panel.appendChild(ecg)
  } else {
    ecg.querySelectorAll('animateMotion').forEach(a => a.setAttribute('dur', `${ecgDuration}s`))
  }

  ecg.style.setProperty('--ecg-dur', `${ecgDuration}s`)
  ecg.style.width = `${ecgWidth}px`
  ecg.style.height = `${Math.round(ecgWidth / 5)}px`

  if (ecg.parentElement !== countBlock) countBlock.appendChild(ecg)
  // 生成涟漪环
  const totalDur = Math.max(beatSec * (RIPPLE_RING_COUNT + 1) * RIPPLE_EMIT_RATIO, RIPPLE_MIN_DURATION)
  const emitSpacing = beatSec * RIPPLE_EMIT_RATIO

  for (let i = 1; i <= RIPPLE_RING_COUNT; i++) {
    let ring = countBlock.querySelector(`.ripple-ring.r${i}`)
    if (!ring) {
      ring = document.createElement('div')
      ring.className = `ripple-ring r${i}`
      countBlock.appendChild(ring)
    }

    Object.assign(ring.style, {
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
