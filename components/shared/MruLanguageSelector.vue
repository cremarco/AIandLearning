<script setup lang="ts">
import { language, setPresentationLanguage, t, type PresentationLanguage } from '../../utils/language'

function choose(next: PresentationLanguage, event: MouseEvent) {
  setPresentationLanguage(next)
  // Pointer selection should leave the deck ready for arrow-key navigation.
  if (event.detail > 0) (event.currentTarget as HTMLButtonElement).blur()
}
</script>

<template>
  <div class="mru-locale-selector" @click.stop @pointerdown.stop @keydown.stop>
    <div class="mru-locale-options" role="group" :aria-label="t('Presentation language')">
      <button class="btn mru-locale-button" type="button" :aria-pressed="language === 'en'" @click="choose('en', $event)">
        <span class="mru-flag-frame" aria-hidden="true">
          <svg class="mru-flag" viewBox="0 0 60 30" width="52" height="26" focusable="false">
            <path fill="#012169" d="M0 0h60v30H0z" />
            <path stroke="#fff" stroke-width="6" d="m0 0 60 30M60 0 0 30" />
            <path stroke="#c8102e" stroke-width="2" d="m0 0 60 30M60 0 0 30" />
            <path stroke="#fff" stroke-width="10" d="M30 0v30M0 15h60" />
            <path stroke="#c8102e" stroke-width="6" d="M30 0v30M0 15h60" />
          </svg>
        </span>
        <span lang="en">English</span>
      </button>
      <button class="btn mru-locale-button" type="button" :aria-pressed="language === 'uk'" @click="choose('uk', $event)">
        <span class="mru-flag-frame" aria-hidden="true">
          <svg class="mru-flag mru-flag-ukraine" viewBox="0 0 66 44" width="44" height="30" focusable="false">
            <path fill="#0057b7" d="M0 4h60v20H0z" />
            <path fill="#ffd700" d="M0 24h60v20H0z" />
            <path class="mru-flag-heart" fill="#e5484d" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" d="M58 14 51.2 7.5C46.5 2.8 53.4-2.2 58 2.8c4.6-5 11.5 0 6.8 4.7Z" />
          </svg>
        </span>
        <span lang="uk">Українська</span>
      </button>
    </div>
    <p class="mru-locale-note">{{ t('Videos and recorded examples remain in English.') }}</p>
  </div>
</template>

<style scoped>
.mru-locale-selector { position:absolute; top:48px; right:64px; z-index:10; width:330px; }
.mru-locale-options { display:flex; gap:10px; }
.slidev-layout .deck-slide .mru-locale-button.btn { display:flex; flex:1; flex-direction:column; gap:8px; height:auto; min-height:82px; padding:12px 14px; border:1px solid var(--deck-control-line); border-radius:8px; background:var(--deck-surface); color:var(--deck-ink); font:inherit; font-size:17px; font-weight:600; line-height:1.2; box-shadow:none; cursor:pointer; }
.slidev-layout .deck-slide .mru-locale-button[aria-pressed="true"] { border-color:var(--deck-cyan); color:var(--deck-cyan); }
.slidev-layout .deck-slide .mru-locale-button:hover { background:var(--deck-paper); border-color:var(--deck-cyan); }
.mru-locale-button:focus-visible { outline:2px solid var(--deck-cyan); outline-offset:4px; }
.mru-flag-frame { display:grid; place-items:center; width:54px; height:32px; }
.mru-flag { display:block; flex:none; }
.mru-flag-ukraine { overflow:visible; }
.slidev-layout .deck-slide .mru-locale-note { margin:10px 0 0; max-width:330px; font-size:13px; line-height:1.4; color:var(--deck-muted); }
@media print { .mru-locale-selector { display:none; } }
</style>
