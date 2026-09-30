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
import { OFFERS_ATTRIBUTES_FEATURE_ID } from '../modules/offers-item-attributes/types';
import { DEFAULT_TRADE_SUMMARY_MODE, TRADE_SUMMARY_FEATURE_ID, TRADE_SUMMARY_MODE_OPTION_KEY, TradeSummaryMode } from '../modules/trade-item-summary/types';
import { DEFAULT_METAL_BUTTON_MODE, METAL_BUTTON_MODE_OPTION_KEY, MetalButtonMode, QUICK_ADD_FEATURE_ID } from '../modules/quick-add-items/types';
import { SCRAP_ITEM_MODAL_FEATURE_ID } from '../modules/scrap-item-modal/types';
import {
  DEFAULT_SCRAP_MODAL_TRIGGER,
  formatScrapModalTrigger,
  mouseButtonFromCode,
  SCRAP_MODAL_TRIGGER_OPTION_KEY,
  ScrapModalTrigger,
} from '../modules/scrap-item-modal/trigger';
import {
  COMMITTED_ITEMS_FEATURE_ID,
  COMMITTED_OPTIONS_KEY,
  CommittedItemsOptions,
  DEFAULT_COMMITTED_ITEMS_OPTIONS,
} from '../modules/trade-committed-items/types';
import { hexToRgba } from '../modules/trade-committed-items/render';

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
    metalModeLabel: 'Кнопка «Металл»:',
    metalModeCombined: 'Металл (по сумме)',
    metalModeSplit: 'Реф / Рек / Скр (по счёту)',
    metalModeHint:
      '«Металл (по сумме)» — одна кнопка, добавляет металл на сумму в ref, жадно разменивая сверху вниз (Refined → Reclaimed → Scrap) — удобно для округлой цены. «Реф / Рек / Скр (по счёту)» — три кнопки вместо одной, каждая добавляет ровно столько штук ОДНОГО номинала металла, сколько введено в поле количества — как кнопка «Ключи», по счёту, а не по стоимости.',
    triggerLabel: 'Комбинация активации:',
    recording: 'Нажмите кнопку мыши (можно с Ctrl/Alt/Shift)…',
    record: 'Записать',
    resetTitle: 'Сбросить на среднюю кнопку',
    triggerHint:
      'Жмите «Записать», затем — нужную кнопку мыши (левая/средняя/правая), по желанию зажав Ctrl/Alt/Shift/Cmd — сработает где угодно на странице, необязательно по самой кнопке. Esc — отмена без изменений. Если выбрать левую кнопку БЕЗ модификаторов, обычный клик по предмету на scrap.tf перестанет доходить до самого сайта (открывать аукцион и т.п.) — вместо этого будет открывать это окно.',
    requires: 'Требует:',
    committedOptionsLabel: 'Отображение занятых предметов:',
    showBadge: 'Значок ⇄ (правый нижний угол)',
    showBorder: 'Цветная рамка',
    showBackground: 'Цветной фон за предметом',
    backgroundOpacity: 'Прозрачность фона:',
    quickAddButtonsLabel: 'Кнопки свободной валюты в Quick Add',
    quickAddButtonsHint: 'Показывать в панели Quick Add кнопки «(своб.)» и меню «Из оффера ▾» для быстрого добавления или клонирования предметов',
    previewLabel: 'Интерактивный предпросмотр тайла:',
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
    metalModeLabel: '"Metal" button:',
    metalModeCombined: 'Metal (by amount)',
    metalModeSplit: 'Ref / Rec / Scr (by count)',
    metalModeHint:
      '"Metal (by amount)" — one button, adds metal worth that many ref, greedily breaking it down top to bottom (Refined → Reclaimed → Scrap) — handy for a round price. "Ref / Rec / Scr (by count)" — three buttons instead of one, each adds exactly that many items of ONE metal denomination — like the "Keys" button, by count rather than value.',
    triggerLabel: 'Activation combo:',
    recording: 'Press a mouse button (Ctrl/Alt/Shift optional)…',
    record: 'Record',
    resetTitle: 'Reset to middle click',
    triggerHint:
      'Click "Record", then press the mouse button you want (left/middle/right), optionally holding Ctrl/Alt/Shift/Cmd — it works anywhere on the page, not just on this button. Esc cancels without changes. Picking left click WITHOUT modifiers means a normal click on an item on scrap.tf will no longer reach the site itself (open the auction, etc.) — this window opens instead.',
    requires: 'Requires:',
    committedOptionsLabel: 'Committed items display:',
    showBadge: '⇄ Badge (bottom-right corner)',
    showBorder: 'Colored border',
    showBackground: 'Colored background behind item',
    backgroundOpacity: 'Background opacity:',
    quickAddButtonsLabel: 'Free currency buttons in Quick Add',
    quickAddButtonsHint: 'Show "(free)" buttons and the "From offer ▾" menu in Quick Add panel for fast adding or duplicating items',
    previewLabel: 'Live tile preview:',
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
const ICON_DETAIL_MODULE_IDS = [
  ATTRIBUTES_FEATURE_ID,
  INVENTORY_ATTRIBUTES_FEATURE_ID,
  MARKET_ATTRIBUTES_FEATURE_ID,
  OFFERS_ATTRIBUTES_FEATURE_ID,
];
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

