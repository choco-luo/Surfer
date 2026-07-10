import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { load, type Store } from '@tauri-apps/plugin-store'
import { emit, listen } from '@tauri-apps/api/event'
import type { RoadmapItem, Tag } from '../types/roadmap'

// 第一階段先用 JSON 檔（tauri-plugin-store）驗證流程，第二階段遷移到 SQLite
const CHANGED_EVENT = 'roadmap:changed'

let file: Store | null = null

export const useRoadmapStore = defineStore('roadmap', () => {
  const items = ref<RoadmapItem[]>([])
  const tags = ref<Tag[]>([])
  let initialized = false

  /** 今天（含逾期）該處理的事項，供 Widget 展開清單使用 */
  const dueItems = computed(() => {
    const today = todayISO()
    return items.value
      .filter((i) => i.scheduledDate <= today && i.status !== 'draft')
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
  })

  async function refresh() {
    if (!file) return
    items.value = (await file.get<RoadmapItem[]>('items')) ?? []
    tags.value = (await file.get<Tag[]>('tags')) ?? []
  }

  async function init() {
    if (initialized) return
    initialized = true
    file = await load('roadmap.json', { autoSave: false, defaults: {} })
    await refresh()
    // 另一個視窗寫入後透過事件同步（Widget ↔ Notebook）
    await listen(CHANGED_EVENT, refresh)
  }

  async function persist() {
    if (!file) return
    await file.set('items', items.value)
    await file.set('tags', tags.value)
    await file.save()
    await emit(CHANGED_EVENT)
  }

  async function addItem(input: {
    title: string
    note?: string
    scheduledDate: string
    scheduledDateEnd?: string
    tagIds?: string[]
  }) {
    items.value.push({
      id: crypto.randomUUID(),
      title: input.title,
      note: input.note,
      tagIds: input.tagIds ?? [],
      scheduledDate: input.scheduledDate,
      scheduledDateEnd: input.scheduledDateEnd,
      createdAt: new Date().toISOString(),
      status: 'scheduled',
    })
    await persist()
  }

  async function updateItem(id: string, patch: Partial<Omit<RoadmapItem, 'id'>>) {
    const item = items.value.find((i) => i.id === id)
    if (!item) return
    Object.assign(item, patch)
    await persist()
  }

  async function removeItem(id: string) {
    items.value = items.value.filter((i) => i.id !== id)
    await persist()
  }

  async function toggleComplete(id: string) {
    const item = items.value.find((i) => i.id === id)
    if (!item) return
    if (item.status === 'completed') {
      item.status = 'scheduled'
      item.completedAt = undefined
      item.durationMs = undefined
    } else {
      const now = new Date().toISOString()
      item.status = 'completed'
      item.completedAt = now
      item.durationMs = Date.parse(now) - Date.parse(item.createdAt)
    }
    await persist()
  }

  return { items, tags, dueItems, init, addItem, updateItem, removeItem, toggleComplete }
})

export function todayISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
