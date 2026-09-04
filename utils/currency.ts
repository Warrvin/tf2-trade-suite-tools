/**
 * Модель "чистой" валюты TF2 (Key / Refined / Reclaimed / Scrap Metal).
 *
 * Изначально здесь было только то, что нужно для ПОДСЧЁТА того, сколько
 * валюты лежит в инвентаре (модуль wallet-summary). Арифметика "как набрать
 * N ref минимум числом предметов" (см. METAL_SCRAP_VALUE/refinedValueToScrap
 * ниже) добавлена, когда до неё дошла очередь — модулю quick-add-items
 * (см. registry.ts), как и планировалось этим комментарием.
 */

export const CURRENCY_DEFINDEX = {
  KEY: 5021,
  REFINED: 5002,
  RECLAIMED: 5001,
  SCRAP: 5000,
} as const;

export type CurrencyKind = 'keys' | 'refined' | 'reclaimed' | 'scrap';

/**
 * Валютные предметы TF2 по их точному market_hash_name.
 *
 * ПОЧЕМУ ПО ИМЕНИ, А НЕ ПО defindex: публичный эндпоинт
 * steamcommunity.com/inventory/<id>/440/2 отдаёт descriptions[].app_data
 * (где лежит def_index) далеко не всегда — на живых ответах он часто
 * попросту отсутствует, и весь подсчёт по defindex тогда молча даёт 0 по
 * всем валютам, хотя предметы есть (это и был баг в первой версии
 * модуля). market_hash_name/name, наоборот, есть в каждом description
 * всегда — тот же приём использует tf2TradingUtils
 * (utils/constants/tf2Economy.js: TF2_CURRENCY_BY_NAME) и подтверждённо
 * работает на реальном инвентаре.
 */
export const CURRENCY_NAMES: Record<string, CurrencyKind> = {
  'Mann Co. Supply Crate Key': 'keys',
  'Refined Metal': 'refined',
  'Reclaimed Metal': 'reclaimed',
  'Scrap Metal': 'scrap',
};

export interface CurrencyCounts {
  keys: number;
  refined: number;
  reclaimed: number;
  scrap: number;
}

export function emptyCurrencyCounts(): CurrencyCounts {
  return { keys: 0, refined: 0, reclaimed: 0, scrap: 0 };
}

/** Определяет валютный "вид" предмета по его market_hash_name/name; null — не валюта. */
export function getCurrencyKindFromName(name: string | undefined | null): CurrencyKind | null {
  if (!name) return null;
  return CURRENCY_NAMES[name] ?? null;
}

/**
 * Определяет валютный "вид" предмета по его defindex; null — не валюта.
 * Используется только как ДОПОЛНИТЕЛЬНАЯ проверка (app_data не всегда
 * присутствует в ответе, см. CURRENCY_NAMES выше) — основной путь это
 * getCurrencyKindFromName.
 */
export function getCurrencyKind(defindex: number): CurrencyKind | null {
  switch (defindex) {
    case CURRENCY_DEFINDEX.KEY:
      return 'keys';
    case CURRENCY_DEFINDEX.REFINED:
      return 'refined';
    case CURRENCY_DEFINDEX.RECLAIMED:
      return 'reclaimed';
    case CURRENCY_DEFINDEX.SCRAP:
      return 'scrap';
    default:
      return null;
  }
}

/**
 * Суммарная стоимость металла (БЕЗ ключей) в единицах scrap.
 * 1 Refined = 9 scrap, 1 Reclaimed = 3 scrap, 1 Scrap = 1 scrap.
 * Используется только для отображения ("≈ X ref"), не для операций с трейдом.
 */
export function metalValueInScrap(counts: Pick<CurrencyCounts, 'refined' | 'reclaimed' | 'scrap'>): number {
  return counts.refined * 9 + counts.reclaimed * 3 + counts.scrap;
}

/**
 * БАГ (исправлено): раньше округляли математически (Math.round) — 2
 * Reclaimed (6 scrap) показывались как "0.67 ref" вместо ожидаемых "0.66
 * ref". Пользователь указал на это явно: в TF2-трейдинге (backpack.tf,
 * scrap.tf и т.д.) стоимость металла в ref принято ОКРУГЛЯТЬ ВНИЗ
 * (усечение, не арифметическое округление) — каждый scrap добавляет ровно
 * "0.11 ref" по нарастающей (1 scrap -> 0.11, 2 -> 0.22, ..., 9 -> 1.00), а
 * не "честную" дробь 1/9 ref, округлённую к ближайшей сотой. Округление
 * вверх/к ближайшему может визуально завысить сумму металла относительно
 * того, что реально лежит в оффере/инвентаре — усечение исключает это.
 */
