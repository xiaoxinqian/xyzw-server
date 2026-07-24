<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <el-button type="primary" size="small" @click="showCreate = true">+ 创建</el-button>
        </div>
      </template>

      <el-table v-if="!isMobile" :data="users" stripe size="small">
        <el-table-column prop="username" label="用户名" min-width="100" />
        <el-table-column label="角色" width="70"><template #default="{ row }"><el-tag :type="row.role === 'admin' ? 'danger' : 'info'" size="small">{{ row.role === 'admin' ? '管理员' : '普通' }}</el-tag></template></el-table-column>
        <el-table-column label="状态" width="60"><template #default="{ row }"><el-tag :type="row.active ? 'success' : 'info'" size="small">{{ row.active ? '正常' : '禁用' }}</el-tag></template></el-table-column>
        <el-table-column label="创建时间" width="140"><template #default="{ row }">{{ fmtTime(row.created_at) }}</template></el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="editUser(row)">编辑</el-button>
            <el-button size="small" link type="warning" @click="resetPassword(row)">重置密码</el-button>
            <el-popconfirm v-if="row.role !== 'admin'" title="确定删除？" @confirm="deleteUser(row.id)">
              <template #reference><el-button size="small" link type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <template v-else>
        <div v-for="u in users" :key="u.id" class="mobile-card">
          <div class="mobile-card-row">
            <span class="mobile-card-title">{{ u.username }}</span>
            <div style="display: flex; gap: 4px">
              <el-tag :type="u.role === 'admin' ? 'danger' : 'info'" size="small">{{ u.role === 'admin' ? '管理员' : '普通' }}</el-tag>
              <el-tag :type="u.active ? 'success' : 'info'" size="small">{{ u.active ? '正常' : '禁用' }}</el-tag>
            </div>
          </div>
          <div class="mobile-card-meta">{{ fmtTime(u.created_at) }}</div>
          <div class="mobile-card-actions">
            <el-button size="small" @click="editUser(u)">编辑</el-button>
            <el-button size="small" type="warning" @click="resetPassword(u)">重置密码</el-button>
            <el-button v-if="u.role !== 'admin'" size="small" type="danger" @click="deleteUser(u.id)">删除</el-button>
          </div>
        </div>
        <el-empty v-if="!users.length" description="暂无用户" :image-size="60" />
      </template>
    </el-card>

    <el-dialog v-model="showCreate" title="创建用户" width="90%" style="max-width: 360px">
      <el-form :model="createForm" label-width="64px" size="small">
        <el-form-item label="用户名"><el-input v-model="createForm.username" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="createForm.password" type="password" show-password /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="createForm.role" style="width: 100%">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" @click="createUser">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showEdit" title="编辑用户" width="90%" style="max-width: 360px">
      <el-form :model="editForm" label-width="64px" size="small">
        <el-form-item label="角色">
          <el-select v-model="editForm.role" style="width: 100%">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态"><el-switch v-model="editForm.active" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEdit = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showReset" title="重置密码" width="90%" style="max-width: 360px">
      <el-form :model="resetForm" label-width="64px" size="small">
        <el-form-item label="新密码"><el-input v-model="resetForm.password" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showReset = false">取消</el-button>
        <el-button type="primary" @click="saveReset">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../utils/api'
import { fmtTime } from '../utils/format'
import { useBreakpoint } from '../utils/useBreakpoint'

const { isMobile } = useBreakpoint()
const users = ref([])
const showCreate = ref(false)
const showEdit = ref(false)
const showReset = ref(false)
const createForm = ref({ username: '', password: '', role: 'user' })
const editForm = ref({ id: '', role: 'user', active: true })
const resetForm = ref({ id: '', password: '' })

async function loadUsers() { const r = await api.get('/users'); users.value = r.data || [] }
async function createUser() {
  if (!createForm.value.username || !createForm.value.password) return ElMessage.warning('请填写完整')
  try { await api.post('/users', createForm.value); ElMessage.success('创建成功'); showCreate.value = false; createForm.value = { username: '', password: '', role: 'user' }; loadUsers() } catch {}
}
function editUser(row) { editForm.value = { id: row.id, role: row.role, active: !!row.active }; showEdit.value = true }
async function saveEdit() { try { await api.put(`/users/${editForm.value.id}`, { role: editForm.value.role, active: editForm.value.active }); ElMessage.success('已保存'); showEdit.value = false; loadUsers() } catch {} }
function resetPassword(row) { resetForm.value = { id: row.id, password: '' }; showReset.value = true }
async function saveReset() { if (!resetForm.value.password) return ElMessage.warning('请输入密码'); try { await api.put(`/users/${resetForm.value.id}`, { password: resetForm.value.password }); ElMessage.success('已重置'); showReset.value = false } catch {} }
async function deleteUser(id) { try { await api.delete(`/users/${id}`); ElMessage.success('已删除'); loadUsers() } catch {} }

onMounted(loadUsers)
</script>
