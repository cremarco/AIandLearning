import { computed, inject, provide, type ComputedRef, type InjectionKey } from 'vue'
import lithuanian from '#deck/lt'
import { language, t, localizeContent, slideCountText } from './language'
import { translateContent } from './translate-content.mjs'

type SlideLocale = 'en' | 'uk' | 'lt'
const dictionary = lithuanian as Record<string, string>
type SlideTranslation = {
  language: ComputedRef<SlideLocale>
  t: (text: string) => string
  localizeContent: <T>(value: T) => T
  slideCountText: (number: number, total: number) => string
}
const key: InjectionKey<SlideTranslation> = Symbol('slide-language')

// A scope for each mounted slide also works in print and presenter previews,
// where English and Lithuanian slides are visible at the same time.
export function provideSlideLanguage(locale: ComputedRef<SlideLocale>) {
  const scoped: SlideTranslation = {
    language: locale,
    t: text => locale.value === 'lt' ? dictionary[text] || text : t(text),
    localizeContent: value => locale.value === 'lt'
      ? translateContent(value, dictionary) : localizeContent(value),
    slideCountText: (number, total) => locale.value === 'lt'
      ? `Skaidrė ${number} iš ${total}` : slideCountText(number, total),
  }
  provide(key, scoped)
  return scoped
}

export function useSlideLanguage(): SlideTranslation {
  return inject(key, { language: computed(() => language.value), t, localizeContent, slideCountText })
}
