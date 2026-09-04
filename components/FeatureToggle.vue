<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { FeatureModule } from '../utils/registry';
import { getModule } from '../utils/registry';
import { getModuleOption, setModuleOption } from '../utils/settings';
import { Locale, t } from '../utils/i18n';
import { DEFAULT_ICON_DETAIL_LEVEL, ICON_DETAIL_OPTION_KEY, IconDetailLevel } from '../utils/icon-detail-level';
import { ATTRIBUTES_FEATURE_ID } from '../modules/trade-item-attributes/types';
import { INVENTORY_ATTRIBUTES_FEATURE_ID } from '../modules/inventory-item-attributes/types';
import { MARKET_ATTRIBUTES_FEATURE_ID } from '../modules/market-item-attributes/types';
import { DEFAULT_TRADE_SUMMARY_MODE, TRADE_SUMMARY_FEATURE_ID, TRADE_SUMMARY_MODE_OPTION_KEY, TradeSummaryMode } from '../modules/trade-item-summary/types';
import { SCRAP_ITEM_MODAL_FEATURE_ID } from '../modules/scrap-item-modal/types';
import {
  DEFAULT_SCRAP_MODAL_TRIGGER,
  formatScrapModalTrigger,
  mouseButtonFromCode,
  SCRAP_MODAL_TRIGGER_OPTION_KEY,
  ScrapModalTrigger,
} from '../modules/scrap-item-modal/trigger';

const props = defineProps<{
  module: FeatureModule;
  enabled: boolean;
  locale: Locale;
}>();

const emit = defineEmits<{ (e: 'toggle', value: boolean): void }>();

// Статичные подписи карточки — маленький локальный словарь, тот же паттерн,
// что описан в doc-блоке utils/i18n.ts (не тянем это в общий файл-словарь,
// строки живут рядом с местом использования).
const UI = {
  ru: {
    enable: 'Включить',
    disable: 'Выключить',
    iconDetailLabel: 'Значки spell/killstreak:',
    simple: 'Просто',
    detailed: 'Подробно',
    iconDetailHint:
      '«Просто» — один общий значок (как в Steam TO Enhancer), без ошибок. «Подробно» — конкретный спелл и тир/sheen/killstreaker killstreak-а; для части спеллов (перекраска оружия/следов, 12 видов из ~16) название распознаётся по лучшему известному сопоставлению и может быть неточным — сам факт наличия спелла всегда верен.',
    summaryModeLabel: 'Прочие предметы в оффере:',
    simpleCount: 'Просто число',
    priced: 'С ценами PriceDB.io',
    summaryModeHint:
      '«Просто число» — сколько НЕ-валютных предметов в оффере, без цены, без сети. «С ценами PriceDB.io» — плюс их суммарная оценка (цена продажи с pricedb.io, публичная база без ключа) отдельно в keys и в ref; предметы, которых нет в базе, по-прежнему считаются числом. Валюта (keys/ref/rec/scrap) считается одинаково в обоих режимах.',
    triggerLabel: 'Комбинация активации:',
    recording: 'Нажмите кнопку мыши (можно с Ctrl/Alt/Shift)…',
    record: 'Записать',
    resetTitle: 'Сбросить на среднюю кнопку',
    triggerHint:
      'Жмите «Записать», затем — нужную кнопку мыши (левая/средняя/правая), по желанию зажав Ctrl/Alt/Shift/Cmd — сработает где угодно на странице, необязательно по самой кнопке. Esc — отмена без изменений. Если выбрать левую кнопку БЕЗ модификаторов, обычный клик по предмету на scrap.tf перестанет доходить до самого сайта (открывать аукцион и т.п.) — вместо этого будет открывать это окно.',
    requires: 'Требует:',
  },
  en: {
    enable: 'Enable',
    disable: 'Disable',
    iconDetailLabel: 'Spell/killstreak icons:',
    simple: 'Simple',
    detailed: 'Detailed',
    iconDetailHint:
      '"Simple" — one generic icon (like Steam TO Enhancer), never wrong. "Detailed" — the exact spell and killstreak tier/sheen/killstreaker; for some spells (weapon/footprint recolors, 12 of ~16 kinds) the name is guessed from the closest known match and may be inaccurate — whether a spell is present at all is always correct.',
    summaryModeLabel: 'Other items in the offer:',
    simpleCount: 'Plain count',
    priced: 'With PriceDB.io prices',
    summaryModeHint:
      '"Plain count" — how many non-currency items are in the offer, no price, no network. "With PriceDB.io prices" — plus their combined estimate (sell price from pricedb.io, a public database, no key needed) shown separately in keys and ref; items not in the database still count as a number. Currency (keys/ref/rec/scrap) is counted the same in both modes.',
    triggerLabel: 'Activation combo:',
    recording: 'Press a mouse button (Ctrl/Alt/Shift optional)…',
    record: 'Record',
    resetTitle: 'Reset to middle click',
    triggerHint:
      'Click "Record", then press the mouse button you want (left/middle/right), optionally holding Ctrl/Alt/Shift/Cmd — it works anywhere on the page, not just on this button. Esc cancels without changes. Picking left click WITHOUT modifiers means a normal click on an item on scrap.tf will no longer reach the site itself (open the auction, etc.) — this window opens instead.',
    requires: 'Requires:',
  },
} as const;

