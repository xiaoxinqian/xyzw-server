<template>
  <div class="page-container">
    <!-- 统计卡片 -->
    <div class="stat-grid">
      <div v-for="card in statCards" :key="card.label" class="stat-card">
        <el-icon :size="28" :color="card.color"><component :is="card.icon" /></el-icon>
        <div>
          <div style="font-size: 24px; font-weight: 700">{{ card.value }}</div>
          <div style="font-size: 12px; color: #909399">{{ card.label }}</div>
        </div>
      </div>
    </div>

    <!-- Worker 状态 -->
    <el-card style="margin-top: 12px">
      <template #header><span>Worker 状态</span></template>
      <el-table v-if="!isMobile" :data="workers" stripe size="small">
        <el-table-column prop="account_name" label="账号" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }"><el-tag :type="fmtStatus(row.status).type" size="small">{{ fmtStatus(row.status).text }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="currentTask" label="当前任务" />
        <el-table-column label="运行时间" width="80"><template #default="{ row }">{{ fmtDuration(row.uptime) }}</template></el-table-column>
      </el-table>
      <template v-else>
        <div v-for="w in workers" :key="w.accountId" class="mobile-card">
          <div class="mobile-card-row">
            <span class="mobile-card-title">{{ w.account_name }}</span>
            <el-tag :type="fmtStatus(w.status).type" size="small">{{ fmtStatus(w.status).text }}</el-tag>
          </div>
          <div class="mobile-card-meta" v-if="w.currentTask">任务: {{ w.currentTask }}</div>
          <div class="mobile-card-meta">运行: {{ fmtDuration(w.uptime) }}</div>
        </div>
        <el-empty v-if="!workers.length" description="暂无Worker" :image-size="60" />
      </template>
    </el-card>

    <!-- 最近执行 -->
    <el-card style="margin-top: 12px">
      <template #header><span>最近执行</span></template>
      <el-table v-if="!isMobile" :data="recentLogs" stripe size="small">
        <el-table-column prop="account_name" label="账号" width="100" />
        <el-table-column prop="task_type" label="任务" width="80" />
        <el-table-column label="状态" width="60"><template #default="{ row }"><el-tag :type="fmtStatus(row.status).type" size="small">{{ fmtStatus(row.status).text }}</el-tag></template></el-table-column>
        <el-table-column label="手动" width="40"><template #default="{ row }">{{ row.manual ? '是' : '否' }}</template></el-table-column>
        <el-table-column label="耗时" width="60"><template #default="{ row }">{{ fmtDuration(row.duration_ms) }}</template></el-table-column>
        <el-table-column label="时间" width="140"><template #default="{ row }">{{ fmtTime(row.created_at) }}</template></el-table-column>
      </el-table>
      <template v-else>
        <div v-for="l in recentLogs" :key="l.id" class="mobile-card">
          <div class="mobile-card-row">
            <span class="mobile-card-title">{{ l.account_name }}</span>
            <el-tag :type="fmtStatus(l.status).type" size="small">{{ fmtStatus(l.status).text }}</el-tag>
          </div>
          <div class="mobile-card-meta">{{ l.task_type }} · {{ fmtDuration(l.duration_ms) }} · {{ fmtTime(l.created_at) }}</div>
        </div>
        <el-empty v-if="!recentLogs.length" description="暂无记录" :image-size="60" />
      </template>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import api from '../utils/api'
import { fmtTime, fmtDuration, fmtStatus } from '../utils/format'
import { useBreakpoint } from '../utils/useBreakpoint'

const { isMobile } = useBreakpoint()
const workers = ref([])
const recentLogs = ref([])
const statCards = ref([])
let timer = null

async function loadData() {
  try {
    const [wRes, lRes] = await Promise.all([api.get('/workers'), api.get('/logs/task-logs', { params: { limit: 10 } })])
    workers.value = wRes.data || []
    recentLogs.value = lRes.data || []
    statCards.value = [
      { label: '总账号', value: workers.value.length, icon: 'User', color: '#409eff' },
      { label: '在线', value: workers.value.filter(w => w.status === 'connected').length, icon: 'Connection', color: '#67c23a' },
      { label: '执行中', value: workers.value.filter(w => w.currentTask).length, icon: 'Loading', color: '#e6a23c' },
      { label: '今日失败', value: recentLogs.value.filter(l => l.status === 'failed').length, icon: 'WarningFilled', color: '#f56c6c' },
    ]
  } catch {}
}

onMounted(() => { loadData(); timer = setInterval(loadData, 15000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.stat-card {
  display: flex; align-items: center; gap: 12px;
  background: #fff; border-radius: 12px; padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
}
@media (max-width: 767px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .stat-card { padding: 12px; border-radius: 10px; }
  .stat-card :deep(.el-icon) { font-size: 22px; }
}
</style>
