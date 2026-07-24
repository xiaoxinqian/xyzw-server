<template>
  <!-- PC端：侧边栏 + 顶栏 -->
  <template v-if="!isMobile">
    <el-container style="height: 100vh">
      <el-aside :width="collapsed ? '64px' : '200px'" class="pc-sidebar" style="transition: width .3s">
        <div class="logo" @click="$router.push('/dashboard')">
          <span v-if="!collapsed">XYZW 管理</span>
          <span v-else>X</span>
        </div>
        <el-menu
          :default-active="$route.path"
          :collapse="collapsed"
          router
          background-color="#2b3a4d"
          text-color="#bfcbd9"
          active-text-color="#409eff"
        >
          <el-menu-item index="/dashboard"><el-icon><DataBoard /></el-icon><span>仪表盘</span></el-menu-item>
          <el-menu-item index="/accounts"><el-icon><User /></el-icon><span>游戏账号</span></el-menu-item>
          <el-menu-item index="/tasks"><el-icon><Calendar /></el-icon><span>任务管理</span></el-menu-item>
          <el-menu-item index="/workers"><el-icon><Connection /></el-icon><span>Worker</span></el-menu-item>
          <el-menu-item index="/logs"><el-icon><Document /></el-icon><span>日志</span></el-menu-item>
          <el-menu-item v-if="auth.isAdmin" index="/users"><el-icon><UserFilled /></el-icon><span>用户管理</span></el-menu-item>
          <el-menu-item index="/settings"><el-icon><Setting /></el-icon><span>设置</span></el-menu-item>
        </el-menu>
      </el-aside>

      <el-container>
        <div class="topbar">
          <div class="flex">
            <el-icon style="cursor: pointer; font-size: 18px" @click="collapsed = !collapsed">
              <Fold v-if="!collapsed" /><Expand v-else />
            </el-icon>
            <span style="font-size: 15px; font-weight: 600">{{ $route.meta.title }}</span>
          </div>
          <div class="flex" style="gap: 8px">
            <span style="font-size: 13px; color: #606266">{{ auth.user?.username }}</span>
            <el-tag v-if="auth.isAdmin" type="danger" size="small">管理员</el-tag>
            <el-dropdown @command="handleCommand">
              <el-icon style="cursor: pointer"><ArrowDown /></el-icon>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="logout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
        <el-main style="background: var(--bg); overflow-y: auto">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </template>

  <!-- 手机端：顶栏 + 内容 + 底部Tab -->
  <template v-else>
    <div style="height: 100vh; display: flex; flex-direction: column">
      <div class="topbar" style="padding: 0 12px">
        <span style="font-size: 16px; font-weight: 700">{{ $route.meta.title }}</span>
        <div class="flex" style="gap: 6px">
          <span style="font-size: 12px; color: #909399">{{ auth.user?.username }}</span>
          <el-dropdown @command="handleCommand" v-if="auth.isAdmin">
            <el-icon style="cursor: pointer"><ArrowDown /></el-icon>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-icon v-else style="cursor: pointer" @click="handleCommand('logout')"><SwitchButton /></el-icon>
        </div>
      </div>

      <div style="flex: 1; overflow-y: auto; background: var(--bg); -webkit-overflow-scrolling: touch">
        <router-view />
      </div>

      <div class="mobile-tabbar">
        <div
          v-for="tab in tabs" :key="tab.path"
          class="mobile-tabbar-item"
          :class="{ active: $route.path.startsWith(tab.path) }"
          @click="$router.push(tab.path)"
        >
          <el-icon><component :is="tab.icon" /></el-icon>
          <span>{{ tab.label }}</span>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useBreakpoint } from '../utils/useBreakpoint'

const auth = useAuthStore()
const router = useRouter()
const { isMobile } = useBreakpoint()
const collapsed = ref(false)

const tabs = [
  { path: '/dashboard', label: '首页', icon: 'DataBoard' },
  { path: '/accounts', label: '账号', icon: 'User' },
  { path: '/tasks', label: '任务', icon: 'Calendar' },
  { path: '/workers', label: 'Worker', icon: 'Connection' },
  { path: '/settings', label: '设置', icon: 'Setting' },
]

function handleCommand(cmd) {
  if (cmd === 'logout') { auth.logout(); router.push('/login') }
}
</script>