export function formatMetalScrap(totalScrap: number): string {
  return `${truncateDecimal2(totalScrap / 9)} ref`;
}

/**
 * Усечение (не округление) дробного числа до 2 знаков после запятой — та же
 * логика, что чинит баг в formatMetalScrap выше, но как отдельная НЕ
 * привязанная к единице измерения функция: нужна не только для ref
 * (metal/9), но и напрямую для чисел, которые PriceDB.io уже отдаёт готовыми
 * в ref/keys (modules/trade-item-summary, режим 'priced' — см.
 * utils/pricedb.ts), где делить на 9 не нужно. Общее место, чтобы принцип
 * "никогда не округляем в пользу большего числа" не разъезжался по проекту
 * (требование 4).
 */
export function truncateDecimal2(value: number): string {
  const truncated = Math.floor(value * 100) / 100;
  return Number.isInteger(truncated) ? truncated.toFixed(0) : truncated.toFixed(2);
}

/**
 * Стоимость каждого вида металла в scrap (Refined = 9, Reclaimed = 3, Scrap = 1)
 * — та же лестница, что и в metalValueInScrap выше, но по видам металла
 * отдельно, а не суммой. Нужна modules/quick-add-items/core.ts: набирая
 * "13.33 ref" по кнопке "Добавить металл", нужно знать, СКОЛЬКО именно
 * Refined/Reclaimed/Scrap предметов класть в оффер (от крупного номинала к
 * мелкому — жадный алгоритм, портирован из Steam Trade Offer Enhancer
 * `collectItems`/`getItemsForMetal`).
 */
export const METAL_SCRAP_VALUE: Record<'refined' | 'reclaimed' | 'scrap', number> = {
  refined: 9,
  reclaimed: 3,
  scrap: 1,
};

/** market_hash_name для каждого вида металла — обратная сторона CURRENCY_NAMES. */
export const METAL_NAME_BY_KIND: Record<'refined' | 'reclaimed' | 'scrap', string> = {
  refined: 'Refined Metal',
  reclaimed: 'Reclaimed Metal',
  scrap: 'Scrap Metal',
};

/**
 * Переводит значение в ref (то, что пользователь вводит в поле "amount",
 * например "13.33") в целое число scrap — минимальную неделимую единицу
 * металла в TF2 (1 Refined = 9 scrap). Округление МАТЕМАТИЧЕСКОЕ (не вниз,
 * как в formatMetalScrap/truncateDecimal2 при ОТОБРАЖЕНИИ уже имеющейся
 * суммы) — здесь это ЦЕЛЬ подбора, ближайшее валидное значение к тому, что
 * ввёл пользователь, а не показ уже точно известной величины, так что
 * усечение было бы неверно (тот же выбор округления, что и в оригинале
 * Steam Trade Offer Enhancer, `toScrap`).
 */
export function refinedValueToScrap(refValue: number): number {
  return Math.round(refValue / (1 / 9));
}

/**
 * Компактный текст суммы валюты вида "2 Keys, 3.44 ref" — тот же формат
 * (число + статичная метка "Keys", металл через formatMetalScrap), что уже
 * использует modules/trade-item-summary/panel.ts для своих чипов, но одной
 * строкой без HTML — нужен местам, которым не нужны отдельные чипы с
 * иконками (сейчас — modules/offer-currency-total, компактная сводка на
 * список офферов/историю). `null`, если валюты нет вовсе с обеих сторон —
 * вызывающий код сам решает, что показать вместо суммы (например, число
 * предметов).
 */
export function formatKeysAndScrap(keys: number, metalScrap: number): string | null {
  if (keys <= 0 && metalScrap <= 0) return null;
  const parts: string[] = [];
  if (keys > 0) parts.push(`${keys} Keys`);
  if (metalScrap > 0) parts.push(formatMetalScrap(metalScrap));
  return parts.join(', ');
}
