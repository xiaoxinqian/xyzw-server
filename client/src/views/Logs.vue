<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>执行日志</span>
          <div style="display: flex; gap: 4px">
            <el-select v-model="filter.status" placeholder="状态" clearable size="small" style="width: 100px" @change="loadLogs">
              <el-option label="成功" value="success" />
              <el-option label="失败" value="failed" />
              <el-option label="跳过" value="skipped" />
            </el-select>
            <el-button size="small" link @click="loadLogs">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table v-if="!isMobile" :data="logs" stripe size="small">
        <el-table-column prop="account_name" label="账号" width="100" />
        <el-table-column prop="task_type" label="任务" width="70" />
        <el-table-column label="状态" width="60"><template #default="{ row }"><el-tag :type="fmtStatus(row.status).type" size="small">{{ fmtStatus(row.status).text }}</el-tag></template></el-table-column>
        <el-table-column label="手动" width="40"><template #default="{ row }">{{ row.manual ? '是' : '否' }}</template></el-table-column>
        <el-table-column label="耗时" width="60"><template #default="{ row }">{{ fmtDuration(row.duration_ms) }}</template></el-table-column>
        <el-table-column label="错误" min-width="160" show-overflow-tooltip><template #default="{ row }">{{ row.error || row.result || '-' }}</template></el-table-column>
        <el-table-column label="时间" width="140"><template #default="{ row }">{{ fmtTime(row.created_at) }}</template></el-table-column>
      </el-table>

      <template v-else>
        <div v-for="l in logs" :key="l.id" class="mobile-card">
          <div class="mobile-card-row">
            <span class="mobile-card-title">{{ l.account_name }}</span>
            <el-tag :type="fmtStatus(l.status).type" size="small">{{ fmtStatus(l.status).text }}</el-tag>
          </div>
          <div class="mobile-card-meta">{{ l.task_type }} · {{ fmtDuration(l.duration_ms) }} · {{ l.manual ? '手动' : '自动' }}</div>
          <div class="mobile-card-meta" v-if="l.error || l.result" style="color: #f56c6c">{{ l.error || l.result }}</div>
          <div class="mobile-card-meta">{{ fmtTime(l.created_at) }}</div>
        </div>
        <el-empty v-if="!logs.length" description="暂无日志" :image-size="60" />
      </template>

      <div style="display: flex; justify-content: center; margin-top: 12px">
        <el-pagination v-model:current-page="page" :total="total" layout="prev, pager, next" small @current-change="loadLogs" />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../utils/api'
import { fmtTime, fmtDuration, fmtStatus } from '../utils/format'
import { useBreakpoint } from '../utils/useBreakpoint'

const { isMobile } = useBreakpoint()
const logs = ref([])
const filter = ref({ status: '' })
const page = ref(1)
const total = ref(0)

async function loadLogs() {
  const params = { page: page.value, limit: 20 }
  if (filter.value.status) params.status = filter.value.status
  const r = await api.get('/logs/task-logs', { params })
  logs.value = r.data || []
  total.value = r.total || 0
}
onMounted(loadLogs)
</script>
