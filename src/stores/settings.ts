import { defineStore } from 'pinia'
import { ref } from 'vue'
import { load, type Store } from '@tauri-apps/plugin-store'
import type { Settings } from '../types/roadmap'

const DEFAULT_SETTINGS: Settings = {
  refreshRule: { type: 'daily', time: '09:00' },
  dailySummaryTime: '00:00',
  theme: 'system',
}

let file: Store | null = null

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS })
  let initialized = false

  async function init() {
    if (initialized) return
    initialized = true
    file = await load('settings.json', { autoSave: false, defaults: {} })
    const saved = await file.get<Settings>('settings')
    if (saved) settings.value = { ...DEFAULT_SETTINGS, ...saved }
  }

  async function save(patch: Partial<Settings>) {
    settings.value = { ...settings.value, ...patch }
    if (!file) return
    await file.set('settings', settings.value)
    await file.save()
  }

  return { settings, init, save }
})
