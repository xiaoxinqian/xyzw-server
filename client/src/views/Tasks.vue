<template>
  <div class="page-container">
    <!-- 批量执行 -->
    <el-card style="margin-bottom: 12px">
      <template #header>
        <div class="card-header">
          <span>批量执行</span>
          <el-button size="small" link @click="loadAccounts" :loading="loadingAccs">刷新</el-button>
        </div>
      </template>

      <!-- 账号选择 -->
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap">
        <el-checkbox v-model="accAll" :indeterminate="accInd" @change="v => selectedAccs = v ? accounts.map(a => a.id) : []">全选</el-checkbox>
        <el-input v-model="accSearch" placeholder="搜索..." size="small" style="width: 140px" clearable />
        <span style="font-size: 12px; color: #909399; margin-left: auto">已选 {{ selectedAccs.length }}</span>
      </div>
      <div style="max-height: 140px; overflow-y: auto; border: 1px solid #ebeef5; border-radius: 6px; padding: 6px">
        <el-checkbox-group v-model="selectedAccs" style="display: flex; flex-wrap: wrap; gap: 4px">
          <el-checkbox v-for="a in filteredAccs" :key="a.id" :label="a.id" style="margin-right: 0">
            {{ a.name }}<el-tag size="small" type="info" style="margin-left: 2px">{{ a.server_id || '?' }}</el-tag>
          </el-checkbox>
        </el-checkbox-group>
      </div>

      <div style="height: 1px; background: #ebeef5; margin: 12px 0"></div>

      <div style="display: flex; gap: 8px; align-items: center">
        <el-select v-model="selTaskType" filterable placeholder="选择任务类型" style="flex: 1">
          <el-option-group v-for="g in groupedTasks" :key="g.label" :label="g.label">
            <el-option v-for="t in g.options" :key="t.id" :label="t.name" :value="t.id">
              <span>{{ t.name }}</span><span style="font-size: 11px; color: #909399; margin-left: 6px">{{ t.description }}</span>
            </el-option>
          </el-option-group>
        </el-select>
        <el-button type="primary" :loading="batchRunning" :disabled="!selectedAccs.length || !selTaskType" @click="batchRun">
          {{ batchRunning ? batchProgress : '执行' }}
        </el-button>
      </div>

      <div v-if="batchResults.length" style="margin-top: 8px; border: 1px solid #ebeef5; border-radius: 6px; padding: 6px; max-height: 150px; overflow-y: auto">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; font-weight: 600">
          <span>结果 {{ batchResults.filter(r => r.success).length }}/{{ batchResults.length }}</span>
          <el-button text size="small" @click="batchResults = []">清空</el-button>
        </div>
        <div v-for="r in batchResults" :key="r.accountId" style="display: flex; align-items: center; gap: 6px; padding: 3px 0; border-bottom: 1px solid #f5f5f5; font-size: 12px">
          <span style="flex: 1">{{ r.accountName }}</span>
          <el-tag :type="r.success ? 'success' : 'danger'" size="small">{{ r.success ? '✓' : '✗' }}</el-tag>
          <span v-if="!r.success" style="color: #f56c6c; font-size: 11px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ r.message }}</span>
        </div>
      </div>
    </el-card>

    <!-- 定时任务 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>定时任务</span>
          <el-button type="primary" size="small" @click="openCreate">+ 创建</el-button>
        </div>
      </template>

      <!-- PC 表格 -->
      <el-table v-if="!isMobile" :data="tasks" stripe size="small">
        <el-table-column prop="name" label="名称" min-width="100" />
        <el-table-column label="账号" min-width="120">
          <template #default="{ row }">
            <span v-if="row.account_names?.length">{{ row.account_names.join(', ') }}</span>
            <span v-else>{{ row.account_name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">{{ taskLabel(row.task_type) }}</template>
        </el-table-column>
        <el-table-column label="调度" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.schedule_type === 'interval' ? 'warning' : ''">
              {{ row.schedule_type === 'interval' ? `每${row.interval_minutes}分` : '每日' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="execute_time" label="时间" width="60" />
        <el-table-column label="状态" width="55">
          <template #default="{ row }"><el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '开' : '关' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="上次" width="140"><template #default="{ row }">{{ fmtTime(row.last_execute) }}</template></el-table-column>
        <el-table-column label="下次" width="140"><template #default="{ row }">{{ fmtTime(row.next_execute) }}</template></el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="success" :loading="running === row.id" @click="runTask(row)">执行</el-button>
            <el-button size="small" link @click="toggleTask(row)">{{ row.enabled ? '禁用' : '启用' }}</el-button>
            <el-button size="small" link @click="viewLogs(row)">日志</el-button>
            <el-button size="small" link type="danger" @click="deleteTask(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 手机卡片 -->
      <template v-else>
        <div v-for="row in tasks" :key="row.id" class="mobile-card">
          <div class="mobile-card-row">
            <span class="mobile-card-title">{{ row.name }}</span>
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '开' : '关' }}</el-tag>
          </div>
          <div class="mobile-card-meta">
            <span v-if="row.account_names?.length">{{ row.account_names.join(', ') }}</span>
            <span v-else>{{ row.account_name }}</span> · {{ taskLabel(row.task_type) }} ·
            {{ row.schedule_type === 'interval' ? `每${row.interval_minutes}分钟` : (row.execute_time || '每日') }}
          </div>
          <div class="mobile-card-meta" v-if="row.next_execute">下次: {{ fmtTime(row.next_execute) }}</div>
          <div class="mobile-card-actions">
            <el-button size="small" type="success" :loading="running === row.id" @click="runTask(row)">执行</el-button>
            <el-button size="small" @click="toggleTask(row)">{{ row.enabled ? '禁用' : '启用' }}</el-button>
            <el-button size="small" @click="viewLogs(row)">日志</el-button>
            <el-button size="small" type="danger" @click="deleteTask(row.id)">删除</el-button>
          </div>
        </div>
        <el-empty v-if="!tasks.length" description="暂无定时任务" :image-size="60" />
      </template>
    </el-card>

    <!-- 创建任务 -->
    <el-dialog v-model="showCreate" title="创建定时任务" width="92%" style="max-width: 460px">
      <el-form :model="createForm" label-width="70px" size="small">
        <el-form-item label="名称"><el-input v-model="createForm.name" placeholder="留空自动生成" /></el-form-item>
        <el-form-item label="账号">
          <el-select v-model="createForm.accountIds" filterable multiple collapse-tags collapse-tags-tooltip placeholder="选择账号（可多选）" style="width: 100%">
            <el-option v-for="a in accounts" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="createForm.taskType" filterable placeholder="选择任务类型" style="width: 100%">
            <el-option-group v-for="g in groupedTasks" :key="g.label" :label="g.label">
              <el-option v-for="t in g.options" :key="t.id" :label="t.name" :value="t.id">
                <span>{{ t.name }}</span><span style="font-size: 11px; color: #909399; margin-left: 6px">{{ t.description }}</span>
              </el-option>
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="调度">
          <el-radio-group v-model="createForm.scheduleType">
            <el-radio-button label="daily">每日定时</el-radio-button>
            <el-radio-button label="interval">间隔循环</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="createForm.scheduleType === 'daily'" label="时间">
          <el-time-picker v-model="createTime" format="HH:mm" value-format="HH:mm" placeholder="04:00" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="createForm.scheduleType === 'interval'" label="间隔">
          <el-input-number v-model="createInterval" :min="1" :max="1440" /> <span style="margin-left: 6px; color: #909399; font-size: 12px">分钟</span>
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="createForm.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" @click="createTask">创建</el-button>
      </template>
    </el-dialog>

    <!-- 日志 -->
    <el-dialog v-model="showLogs" title="执行日志" width="92%" style="max-width: 680px">
      <el-table :data="taskLogs" stripe size="small" max-height="380">
        <el-table-column label="状态" width="65">
          <template #default="{ row }"><el-tag :type="fmtStatus(row.status).type" size="small">{{ fmtStatus(row.status).text }}</el-tag></template>
        </el-table-column>
        <el-table-column label="手动" width="45"><template #default="{ row }">{{ row.manual ? '是' : '否' }}</template></el-table-column>
        <el-table-column label="耗时" width="55"><template #default="{ row }">{{ fmtDuration(row.duration_ms) }}</template></el-table-column>
        <el-table-column label="结果" min-width="160" show-overflow-tooltip><template #default="{ row }">{{ row.result }}</template></el-table-column>
        <el-table-column label="时间" width="140"><template #default="{ row }">{{ fmtTime(row.created_at) }}</template></el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../utils/api'
import { fmtTime, fmtDuration, fmtStatus } from '../utils/format'
import { useBreakpoint } from '../utils/useBreakpoint'

const { isMobile } = useBreakpoint()
const accounts = ref([])
const tasks = ref([])
const taskTypes = ref([])
const loadingAccs = ref(false)
const selectedAccs = ref([])
const accSearch = ref('')
const selTaskType = ref('')
const batchRunning = ref(false)
const batchProgress = ref('')
const batchResults = ref([])
const showCreate = ref(false)
const showLogs = ref(false)
const running = ref(null)
const taskLogs = ref([])
const createForm = ref({ name: '', accountIds: [], taskType: '', scheduleType: 'daily', enabled: true })
const createTime = ref('04:00')
const createInterval = ref(30)

const filteredAccs = computed(() => {
  if (!accSearch.value) return accounts.value
  const kw = accSearch.value.toLowerCase()
  return accounts.value.filter(a => a.name.toLowerCase().includes(kw))
})
const accAll = computed({ get: () => selectedAccs.value.length === accounts.value.length && accounts.value.length > 0, set: () => {} })
const accInd = computed(() => selectedAccs.value.length > 0 && selectedAccs.value.length < accounts.value.length)

const groupedTasks = computed(() => {
  const groups = {}
  for (const t of taskTypes.value) {
    const cat = t.category || 'other'
    if (!groups[cat]) groups[cat] = { label: catLabel(cat), options: [] }
    groups[cat].options.push(t)
  }
  return Object.values(groups)
})
function catLabel(c) { return { daily:'日常', hangup:'挂机', bottle:'罐子', tower:'塔', arena:'竞技场', item:'资源', dungeon:'副本', car:'车辆', store:'商店', legacy:'珍宝阁' }[c] || '其他' }
function taskLabel(t) { return taskTypes.value.find(x => x.id === t)?.name || t }

async function loadAccounts() { loadingAccs.value = true; try { const r = await api.get('/accounts'); accounts.value = r.data || [] } catch {} finally { loadingAccs.value = false } }
async function loadTasks() { try { const r = await api.get('/tasks'); tasks.value = r.data || [] } catch {} }
async function loadTaskTypes() { try { const r = await api.get('/tasks/types'); taskTypes.value = r.data || [] } catch {} }

async function batchRun() {
  if (!selectedAccs.value.length) return ElMessage.warning('请选择账号')
  if (!selTaskType.value) return ElMessage.warning('请选择任务类型')
  batchRunning.value = true; batchResults.value = []; batchProgress.value = `0/${selectedAccs.value.length}`
  try {
    // 启动批量任务，拿到 batchId
    const startRes = await api.post('/tasks/batch-run', { accountIds: selectedAccs.value, taskType: selTaskType.value })
    if (!startRes.success || !startRes.batchId) { ElMessage.error(startRes.message || '启动失败'); return }
    const batchId = startRes.batchId
    // 轮询进度
    const poll = async () => {
      try {
        const st = await api.get(`/tasks/batch-status/${batchId}`)
        if (!st.success) return
        batchProgress.value = `${st.done}/${st.total}`
        batchResults.value = (st.results || []).map(r => { const a = accounts.value.find(x => x.id === r.accountId); return { ...r, accountName: a?.name || r.accountId } })
        if (st.status === 'running') {
          setTimeout(poll, 3000)
        } else {
          const ok = batchResults.value.filter(r => r.success).length
          ElMessage.success(`${ok}成功, ${batchResults.value.length - ok}失败`)
          batchRunning.value = false; batchProgress.value = ''; loadTasks()
        }
      } catch { setTimeout(poll, 5000) }
    }
    setTimeout(poll, 2000)
  } catch (e) { ElMessage.error(e.response?.data?.message || '执行失败'); batchRunning.value = false; batchProgress.value = '' }
}

function openCreate() { createForm.value = { name: '', accountIds: [], taskType: '', scheduleType: 'daily', enabled: true }; createTime.value = '04:00'; createInterval.value = 30; showCreate.value = true }
async function createTask() {
  if (!createForm.value.accountIds.length || !createForm.value.taskType) return ElMessage.warning('请选择账号和任务类型')
  try {
    // 名称为空时自动生成
    const taskLabel = availableTasks.find(t => t.id === createForm.value.taskType)?.label || createForm.value.taskType
    const accNames = accounts.value.filter(a => createForm.value.accountIds.includes(a.id)).map(a => a.name).join(',')
    const body = {
      name: createForm.value.name?.trim() || `${taskLabel}(${accNames})`,
      accountIds: createForm.value.accountIds,
      taskType: createForm.value.taskType,
      scheduleType: createForm.value.scheduleType,
      enabled: createForm.value.enabled,
    }
    if (createForm.value.scheduleType === 'daily') body.executeTime = createTime.value
    else body.intervalMinutes = createInterval.value
    await api.post('/tasks', body)
    ElMessage.success('创建成功'); showCreate.value = false; loadTasks()
  } catch (e) { console.error('创建任务失败:', e) }
}
async function toggleTask(row) { try { await api.post(`/tasks/${row.id}/toggle`); loadTasks() } catch {} }
async function deleteTask(id) { try { await ElMessageBox.confirm('删除该任务？', '提示', { type: 'warning' }); await api.delete(`/tasks/${id}`); ElMessage.success('已删除'); loadTasks() } catch {} }
async function runTask(row) {
  running.value = row.id
  try {
    const r = await api.post(`/tasks/${row.id}/run`)
    // 多账号：返回 batchId，需要轮询
    if (r.success && r.batchId) {
      ElMessage.info(`开始执行 ${r.total} 个账号`)
      const poll = async () => {
        try {
          const st = await api.get(`/tasks/batch-status/${r.batchId}`)
          if (!st.success) return
          if (st.status === 'running') {
            setTimeout(poll, 3000)
          } else {
            const ok = (st.results || []).filter(x => x.success).length
            ElMessage.success(`${ok}/${st.total} 成功`)
            running.value = null
            loadTasks()
          }
        } catch { setTimeout(poll, 5000) }
      }
      setTimeout(poll, 2000)
    } else if (r.success) {
      ElMessage.success('执行完成')
      running.value = null
      loadTasks()
    } else {
      ElMessage.warning(r.message || '未成功')
      running.value = null
    }
  } catch { running.value = null }
}
async function viewLogs(row) { try { const r = await api.get(`/tasks/${row.id}/logs`, { params: { limit: 50 } }); taskLogs.value = r.data || []; showLogs.value = true } catch {} }

onMounted(() => { loadAccounts(); loadTasks(); loadTaskTypes() })
</script>
