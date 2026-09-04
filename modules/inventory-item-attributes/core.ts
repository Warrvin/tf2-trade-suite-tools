import { respondInMain } from '../../utils/bridge';
import { getItemAttributes, ItemAttributes } from '../../utils/item-attributes';
import { installInventoryWatch } from '../../utils/inventory-watch';
import { INVENTORY_ATTRIBUTES_CHANNEL, InventoryAttributesRequest, InventoryAttributesSnapshot } from './types';

/**
 * MAIN-world наблюдатель за инвентарём на странице
 * steamcommunity.com/profiles|id/<x>/inventory.
 *
 * В отличие от окна оффера (/tradeoffer/*), где Steam сам кладёт ПОЛНЫЕ
 * данные инвентаря в window.g_rgAppContextData ещё до рендера, страница
 * обычного инвентаря подгружает предметы постранично через собственные
 * fetch/XHR-запросы к steamcommunity.com/inventory/<id>/440/2 по мере
 * скролла — никакого готового глобального объекта с ПОЛНЫМИ описаниями
 * (name_color/type/descriptions) тут нет.
 *
 * Сам перехват fetch/XHR (и растущая карта assetId -> предмет) вынесен в
 * utils/inventory-watch.ts — этой же картой пользуется и
 * modules/inventory-currency-counter (требование 4 — не дублировать
 * функционал): оба модуля наблюдают ОДНИ И ТЕ ЖЕ ответы страницы, просто
 * рисуют из них разное (значки атрибутов vs подсчёт валюты). Здесь
 * остаётся только специфика ЭТОГО модуля — превращение SteamEconItem в
 * ItemAttributes и отдача снимка по запросу с ISOLATED-стороны.
 */

function collectAttributes(): InventoryAttributesSnapshot {
  const { itemByAssetId } = installInventoryWatch();
  const result: InventoryAttributesSnapshot = {};
  for (const [assetId, item] of itemByAssetId) {
    result[assetId] = getItemAttributes(item) as ItemAttributes;
  }
  return result;
}

/**
 * Регистрирует обработчик в MAIN world: ставит общий перехват fetch/XHR
 * (если ещё не стоит — installInventoryWatch идемпотентен и общий с
 * inventory-currency-counter, см. её own core.ts) и по запросу с
 * ISOLATED-стороны отдаёт текущий (растущий по мере прокрутки страницы)
 * снимок атрибутов всех виденных предметов.
 */
export function registerInventoryAttributesCoreHandler(): () => void {
  installInventoryWatch();
  return respondInMain<InventoryAttributesRequest, InventoryAttributesSnapshot>(INVENTORY_ATTRIBUTES_CHANNEL, async () =>
    collectAttributes(),
  );
}
