/**
 * Режим кнопки «Металл» модуля quick-add-items — по прямой просьбе
 * пользователя вынесен из внутрипанельного переключателя на options-
 * страницу, тем же способом, что и остальные "доп. опции конкретного
 * модуля" (см. utils/trade-summary-mode.ts / utils/icon-detail-level.ts —
 * общий тип/дефолт тут, а сам выбор хранится в moduleOptions КОНКРЕТНОГО
 * модуля, см. utils/settings.ts#getModuleOption/setModuleOption):
 *
 *  - 'combined' (по умолчанию) — одна кнопка «Металл»: добавляет металл НА
 *    СУММУ `amount` ref, жадным разменом сверху вниз (Refined → Reclaimed →
 *    Scrap, см. utils/trade-offer.ts#getItemsForMetal) — удобно для
 *    округлой цены сделки.
 *  - 'split' — три кнопки «Реф»/«Рек»/«Скр» вместо одной «Металл»: каждая
 *    добавляет РОВНО `amount` штук ОДНОГО конкретного номинала, по счёту
 *    (см. utils/trade-offer.ts#findMetalByKind), тем же способом, что и
 *    «Ключи» — нужно, когда важно положить в оффер именно N Reclaimed/
 *    Scrap, а не "что-то на такую-то сумму".
 */
export type MetalButtonMode = 'combined' | 'split';
export const METAL_BUTTON_MODE_OPTION_KEY = 'metalButtonMode';
export const DEFAULT_METAL_BUTTON_MODE: MetalButtonMode = 'combined';
