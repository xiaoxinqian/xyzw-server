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
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="success" :loading="running === row.id" @click="runTask(row)">执行</el-button>
            <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
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
            <el-button size="small" type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" @click="toggleTask(row)">{{ row.enabled ? '禁用' : '启用' }}</el-button>
            <el-button size="small" @click="viewLogs(row)">日志</el-button>
            <el-button size="small" type="danger" @click="deleteTask(row.id)">删除</el-button>
          </div>
        </div>
        <el-empty v-if="!tasks.length" description="暂无定时任务" :image-size="60" />
      </template>
    </el-card>

    <!-- 创建/编辑任务 -->
    <el-dialog v-model="showDialog" :title="editingId ? '编辑任务' : '创建定时任务'" width="92%" style="max-width: 520px">
      <el-form :model="formData" label-width="70px" size="small">
        <el-form-item label="名称"><el-input v-model="formData.name" placeholder="留空自动生成" /></el-form-item>
        <el-form-item label="账号">
          <el-select v-model="formData.accountIds" filterable multiple collapse-tags collapse-tags-tooltip placeholder="选择账号（可多选）" style="width: 100%">
            <el-option v-for="a in accounts" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="formData.taskType" filterable placeholder="选择任务类型" style="width: 100%" @change="onTaskTypeChange">
            <el-option-group v-for="g in groupedTasks" :key="g.label" :label="g.label">
              <el-option v-for="t in g.options" :key="t.id" :label="t.name" :value="t.id">
                <span>{{ t.name }}</span><span style="font-size: 11px; color: #909399; margin-left: 6px">{{ t.description }}</span>
              </el-option>
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="调度">
          <el-radio-group v-model="formData.scheduleType">
            <el-radio-button label="daily">每日定时</el-radio-button>
            <el-radio-button label="interval">间隔循环</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="formData.scheduleType === 'daily'" label="时间">
          <el-time-picker v-model="formData.executeTime" format="HH:mm" value-format="HH:mm" placeholder="04:00" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="formData.scheduleType === 'interval'" label="间隔">
          <el-input-number v-model="formData.intervalMinutes" :min="1" :max="1440" /> <span style="margin-left: 6px; color: #909399; font-size: 12px">分钟</span>
        </el-form-item>

        <!-- 动态配置区 -->
        <template v-if="configFields.length">
          <el-divider content-position="left">任务配置</el-divider>
          <template v-for="field in configFields" :key="field.key">
            <!-- 黑市购买 -->
            <el-form-item v-if="field.type === 'blackMarket'" :label="field.label">
              <div style="width: 100%">
                <el-radio-group v-model="formData.config.blackMarketMode" style="margin-bottom: 8px">
                  <el-radio-button label="all">一键全买</el-radio-button>
                  <el-radio-button label="custom">自选商品</el-radio-button>
                </el-radio-group>
                <div v-if="formData.config.blackMarketMode === 'custom'">
                  <div style="margin-bottom: 6px">
                    <el-button size="small" @click="selectAllBlackMarket">全选</el-button>
                    <el-button size="small" @click="clearBlackMarket">清空</el-button>
                  </div>
                  <el-checkbox-group v-model="formData.config.blackMarketSelected" style="display: flex; flex-wrap: wrap; gap: 4px">
                    <el-checkbox v-for="item in blackMarketItems" :key="item.id" :label="item.id">
                      {{ item.name }}
                    </el-checkbox>
                  </el-checkbox-group>
                  <div style="font-size: 11px; color: #909399; margin-top: 4px">选择需要购买的商品，留空或选择"一键全买"则发空请求全买</div>
                </div>
              </div>
            </el-form-item>

            <!-- 梦境商品 -->
            <el-form-item v-if="field.type === 'dreamItems'" :label="field.label">
              <div style="width: 100%">
                <div style="display: flex; gap: 8px; margin-bottom: 8px">
                  <el-button size="small" type="warning" @click="selectGoldItems">勾选金币商品</el-button>
                  <el-button size="small" @click="selectAllDreamItems">全选</el-button>
                  <el-button size="small" @click="clearDreamItems">清空</el-button>
                </div>
                <div v-for="m in dreamMerchants" :key="m.id" style="margin-bottom: 10px">
                  <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px">{{ m.name }}</div>
                  <el-checkbox-group v-model="formData.config.dreamList" style="display: flex; flex-wrap: wrap; gap: 4px">
                    <el-checkbox v-for="(item, idx) in m.items" :key="`${m.id}-${idx}`" :label="`${m.id}-${idx}`">
                      {{ item }}
                    </el-checkbox>
                  </el-checkbox-group>
                </div>
                <div style="font-size: 11px; color: #909399">格式: 商人ID-商品索引，如 1-5 表示初级商人第6个商品</div>
              </div>
            </el-form-item>

            <!-- 下拉选择 -->
            <el-form-item v-if="field.type === 'select'" :label="field.label">
              <el-select v-model="formData.config[field.key]" style="width: 100%">
                <el-option v-for="opt in field.options" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>

            <!-- 数字输入 -->
            <el-form-item v-if="field.type === 'number'" :label="field.label">
              <el-input-number v-model="formData.config[field.key]" :min="field.min || 1" />
            </el-form-item>

            <!-- 文本输入 -->
            <el-form-item v-if="field.type === 'text'" :label="field.label">
              <el-input v-model="formData.config[field.key]" :placeholder="field.placeholder || ''" />
            </el-form-item>
          </template>
        </template>

        <el-form-item label="启用"><el-switch v-model="formData.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="saveTask">{{ editingId ? '保存' : '创建' }}</el-button>
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
const showDialog = ref(false)
const showLogs = ref(false)
const running = ref(null)
const taskLogs = ref([])
const editingId = ref(null)

