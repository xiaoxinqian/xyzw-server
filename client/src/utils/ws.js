/**
 * WebSocket 客户端 - 实时接收服务端推送
 */

import { ElNotification } from 'element-plus'

let ws = null
let reconnectTimer = null
let messageHandlers = new Map()

export function connectWebSocket(token) {
  if (ws && ws.readyState <= 1) return // 已连接或连接中

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${protocol}//${location.host}/ws?token=${token}`

  ws = new WebSocket(url)

  ws.onopen = () => {
    console.log('[WS] 已连接')
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      const handlers = messageHandlers.get(msg.type) || []
      handlers.forEach(h => h(msg.data))
    } catch (e) {
      // ignore
    }
  }

  ws.onclose = () => {
    console.log('[WS] 已断开，5秒后重连...')
    ws = null
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        if (token) connectWebSocket(token)
      }, 5000)
    }
  }

  ws.onerror = () => {
    // onclose 会处理重连
  }
}

export function disconnectWebSocket() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  if (ws) { ws.close(); ws = null }
}

export function onMessage(type, handler) {
  if (!messageHandlers.has(type)) {
    messageHandlers.set(type, [])
  }
  messageHandlers.get(type).push(handler)
}

export function offMessage(type, handler) {
  const handlers = messageHandlers.get(type)
  if (handlers) {
    const idx = handlers.indexOf(handler)
    if (idx > -1) handlers.splice(idx, 1)
  }
}
