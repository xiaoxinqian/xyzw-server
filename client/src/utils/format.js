import dayjs from 'dayjs'

export function fmtTime(t) {
  if (!t) return '-'
  return dayjs(t).format('YYYY-MM-DD HH:mm:ss')
}

export function fmtDuration(ms) {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function fmtStatus(status) {
  const map = {
    connected: { text: '已连接', type: 'success' },
    connecting: { text: '连接中', type: 'warning' },
    disconnected: { text: '已断开', type: 'info' },
    error: { text: '错误', type: 'danger' },
    reconnecting: { text: '重连中', type: 'warning' },
    success: { text: '成功', type: 'success' },
    failed: { text: '失败', type: 'danger' },
    skipped: { text: '跳过', type: 'info' },
  }
  return map[status] || { text: status || '-', type: 'info' }
}