// Опция режима кнопки «Металл» модуля quick-add-items ('combined' — одна
// кнопка по сумме, 'split' — «Реф»/«Рек»/«Скр» по счёту, см.
// utils/metal-button-mode.ts) — по прямой просьбе пользователя вынесена
// сюда с options-страницы вместо внутрипанельного переключателя (тот же
// UI-паттерн, что и summaryMode выше).
const hasMetalModeOption = props.module.id === QUICK_ADD_FEATURE_ID;
const metalMode = ref<MetalButtonMode>(DEFAULT_METAL_BUTTON_MODE);

onMounted(async () => {
  if (!hasMetalModeOption) return;
  metalMode.value = await getModuleOption<MetalButtonMode>(props.module.id, METAL_BUTTON_MODE_OPTION_KEY, DEFAULT_METAL_BUTTON_MODE);
});

async function setMetalMode(mode: MetalButtonMode) {
  metalMode.value = mode;
  await setModuleOption(props.module.id, METAL_BUTTON_MODE_OPTION_KEY, mode);
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

// Опции отображения занятых предметов (модуль trade-committed-items)
const hasCommittedOptions = props.module.id === COMMITTED_ITEMS_FEATURE_ID;
const committedOptions = ref<CommittedItemsOptions>({ ...DEFAULT_COMMITTED_ITEMS_OPTIONS });

onMounted(async () => {
  if (!hasCommittedOptions) return;
  committedOptions.value = await getModuleOption<CommittedItemsOptions>(
    props.module.id,
    COMMITTED_OPTIONS_KEY,
    DEFAULT_COMMITTED_ITEMS_OPTIONS,
  );
});

async function saveCommittedOptions() {
  await setModuleOption(props.module.id, COMMITTED_OPTIONS_KEY, { ...committedOptions.value });
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

    <div v-if="hasMetalModeOption && enabled" class="tf2s-feature__option">
      <span class="tf2s-feature__option-label">{{ ui.metalModeLabel }}</span>
      <div class="tf2s-segmented">
        <button
          type="button"
          class="tf2s-segmented__btn"
          :class="{ 'tf2s-segmented__btn--active': metalMode === 'combined' }"
          @click="setMetalMode('combined')"
        >
          {{ ui.metalModeCombined }}
        </button>
        <button
          type="button"
          class="tf2s-segmented__btn"
          :class="{ 'tf2s-segmented__btn--active': metalMode === 'split' }"
          @click="setMetalMode('split')"
        >
          {{ ui.metalModeSplit }}
        </button>
      </div>
      <p class="tf2s-feature__option-hint">{{ ui.metalModeHint }}</p>
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

    <div v-if="hasCommittedOptions && enabled" class="tf2s-feature__option">
      <span class="tf2s-feature__option-label">{{ ui.committedOptionsLabel }}</span>
      <div class="tf2s-committed-options">
        <label class="tf2s-committed-option-row">
          <input
            type="checkbox"
            v-model="committedOptions.showBadge"
            @change="saveCommittedOptions"
          />
          <span>{{ ui.showBadge }}</span>
        </label>

        <label class="tf2s-committed-option-row">
          <input
            type="checkbox"
            v-model="committedOptions.showBorder"
            @change="saveCommittedOptions"
          />
          <span>{{ ui.showBorder }}</span>
          <input
            type="color"
            class="tf2s-committed-color-picker"
            v-model="committedOptions.borderColor"
            :disabled="!committedOptions.showBorder"
            @change="saveCommittedOptions"
          />
        </label>

        <label class="tf2s-committed-option-row">
          <input
            type="checkbox"
            v-model="committedOptions.showBackground"
            @change="saveCommittedOptions"
          />
          <span>{{ ui.showBackground }}</span>
          <input
            type="color"
            class="tf2s-committed-color-picker"
            v-model="committedOptions.backgroundColor"
            :disabled="!committedOptions.showBackground"
            @change="saveCommittedOptions"
          />
        </label>

        <div v-if="committedOptions.showBackground" class="tf2s-committed-slider-row">
          <span>{{ ui.backgroundOpacity }}</span>
          <input
            type="range"
            class="tf2s-committed-slider"
            min="0.05"
            max="0.8"
            step="0.05"
            v-model.number="committedOptions.backgroundAlpha"
            @input="saveCommittedOptions"
          />
          <span>{{ Math.round(committedOptions.backgroundAlpha * 100) }}%</span>
        </div>

        <label class="tf2s-committed-option-row" style="margin-top: 6px; border-top: 1px solid var(--tf2s-border, rgba(255,255,255,0.06)); padding-top: 8px;">
          <input
            type="checkbox"
            v-model="committedOptions.enableQuickAddButtons"
            @change="saveCommittedOptions"
          />
          <span>{{ ui.quickAddButtonsLabel }}</span>
        </label>
        <p class="tf2s-feature__option-hint" style="margin-top: -4px;">{{ ui.quickAddButtonsHint }}</p>

        <div class="tf2s-committed-preview-wrapper">
          <span class="tf2s-feature__option-hint">{{ ui.previewLabel }}</span>
          <div
            class="tf2s-committed-preview-tile"
            :style="{
              boxShadow: committedOptions.showBorder ? `inset 0 0 0 2px ${committedOptions.borderColor}` : 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
              backgroundColor: committedOptions.showBackground ? hexToRgba(committedOptions.backgroundColor, committedOptions.backgroundAlpha) : '#121418',
            }"
          >
            <svg viewBox="0 0 64 64" width="46" height="46" fill="#ffd700">
              <circle cx="20" cy="22" r="12" fill="none" stroke="#ffd700" stroke-width="5"/>
              <rect x="20" y="20" width="36" height="5" rx="2" fill="#ffd700"/>
              <rect x="42" y="25" width="5" height="9" rx="1" fill="#ffd700"/>
              <rect x="50" y="25" width="5" height="6" rx="1" fill="#ffd700"/>
            </svg>
            <span v-if="committedOptions.showBadge" class="tf2s-committed-preview-badge">⇄</span>
          </div>
        </div>
      </div>
    </div>

    <p v-if="dependsOnTitles.length" class="tf2s-feature__warning">
      <strong>{{ ui.requires }}</strong> {{ dependsOnTitles.join(', ') }}
    </p>
    <p v-if="stability" class="tf2s-feature__warning">{{ stability }}</p>
  </div>
</template>
