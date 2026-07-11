import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import Database from '@tauri-apps/plugin-sql'
import { load } from '@tauri-apps/plugin-store'
import { emit, listen } from '@tauri-apps/api/event'
import type { DailySummary, RoadmapItem, Tag } from '../types/roadmap'

// 第二階段：資料遷移至 SQLite（tauri-plugin-sql），schema 見 src-tauri/src/lib.rs
const CHANGED_EVENT = 'roadmap:changed'

let db: Database | null = null

interface ItemRow {
  id: string
  title: string
  note: string | null
  scheduled_date: string
  scheduled_date_end: string | null
  created_at: string
  status: RoadmapItem['status']
  completed_at: string | null
  duration_ms: number | null
}

interface SummaryRow {
  date: string
  generated_at: string
  unfinished_item_ids: string
}

function rowToItem(row: ItemRow, tagIds: string[]): RoadmapItem {
  return {
    id: row.id,
    title: row.title,
    note: row.note ?? undefined,
    tagIds,
    scheduledDate: row.scheduled_date,
    scheduledDateEnd: row.scheduled_date_end ?? undefined,
    createdAt: row.created_at,
    status: row.status,
    completedAt: row.completed_at ?? undefined,
    durationMs: row.duration_ms ?? undefined,
  }
}

export const useRoadmapStore = defineStore('roadmap', () => {
  const items = ref<RoadmapItem[]>([])
  const tags = ref<Tag[]>([])
  const summaries = ref<DailySummary[]>([])
  let initPromise: Promise<void> | null = null

  /** 今天（含逾期）該處理的事項，供 Widget 展開清單使用 */
  const dueItems = computed(() => {
    const today = todayISO()
    return items.value
      .filter((i) => i.scheduledDate <= today && i.status !== 'draft')
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
  })

  async function refresh() {
    if (!db) return
    const [itemRows, tagRows, linkRows, summaryRows] = await Promise.all([
      db.select<ItemRow[]>('SELECT * FROM items ORDER BY scheduled_date'),
      db.select<Tag[]>('SELECT id, name, color FROM tags'),
      db.select<{ item_id: string; tag_id: string }[]>('SELECT item_id, tag_id FROM item_tags'),
      db.select<SummaryRow[]>('SELECT * FROM daily_summaries ORDER BY date DESC'),
    ])
    const tagMap = new Map<string, string[]>()
    for (const link of linkRows) {
      const list = tagMap.get(link.item_id) ?? []
      list.push(link.tag_id)
      tagMap.set(link.item_id, list)
    }
    items.value = itemRows.map((r) => rowToItem(r, tagMap.get(r.id) ?? []))
    tags.value = tagRows
    summaries.value = summaryRows.map((r) => ({
      date: r.date,
      generatedAt: r.generated_at,
      unfinishedItemIds: JSON.parse(r.unfinished_item_ids) as string[],
    }))
  }

  /** 舊版 roadmap.json（tauri-plugin-store）→ SQLite 一次性匯入 */
  async function migrateLegacyJson() {
    if (!db) return
    const [{ n }] = await db.select<{ n: number }[]>('SELECT COUNT(*) AS n FROM items')
    if (n > 0) return
    try {
      const legacy = await load('roadmap.json', { autoSave: false, defaults: {} })
      const legacyItems = (await legacy.get<RoadmapItem[]>('items')) ?? []
      for (const item of legacyItems) {
        await db.execute(
          `INSERT OR IGNORE INTO items
           (id, title, note, scheduled_date, scheduled_date_end, created_at, status, completed_at, duration_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            item.id,
            item.title,
            item.note ?? null,
            item.scheduledDate,
            item.scheduledDateEnd ?? null,
            item.createdAt,
            item.status,
            item.completedAt ?? null,
            item.durationMs ?? null,
          ],
        )
      }
    } catch {
      // 沒有舊資料檔就跳過
    }
  }

  function init(): Promise<void> {
    initPromise ??= (async () => {
      db = await Database.load('sqlite:surfer.db')
      await migrateLegacyJson()
      await refresh()
      // 另一個視窗寫入後透過事件同步（Widget ↔ Notebook）
      await listen(CHANGED_EVENT, refresh)
    })()
    return initPromise
  }

  /** 寫入後刷新本視窗並廣播給其他視窗 */
  async function changed() {
    await refresh()
    await emit(CHANGED_EVENT)
  }

  async function addItem(input: {
    title: string
    note?: string
    scheduledDate: string
    scheduledDateEnd?: string
    tagIds?: string[]
  }) {
    if (!db) return
    const id = crypto.randomUUID()
    await db.execute(
      `INSERT INTO items (id, title, note, scheduled_date, scheduled_date_end, created_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')`,
      [
        id,
        input.title,
        input.note ?? null,
        input.scheduledDate,
        input.scheduledDateEnd ?? null,
        new Date().toISOString(),
      ],
    )
    for (const tagId of input.tagIds ?? []) {
      await db.execute('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES ($1, $2)', [
        id,
        tagId,
      ])
    }
    await changed()
  }

  async function removeItem(id: string) {
    if (!db) return
    await db.execute('DELETE FROM items WHERE id = $1', [id])
    await db.execute('DELETE FROM item_tags WHERE item_id = $1', [id])
    await changed()
  }

  async function toggleComplete(id: string) {
    if (!db) return
    const item = items.value.find((i) => i.id === id)
    if (!item) return
    if (item.status === 'completed') {
      await db.execute(
        `UPDATE items SET status = 'scheduled', completed_at = NULL, duration_ms = NULL WHERE id = $1`,
        [id],
      )
    } else {
      const now = new Date().toISOString()
      await db.execute(
        `UPDATE items SET status = 'completed', completed_at = $1, duration_ms = $2 WHERE id = $3`,
        [now, Date.parse(now) - Date.parse(item.createdAt), id],
      )
    }
    await changed()
  }

  /** 換新日：把已到期的 scheduled 事項展開 */
  async function expandDueItems() {
    if (!db) return
    await db.execute(
      `UPDATE items SET status = 'expanded' WHERE status = 'scheduled' AND scheduled_date <= $1`,
      [todayISO()],
    )
    await changed()
  }

  /** 每日總結：把「已過期未完成」寫入快照，回傳未完成事項 */
  async function writeDailySummary(): Promise<RoadmapItem[]> {
    if (!db) return []
    const today = todayISO()
    const unfinished = items.value.filter(
      (i) => i.scheduledDate <= today && i.status !== 'completed' && i.status !== 'draft',
    )
    await db.execute(
      `INSERT OR REPLACE INTO daily_summaries (date, generated_at, unfinished_item_ids)
       VALUES ($1, $2, $3)`,
      [today, new Date().toISOString(), JSON.stringify(unfinished.map((i) => i.id))],
    )
    await changed()
    return unfinished
  }

  // ---- meta：排程器的持久化狀態（上次檢查時間、徽章）----

  async function getMeta(key: string): Promise<string | null> {
    if (!db) return null
    const rows = await db.select<{ value: string }[]>('SELECT value FROM meta WHERE key = $1', [
      key,
    ])
    return rows[0]?.value ?? null
  }

  async function setMeta(key: string, value: string) {
    if (!db) return
    await db.execute('INSERT OR REPLACE INTO meta (key, value) VALUES ($1, $2)', [key, value])
  }

  return {
    items,
    tags,
    summaries,
    dueItems,
    init,
    addItem,
    removeItem,
    toggleComplete,
    expandDueItems,
    writeDailySummary,
    getMeta,
    setMeta,
  }
})

export function todayISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
