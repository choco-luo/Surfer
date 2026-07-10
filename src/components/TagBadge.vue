<script setup lang="ts">
// 第三階段：Tag 上色與篩選
import type { Tag } from '../types/roadmap'

defineProps<{ tag: Tag }>()
</script>

<template>
  <span class="tag-badge" :style="{ backgroundColor: tag.color }">
    {{ tag.name }}
  </span>
</template>

<style scoped>
.tag-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: #fff;
}
</style>
