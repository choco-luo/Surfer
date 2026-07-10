// 資料模型 — 對應 roadmapwidgetplan.md 第 4 節

/** 事項（Roadmap Item） */
export interface RoadmapItem {
  id: string
  title: string
  note?: string
  tagIds: string[]
  /** ISO date，事項預計處理日期 */
  scheduledDate: string
  /** 若為日期區間 */
  scheduledDateEnd?: string
  /** 寫入筆記本的時間（用於統計起算點） */
  createdAt: string
  status: 'draft' | 'scheduled' | 'expanded' | 'completed'
  /** 勾選完成的時間 */
  completedAt?: string
  /** completedAt - createdAt，完成時自動計算 */
  durationMs?: number
}

/** 標籤（Tag） */
export interface Tag {
  id: string
  name: string
  color: string
}

/** 每日總結快照 */
export interface DailySummary {
  /** 總結對應的日期 */
  date: string
  generatedAt: string
  unfinishedItemIds: string[]
}

/** 使用者設定 */
export interface Settings {
  refreshRule: {
    type: 'daily' | 'weekly' | 'interval'
    /** HH:mm */
    time: string
    /** 當 type = weekly */
    weekday?: number
    /** 當 type = interval */
    intervalDays?: number
  }
  /** 預設 '00:00' */
  dailySummaryTime: string
  theme: 'light' | 'dark' | 'system'
}
