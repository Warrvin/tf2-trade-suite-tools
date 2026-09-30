/**
 * Режим сбора предметов — соответствует кнопкам панели (см. panel.ts) и
 * почти дословно "mode" из Steam Trade Offer Enhancer `collectItems`
 * (см. README §"Модуль `quick-add-items`" за источником и портированной
 * логикой). CLEAR_ME/CLEAR_THEM — отдельное действие (не сбор+добавление,
 * а удаление уже добавленных предметов), но живёт в том же канале/панели,
 * т.к. в оригинале это те же самые кнопки одной панели управления.
 *
 * Режим ID (добавление по списку assetId, был в оригинале) сюда сознательно
 * НЕ включён — по прямой просьбе пользователя убрали как неудобное в
 * использовании поле (см. README §"Модуль `quick-add-items`").
 */
/**
 * REFINED/RECLAIMED/SCRAP — добавлены по прямой просьбе пользователя как
 * альтернатива METAL: тот же список кнопок, но КАЖДАЯ добавляет РОВНО
 * `amount` штук ОДНОГО конкретного номинала металла (как KEYS — по счёту),
 * а не металл суммарной стоимостью `amount` ref жадным разменом сверху
 * вниз (как METAL, см. utils/trade-offer.ts#getItemsForMetal). Показываются
 * панелью ВЗАИМОЗАМЕНЯЕМО с METAL через переключатель режима (см. panel.ts)
 * — либо одна кнопка "Металл", либо эти три, никогда одновременно.
 */
export type QuickAddMode =
  | 'ITEMS'
  | 'KEYS'
  | 'FREE_KEYS'
  | 'METAL'
  | 'FREE_METAL'
  | 'REFINED'
  | 'FREE_REFINED'
  | 'RECLAIMED'
  | 'FREE_RECLAIMED'
  | 'SCRAP'
  | 'FREE_SCRAP'
  | 'FROM_OFFER'
  | 'RECENT'
  | 'CLEAR_ME'
  | 'CLEAR_THEM';

export interface QuickAddRequest {
  mode: QuickAddMode;
  /** Количество предметов (ITEMS/KEYS/RECENT/REFINED/RECLAIMED/SCRAP) или стоимость в ref (METAL). Не используется для CLEAR_*. */
  amount: number;
  /** Индекс, с которого начинать выбор (отрицательный — с конца). Не используется для CLEAR_*. */
  index: number;
  /** Чей инвентарь: true — свой, false — партнёра. Не используется для CLEAR_* (там сторона уже задана самим mode). */
  isYou: boolean | null;
  /** Список assetId занятых предметов (для режимов FREE_*). */
  committedAssetIds?: string[];
  /** Список economyKey занятых предметов (для режимов FREE_*). */
  committedEconomyKeys?: string[];
  /** Точные assetId для добавления (для режима FROM_OFFER). */
  targetAssetIds?: string[];
  /** Точные economyKey для добавления (для режима FROM_OFFER, если assetId ещё не известны). */
  targetEconomyKeys?: string[];
}

export interface QuickAddResponse {
  /**
   * true — запрошенное количество добавлено полностью; false — добавлено
   * частично или не добавлено (не хватило подходящих предметов); null —
   * оффер сейчас нельзя менять (см. canModifyOffer в core.ts) — например,
   * оффер уже отправлен и показывается "Change offer".
   */
  satisfied: boolean | null;
  addedCount?: number;
  wantedCount?: number;
}

export const QUICK_ADD_CHANNEL = 'tf2suite:quick-add-items';
export const QUICK_ADD_FEATURE_ID = 'quick-add-items';

// Режим кнопки «Металл» ('combined' | 'split') переехал в
// utils/metal-button-mode.ts — общий формат опции модуля, тот же паттерн,
// что и TradeSummaryMode у trade-item-summary (см. её types.ts). Реэкспорт
// здесь, чтобы не трогать импорты по остальному модулю/FeatureToggle.vue.
export { METAL_BUTTON_MODE_OPTION_KEY, DEFAULT_METAL_BUTTON_MODE } from '../../utils/metal-button-mode';
export type { MetalButtonMode } from '../../utils/metal-button-mode';
