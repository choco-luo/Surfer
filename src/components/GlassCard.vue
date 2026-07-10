<template>
  <div class="glass-card">
    <slot />
  </div>
</template>

<style scoped>
/* 毛玻璃質感 — roadmapwidgetplan.md 3.2 節
   注意：Windows 上 backdrop-filter 只會模糊網頁內容而非桌面，
   實際觀感以半透明底色為主，桌面級模糊留待第四階段調校 */
.glass-card {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  color: #1d1d1f;
}
</style>
