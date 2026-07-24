<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>Worker 监控</span>
          <div style="display: flex; gap: 4px" v-if="auth.isAdmin">
            <el-button size="small" type="success" @click="startAll">全部启动</el-button>
            <el-button size="small" type="danger" @click="stopAll">全部停止</el-button>
            <el-button size="small" link @click="loadWorkers">刷新</el-button>
          </div>
          <el-button v-else size="small" link @click="loadWorkers">刷新</el-button>
        </div>
      </template>

      <el-table v-if="!isMobile" :data="workers" stripe size="small">
        <el-table-column prop="account_name" label="账号" min-width="100" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }"><el-tag :type="fmtStatus(row.status).type" size="small">{{ fmtStatus(row.status).text }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="currentTask" label="当前任务" width="100"><template #default="{ row }">{{ row.currentTask || '-' }}</template></el-table-column>
        <el-table-column label="运行时间" width="80"><template #default="{ row }">{{ fmtDuration(row.uptime) }}</template></el-table-column>
        <el-table-column label="重连" width="50" prop="reconnectCount" />
        <el-table-column label="最后心跳" width="140"><template #default="{ row }">{{ fmtTime(row.lastHeartbeat) }}</template></el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="success" @click="startWorker(row.account_id)" :disabled="row.status === 'connected'">启动</el-button>
            <el-button size="small" link type="warning" @click="restartWorker(row.account_id)" :disabled="!row.status || row.status === 'disconnected'">重启</el-button>
            <el-button size="small" link type="danger" @click="stopWorker(row.account_id)" :disabled="!row.status || row.status === 'disconnected'">停止</el-button>
          </template>
        </el-table-column>
      </el-table>

      <template v-else>
        <div v-for="w in workers" :key="w.account_id" class="mobile-card">
          <div class="mobile-card-row">
            <span class="mobile-card-title">{{ w.account_name }}</span>
            <el-tag :type="fmtStatus(w.status).type" size="small">{{ fmtStatus(w.status).text }}</el-tag>
          </div>
          <div class="mobile-card-meta" v-if="w.currentTask">任务: {{ w.currentTask }}</div>
          <div class="mobile-card-meta">运行 {{ fmtDuration(w.uptime) }} · 重连 {{ w.reconnectCount || 0 }} 次</div>
          <div class="mobile-card-meta">{{ fmtTime(w.lastHeartbeat) }}</div>
          <div class="mobile-card-actions">
            <el-button size="small" type="success" @click="startWorker(w.account_id)" :disabled="w.status === 'connected'">启动</el-button>
            <el-button size="small" type="warning" @click="restartWorker(w.account_id)" :disabled="!w.status || w.status === 'disconnected'">重启</el-button>
            <el-button size="small" type="danger" @click="stopWorker(w.account_id)" :disabled="!w.status || w.status === 'disconnected'">停止</el-button>
          </div>
        </div>
        <el-empty v-if="!workers.length" description="暂无Worker" :image-size="60" />
      </template>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../utils/api'
import { useAuthStore } from '../stores/auth'
import { fmtTime, fmtDuration, fmtStatus } from '../utils/format'
import { useBreakpoint } from '../utils/useBreakpoint'

const auth = useAuthStore()
const { isMobile } = useBreakpoint()
const workers = ref([])
let timer = null

async function loadWorkers() { try { const r = await api.get('/workers'); workers.value = r.data || [] } catch {} }
async function startWorker(id) { try { await api.post(`/workers/${id}/start`); ElMessage.success('已启动'); loadWorkers() } catch {} }
async function stopWorker(id) { try { await api.post(`/workers/${id}/stop`); ElMessage.success('已停止'); loadWorkers() } catch {} }
async function restartWorker(id) { try { await api.post(`/workers/${id}/restart`); ElMessage.success('重启中'); loadWorkers() } catch {} }
async function startAll() { try { await ElMessageBox.confirm('启动全部Worker？', '提示'); await api.post('/workers/batch/start-all'); ElMessage.success('已发送'); loadWorkers() } catch {} }
async function stopAll() { try { await ElMessageBox.confirm('停止全部Worker？', '提示'); await api.post('/workers/batch/stop-all'); ElMessage.success('已发送'); loadWorkers() } catch {} }

onMounted(() => { loadWorkers(); timer = setInterval(loadWorkers, 10000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>
