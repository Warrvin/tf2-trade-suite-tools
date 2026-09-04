<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { CREDIT_PROJECTS, FEATURE_REGISTRY, SITE_GROUPS, SiteGroup, getModulesBySite } from '../../utils/registry';
import { getSettings, setFeatureEnabled, setLocale, watchSettings } from '../../utils/settings';
import { Locale, LOCALE_LABELS, t } from '../../utils/i18n';
import SiteBlock from '../../components/SiteBlock.vue';

const features = ref<Record<string, boolean>>({});
const locale = ref<Locale>('ru');
let stopWatching: (() => void) | null = null;

const sites = Object.keys(SITE_GROUPS) as SiteGroup[];
const query = ref('');

// Статичные подписи страницы — см. doc-блок utils/i18n.ts за тем, почему
// это маленький локальный словарь прямо тут, а не общий файл на всё
// расширение.
const UI = {
  ru: {
    subtitle: 'Каждая функция включается и выключается независимо. Изменения применяются сразу.',
    enabled: 'включено',
    searchPlaceholder: 'Поиск функции — по названию или описанию…',
    clearSearch: 'Очистить',
    emptyBefore: 'Ничего не найдено по запросу «',
    emptyAfter: '».',
    language: 'Язык',
    creditsBuiltBy: 'Расширение разработал',
    creditsWith: 'с помощью',
    creditsClaudeCode: 'Claude Code',
    creditsBasedOn: 'За основу были взяты наработки проектов:',
  },
  en: {
    subtitle: 'Every feature switches on and off independently. Changes apply immediately.',
    enabled: 'enabled',
    searchPlaceholder: 'Search features — by name or description…',
    clearSearch: 'Clear',
    emptyBefore: 'Nothing found for “',
    emptyAfter: '”.',
    language: 'Language',
    creditsBuiltBy: 'This extension was built by',
    creditsWith: 'with',
    creditsClaudeCode: 'Claude Code',
    creditsBasedOn: 'Built on ideas from these projects:',
  },
} as const;

const ui = computed(() => UI[locale.value]);

// Заголовок вкладки — index.html даёт русский по умолчанию (см. его
// комментарий), тут просто держим его синхронизированным с реальной
// локалью, включая самый первый рендер (ref начинается с 'ru' до того, как
// onMounted успеет прочитать settings.locale — immediate:true покрывает и
// этот момент, не только последующие смены).
const PAGE_TITLE: Record<Locale, string> = { ru: 'TF2 Trade Suite Tools — настройки', en: 'TF2 Trade Suite Tools — Settings' };
watch(locale, (l) => { document.title = PAGE_TITLE[l]; }, { immediate: true });

const totalCount = FEATURE_REGISTRY.length;
const enabledCount = computed(() => Object.values(features.value).filter(Boolean).length);

const modulesBySite = computed(() => {
  const q = query.value.trim().toLowerCase();
  const map = new Map<SiteGroup, ReturnType<typeof getModulesBySite>>();
  for (const site of sites) {
    const all = getModulesBySite(site);
    const filtered = q
      ? all.filter(
          (m) => t(locale.value, m.title).toLowerCase().includes(q) || t(locale.value, m.description).toLowerCase().includes(q),
        )
      : all;
    map.set(site, filtered);
  }
  return map;
});

const visibleSites = computed(() => sites.filter((s) => (modulesBySite.value.get(s)?.length ?? 0) > 0));

onMounted(async () => {
  const settings = await getSettings();
  features.value = settings.features;
  locale.value = settings.locale;
  stopWatching = watchSettings((settings) => {
    features.value = settings.features;
    locale.value = settings.locale;
  });
});

onUnmounted(() => stopWatching?.());

async function onToggle(id: string, value: boolean) {
  // Оптимистичное обновление — UI реагирует мгновенно, а не ждёт round-trip
  // до storage и обратно через watch().
  features.value = { ...features.value, [id]: value };
  await setFeatureEnabled(id, value);
}