const ui = computed(() => UI[props.locale]);
const title = computed(() => t(props.locale, props.module.title));
const description = computed(() => t(props.locale, props.module.description));
const stability = computed(() => (props.module.stability ? t(props.locale, props.module.stability) : null));
const dependsOnTitles = computed(() =>
  (props.module.dependsOn ?? [])
    .map((id) => getModule(id))
    .filter((m): m is FeatureModule => !!m)
    .map((m) => t(props.locale, m.title)),
);

function onChange(event: Event) {
  emit('toggle', (event.target as HTMLInputElement).checked);
}

// Модули с доп. опцией "уровень детализации значков spell/killstreak" — все
// используют один и тот же общий рендерer (utils/item-attribute-render.ts)
// и один и тот же тип опции (utils/icon-detail-level.ts), поэтому переключатель
// здесь один на все, каждый модуль хранит свой выбор отдельно (moduleOptions
// ключуется по id модуля — см. utils/settings.ts). Если у других модулей
// появятся свои опции, стоит обобщить это в отдельный компонент.
const ICON_DETAIL_MODULE_IDS = [ATTRIBUTES_FEATURE_ID, INVENTORY_ATTRIBUTES_FEATURE_ID, MARKET_ATTRIBUTES_FEATURE_ID];
const hasIconDetailOption = ICON_DETAIL_MODULE_IDS.includes(props.module.id);
const iconDetailLevel = ref<IconDetailLevel>(DEFAULT_ICON_DETAIL_LEVEL);

onMounted(async () => {
  if (!hasIconDetailOption) return;
  iconDetailLevel.value = await getModuleOption<IconDetailLevel>(props.module.id, ICON_DETAIL_OPTION_KEY, DEFAULT_ICON_DETAIL_LEVEL);
});

async function setIconDetailLevel(level: IconDetailLevel) {
  iconDetailLevel.value = level;
  await setModuleOption(props.module.id, ICON_DETAIL_OPTION_KEY, level);
}

// Опция режима trade-item-summary ("простой" счётчик прочих предметов vs.
// их суммарная цена по PriceDB.io) — своя опция, не связана с
// ICON_DETAIL_MODULE_IDS выше, поэтому отдельный блок кода, тот же UI-паттерн
// (сегментированный переключатель + подсказка).
const hasSummaryModeOption = props.module.id === TRADE_SUMMARY_FEATURE_ID;
const summaryMode = ref<TradeSummaryMode>(DEFAULT_TRADE_SUMMARY_MODE);

onMounted(async () => {
  if (!hasSummaryModeOption) return;
  summaryMode.value = await getModuleOption<TradeSummaryMode>(props.module.id, TRADE_SUMMARY_MODE_OPTION_KEY, DEFAULT_TRADE_SUMMARY_MODE);
});

async function setSummaryMode(mode: TradeSummaryMode) {
  summaryMode.value = mode;
  await setModuleOption(props.module.id, TRADE_SUMMARY_MODE_OPTION_KEY, mode);
}

// Настраиваемая комбинация активации scrap-item-modal — по прямой просьбе
// пользователя вместо изначально зашитых среднего клика/Ctrl+клика (см.
// modules/scrap-item-modal/trigger.ts за схемой хранения и матчингом на
// стороне content-скрипта). "Записать" вооружает разовые capture-слушатели
// на window — mousedown ловит саму комбинацию (кнопка + текущие
// Ctrl/Alt/Shift/Cmd), contextmenu гасит нативное меню, если записывалась
// именно правая кнопка (иначе меню перекрыло бы результат прямо в момент
// записи). Слушатели на window, а не на самой кнопке "Записать" — так
// работает запись ЛЮБОЙ кнопки где угодно на странице опций, а не только
// клика по этой самой кнопке (что было бы неудобно для, например, правой
// кнопки — по ней тогда всплыло бы контекстное меню прямо над записывающей
// кнопкой).
const hasTriggerOption = props.module.id === SCRAP_ITEM_MODAL_FEATURE_ID;
const trigger = ref<ScrapModalTrigger>(DEFAULT_SCRAP_MODAL_TRIGGER);
const recordingTrigger = ref(false);
let stopRecording: (() => void) | null = null;

onMounted(async () => {
  if (!hasTriggerOption) return;
  trigger.value = await getModuleOption<ScrapModalTrigger>(props.module.id, SCRAP_MODAL_TRIGGER_OPTION_KEY, DEFAULT_SCRAP_MODAL_TRIGGER);
});

onUnmounted(() => stopRecording?.());