// 黑市物品列表（来源：原项目 ClubCarKing.vue / CarTaskCard.vue itemMapping）
const blackMarketItems = [
  { id: 1001, name: '招募令' }, { id: 1003, name: '进阶石' },
  { id: 1006, name: '精铁' }, { id: 1007, name: '竞技场门票' },
  { id: 1008, name: '木柴火把' }, { id: 1009, name: '青铜火把' },
  { id: 1010, name: '咸神火把' }, { id: 1011, name: '普通鱼竿' },
  { id: 1012, name: '黄金鱼竿' }, { id: 1013, name: '珍珠' },
  { id: 1014, name: '军团币' }, { id: 1016, name: '晶石' },
  { id: 1017, name: '复活丹' }, { id: 1019, name: '盐靛' },
  { id: 1020, name: '皮肤币' }, { id: 1021, name: '扫荡魔毯' },
  { id: 1022, name: '白玉' }, { id: 1023, name: '彩玉' },
  { id: 1026, name: '扳手' }, { id: 1033, name: '贝壳' },
  { id: 1035, name: '金盐靛' }, { id: 10002, name: '蓝玉' },
  { id: 10003, name: '红玉' }, { id: 10101, name: '四圣碎片' },
  { id: 2001, name: '木制宝箱' }, { id: 2002, name: '青铜宝箱' },
  { id: 2003, name: '黄金宝箱' }, { id: 2004, name: '铂金宝箱' },
  { id: 2005, name: '钻石宝箱' }, { id: 2101, name: '助威币' },
  { id: 3001, name: '金币袋子' }, { id: 3002, name: '金砖袋子' },
  { id: 3005, name: '紫色随机碎片' }, { id: 3006, name: '橙色随机碎片' },
  { id: 3007, name: '红色随机碎片' }, { id: 3008, name: '精铁袋子' },
  { id: 3009, name: '进阶袋子' }, { id: 3010, name: '梦魇袋子' },
  { id: 3011, name: '白玉袋子' }, { id: 3012, name: '扳手袋子' },
  { id: 3020, name: '聚宝盆' }, { id: 3021, name: '豪华聚宝盆' },
  { id: 3201, name: '红色万能碎片' }, { id: 3302, name: '橙色万能碎片' },
  { id: 35002, name: '刷新券' }, { id: 35009, name: '零件' },
]

// 梦境商人配置（前端静态）
const dreamMerchants = [
  { id: 1, name: '初级商人', items: ['进阶石', '精铁', '木质宝箱', '青铜宝箱', '普通鱼竿', '咸神门票', '咸神火把'] },
  { id: 2, name: '中级商人', items: ['梦魇晶石', '进阶石', '精铁', '黄金宝箱', '黄金鱼竿', '招募令', '橙将碎片', '紫将碎片'] },
  { id: 3, name: '高级商人', items: ['梦魇晶石', '铂金宝箱', '黄金鱼竿', '招募令', '红将碎片', '橙将碎片', '红将碎片', '普通鱼竿'] },
]
const goldItemKeys = ['1-5', '1-6', '2-6', '2-7', '3-5', '3-6', '3-7']