async function onLocaleChange(next: Locale) {
  if (next === locale.value) return;
  locale.value = next; // оптимистично, как и onToggle выше
  await setLocale(next);
}

function enabledInSite(site: SiteGroup): number {
  return getModulesBySite(site).filter((m) => features.value[m.id] ?? m.defaultEnabled).length;
}

function scrollToSite(site: SiteGroup) {
  document.getElementById(`site-${site}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>

<template>
  <div class="tf2s-root tf2s-options">
    <div class="tf2s-options__shell">
      <header class="tf2s-options__topbar">
        <div class="tf2s-options__brand">
          <div class="tf2s-options__logo">TF2S</div>
          <div>
            <h1 class="tf2s-options__title">TF2 Trade Suite Tools</h1>
            <p class="tf2s-options__subtitle">{{ ui.subtitle }}</p>
          </div>
        </div>

        <div class="tf2s-options__stats">
          <div class="tf2s-stat">
            <span class="tf2s-stat__value">{{ enabledCount }}<span class="tf2s-stat__of">/{{ totalCount }}</span></span>
            <span class="tf2s-stat__label">{{ ui.enabled }}</span>
          </div>
        </div>

        <div class="tf2s-options__lang">
          <span class="tf2s-options__lang-label">{{ ui.language }}</span>
          <div class="tf2s-segmented">
            <button
              v-for="loc in (['ru', 'en'] as Locale[])"
              :key="loc"
              type="button"
              class="tf2s-segmented__btn"
              :class="{ 'tf2s-segmented__btn--active': locale === loc }"
              @click="onLocaleChange(loc)"
            >
              {{ LOCALE_LABELS[loc] }}
            </button>
          </div>
        </div>
      </header>

      <div class="tf2s-options__search">
        <svg class="tf2s-options__search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5.25" stroke="currentColor" stroke-width="1.5" />
          <path d="M11 11L14.5 14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <input v-model="query" type="text" class="tf2s-options__search-input" :placeholder="ui.searchPlaceholder" />
        <button v-if="query" class="tf2s-options__search-clear" @click="query = ''" :title="ui.clearSearch">✕</button>
      </div>

      <div class="tf2s-options__body">
        <nav class="tf2s-options__nav">
          <button
            v-for="site in sites"
            :key="site"
            class="tf2s-navitem"
            :style="{ '--site-color': SITE_GROUPS[site].color }"
            @click="scrollToSite(site)"
          >
            <span class="tf2s-navitem__icon">{{ SITE_GROUPS[site].abbr }}</span>
            <span class="tf2s-navitem__label">{{ t(locale, SITE_GROUPS[site].label) }}</span>
            <span class="tf2s-navitem__count">{{ enabledInSite(site) }}/{{ getModulesBySite(site).length }}</span>
          </button>
        </nav>

        <main class="tf2s-options__main">
          <SiteBlock
            v-for="site in visibleSites"
            :id="`site-${site}`"
            :key="site"
            :site="site"
            :modules="modulesBySite.get(site) ?? []"
            :features="features"
            :locale="locale"
            @toggle="onToggle"
          />
          <p v-if="visibleSites.length === 0" class="tf2s-options__empty">{{ ui.emptyBefore }}{{ query }}{{ ui.emptyAfter }}</p>
        </main>
      </div>

      <footer class="tf2s-options__footer">
        <p>
          {{ ui.creditsBuiltBy }}
          <a class="tf2s-link" href="https://steamcommunity.com/profiles/76561198038152985/" target="_blank" rel="noopener noreferrer">Warrvin</a>
          {{ ui.creditsWith }} {{ ui.creditsClaudeCode }}.
        </p>
        <p>{{ ui.creditsBasedOn }} {{ CREDIT_PROJECTS.join(', ') }}.</p>
      </footer>
    </div>
  </div>
</template>
