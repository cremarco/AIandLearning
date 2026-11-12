import { inject, provide, ref, shallowRef, type ComputedRef, type InjectionKey, type Ref } from 'vue'

export type NarrationPlayback = {
  enabled: ComputedRef<boolean>
  audio: Ref<HTMLAudioElement | undefined>
  playing: Ref<boolean>
}
const key: InjectionKey<NarrationPlayback> = Symbol('narration-playback')

/** Each mounted slide owns its audio clock, including simultaneous previews. */
export function provideNarrationPlayback(enabled: ComputedRef<boolean>) {
  const playback = { enabled, audio: shallowRef<HTMLAudioElement>(), playing: ref(false) }
  provide(key, playback)
  return playback
}

export function useNarrationPlayback() { return inject(key, undefined) }

/** Keep spoken commentary separate from the demonstration on the same slide. */
export function pauseCompetingMedia(container: ParentNode, current: HTMLMediaElement) {
  for (const media of container.querySelectorAll<HTMLMediaElement>('audio,video')) {
    if (media !== current && !media.paused) media.pause()
  }
}
