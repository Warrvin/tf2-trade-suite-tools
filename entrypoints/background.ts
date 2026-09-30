import { defineBackground } from 'wxt/sandbox';
import { storage } from 'wxt/storage';
import {
  COMMITTED_OFFERS_STORAGE_KEY,
  CommittedOffer,
  CommittedOffersMap,
} from '../utils/committed-offers';

export const STEAM_WEBAPI_TOKEN_STORAGE_KEY = 'local:tf2s_steam_webapi_token';

interface SteamTradeOfferItem {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
  missing?: boolean;
}

interface SteamTradeOfferApi {
  tradeofferid: string;
  accountid_other: number;
  message?: string;
  expiration_time?: number;
  trade_offer_state: number;
  items_to_give?: SteamTradeOfferItem[];
  items_to_receive?: SteamTradeOfferItem[];
  is_our_offer?: boolean;
  time_created?: number;
  time_updated?: number;
}

interface SteamGetTradeOffersResponse {
  response?: {
    trade_offers_sent?: SteamTradeOfferApi[];
    trade_offers_received?: SteamTradeOfferApi[];
  };
}

interface SteamPlayerSummary {
  steamid: string;
  personaname: string;
}

interface SteamGetPlayerSummariesResponse {
  response?: {
    players?: SteamPlayerSummary[];
  };
}

/**
 * Извлекает webApiToken (JWT) со страницы настроек Steam Community или хранилища.
 */
async function fetchSteamWebapiToken(): Promise<string | null> {
  try {
    const cached = await storage.getItem<string>(STEAM_WEBAPI_TOKEN_STORAGE_KEY);
    if (cached && typeof cached === 'string' && cached.length > 20) {
      return cached;
    }
  } catch {
    // игнорируем ошибки хранилища
  }

  const endpoints = [
    'https://steamcommunity.com/id/me/edit/info',
    'https://steamcommunity.com/my/edit/info',
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) continue;
      const html = await res.text();
      const match = html.match(/data-loyalty_webapi_token=["'](?:&quot;)?([a-zA-Z0-9_\-\.]+)(?:&quot;)?["']/);
      if (match && match[1]) {
        const token = match[1];
        await storage.setItem(STEAM_WEBAPI_TOKEN_STORAGE_KEY, token);
        return token;
      }
    } catch {
      // пробуем следующий endpoint
    }
  }

  return null;
}

/**
 * Получает имена игроков по списку SteamID64 через Steam Web API.
 */
async function fetchPlayerSummaries(
  steamIds: string[],
  token: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (steamIds.length === 0) return result;

  try {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?steamids=${encodeURIComponent(
      steamIds.join(','),
    )}&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) return result;
    const data = (await res.json()) as SteamGetPlayerSummariesResponse;
    const players = data.response?.players || [];
    for (const p of players) {
      if (p.steamid && p.personaname) {
        result[p.steamid] = p.personaname;
      }
    }
  } catch (err) {
    console.warn('[TF2Suite Background] Failed to fetch player summaries:', err);
  }

  return result;
}

/**
 * Синхронизирует активные отправленные офферы через официальный Steam Web API (IEconService/GetTradeOffers).
 */