function startRecordingTrigger() {
  if (recordingTrigger.value) return;
  recordingTrigger.value = true;

  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next: ScrapModalTrigger = {
      button: mouseButtonFromCode(e.button),
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      meta: e.metaKey,
    };
    trigger.value = next;
    void setModuleOption(props.module.id, SCRAP_MODAL_TRIGGER_OPTION_KEY, next);
    finishRecording();
  };
  const onContextMenu = (e: MouseEvent) => {
    // Записывается правая кнопка — не даём открыться нативному меню поверх
    // результата. Слушатель снимается в finishRecording() ниже вместе с
    // mousedown-обработчиком, поэтому дальше контекстное меню снова работает как обычно.
    e.preventDefault();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finishRecording(); // отмена записи без изменения бинда
  };

  function finishRecording() {
    window.removeEventListener('mousedown', onMouseDown, true);
    window.removeEventListener('contextmenu', onContextMenu, true);
    window.removeEventListener('keydown', onKeyDown, true);
    stopRecording = null;
    recordingTrigger.value = false;
  }

  window.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('contextmenu', onContextMenu, true);
  window.addEventListener('keydown', onKeyDown, true);
  stopRecording = finishRecording;
}

async function resetTrigger() {
  stopRecording?.();
  trigger.value = DEFAULT_SCRAP_MODAL_TRIGGER;
  await setModuleOption(props.module.id, SCRAP_MODAL_TRIGGER_OPTION_KEY, DEFAULT_SCRAP_MODAL_TRIGGER);
}
</script>

<template>
  <div class="tf2s-feature" :class="{ 'tf2s-feature--on': enabled }">
    <div class="tf2s-feature__top">
      <label class="tf2s-switch" :title="props.enabled ? ui.disable : ui.enable">
        <input type="checkbox" :checked="props.enabled" @change="onChange" />
        <span class="tf2s-switch__track"></span>
      </label>
    </div>
    <span class="tf2s-feature__title">{{ title }}</span>
    <p class="tf2s-feature__desc">{{ description }}</p>

    <div v-if="hasIconDetailOption && enabled" class="tf2s-feature__option">
      <span class="tf2s-feature__option-label">{{ ui.iconDetailLabel }}</span>
      <div class="tf2s-segmented">
        <button
          type="button"
          class="tf2s-segmented__btn"
          :class="{ 'tf2s-segmented__btn--active': iconDetailLevel === 'simple' }"
          @click="setIconDetailLevel('simple')"
        >
          {{ ui.simple }}
        </button>
        <button
          type="button"
          class="tf2s-segmented__btn"
          :class="{ 'tf2s-segmented__btn--active': iconDetailLevel === 'detailed' }"
          @click="setIconDetailLevel('detailed')"
        >
          {{ ui.detailed }}
        </button>
      </div>
      <p class="tf2s-feature__option-hint">{{ ui.iconDetailHint }}</p>
    </div>

    <div v-if="hasSummaryModeOption && enabled" class="tf2s-feature__option">
      <span class="tf2s-feature__option-label">{{ ui.summaryModeLabel }}</span>
      <div class="tf2s-segmented">
        <button
          type="button"
          class="tf2s-segmented__btn"
          :class="{ 'tf2s-segmented__btn--active': summaryMode === 'simple' }"
          @click="setSummaryMode('simple')"
        >
          {{ ui.simpleCount }}
        </button>
        <button
          type="button"
          class="tf2s-segmented__btn"
          :class="{ 'tf2s-segmented__btn--active': summaryMode === 'priced' }"
          @click="setSummaryMode('priced')"
        >
          {{ ui.priced }}
        </button>
      </div>
      <p class="tf2s-feature__option-hint">{{ ui.summaryModeHint }}</p>
    </div>

    <div v-if="hasTriggerOption && enabled" class="tf2s-feature__option">
      <span class="tf2s-feature__option-label">{{ ui.triggerLabel }}</span>
      <div class="tf2s-trigger-recorder">
        <span class="tf2s-trigger-recorder__value" :class="{ 'tf2s-trigger-recorder__value--recording': recordingTrigger }">
          {{ recordingTrigger ? ui.recording : formatScrapModalTrigger(trigger, props.locale) }}
        </span>
        <button type="button" class="tf2s-btn" :disabled="recordingTrigger" @click="startRecordingTrigger">{{ ui.record }}</button>
        <button type="button" class="tf2s-btn tf2s-btn--icon" :title="ui.resetTitle" @click="resetTrigger">⟲</button>
      </div>
      <p class="tf2s-feature__option-hint">{{ ui.triggerHint }}</p>
    </div>

    <p v-if="dependsOnTitles.length" class="tf2s-feature__warning">
      <strong>{{ ui.requires }}</strong> {{ dependsOnTitles.join(', ') }}
    </p>
    <p v-if="stability" class="tf2s-feature__warning">{{ stability }}</p>
  </div>
</template>
