<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { FEATURE_REGISTRY } from '../../utils/registry';
import { getSettings } from '../../utils/settings';
import { Locale } from '../../utils/i18n';

const features = ref<Record<string, boolean>>({});
const locale = ref<Locale>('ru');
const enabledCount = computed(() => Object.values(features.value).filter(Boolean).length);

const UI = {
  ru: { enabledOf: (n: number, total: number) => `Включено ${n} из ${total} функций.`, openSettings: 'Открыть настройки' },
  en: { enabledOf: (n: number, total: number) => `${n} of ${total} features enabled.`, openSettings: 'Open settings' },
} as const;

const ui = computed(() => UI[locale.value]);

onMounted(async () => {
  const settings = await getSettings();
  features.value = settings.features;
  locale.value = settings.locale;
});

function openOptions() {
  browser.runtime.openOptionsPage();
}
</script>

<template>
  <div class="tf2s-root" style="padding: 16px">
    <div class="tf2s-panel" style="padding: 16px">
      <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px">TF2 Trade Suite Tools</div>
      <p class="tf2s-muted" style="margin: 0 0 12px; font-size: 12px; line-height: 1.5">
        {{ ui.enabledOf(enabledCount, FEATURE_REGISTRY.length) }}
      </p>
      <button class="tf2s-btn tf2s-btn--accent" style="width: 100%" @click="openOptions">
        {{ ui.openSettings }}
      </button>
    </div>
  </div>
</template>