const formData = ref({
  name: '',
  accountIds: [],
  taskType: '',
  scheduleType: 'daily',
  executeTime: '04:00',
  intervalMinutes: 30,
  enabled: true,
  config: {
    blackMarketMode: 'all',
    blackMarketSelected: [],
    purchaseListStr: '',
    dreamList: [],
  },
})

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
function catLabel(c) { return { daily:'日常', hangup:'挂机', bottle:'罐子', tower:'塔', arena:'竞技场', item:'资源', dungeon:'副本', car:'车辆', store:'商店', legacy:'功法残卷' }[c] || '其他' }
function taskLabel(t) { return taskTypes.value.find(x => x.id === t)?.name || t }

// 获取当前任务类型的配置字段
const configFields = computed(() => {
  const t = taskTypes.value.find(x => x.id === formData.value.taskType)
  return t?.configFields || []
})

function onTaskTypeChange() {
  // 切换任务类型时重置 config
  const cfg = {
    blackMarketMode: 'all',
    blackMarketSelected: [],
    purchaseListStr: '',
    dreamList: [],
  }
  // 从 configFields 提取默认值
  const t = taskTypes.value.find(x => x.id === formData.value.taskType)
  if (t?.configFields) {
    for (const f of t.configFields) {
      if (f.default != null) cfg[f.key] = f.default
    }
  }
  formData.value.config = cfg
}

function selectAllBlackMarket() {
  formData.value.config.blackMarketSelected = blackMarketItems.map(i => i.id)
}
function clearBlackMarket() {
  formData.value.config.blackMarketSelected = []
}
function selectGoldItems() {
  formData.value.config.dreamList = [...goldItemKeys]
}
function selectAllDreamItems() {
  const all = []
  for (const m of dreamMerchants) {
    m.items.forEach((_, idx) => all.push(`${m.id}-${idx}`))
  }
  formData.value.config.dreamList = all
}
function clearDreamItems() {
  formData.value.config.dreamList = []
}

async function loadAccounts() { loadingAccs.value = true; try { const r = await api.get('/accounts'); accounts.value = r.data || [] } catch (e) { console.error('loadAccounts:', e) } finally { loadingAccs.value = false } }
async function loadTasks() { try { const r = await api.get('/tasks'); tasks.value = r.data || [] } catch (e) { console.error('loadTasks:', e) } }
async function loadTaskTypes() { try { const r = await api.get('/tasks/types'); taskTypes.value = r.data || [] } catch (e) { console.error('loadTaskTypes:', e) } }

async function batchRun() {
  if (!selectedAccs.value.length) return ElMessage.warning('请选择账号')
  if (!selTaskType.value) return ElMessage.warning('请选择任务类型')
  batchRunning.value = true; batchResults.value = []; batchProgress.value = `0/${selectedAccs.value.length}`
  try {
    const startRes = await api.post('/tasks/batch-run', { accountIds: selectedAccs.value, taskType: selTaskType.value })
    if (!startRes.success || !startRes.batchId) { ElMessage.error(startRes.message || '启动失败'); return }
    const batchId = startRes.batchId
    let pollCount = 0
    const MAX_POLL = 100 // 100 * 3s = 5分钟
    const poll = async () => {
      if (++pollCount > MAX_POLL) {
        ElMessage.error('执行超时，请刷新查看结果')
        batchRunning.value = false; batchProgress.value = ''
        return
      }
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
      } catch (e) { console.error('poll:', e); setTimeout(poll, 5000) }
    }
    setTimeout(poll, 2000)
  } catch (e) { ElMessage.error(e.response?.data?.message || '执行失败'); batchRunning.value = false; batchProgress.value = '' }
}

function openCreate() {
  editingId.value = null
  formData.value = {
    name: '', accountIds: [], taskType: '', scheduleType: 'daily',
    executeTime: '04:00', intervalMinutes: 30, enabled: true,
    config: { blackMarketMode: 'all', blackMarketSelected: [], purchaseListStr: '', dreamList: [] },
  }
  showDialog.value = true
}

