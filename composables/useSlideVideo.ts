import { useNav, useSlideContext } from '@slidev/client'
import { computed, onScopeDispose, watch, type Ref } from 'vue'
import { useDocumentVisibility } from './useDocumentVisibility'
import { connectPresenterMedia, mediaPlaybackIssue, type MediaSyncMessage } from '../utils/presenter-media'

/** The presenter controls the current slide's media; only the audience plays audio. */
export function useSlideVideo<T extends HTMLMediaElement>(video: Ref<T | undefined>, onLeave?: () => void) {
  const nav = useNav()
  const context = nav.currentRoute.value.name === 'print' ? undefined : useSlideContext()
  const visible = useDocumentVisibility()
  const role = computed(() => context?.$renderContext.value)
  const active = computed(() => !nav.isPrintMode.value
    && ['slide', 'presenter'].includes(role.value || '')
    && context?.$page.value === nav.currentSlideNo.value)
  let send: ((message: MediaSyncMessage) => void) | undefined
  const source = () => video.value?.querySelector('source')?.src || video.value?.currentSrc || video.value?.src || ''
  const key = () => ({ page: context?.$page.value || 0, source: source() })
  let lastUpdate = 0
  let pending: Extract<MediaSyncMessage, { type: 'playback' }> | undefined
  let playPending = false
  let blocked = false
  let metadataRequested = false
  let repaintFrame: number | undefined
  let repaintSeek: { media: T; time: number } | undefined

  function cancelRepaint() {
    if (repaintFrame !== undefined) cancelAnimationFrame(repaintFrame)
    repaintFrame = undefined
    repaintSeek = undefined
  }

  function restorePausedFrame() {
    const media = video.value
    if (!media || media.tagName !== 'VIDEO' || !active.value || !visible.value) return
    cancelRepaint()
    repaintFrame = requestAnimationFrame(() => {
      repaintFrame = undefined
      if (video.value !== media || !active.value || !visible.value || !media.paused
        || media.readyState < 2 || media.seeking || (!media.currentTime && !media.played.length)) return
      // Background tabs can lose their decoded video surface. Seek to the same
      // position after the tab is painted again, without playing or reloading it.
      repaintSeek = { media, time: media.currentTime }
      media.currentTime = media.currentTime
    })
  }

  function publish(seek = false) {
    const media = video.value
    if (!media || !active.value || !visible.value || role.value !== 'presenter' || !source()) return
    send?.({ ...key(), type: 'playback', time: media.currentTime, paused: media.paused,
      rate: media.playbackRate, sentAt: Date.now(), seek })
  }

  function report(blockedPlayback: boolean) {
    blocked = blockedPlayback
    const mediaKey = key()
    if (blockedPlayback) mediaPlaybackIssue.value = { ...mediaKey, retry: () => { if (pending) apply(pending) } }
    else if (mediaPlaybackIssue.value?.source === mediaKey.source) mediaPlaybackIssue.value = undefined
    send?.({ ...mediaKey, type: 'status', blocked: blockedPlayback })
  }

  function apply(message: Extract<MediaSyncMessage, { type: 'playback' }>) {
    const media = video.value
    if (!media || !active.value || !visible.value || role.value !== 'slide') return
    pending = message
    if (message.paused) media.pause()
    // Metadata can arrive after a remote Play or seek. Retry then, preserving the command.
    if (!media.readyState) {
      if ((!message.paused || message.time > 0) && !metadataRequested) {
        metadataRequested = true
        media.load()
      }
      return
    }
    const elapsed = message.paused ? 0 : Math.max(0, Date.now() - message.sentAt) / 1000 * message.rate
    const time = Math.min(Number.isFinite(media.duration) ? media.duration : Infinity, message.time + elapsed)
    media.playbackRate = message.rate
    if (Math.abs(media.currentTime - time) > (message.seek ? 0.01 : 0.75)) media.currentTime = time
    if (message.paused) {
      if (blocked) report(false)
    } else if (media.paused && !playPending) {
      playPending = true
      void media.play().then(() => {
        if (video.value === media && active.value && pending && !pending.paused) report(false)
      }).catch(error => {
        if (error.name !== 'AbortError' && video.value === media && active.value && pending && !pending.paused) report(true)
      }).finally(() => { playPending = false })
    }
  }

  const pause = () => {
    cancelRepaint()
    video.value?.pause()
    if (blocked) report(false)
    pending = undefined
    blocked = false
    onLeave?.()
  }

  const connection = context && ['slide', 'presenter'].includes(role.value || '')
    ? connectPresenterMedia(message => {
      if (!active.value || message.page !== context.$page.value || message.source !== source()) return
      if (message.type === 'ready' && role.value === 'presenter') publish(true)
      if (message.type === 'playback' && Number.isFinite(message.time) && message.time >= 0
        && Number.isFinite(message.rate) && message.rate > 0 && Number.isFinite(message.sentAt)) apply(message)
      if (message.type === 'status' && role.value === 'presenter') {
        if (message.blocked) mediaPlaybackIssue.value = key()
        else if (mediaPlaybackIssue.value?.source === message.source) mediaPlaybackIssue.value = undefined
      }
    }) : undefined
  send = connection?.send

  watch(video, (media, previous, cleanup) => {
    previous?.pause()
    metadataRequested = false
    if (!media || !context) return
    const mediaSource = source()
    // Preloaded slides and the Next preview never participate in playback.
    media.muted = role.value !== 'slide'
    const onControl = (event: Event) => {
      if (event.type === 'seeked' && repaintSeek?.media === media) {
        const restoring = media.paused && Math.abs(media.currentTime - repaintSeek.time) < 0.001
        repaintSeek = undefined
        if (restoring) return
      }
      publish(true)
    }
    const onTime = () => {
      if (media.paused || Date.now() - lastUpdate < 1000) return
      lastUpdate = Date.now()
      publish()
    }
    const onVolume = () => { if (role.value !== 'slide') media.muted = true }
    const onMetadata = () => { if (pending) apply(pending) }
    const onPlay = () => {
      repaintSeek = undefined
      if (!active.value) { media.pause(); return }
      publish(true)
    }
    for (const event of ['pause', 'seeked', 'ratechange']) media.addEventListener(event, onControl)
    media.addEventListener('play', onPlay)
    media.addEventListener('timeupdate', onTime)
    media.addEventListener('volumechange', onVolume)
    media.addEventListener('loadedmetadata', onMetadata)
    cleanup(() => {
      cancelRepaint()
      for (const event of ['pause', 'seeked', 'ratechange']) media.removeEventListener(event, onControl)
      media.removeEventListener('play', onPlay)
      media.removeEventListener('timeupdate', onTime)
      media.removeEventListener('volumechange', onVolume)
      media.removeEventListener('loadedmetadata', onMetadata)
      if (mediaPlaybackIssue.value?.source === mediaSource) mediaPlaybackIssue.value = undefined
      pending = undefined
    })
    if (active.value && role.value === 'slide') send?.({ ...key(), type: 'ready' })
  }, { flush: 'post', immediate: true })

  watch([active, visible], () => {
    if (active.value && visible.value && video.value) {
      restorePausedFrame()
      if (role.value === 'slide') send?.({ ...key(), type: 'ready' })
    }
  })
  watch([nav.currentSlideNo, nav.isPrintMode], pause)
  watch(visible, shown => { if (!shown) pause() })
  onScopeDispose(() => { connection?.close(); pause() })
  return pause
}
