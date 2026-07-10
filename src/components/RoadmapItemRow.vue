<script setup lang="ts">
import type { RoadmapItem } from '../types/roadmap'

defineProps<{ item: RoadmapItem }>()
defineEmits<{ toggle: [] }>()
</script>

<template>
  <label class="row" :class="{ done: item.status === 'completed' }">
    <input
      type="checkbox"
      :checked="item.status === 'completed'"
      @change="$emit('toggle')"
    />
    <span class="title">{{ item.title }}</span>
    <span class="date">{{ item.scheduledDate.slice(5).replace('-', '/') }}</span>
  </label>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.row:hover {
  background: rgba(128, 128, 128, 0.15);
}
.title {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.date {
  font-size: 11px;
  opacity: 0.55;
  flex-shrink: 0;
}
.done .title {
  text-decoration: line-through;
  opacity: 0.45;
}
input[type='checkbox'] {
  accent-color: #34c759;
  cursor: pointer;
}
</style>
