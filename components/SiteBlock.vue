<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FeatureModule, SiteGroup } from '../utils/registry';
import { SITE_GROUPS } from '../utils/registry';
import { Locale, t } from '../utils/i18n';
import FeatureToggle from './FeatureToggle.vue';

const props = defineProps<{
  site: SiteGroup;
  modules: FeatureModule[];
  features: Record<string, boolean>;
  locale: Locale;
}>();

const emit = defineEmits<{ (e: 'toggle', id: string, value: boolean): void }>();

const collapsed = ref(false);
const info = computed(() => SITE_GROUPS[props.site]);
const label = computed(() => t(props.locale, info.value.label));
const hint = computed(() => t(props.locale, info.value.hint));
const enabledCount = computed(() => props.modules.filter((m) => props.features[m.id] ?? m.defaultEnabled).length);
</script>

<template>
  <section class="tf2s-block" :style="{ '--site-color': info.color }">
    <header class="tf2s-block__header" @click="collapsed = !collapsed">
      <span class="tf2s-block__icon">{{ info.abbr }}</span>
      <div class="tf2s-block__heading">
        <span class="tf2s-block__title">{{ label }}</span>
        <span class="tf2s-block__hint">{{ hint }}</span>
      </div>
      <span class="tf2s-block__count">{{ enabledCount }} / {{ modules.length }}</span>
      <svg
        class="tf2s-block__chevron"
        :class="{ 'tf2s-block__chevron--collapsed': collapsed }"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
      >
        <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </header>
    <div v-show="!collapsed" class="tf2s-block__grid">
      <FeatureToggle
        v-for="mod in modules"
        :key="mod.id"
        :module="mod"
        :enabled="features[mod.id] ?? mod.defaultEnabled"
        :locale="locale"
        @toggle="(value) => emit('toggle', mod.id, value)"
      />
    </div>
  </section>
</template>
