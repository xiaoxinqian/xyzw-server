<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>游戏账号</span>
          <div style="display: flex; gap: 6px">
            <el-button size="small" link @click="loadAccounts" :loading="loading">刷新</el-button>
            <el-button type="primary" size="small" @click="showImport = true">导入</el-button>
          </div>
        </div>
      </template>

      <!-- 批量操作条 -->
      <div v-if="selectedIds.length" class="batch-bar">
        <span>已选 {{ selectedIds.length }}</span>
        <el-button size="small" type="danger" @click="batchDelete">删除</el-button>
        <el-button size="small" @click="batchRefreshToken">刷新Token</el-button>
        <el-button size="small" text @click="clearSel">取消</el-button>
      </div>

      <!-- PC 表格 -->
      <el-table v-if="!isMobile" ref="tableRef" :data="accounts" stripe @selection-change="onSelChange" style="width: 100%">
        <el-table-column type="selection" width="42" />
        <el-table-column prop="name" label="账号名" min-width="110" />
        <el-table-column label="区服" width="70"><template #default="{ row }">{{ row.server_id || '-' }}</template></el-table-column>
        <el-table-column label="角色" width="80"><template #default="{ row }">{{ row.role_name || row.role_id || '-' }}</template></el-table-column>
        <el-table-column label="来源" width="60"><template #default="{ row }"><el-tag size="small" :type="row.import_method === 'wxQrcode' ? 'success' : ''">{{ row.import_method === 'wxQrcode' ? '扫码' : 'Bin' }}</el-tag></template></el-table-column>
        <el-table-column label="状态" width="60"><template #default="{ row }"><el-tag :type="fmtStatus(row.status).type" size="small">{{ fmtStatus(row.status).text }}</el-tag></template></el-table-column>
        <el-table-column label="Token" width="60"><template #default="{ row }"><el-tag :type="row.token_status === 'active' ? 'success' : 'danger'" size="small">{{ row.token_status === 'active' ? '正常' : '异常' }}</el-tag></template></el-table-column>
        <el-table-column label="最后活跃" width="145"><template #default="{ row }">{{ fmtTime(row.last_active) }}</template></el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="openTaskBinding(row)">任务</el-button>
            <el-button size="small" link @click="refreshToken(row.id)">刷新Token</el-button>
            <el-button size="small" link @click="editAccount(row)">编辑</el-button>
            <el-button size="small" link type="danger" @click="deleteAccount(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 手机卡片 -->
      <template v-else>
        <div v-for="row in accounts" :key="row.id" class="mobile-card">
          <div class="mobile-card-row">
            <el-checkbox :model-value="selectedIds.includes(row.id)" @change="toggleRow(row.id)" style="margin-right: 4px" />
            <span class="mobile-card-title">{{ row.name }}</span>
            <el-tag :type="row.token_status === 'active' ? 'success' : 'danger'" size="small">{{ row.token_status === 'active' ? '正常' : '异常' }}</el-tag>
          </div>
          <div class="mobile-card-meta">
            {{ row.server_id || '-' }} · {{ row.role_name || row.role_id || '-' }} · {{ row.import_method === 'wxQrcode' ? '扫码' : 'Bin' }}
          </div>
          <div class="mobile-card-actions">
            <el-button size="small" @click="openTaskBinding(row)">任务</el-button>
            <el-button size="small" @click="refreshToken(row.id)">刷新Token</el-button>
            <el-button size="small" @click="editAccount(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteAccount(row.id)">删除</el-button>
          </div>
        </div>
        <el-empty v-if="!accounts.length" description="暂无账号，点击右上角导入" :image-size="60" />
      </template>
    </el-card>

    <!-- 导入 -->
    <el-dialog v-model="showImport" title="导入账号" width="92%" style="max-width: 480px" @close="resetImport">
      <el-tabs v-model="importTab">
        <el-tab-pane label="Bin文件" name="bin">
          <el-form label-width="60px" size="small">
            <el-form-item label="名称"><el-input v-model="binForm.name" placeholder="选填，留空自动用 区服_角色名" /></el-form-item>
            <el-form-item label="文件">
              <el-upload :auto-upload="false" :limit="1" accept=".bin,.dmp" :on-change="onFileChange" :on-remove="() => { binForm.file = null; binForm.roles = []; binForm.selectedRoles = [] }" drag style="width: 100%">
                <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
                <div class="el-upload__text">点击或拖拽 bin 文件</div>
              </el-upload>
            </el-form-item>

            <div v-if="previewing" style="display: flex; align-items: center; gap: 6px; color: #909399; padding: 6px 0">
              <el-icon class="is-loading"><Loading /></el-icon> 获取角色列表中...
            </div>

            <div v-if="binForm.roles.length" style="margin: 8px 0; padding: 8px; border: 1px solid #ebeef5; border-radius: 8px">
              <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; display: flex; justify-content: space-between">
                <span>发现 {{ binForm.roles.length }} 个角色</span>
                <span>
                  <el-button text size="small" @click="binForm.selectedRoles = binForm.roles.map(r => r.roleId)">全选</el-button>
                  <el-button text size="small" @click="binForm.selectedRoles = []">清空</el-button>
                </span>
              </div>
              <el-checkbox-group v-model="binForm.selectedRoles">
                <div v-for="role in binForm.roles" :key="role.roleId" style="padding: 4px 0; border-bottom: 1px solid #f5f5f5">
                  <el-checkbox :label="role.roleId">
                    <span style="font-size: 13px">{{ role.name }}</span>
                    <span style="font-size: 11px; color: #909399; margin-left: 6px">区服{{ role.serverId }} · 战力{{ role.power }}</span>
                  </el-checkbox>
                </div>
              </el-checkbox-group>
            </div>

            <el-form-item style="margin-top: 10px">
              <el-button type="primary" :loading="importing" :disabled="binForm.roles.length > 0 && binForm.selectedRoles.length === 0" @click="doImportBin" style="width: 100%">导入</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="微信扫码" name="wx">
          <div v-if="!wxQrcode" class="qr-placeholder" @click="getWxQrcode">
            <el-icon size="36" color="#c0c4cc"><Iphone /></el-icon>
            <p style="font-size: 13px; margin-top: 6px">点击获取微信二维码</p>
          </div>
          <div v-else style="text-align: center">
            <img :src="wxQrcode" alt="二维码" style="width: 180px; height: 180px" />
          </div>
          <div :class="['qr-status', wxStatusType]" style="text-align: center; padding: 6px; margin: 6px 0; border-radius: 4px; font-size: 13px">{{ wxStatusMsg }}</div>

          <div v-if="wxRoles.length" style="margin-top: 8px">
            <div v-for="role in wxRoles" :key="role.roleId" class="mobile-card" style="margin-bottom: 6px">
              <div class="mobile-card-row">
                <div>
                  <div style="font-weight: 600; font-size: 13px">{{ role.name }}</div>
                  <div style="font-size: 11px; color: #909399">区服 {{ role.serverId }} · 战力 {{ role.power }}</div>
                </div>
                <el-button size="small" type="success" :loading="role._loading" @click="importRole(role)">导入</el-button>
              </div>
            </div>
          </div>

          <el-button v-if="wxQrcode" text size="small" @click="getWxQrcode" :loading="wxLoading" style="margin-top: 6px">刷新二维码</el-button>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <!-- 编辑 -->
    <el-dialog v-model="showEdit" title="编辑账号" width="90%" style="max-width: 340px">
      <el-form :model="editForm" label-width="56px" size="small">
        <el-form-item label="名称"><el-input v-model="editForm.name" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEdit = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 任务绑定 -->
    <el-dialog v-model="showTaskBinding" :title="`任务绑定 - ${taskBindAccount.name || ''}`" width="92%" style="max-width: 520px" @close="taskBindingDirty = false">
      <div v-if="taskBindingLoading" style="text-align: center; padding: 20px">
        <el-icon class="is-loading"><Loading /></el-icon> 加载中...
      </div>
      <template v-else>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
          <span style="font-size: 13px; color: #606266">已选 {{ taskBindSelected.length }} / {{ taskBindList.length }} 个任务</span>
          <div>
            <el-button text size="small" @click="taskBindSelected = taskBindList.map(t => t.id)">全选</el-button>
            <el-button text size="small" @click="taskBindSelected = []">清空</el-button>
          </div>
        </div>
        <el-checkbox-group v-model="taskBindSelected" style="max-height: 50vh; overflow-y: auto">
          <div v-for="t in taskBindList" :key="t.id" style="padding: 6px 0; border-bottom: 1px solid #f5f5f5; display: flex; align-items: center">
            <el-checkbox :label="t.id" :value="t.id">
              <span style="font-size: 13px">{{ t.name }}</span>
              <el-tag size="small" :type="t.enabled ? 'success' : 'info'" style="margin-left: 6px">{{ t.enabled ? '启用' : '禁用' }}</el-tag>
              <span style="font-size: 11px; color: #909399; margin-left: 6px">{{ t.schedule_type === 'interval' ? `每${t.interval_minutes || ''}分钟` : t.execute_time || '' }}</span>
            </el-checkbox>
          </div>
        </el-checkbox-group>
      </template>
      <template #footer>
        <el-button @click="showTaskBinding = false">取消</el-button>
        <el-button type="primary" :loading="taskBindingSaving" @click="saveTaskBinding">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled, Iphone, Loading } from '@element-plus/icons-vue'