export async function syncCommittedOffersViaWebapi(providedToken?: string): Promise<CommittedOffersMap> {
  let token = providedToken || (await fetchSteamWebapiToken());
  if (!token) {
    console.warn('[TF2Suite Background] No webApiToken available for sync.');
    const existing = await storage.getItem<CommittedOffersMap>(COMMITTED_OFFERS_STORAGE_KEY);
    return existing ?? {};
  }

  let apiUrl = `https://api.steampowered.com/IEconService/GetTradeOffers/v1/?get_sent_offers=1&active_only=0&get_descriptions=1&access_token=${encodeURIComponent(
    token,
  )}`;

  let res: Response;
  try {
    res = await fetch(apiUrl);
  } catch (err) {
    console.warn('[TF2Suite Background] Network error during GetTradeOffers:', err);
    const existing = await storage.getItem<CommittedOffersMap>(COMMITTED_OFFERS_STORAGE_KEY);
    return existing ?? {};
  }

  // Если токен протух (401/403) — сбрасываем кэш и пробуем переполучить токен
  if (res.status === 401 || res.status === 403) {
    await storage.removeItem(STEAM_WEBAPI_TOKEN_STORAGE_KEY);
    const freshToken = await fetchSteamWebapiToken();
    if (freshToken && freshToken !== token) {
      token = freshToken;
      apiUrl = `https://api.steampowered.com/IEconService/GetTradeOffers/v1/?get_sent_offers=1&active_only=0&get_descriptions=1&access_token=${encodeURIComponent(
        token,
      )}`;
      try {
        res = await fetch(apiUrl);
      } catch {
        const existing = await storage.getItem<CommittedOffersMap>(COMMITTED_OFFERS_STORAGE_KEY);
        return existing ?? {};
      }
    }
  }

  if (!res.ok) {
    console.warn(`[TF2Suite Background] GetTradeOffers returned HTTP ${res.status}`);
    const existing = await storage.getItem<CommittedOffersMap>(COMMITTED_OFFERS_STORAGE_KEY);
    return existing ?? {};
  }

  const data = (await res.json()) as SteamGetTradeOffersResponse;
  const rawOffers = data.response?.trade_offers_sent || [];

  // Фильтруем только активные офферы: state 2 (Active), state 9 (CreatedNeedsConfirmation)
  const activeOffers = rawOffers.filter(
    (o) => o.trade_offer_state === 2 || o.trade_offer_state === 9,
  );

  const existingOffers = (await storage.getItem<CommittedOffersMap>(COMMITTED_OFFERS_STORAGE_KEY)) ?? {};
  const partnerSteamIds: string[] = [];

  const offersMap: CommittedOffersMap = {};

  for (const o of activeOffers) {
    const offerId = String(o.tradeofferid);
    const partnerSteamId = String(BigInt('76561197960265728') + BigInt(o.accountid_other));
    partnerSteamIds.push(partnerSteamId);

    const assetIds: string[] = [];
    const economyKeys: string[] = [];

    for (const it of o.items_to_give || []) {
      if (it.assetid) assetIds.push(String(it.assetid));
      if (it.classid) {
        economyKeys.push(`classinfo/${it.appid}/${it.classid}/${it.instanceid || '0'}`);
      }
    }

    const prevOffer = existingOffers[offerId];
    const partnerName = prevOffer?.partnerName && prevOffer.partnerName !== 'Трейдер'
      ? prevOffer.partnerName
      : `Партнёр (${o.accountid_other})`;

    offersMap[offerId] = {
      offerId,
      partnerName,
      partnerSteamId,
      createdTime: o.time_created ? o.time_created * 1000 : Date.now(),
      assetIds,
      economyKeys,
    };
  }

  // Подтягиваем имена партнёров
  if (partnerSteamIds.length > 0 && token) {
    const uniqueIds = Array.from(new Set(partnerSteamIds));
    const personas = await fetchPlayerSummaries(uniqueIds, token);
    for (const offer of Object.values(offersMap)) {
      if (personas[offer.partnerSteamId]) {
        offer.partnerName = personas[offer.partnerSteamId];
      }
    }
  }

  await storage.setItem(COMMITTED_OFFERS_STORAGE_KEY, offersMap);
  return offersMap;
}

export default defineBackground(() => {
  // Обработчик сообщений от контент-скриптов для фоновой синхронизации офферов
  (browser.runtime.onMessage.addListener as any)((message: unknown, _sender: unknown, sendResponse: (res: unknown) => void) => {
    if (typeof message === 'object' && message !== null && 'type' in message) {
      const msg = message as { type: string; token?: string };
      if (msg.type === 'SYNC_COMMITTED_OFFERS') {
        syncCommittedOffersViaWebapi(msg.token)
          .then((offers) => {
            sendResponse({ success: true, offers });
          })
          .catch((err) => {
            sendResponse({ success: false, error: String(err) });
          });
        return true;
      }
      if (msg.type === 'SET_WEBAPI_TOKEN' && msg.token) {
        storage.setItem(STEAM_WEBAPI_TOKEN_STORAGE_KEY, msg.token)
          .then(() => syncCommittedOffersViaWebapi(msg.token))
          .then((offers) => {
            sendResponse({ success: true, offers });
          })
          .catch((err) => {
            sendResponse({ success: false, error: String(err) });
          });
        return true;
      }
    }
    return;
  });
});
