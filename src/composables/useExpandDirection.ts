import { currentMonitor, getCurrentWindow } from '@tauri-apps/api/window'

export type ExpandDirection = 'up' | 'down'

/**
 * 依 Widget 目前貼在螢幕的位置決定清單展開方向：
 * 卡片位於螢幕下半部 → 向上展開；上半部 → 向下展開。
 */
export async function decideExpandDirection(): Promise<ExpandDirection> {
  const win = getCurrentWindow()
  const [pos, size, monitor] = await Promise.all([
    win.outerPosition(),
    win.outerSize(),
    currentMonitor(),
  ])
  if (!monitor) return 'down'

  const cardCenterY = pos.y + size.height / 2 - monitor.position.y
  return cardCenterY > monitor.size.height / 2 ? 'up' : 'down'
}
