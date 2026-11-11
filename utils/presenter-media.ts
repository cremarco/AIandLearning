import { shallowRef } from 'vue'

type MediaKey = { page: number; source: string }
export type MediaSyncMessage = MediaKey & (
  | { type: 'playback'; time: number; paused: boolean; rate: number; sentAt: number; seek: boolean }
  | { type: 'ready' }
  | { type: 'status'; blocked: boolean }
  | { type: 'dialog'; command: string | null }
)

export const mediaPlaybackIssue = shallowRef<(MediaKey & { retry?: () => void })>()

let channel: BroadcastChannel | undefined
const listeners = new Set<(message: MediaSyncMessage) => void>()

/** One channel per deck, shared by its mounted players. No state survives a reload. */
export function connectPresenterMedia(receive: (message: MediaSyncMessage) => void) {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    const base = new URL(import.meta.env.BASE_URL, window.location.href).pathname
    channel = new BroadcastChannel(`eduforum:presenter-media:v1:${base}`)
    channel.onmessage = ({ data }) => {
      if (!data || !Number.isInteger(data.page) || typeof data.source !== 'string') return
      for (const listener of listeners) listener(data)
    }
  }
  listeners.add(receive)
  let closed = false
  return {
    send(message: MediaSyncMessage) { if (!closed) channel?.postMessage(message) },
    close() {
      closed = true
      listeners.delete(receive)
      if (!listeners.size) {
        channel?.close()
        channel = undefined
      }
    },
  }
}
