import { ScrapItemAttributes } from './attributes';

/**
 * Изначально реестр (utils/registry.ts) описывал это как 4 отдельные
 * ссылки — Bp Stats / Bp Classifieds / Steam Market / Wiki (уже сокращённый
 * набор относительно оригинала tf2TradingUtils, который строит все 12).
 * По прямой просьбе пользователя сужено ещё раз, тем же приёмом, что и
 * modules/stn-item-links: вместо 4 отдельно построенных ссылок — ОДНА,
 * на PriceDB.io (utils/pricedb.ts — тот же SKU-резолвер, что уже
 * используется pricedb-check-button/market-pricedb-check-button/
 * stn-item-links, ни строчки не продублировано, requirement 4), а сама
 * страница предмета на PriceDB.io уже ссылается на добрый десяток других
 * площадок разом, включая Steam Market и backpack.tf (подтверждено живым
 * запросом при разборе stn-item-links, см. его core.ts).
 *
 * Единственное, что нужно от предмета — его "приайсабельное" имя в
 * формате, который понимает GET sku.pricedb.io/api/name/<имя>: для
 * подавляющего большинства предметов это полное описательное имя (Non-
 * Craftable, качество, killstreak-тир, Festivized, Australium, имя — тем
 * же порядком, что показывает сам Steam), а для Unusual — отдельный
 * формат "<имя эффекта> <имя предмета>" БЕЗ слова "Unusual" (см.
 * buildPriceableName в utils/pricedb.ts, тот же самый резолвер).
 */

const KS_PREFIX: Record<0 | 1 | 2 | 3, string> = {
  0: '',
  1: 'Killstreak ',
  2: 'Specialized Killstreak ',
  3: 'Professional Killstreak ',
};

/** Полное описательное имя без слова качества — Non-Craftable + Festivized + killstreak-тир + (Australium )имя. */
function composeName(attrs: ScrapItemAttributes, includeCraftability: boolean): string {
  const ksPrefix = KS_PREFIX[attrs.ksTier];
  const festivizedPrefix = attrs.festivized ? 'Festivized ' : '';
  const craftabilityPrefix = includeCraftability && !attrs.craftable ? 'Non-Craftable ' : '';
  const baseName = attrs.australium ? `Australium ${attrs.name}` : attrs.name;
  return craftabilityPrefix + festivizedPrefix + ksPrefix + baseName;
}

/**
 * Добавляет слово качества спереди, если его там ещё нет — идемпотентно
 * (проверка startsWith), безопасно вызывать вне зависимости от того,
 * содержит ли имя это слово уже (для Unusual обычно содержит, для
 * Genuine/Strange/Vintage/Collector's — почти никогда, см. attributes.ts,
 * они срезаются при парсинге).
 */
function ensureQualityPrefix(name: string, quality: ScrapItemAttributes['quality']): string {
  if (quality === 'Unique') return name;
  return name.startsWith(`${quality} `) ? name : `${quality} ${name}`;
}

/** Полное отображаемое имя для заголовка виджета (panel.ts). */
export function buildFullDisplayName(attrs: ScrapItemAttributes): string {
  return ensureQualityPrefix(composeName(attrs, true), attrs.quality);
}

/** Имя для sku.pricedb.io/api/name/<имя> — см. шапку файла и utils/pricedb.ts#buildPriceableName. */
export function buildPricedbPriceableName(attrs: ScrapItemAttributes): string {
  if (attrs.quality === 'Unusual' && attrs.effectName) {
    return `${attrs.effectName} ${composeName(attrs, true)}`;
  }
  return buildFullDisplayName(attrs);
}
