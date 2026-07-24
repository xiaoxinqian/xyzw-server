<template>
  <div class="page-container">
    <el-card>
      <template #header><span>系统设置</span></template>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="基本设置" name="general">
          <el-form label-width="120px" size="small" style="max-width: 500px">
            <el-form-item label="默认执行时间">
              <el-time-picker v-model="defaultTime" format="HH:mm" value-format="HH:mm" />
            </el-form-item>
            <el-form-item label="免登录时段">
              <el-input :value="noLoginPeriod" disabled />
              <div style="color: #909399; font-size: 12px; margin-top: 4px">周六 20:00~21:00 / 周日 08:00~08:30（上海时间）</div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveSettings">保存</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="调度器状态" name="scheduler">
          <div v-if="schedulerStatus">
            <el-descriptions :column="isMobile ? 1 : 2" border size="small">
              <el-descriptions-item label="已调度任务数">{{ schedulerStatus.scheduledCount }}</el-descriptions-item>
            </el-descriptions>

            <el-table :data="schedulerStatus.tasks" stripe size="small" style="margin-top: 12px">
              <el-table-column prop="name" label="任务名" min-width="80" />
              <el-table-column prop="account_name" label="账号" width="80" />
              <el-table-column prop="task_type" label="类型" width="70" />
              <el-table-column label="启用" width="50"><template #default="{ row }">{{ row.enabled ? '是' : '否' }}</template></el-table-column>
              <el-table-column prop="execute_time" label="时间" width="60" />
              <el-table-column label="上次" width="130" v-if="!isMobile"><template #default="{ row }">{{ fmtTime(row.last_execute) }}</template></el-table-column>
              <el-table-column label="下次" width="130" v-if="!isMobile"><template #default="{ row }">{{ fmtTime(row.next_execute) }}</template></el-table-column>
              <el-table-column label="调度中" width="60">
                <template #default="{ row }"><el-tag :type="row.active ? 'success' : 'info'" size="small">{{ row.active ? '是' : '否' }}</el-tag></template>
              </el-table-column>
            </el-table>
          </div>
          <el-empty v-else description="无权限或未加载" :image-size="60" />
        </el-tab-pane>

        <el-tab-pane label="系统信息" name="system">
          <el-descriptions :column="isMobile ? 1 : 2" border size="small">
            <el-descriptions-item label="版本">1.0.0</el-descriptions-item>
            <el-descriptions-item label="Node.js">{{ serverInfo.node }}</el-descriptions-item>
            <el-descriptions-item label="服务器时间">{{ fmtTime(serverInfo.time) }}</el-descriptions-item>
            <el-descriptions-item label="数据库">{{ serverInfo.dbSize }}</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../utils/api'
import { fmtTime } from '../utils/format'
import { useBreakpoint } from '../utils/useBreakpoint'

const { isMobile } = useBreakpoint()
const activeTab = ref('general')
const defaultTime = ref('04:00')
const noLoginPeriod = ref('周六 20:00~21:00 / 周日 08:00~08:30')
const schedulerStatus = ref(null)
const serverInfo = ref({ node: '-', time: new Date().toISOString(), dbSize: '-' })

async function loadSchedulerStatus() { try { const r = await api.get('/tasks/scheduler/status'); schedulerStatus.value = r.data } catch {} }
async function loadServerInfo() { try { const r = await api.get('/health'); serverInfo.value = { node: '-', time: r.time, dbSize: '-' } } catch {} }
function saveSettings() { ElMessage.success('已保存') }

onMounted(() => { loadSchedulerStatus(); loadServerInfo() })
</script>
