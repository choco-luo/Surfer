<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
} from '@tauri-apps/api/window'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { GripVertical, Minus } from '@lucide/vue'
import GlassCard from '../components/GlassCard.vue'
import RoadmapItemRow from '../components/RoadmapItemRow.vue'
import { useRoadmapStore, todayISO } from '../stores/roadmap'
import { decideExpandDirection, type ExpandDirection } from '../composables/useExpandDirection'

// 視窗尺寸（logical px），需與 tauri.conf.json 的 widget 視窗一致
const WIDTH = 460
const COLLAPSED_H = 132
const PANEL_H = 300
const PANEL_W = 280
const EXPANDED_H = COLLAPSED_H + PANEL_H + 8

// 日期軸：第一格是昨天，今天固定在第二格，往後共 30 天
const DAYS_AHEAD = 30

interface DayCell {
  date: string
  label: string
  weekday: string
  isToday: boolean
}

function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function buildDays(): DayCell[] {
  const today = todayISO()
  const cells: DayCell[] = []
  for (let offset = -1; offset < DAYS_AHEAD; offset++) {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    const iso = toISO(d)
    cells.push({
      date: iso,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      weekday: d.toLocaleDateString('zh-TW', { weekday: 'narrow' }),
      isToday: iso === today,
    })
  }
  return cells
}

const store = useRoadmapStore()
const days = buildDays()
const fullDate = todayISO()

const expanded = ref(false)
const direction = ref<ExpandDirection>('down')
const selectedDate = ref<string | null>(null)
const panelOffset = ref(6)
const stripEl = ref<HTMLElement | null>(null)
const busy = ref(false)

/** 選中日期的事項；今天含逾期未完成，其它日期只列當天 */
const panelItems = computed(() => {
  const date = selectedDate.value
  if (!date) return []
  if (date === todayISO()) return store.dueItems
  return store.items
    .filter((i) => i.scheduledDate === date && i.status !== 'draft')
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
})

/** 該日期未完成事項數，顯示在格子角落的徽章 */
function countFor(date: string): number {
  return store.items.filter(
    (i) => i.scheduledDate === date && i.status !== 'draft' && i.status !== 'completed',
  ).length
}

function updatePanelOffset() {
  const strip = stripEl.value
  if (!strip || !selectedDate.value) return
  const cell = strip.querySelector<HTMLElement>(`[data-date="${selectedDate.value}"]`)
  if (!cell) return
  const left = cell.offsetLeft - strip.scrollLeft
  panelOffset.value = Math.min(Math.max(6, left), WIDTH - PANEL_W - 6)
}

function onWheel(e: WheelEvent) {
  if (!stripEl.value) return
  stripEl.value.scrollLeft += e.deltaY + e.deltaX
  updatePanelOffset()
}

