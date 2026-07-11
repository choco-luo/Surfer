<script setup lang="ts">
// 第二階段：每日總結歷史（拖延分析回顧）；完整統計圖表留待第三階段
import { computed } from 'vue'
import { useRoadmapStore } from '../stores/roadmap'
import type { DailySummary } from '../types/roadmap'

const store = useRoadmapStore()

const summaries = computed(() => store.summaries)

function titlesFor(summary: DailySummary): string[] {
  return summary.unfinishedItemIds.map(
    (id) => store.items.find((i) => i.id === id)?.title ?? '（事項已刪除）',
  )
}

function isDone(id: string): boolean {
  return store.items.find((i) => i.id === id)?.status === 'completed'
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="summary-panel">
    <p v-if="summaries.length === 0" class="placeholder">
      📊 還沒有任何每日總結。到了「每日總結時間」（可在設定分頁調整），系統會自動記錄當天尚未完成的事項。
    </p>

    <div v-for="s in summaries" :key="s.date" class="summary-card">
      <div class="summary-head">
        <span class="summary-date">{{ s.date }}</span>
        <span class="summary-meta">
          {{ timeOf(s.generatedAt) }} 產生 ·
          {{ s.unfinishedItemIds.length === 0 ? '全部完成 🎉' : `未完成 ${s.unfinishedItemIds.length} 件` }}
        </span>
      </div>
      <ul v-if="s.unfinishedItemIds.length > 0" class="summary-list">
        <li
          v-for="(id, i) in s.unfinishedItemIds"
          :key="id"
          :class="{ done: isDone(id) }"
        >
          {{ titlesFor(s)[i] }}
          <span v-if="isDone(id)" class="done-note">（事後已完成）</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.summary-panel {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
}
.placeholder {
  opacity: 0.6;
  font-size: 14px;
}
.summary-card {
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.5);
}
.summary-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.summary-date {
  font-size: 14px;
  font-weight: 700;
}
.summary-meta {
  font-size: 12px;
  opacity: 0.6;
}
.summary-list {
  margin-top: 8px;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.8;
}
.summary-list .done {
  opacity: 0.55;
  text-decoration: line-through;
}
.done-note {
  font-size: 11px;
  text-decoration: none;
}
</style>
