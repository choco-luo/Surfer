<script setup lang="ts">
import { computed, ref } from 'vue'
import RoadmapItemRow from '../components/RoadmapItemRow.vue'
import SummaryPanel from '../components/SummaryPanel.vue'
import { useRoadmapStore, todayISO } from '../stores/roadmap'

const store = useRoadmapStore()

const title = ref('')
const note = ref('')
const scheduledDate = ref(todayISO())
const tab = ref<'plan' | 'stats'>('plan')

const sortedItems = computed(() =>
  [...store.items].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
)

async function addItem() {
  const t = title.value.trim()
  if (!t || !scheduledDate.value) return
  await store.addItem({
    title: t,
    note: note.value.trim() || undefined,
    scheduledDate: scheduledDate.value,
  })
  title.value = ''
  note.value = ''
}
</script>

<template>
  <div class="notebook">
    <header class="header">
      <h1>surfer 筆記本</h1>
      <nav class="tabs">
        <button :class="{ active: tab === 'plan' }" @click="tab = 'plan'">規劃</button>
        <button :class="{ active: tab === 'stats' }" @click="tab = 'stats'">統計</button>
      </nav>
    </header>

    <main v-if="tab === 'plan'" class="plan">
      <form class="add-form" @submit.prevent="addItem">
        <input v-model="title" placeholder="事項標題" required />
        <input v-model="scheduledDate" type="date" required />
        <input v-model="note" placeholder="備註（選填）" />
        <button type="submit">加入</button>
      </form>

      <section class="item-list">
        <p v-if="sortedItems.length === 0" class="empty">
          還沒有任何事項，從上方表單開始規劃你的 roadmap。
        </p>
        <div v-for="item in sortedItems" :key="item.id" class="item-wrapper">
          <RoadmapItemRow :item="item" @toggle="store.toggleComplete(item.id)" />
          <p v-if="item.note" class="item-note">{{ item.note }}</p>
          <button class="delete-btn" title="刪除" @click="store.removeItem(item.id)">✕</button>
        </div>
      </section>
    </main>

    <SummaryPanel v-else />
  </div>
</template>

<style scoped>
/* 與 GlassCard 相同的霧面白色毛玻璃質感 */
.notebook {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  color: #1d1d1f;
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
}
.header h1 {
  font-size: 17px;
  font-weight: 700;
}
.tabs {
  flex: 1;
  display: flex;
  gap: 4px;
}
.tabs button {
  border: none;
  background: transparent;
  color: inherit;
  padding: 5px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  opacity: 0.65;
}
.tabs button.active {
  background: rgba(128, 128, 128, 0.18);
  opacity: 1;
  font-weight: 600;
}
.plan {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
}

.add-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  margin-bottom: 20px;
}
.add-form input {
  padding: 9px 12px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.7);
  color: inherit;
  font-size: 13px;
}
.add-form input:nth-child(3) {
  grid-column: 1 / 2;
}
.add-form button {
  border: none;
  background: #0a84ff;
  color: #fff;
  border-radius: 10px;
  padding: 9px 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.add-form button:hover {
  filter: brightness(1.1);
}

.item-list .empty {
  text-align: center;
  opacity: 0.55;
  font-size: 13px;
  padding: 40px 0;
}
.item-wrapper {
  position: relative;
  border-radius: 12px;
  margin-bottom: 4px;
  padding-right: 30px;
}
.item-wrapper:hover {
  background: rgba(128, 128, 128, 0.08);
}
.item-note {
  font-size: 12px;
  opacity: 0.55;
  padding: 0 10px 7px 36px;
}
.delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0;
  cursor: pointer;
  font-size: 12px;
}
.item-wrapper:hover .delete-btn {
  opacity: 0.5;
}
.delete-btn:hover {
  opacity: 1 !important;
  color: #ff453a;
}
</style>
