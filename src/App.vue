<script setup lang="ts">
import { onMounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import WidgetView from './views/WidgetView.vue'
import NotebookView from './views/NotebookView.vue'
import { useRoadmapStore } from './stores/roadmap'
import { useSettingsStore } from './stores/settings'

// 依視窗 label 決定渲染 Widget（玻璃卡片）或 Notebook（規劃介面）
const label = getCurrentWindow().label

const roadmap = useRoadmapStore()
const settings = useSettingsStore()

onMounted(() => {
  roadmap.init()
  settings.init()
})
</script>

<template>
  <WidgetView v-if="label === 'widget'" />
  <NotebookView v-else />
</template>