import api from '../utils/api'
import { fmtTime, fmtStatus } from '../utils/format'
import { useBreakpoint } from '../utils/useBreakpoint'

const { isMobile } = useBreakpoint()
const accounts = ref([])
const loading = ref(false)
const tableRef = ref()
const selectedIds = ref([])
const showImport = ref(false)
const showEdit = ref(false)
const importing = ref(false)
const importTab = ref('bin')
const editForm = ref({ id: '', name: '' })
const binForm = ref({ name: '', file: null, roles: [], selectedRoles: [] })
const previewing = ref(false)
const wxQrcode = ref('')
const wxUuid = ref('')
const wxStatusMsg = ref('点击获取微信二维码')
const wxStatusType = ref('info')
const wxLoading = ref(false)
const wxRoles = ref([])
const wxTempId = ref('')
let wxPollTimer = null

// 任务绑定
const showTaskBinding = ref(false)
const taskBindingLoading = ref(false)
const taskBindingSaving = ref(false)
const taskBindAccount = ref({})
const taskBindList = ref([])
const taskBindSelected = ref([])

function onSelChange(rows) { selectedIds.value = rows.map(r => r.id) }
function clearSel() { tableRef.value?.clearSelection(); selectedIds.value = [] }
function toggleRow(id) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

async function loadAccounts() {
  loading.value = true
  try { const r = await api.get('/accounts'); accounts.value = r.data || [] }
  catch (e) { console.error('loadAccounts', e) }
  finally { loading.value = false }
}