function openEdit(row) {
  editingId.value = row.id
  formData.value = {
    name: row.name,
    accountIds: row.account_ids || [],
    taskType: row.task_type,
    scheduleType: row.schedule_type || 'daily',
    executeTime: row.execute_time || '04:00',
    intervalMinutes: row.interval_minutes || 30,
    enabled: !!row.enabled,
    config: {
      blackMarketMode: 'all',
      blackMarketSelected: [],
      purchaseListStr: '',
      dreamList: [],
      ...row.config,
    },
  }
  // 从 config.purchaseList 恢复黑市状态
  if (row.config?.purchaseList?.length && row.task_type === 'store_purchase') {
    formData.value.config.blackMarketMode = 'custom'
    formData.value.config.blackMarketSelected = [...row.config.purchaseList]
  }
  // 从 config.purchaseList 恢复梦境列表
  if (row.config?.purchaseList?.length && row.task_type === 'batchBuyDreamItems') {
    formData.value.config.dreamList = [...row.config.purchaseList]
  }
  showDialog.value = true
}

async function saveTask() {
  if (!formData.value.accountIds.length || !formData.value.taskType) return ElMessage.warning('请选择账号和任务类型')

  // 构建 config
  const config = {}
  const taskType = formData.value.taskType
  if (taskType === 'store_purchase') {
    if (formData.value.config.blackMarketMode === 'custom' && formData.value.config.blackMarketSelected?.length) {
      config.purchaseList = [...formData.value.config.blackMarketSelected]
    } else {
      config.purchaseList = []
    }
  } else if (taskType === 'batchBuyDreamItems') {
    config.purchaseList = [...formData.value.config.dreamList]
  } else {
    // 其他类型：从 configFields 提取
    for (const f of configFields.value) {
      if (f.type === 'select' || f.type === 'number' || f.type === 'text') {
        if (formData.value.config[f.key] != null) config[f.key] = formData.value.config[f.key]
      }
    }
  }

  const taskLabelStr = taskTypes.value.find(t => t.id === taskType)?.name || taskType
  const body = {
    name: formData.value.name?.trim() || taskLabelStr,
    accountIds: formData.value.accountIds,
    taskType,
    scheduleType: formData.value.scheduleType,
    enabled: formData.value.enabled,
    config,
  }
  if (formData.value.scheduleType === 'daily') body.executeTime = formData.value.executeTime
  else body.intervalMinutes = formData.value.intervalMinutes

  try {
    if (editingId.value) {
      await api.put(`/tasks/${editingId.value}`, body)
      ElMessage.success('保存成功')
    } else {
      await api.post('/tasks', body)
      ElMessage.success('创建成功')
    }
    showDialog.value = false
    loadTasks()
  } catch (e) {
    console.error('saveTask:', e)
    ElMessage.error(e.response?.data?.message || '操作失败')
  }
}

async function toggleTask(row) { try { await api.post(`/tasks/${row.id}/toggle`); loadTasks() } catch (e) { console.error(e) } }
async function deleteTask(id) { try { await ElMessageBox.confirm('删除该任务？', '提示', { type: 'warning' }); await api.delete(`/tasks/${id}`); ElMessage.success('已删除'); loadTasks() } catch (e) {} }
async function runTask(row) {
  running.value = row.id
  try {
    const r = await api.post(`/tasks/${row.id}/run`)
    if (r.success && r.batchId) {
      ElMessage.info(`开始执行 ${r.total} 个账号`)
      let pollCount = 0
      const MAX_POLL = 100
      const poll = async () => {
        if (++pollCount > MAX_POLL) {
          ElMessage.error('执行超时，请刷新查看结果')
          running.value = null
          return
        }
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
        } catch (e) { console.error('poll:', e); setTimeout(poll, 5000) }
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
  } catch (e) { console.error(e); running.value = null }
}
async function viewLogs(row) { try { const r = await api.get(`/tasks/${row.id}/logs`, { params: { limit: 50 } }); taskLogs.value = r.data || []; showLogs.value = true } catch (e) { console.error(e) } }

onMounted(() => { loadAccounts(); loadTasks(); loadTaskTypes() })
</script>
