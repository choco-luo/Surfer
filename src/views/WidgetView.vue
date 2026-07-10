<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
} from '@tauri-apps/api/window'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import GlassCard from '../components/GlassCard.vue'
import RoadmapItemRow from '../components/RoadmapItemRow.vue'
import { useRoadmapStore } from '../stores/roadmap'
import { decideExpandDirection, type ExpandDirection } from '../composables/useExpandDirection'

// 視窗尺寸（logical px），需與 tauri.conf.json 的 widget 視窗一致
const WIDTH = 300
const COLLAPSED_H = 72
const EXPANDED_H = 400

const store = useRoadmapStore()
const expanded = ref(false)
const direction = ref<ExpandDirection>('down')
const busy = ref(false)

const dateLabel = new Date().toLocaleDateString('zh-TW', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
})

const dueItems = computed(() => store.dueItems)

async function toggleExpand() {
  if (busy.value) return
  busy.value = true
  try {
    const win = getCurrentWindow()
    const scale = await win.scaleFactor()
    const delta = Math.round((EXPANDED_H - COLLAPSED_H) * scale)

    if (!expanded.value) {
      direction.value = await decideExpandDirection()
      // 向上展開時把視窗往上挪，讓日期卡片在視覺上留在原地
      if (direction.value === 'up') {
        const pos = await win.outerPosition()
        await win.setPosition(new PhysicalPosition(pos.x, pos.y - delta))
      }
      await win.setSize(new LogicalSize(WIDTH, EXPANDED_H))
      expanded.value = true
    } else {
      await win.setSize(new LogicalSize(WIDTH, COLLAPSED_H))
      if (direction.value === 'up') {
        const pos = await win.outerPosition()
        await win.setPosition(new PhysicalPosition(pos.x, pos.y + delta))
      }
      expanded.value = false
    }
  } finally {
    busy.value = false
  }
}

async function openNotebook() {
  const notebook = await WebviewWindow.getByLabel('notebook')
  await notebook?.show()
  await notebook?.setFocus()
}
</script>

<template>
  <div class="widget" :class="`dir-${direction}`">
    <GlassCard class="date-card" data-tauri-drag-region>
      <span class="date" data-tauri-drag-region>{{ dateLabel }}</span>
      <button class="icon-btn" title="開啟筆記本" @click="openNotebook">✎</button>
      <button class="icon-btn" :title="expanded ? '收合' : '展開'" @click="toggleExpand">
        {{ expanded ? (direction === 'up' ? '▾' : '▴') : (direction === 'up' ? '▴' : '▾') }}
      </button>
    </GlassCard>

    <Transition name="slide-fade">
      <GlassCard v-if="expanded" class="list-card">
        <p v-if="dueItems.length === 0" class="empty">今天沒有待辦事項 🌊</p>
        <RoadmapItemRow
          v-for="item in dueItems"
          :key="item.id"
          :item="item"
          @toggle="store.toggleComplete(item.id)"
        />
      </GlassCard>
    </Transition>
  </div>
</template>

<style scoped>
.widget {
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px;
  user-select: none;
}
.widget.dir-up {
  flex-direction: column-reverse;
}

.date-card {
  flex-shrink: 0;
  height: 60px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  cursor: grab;
}
.date {
  flex: 1;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.icon-btn {
  border: none;
  background: rgba(128, 128, 128, 0.18);
  color: inherit;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  transition: background 0.15s ease;
}
.icon-btn:hover {
  background: rgba(128, 128, 128, 0.35);
}

.list-card {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}
.empty {
  text-align: center;
  font-size: 13px;
  opacity: 0.6;
  padding: 18px 0;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.dir-up .slide-fade-enter-from,
.dir-up .slide-fade-leave-to {
  transform: translateY(6px);
}

.list-card::-webkit-scrollbar {
  width: 4px;
}
.list-card::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.4);
  border-radius: 2px;
}
</style>
