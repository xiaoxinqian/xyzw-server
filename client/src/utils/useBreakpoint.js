import { ref, onMounted, onUnmounted } from 'vue'

const bp = ref(getBp())

function getBp() {
  if (typeof window === 'undefined') return 'desktop'
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

let listeners = []
let resizeTimer = null

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      const next = getBp()
      if (next !== bp.value) {
        bp.value = next
        listeners.forEach(fn => fn(next))
      }
    }, 150)
  })
}

export function useBreakpoint() {
  const current = ref(bp.value)
  const handler = (v) => { current.value = v }
  onMounted(() => listeners.push(handler))
  onUnmounted(() => { listeners = listeners.filter(fn => fn !== handler) })
  return {
    current,
    isMobile: () => current.value === 'mobile',
    isTablet: () => current.value === 'tablet',
    isDesktop: () => current.value === 'desktop',
  }
}