async function onFileChange(file) { binForm.value.file = file.raw; await previewRoles() }
async function previewRoles() {
  if (!binForm.value.file) return
  previewing.value = true; binForm.value.roles = []; binForm.value.selectedRoles = []
  try {
    const fd = new FormData(); fd.append('binFile', binForm.value.file)
    const r = await api.post('/accounts/preview-bin-roles', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    if (r.success) { binForm.value.roles = r.data || []; binForm.value.selectedRoles = [] }
  } catch (e) { console.error('previewRoles', e) }
  previewing.value = false
}

async function doImportBin() {
  if (!binForm.value.file) return ElMessage.warning('请上传 bin 文件')
  importing.value = true
  try {
    const fd = new FormData()
    fd.append('name', binForm.value.name); fd.append('binFile', binForm.value.file)
    if (binForm.value.selectedRoles.length) fd.append('selectedRoles', JSON.stringify(binForm.value.selectedRoles))
    const r = await api.post('/accounts/import-bin-file', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    if (r.success) { ElMessage.success(r.count > 1 ? `导入 ${r.count} 个账号` : '导入成功'); showImport.value = false; loadAccounts() }
    else ElMessage.error(r.message || '导入失败')
  } catch (e) { ElMessage.error(e.response?.data?.message || '导入失败') }
  importing.value = false
}

async function getWxQrcode() {
  wxLoading.value = true
  try {
    const url = 'https://open.weixin.qq.com/connect/app/qrconnect?appid=wxfb0d5667e5cb1c44&bundleid=com.hortor.games.xyzw&scope=snsapi_base,snsapi_userinfo,snsapi_friend,snsapi_message&state=weixin'
    const resp = await fetch(url, { headers: { Accept: 'text/html' } })
    const html = await resp.text()
    let qrUrl = null
    const m1 = html.match(/<img[^>]*class="auth_qrcode"[^>]*src="([^"]+)"/i)
    if (m1) qrUrl = m1[1]
    else { const m2 = html.match(/https:\/\/[^"']*qrcode[^"']*/i); if (m2) qrUrl = m2[0] }
    if (!qrUrl) { wxStatusMsg.value = '获取失败，请用Bin导入'; wxStatusType.value = 'error'; return }
    wxQrcode.value = qrUrl; wxUuid.value = qrUrl.split('/').pop().split('?')[0]
    wxStatusMsg.value = '请微信扫码'; wxStatusType.value = 'success'; startPolling()
  } catch { wxStatusMsg.value = '获取失败'; wxStatusType.value = 'error' }
  wxLoading.value = false
}

function startPolling() {
  if (wxPollTimer) clearInterval(wxPollTimer)
  const start = Date.now()
  wxPollTimer = setInterval(async () => {
    if (Date.now() - start > 120000) { wxStatusMsg.value = '二维码过期'; wxStatusType.value = 'error'; stopPolling(); return }
    try {
      const url = 'https://open.weixin.qq.com/connect/l/qrconnect?uuid=' + wxUuid.value + '&f=url&_=' + Date.now()
      const resp = await fetch(url); const text = await resp.text()
      if (text.includes('wx_errcode=405')) {
        const cm = text.match(/wx_redirecturl='[^']*code=([a-zA-Z0-9]+)/)
        const nm = text.match(/window\.wx_nickname\s*=\s*['"]([^"']+)['"]/)
        stopPolling(); await wxLogin(cm?.[1], nm?.[1] || '')
      } else if (text.includes('wx_errcode=408')) { wxStatusMsg.value = '过期'; wxStatusType.value = 'error'; stopPolling() }
    } catch {}
  }, 2000)
}
function stopPolling() { if (wxPollTimer) { clearInterval(wxPollTimer); wxPollTimer = null } }

async function wxLogin(code, nickname) {
  wxStatusMsg.value = '扫码成功' + (nickname ? '：' + nickname : '') + '，登录中...'; wxStatusType.value = 'success'
  try {
    const r = await api.post('/accounts/wx-login', { code })
    if (r.success) { wxTempId.value = r.data.tempId; wxRoles.value = r.data.roles || []; wxStatusMsg.value = `登录成功，${wxRoles.value.length} 个角色` }
    else { wxStatusMsg.value = '失败: ' + r.message; wxStatusType.value = 'error' }
  } catch { wxStatusMsg.value = '登录失败'; wxStatusType.value = 'error' }
}

async function importRole(role) {
  role._loading = true
  try { const name = role.name || '角色_' + role.roleId; const r = await api.post('/accounts/wx-import-role', { tempId: wxTempId.value, name, serverId: role.serverId }); if (r.success) { ElMessage.success(name + ' 导入成功'); loadAccounts() } else ElMessage.error(r.message || '失败') } catch (e) { console.error('importRole', e) } role._loading = false
}

function resetImport() { binForm.value = { name: '', file: null, roles: [], selectedRoles: [] }; previewing.value = false; wxQrcode.value = ''; wxUuid.value = ''; wxRoles.value = []; wxStatusMsg.value = '点击获取微信二维码'; wxStatusType.value = 'info'; stopPolling() }

async function refreshToken(id) { try { await api.post('/accounts/' + id + '/refresh-token'); ElMessage.success('已刷新'); loadAccounts() } catch (e) { ElMessage.error(e.response?.data?.message || '失败') } }
async function batchRefreshToken() { for (const id of selectedIds.value) { try { await api.post('/accounts/' + id + '/refresh-token') } catch {} } ElMessage.success('批量刷新完成'); loadAccounts() }
function editAccount(row) { editForm.value = { id: row.id, name: row.name }; showEdit.value = true }
async function saveEdit() { try { await api.put('/accounts/' + editForm.value.id, { name: editForm.value.name }); ElMessage.success('已保存'); showEdit.value = false; loadAccounts() } catch (e) { console.error('saveEdit', e) } }
async function deleteAccount(id) { try { await ElMessageBox.confirm('删除该账号？', '提示', { type: 'warning' }); await api.delete('/accounts/' + id); ElMessage.success('已删除'); loadAccounts() } catch {} }
async function batchDelete() { try { await ElMessageBox.confirm(`删除 ${selectedIds.value.length} 个账号？`, '批量删除', { type: 'warning' }); for (const id of selectedIds.value) await api.delete('/accounts/' + id); ElMessage.success(`已删除 ${selectedIds.value.length} 个`); clearSel(); loadAccounts() } catch {} }

// 任务绑定
async function openTaskBinding(row) {
  taskBindAccount.value = row
  showTaskBinding.value = true
  taskBindingLoading.value = true
  taskBindList.value = []
  taskBindSelected.value = []
  try {
    const r = await api.get('/accounts/' + row.id + '/tasks')
    if (r.success) {
      taskBindList.value = r.data || []
      taskBindSelected.value = (r.data || []).filter(t => t.bound).map(t => t.id)
    }
  } catch (e) { console.error('openTaskBinding', e); ElMessage.error('加载失败') }
  taskBindingLoading.value = false
}

async function saveTaskBinding() {
  taskBindingSaving.value = true
  try {
    const r = await api.put('/accounts/' + taskBindAccount.value.id + '/tasks', { taskIds: taskBindSelected.value })
    if (r.success) ElMessage.success(`已更新任务绑定 (${taskBindSelected.value.length}个任务)`)
    else ElMessage.error(r.message || '保存失败')
    showTaskBinding.value = false
  } catch (e) { ElMessage.error(e.response?.data?.message || '保存失败') }
  taskBindingSaving.value = false
}

onMounted(loadAccounts)
</script>

<style scoped>
.qr-placeholder { display: flex; flex-direction: column; align-items: center; padding: 24px; cursor: pointer; border: 2px dashed #dcdfe6; border-radius: 8px; }
.qr-status.info { color: #909399; }
.qr-status.success { color: #67c23a; background: #f0f9eb; }
.qr-status.error { color: #f56c6c; background: #fef0f0; }
</style>
