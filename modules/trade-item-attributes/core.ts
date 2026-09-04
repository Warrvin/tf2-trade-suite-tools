import { respondInMain } from '../../utils/bridge';
import { getItemAttributes, ItemAttributes, SteamEconItem } from '../../utils/item-attributes';
import { ATTRIBUTES_CHANNEL, AttributesRequest, AttributesSnapshot } from './types';

/** Форма window.g_rgAppContextData / g_rgPartnerAppContextData — то, что Steam
 *  сам кладёт в JS-контекст страницы /tradeoffer/*, уже с полными
 *  descriptions/name_color/type для каждого предмета инвентаря. */
interface SteamAppContextData {
  [appid: string]: {
    rgContexts?: {
      [contextid: string]: {
        inventory?: {
          rgInventory?: Record<string, SteamEconItem>;
        };
      };
    };
  };
}

interface SteamTradeWindow {
  UserYou?: { strSteamId?: string };
  UserThem?: { strSteamId?: string };
  g_rgAppContextData?: SteamAppContextData;
  g_rgPartnerAppContextData?: SteamAppContextData;
}

function collectAttributes(source: SteamAppContextData | undefined): Record<string, ItemAttributes> {
  const rgInventory = source?.['440']?.rgContexts?.['2']?.inventory?.rgInventory;
  const result: Record<string, ItemAttributes> = {};
  if (!rgInventory) return result;

  for (const assetId of Object.keys(rgInventory)) {
    result[assetId] = getItemAttributes(rgInventory[assetId]);
  }
  return result;
}

/**
 * Регистрирует обработчик в MAIN world: по запросу с ISOLATED-стороны
 * читает window.g_rgAppContextData/g_rgPartnerAppContextData (Steam кладёт
 * туда полные данные предметов обеих сторон трейда) и отдаёт готовые
 * атрибуты для каждого предмета сразу — ISOLATED-скрипту останется только
 * сопоставить их с DOM-элементами по id="item440_2_<assetId>".
 *
 * Как и в wallet-summary, здесь НЕ проверяется, включена ли фича — этим
 * занимается только ISOLATED-сторона (см. README §"Архитектура").
 */
export function registerAttributesCoreHandler(): () => void {
  return respondInMain<AttributesRequest, AttributesSnapshot>(ATTRIBUTES_CHANNEL, async () => {
    const win = window as unknown as SteamTradeWindow;
    return {
      meSteamId: win.UserYou?.strSteamId ?? null,
      partnerSteamId: win.UserThem?.strSteamId ?? null,
      me: collectAttributes(win.g_rgAppContextData),
      partner: collectAttributes(win.g_rgPartnerAppContextData),
    };
  });
}