async function setExpanded(value: boolean) {
  if (busy.value || expanded.value === value) return
  busy.value = true
  try {
    const win = getCurrentWindow()
    const scale = await win.scaleFactor()
    const delta = Math.round((EXPANDED_H - COLLAPSED_H) * scale)

    if (value) {
      direction.value = await decideExpandDirection()
      // 向上展開時把視窗往上挪，讓日期軸在視覺上留在原地
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

async function selectDate(date: string) {
  if (expanded.value && selectedDate.value === date) {
    // 再點一次同一格 → 收合
    await setExpanded(false)
    selectedDate.value = null
    return
  }
  selectedDate.value = date
  updatePanelOffset()
  await setExpanded(true)
}

async function openNotebook() {
  const notebook = await WebviewWindow.getByLabel('notebook')
  await notebook?.show()
  await notebook?.setFocus()
}

/** 隱藏浮窗；要再顯示時從系統托盤點 surfer 圖示 */
async function hideWidget() {
  await getCurrentWindow().hide()
}
</script>

<template>
  <div class="widget" :class="`dir-${direction}`">
    <div class="top">
      <div class="top-row">
        <GlassCard class="date-card" data-tauri-drag-region>
          <span class="date" data-tauri-drag-region>{{ fullDate }}</span>
          <button class="icon-btn" title="開啟筆記本" @click="openNotebook">✎</button>
        </GlassCard>
        <button class="hide-btn" title="隱藏小工具（從托盤圖示叫回）" @click="hideWidget">
          <Minus :size="14" />
        </button>
      </div>

      <div class="strip-row">
        <GlassCard class="strip-card">
          <div
            ref="stripEl"
            class="strip"
            @wheel.prevent="onWheel"
            @scroll="updatePanelOffset"
          >
            <button
              v-for="d in days"
              :key="d.date"
              class="cell"
              :data-date="d.date"
              :class="{ today: d.isToday, selected: expanded && d.date === selectedDate }"
              @click="selectDate(d.date)"
            >
              <span class="cell-label">{{ d.isToday ? 'Today' : d.label }}</span>
              <span class="cell-week">{{ d.weekday }}</span>
              <span v-if="countFor(d.date)" class="badge">{{ countFor(d.date) }}</span>
            </button>
          </div>
        </GlassCard>

        <GlassCard class="drag-card" data-tauri-drag-region title="拖曳移動">
          <GripVertical :size="16" class="grip-icon" />
        </GlassCard>
      </div>
    </div>
    <!-- /top -->

    <Transition name="slide-fade">
      <GlassCard
        v-if="expanded"
        class="list-card"
        :style="{ marginLeft: panelOffset + 'px' }"
      >
        <p v-if="panelItems.length === 0" class="empty">這天沒有待辦事項 🌊</p>
        <RoadmapItemRow
          v-for="item in panelItems"
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
  /* 灰色半透明底，讓浮窗的佔用範圍看得見 */
  background: rgba(128, 128, 128, 0.3);
  border-radius: 18px;
}
.widget.dir-up {
  flex-direction: column-reverse;
}

.top {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* 右上角：隱藏浮窗 */
.hide-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
  color: #1d1d1f;
  cursor: pointer;
  transition: background 0.15s ease;
}
.hide-btn:hover {
  background: #fff;
}

/* 左上角完整日期小卡 */
.date-card {
  align-self: flex-start;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  cursor: grab;
}
.date {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.icon-btn {
  border: none;
  background: rgba(128, 128, 128, 0.18);
  color: inherit;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  transition: background 0.15s ease;
}
.icon-btn:hover {
  background: rgba(128, 128, 128, 0.35);
}

/* 日期軸 */
.strip-row {
  display: flex;
  gap: 8px;
  height: 76px;
}
.strip-card {
  flex: 1;
  min-width: 0;
  padding: 6px;
  overflow: hidden;
}

/* 最右邊的窄拖動把手 */
.drag-card {
  flex: 0 0 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
}
.drag-card:active {
  cursor: grabbing;
}
.grip-icon {
  pointer-events: none;
  opacity: 0.55;
}
.strip {
  display: flex;
  height: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}
.strip::-webkit-scrollbar {
  display: none;
}
.cell {
  position: relative;
  flex: 0 0 108px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: none;
  background: transparent;
  color: inherit;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: background 0.15s ease;
}
.cell:last-child {
  border-right: none;
}
.cell:hover {
  background: rgba(128, 128, 128, 0.12);
  border-radius: 10px;
}
.cell.today .cell-label {
  font-weight: 800;
}
.cell.selected {
  background: rgba(128, 128, 128, 0.18);
  border-radius: 10px;
}
.cell-label {
  font-size: 16px;
  font-weight: 600;
}
.cell-week {
  font-size: 11px;
  opacity: 0.6;
}
.badge {
  position: absolute;
  top: 6px;
  right: 10px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #ff453a;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

/* 展開清單：對齊選中的日期格 */
.list-card {
  width: 280px;
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
