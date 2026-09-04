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
export type QuickAddMode = 'ITEMS' | 'KEYS' | 'METAL' | 'RECENT' | 'CLEAR_ME' | 'CLEAR_THEM';

export interface QuickAddRequest {
  mode: QuickAddMode;
  /** Количество предметов (ITEMS/KEYS/RECENT) или стоимость в ref (METAL). Не используется для CLEAR_*. */
  amount: number;
  /** Индекс, с которого начинать выбор (отрицательный — с конца). Не используется для CLEAR_*. */
  index: number;
  /** Чей инвентарь: true — свой, false — партнёра. Не используется для CLEAR_* (там сторона уже задана самим mode). */
  isYou: boolean | null;
}

export interface QuickAddResponse {
  /**
   * true — запрошенное количество добавлено полностью; false — добавлено
   * частично или не добавлено (не хватило подходящих предметов); null —
   * оффер сейчас нельзя менять (см. canModifyOffer в core.ts) — например,
   * оффер уже отправлен и показывается "Change offer".
   */
  satisfied: boolean | null;
}

export const QUICK_ADD_CHANNEL = 'tf2suite:quick-add-items';
export const QUICK_ADD_FEATURE_ID = 'quick-add-items';
