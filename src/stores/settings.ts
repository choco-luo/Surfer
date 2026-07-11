import { defineStore } from 'pinia'
import { ref } from 'vue'
import { load, type Store } from '@tauri-apps/plugin-store'
import { emit, listen } from '@tauri-apps/api/event'
import type { Settings } from '../types/roadmap'

const CHANGED_EVENT = 'settings:changed'

const DEFAULT_SETTINGS: Settings = {
  refreshRule: { type: 'daily', time: '09:00' },
  dailySummaryTime: '00:00',
  theme: 'system',
}

let file: Store | null = null

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS })
  let initPromise: Promise<void> | null = null

  async function refresh() {
    if (!file) return
    const saved = await file.get<Settings>('settings')
    if (saved) settings.value = { ...DEFAULT_SETTINGS, ...saved }
  }

  function init(): Promise<void> {
    initPromise ??= (async () => {
      file = await load('settings.json', { autoSave: false, defaults: {} })
      await refresh()
      // 筆記本改設定後，Widget 的排程器即時吃到新規則
      await listen(CHANGED_EVENT, refresh)
    })()
    return initPromise
  }

  async function save(patch: Partial<Settings>) {
    settings.value = { ...settings.value, ...patch }
    if (!file) return
    await file.set('settings', settings.value)
    await file.save()
    await emit(CHANGED_EVENT)
  }

  return { settings, init, save }
})
