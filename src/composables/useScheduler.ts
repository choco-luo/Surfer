// 第二階段 — 換新日 / 每日總結排程校正邏輯（roadmapwidgetplan.md 第 5 節）
//
// 設計原則：不依賴長時間運行的 interval 觸發，而是每次 tick / 聚焦 / 啟動時
// 比對「上次檢查時間」與「現在」，看期間內是否跨越了任何時間點。
// 電腦睡眠、關機錯過的時間點會在下一次醒來的 tick 自動補跑。
import { onMounted, onUnmounted, ref } from 'vue'
import { emit } from '@tauri-apps/api/event'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { todayISO, useRoadmapStore } from '../stores/roadmap'
import { useSettingsStore } from '../stores/settings'
import type { Settings } from '../types/roadmap'

/** 換新日觸發時廣播，Widget 收到後自動展開今天的清單 */
export const DAY_REFRESHED_EVENT = 'surfer:day-refreshed'

const CHECK_INTERVAL_MS = 30_000
const META_LAST_REFRESH = 'lastRefreshCheck'
const META_LAST_SUMMARY = 'lastSummaryCheck'
const META_INTERVAL_ANCHOR = 'refreshIntervalAnchor'
const META_SUMMARY_BADGE = 'summaryBadge'

const MS_PER_DAY = 86_400_000

function parseTime(t: string): { h: number; m: number } {
  const [h = 0, m = 0] = t.split(':').map(Number)
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 }
}

function startOfDay(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  return s
}

/**
 * (from, to] 期間內是否跨越了任何一個規則時間點。
 * matchDay 決定哪些「日子」是規則日（每天 / 每週某天 / 每 N 天）。
 */
function crossed(
  from: Date,
  to: Date,
  time: string,
  matchDay: (day: Date) => boolean,
): boolean {
  if (to <= from) return false
  const { h, m } = parseTime(time)
  const cursor = startOfDay(from)
  // 上限一年，避免系統時鐘異常時無限迴圈
  for (let i = 0; i < 400 && cursor <= to; i++, cursor.setDate(cursor.getDate() + 1)) {
    if (!matchDay(cursor)) continue
    const occurrence = new Date(cursor)
    occurrence.setHours(h, m, 0, 0)
    if (occurrence > from && occurrence <= to) return true
  }
  return false
}

function crossedRefresh(
  rule: Settings['refreshRule'],
  anchorISO: string,
  from: Date,
  to: Date,
): boolean {
  switch (rule.type) {
    case 'daily':
      return crossed(from, to, rule.time, () => true)
    case 'weekly':
      return crossed(from, to, rule.time, (day) => day.getDay() === (rule.weekday ?? 1))
    case 'interval': {
      const n = Math.max(1, rule.intervalDays ?? 1)
      const anchor = startOfDay(new Date(anchorISO))
      return crossed(from, to, rule.time, (day) => {
        const diff = Math.round((day.getTime() - anchor.getTime()) / MS_PER_DAY)
        return diff >= 0 && diff % n === 0
      })
    }
  }
}

async function notify(title: string, body: string) {
  try {
    let granted = await isPermissionGranted()
    if (!granted) granted = (await requestPermission()) === 'granted'
    if (granted) sendNotification({ title, body })
  } catch {
    // 通知失敗不影響排程本身
  }
}

/**
 * 只在 widget 視窗掛載。回傳每日總結徽章狀態，供 Widget 顯示紅點。
 */
export function useScheduler() {
  const roadmap = useRoadmapStore()
  const settingsStore = useSettingsStore()

  /** 有尚未查看的每日總結 */
  const summaryBadge = ref(false)
  let timer: ReturnType<typeof setInterval> | undefined
  let checking = false

  async function checkRefresh(now: Date) {
    const last = await roadmap.getMeta(META_LAST_REFRESH)
    if (last === null) {
      // 首次啟動：直接展開一次已到期事項，不通知
      await roadmap.expandDueItems()
      return
    }
    let anchor = await roadmap.getMeta(META_INTERVAL_ANCHOR)
    if (anchor === null) {
      anchor = todayISO()
      await roadmap.setMeta(META_INTERVAL_ANCHOR, anchor)
    }
    if (crossedRefresh(settingsStore.settings.refreshRule, anchor, new Date(last), now)) {
      await roadmap.expandDueItems()
      await emit(DAY_REFRESHED_EVENT)
      await notify('surfer — 換新日', '今天該處理的事項已經展開')
    }
  }

  async function checkSummary(now: Date) {
    const last = await roadmap.getMeta(META_LAST_SUMMARY)
    if (last === null) return // 首次啟動不補跑總結，避免裝好就跳通知
    const time = settingsStore.settings.dailySummaryTime || '00:00'
    if (crossed(new Date(last), now, time, () => true)) {
      const unfinished = await roadmap.writeDailySummary()
      await roadmap.setMeta(META_SUMMARY_BADGE, '1')
      summaryBadge.value = true
      await notify(
        'surfer — 每日總結',
        unfinished.length > 0
          ? `還有 ${unfinished.length} 件事項尚未完成`
          : '所有事項都完成了 🎉',
      )
    }
  }

  /** 啟動 / 聚焦 / 每 30 秒執行；lastCheck 一律推進到現在 */
  async function check() {
    if (checking) return
    checking = true
    try {
      const now = new Date()
      await checkRefresh(now)
      await checkSummary(now)
      await roadmap.setMeta(META_LAST_REFRESH, now.toISOString())
      await roadmap.setMeta(META_LAST_SUMMARY, now.toISOString())
    } finally {
      checking = false
    }
  }

  async function clearSummaryBadge() {
    if (!summaryBadge.value) return
    summaryBadge.value = false
    await roadmap.setMeta(META_SUMMARY_BADGE, '')
  }

  const onFocus = () => void check()

  onMounted(async () => {
    await Promise.all([roadmap.init(), settingsStore.init()])
    summaryBadge.value = Boolean(await roadmap.getMeta(META_SUMMARY_BADGE))
    await check()
    timer = setInterval(() => void check(), CHECK_INTERVAL_MS)
    window.addEventListener('focus', onFocus)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
    window.removeEventListener('focus', onFocus)
  })

  return { summaryBadge, clearSummaryBadge }
}
