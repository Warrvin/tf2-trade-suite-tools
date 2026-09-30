import { storage } from 'wxt/storage';

export const COMMITTED_OFFERS_STORAGE_KEY = 'local:tf2s_committed_offers';

export interface CommittedOffer {
  offerId: string;
  partnerName: string;
  partnerSteamId: string;
  createdTime: number;
  assetIds: string[];
  economyKeys?: string[];
}

export type CommittedOffersMap = Record<string, CommittedOffer>;

export async function getCommittedOffers(): Promise<CommittedOffersMap> {
  try {
    const data = await storage.getItem<CommittedOffersMap>(COMMITTED_OFFERS_STORAGE_KEY);
    return data ?? {};
  } catch {
    return {};
  }
}

export async function saveCommittedOffers(offers: CommittedOffersMap): Promise<void> {
  try {
    await storage.setItem(COMMITTED_OFFERS_STORAGE_KEY, offers);
  } catch {
    // игнорируем ошибки квоты/storage
  }
}

/**
 * Строит отображение assetId -> список офферов, где этот предмет задействован.
 */
export function buildCommittedAssetMap(offers: CommittedOffersMap): Map<string, CommittedOffer[]> {
  const map = new Map<string, CommittedOffer[]>();
  for (const offer of Object.values(offers)) {
    for (const assetId of offer.assetIds) {
      if (!map.has(assetId)) {
        map.set(assetId, []);
      }
      map.get(assetId)!.push(offer);
    }
  }
  return map;
}

/**
 * Строит отображение economyKey (classinfo/440/classid/instanceid) -> список офферов.
 */
export function buildCommittedEconomyMap(offers: CommittedOffersMap): Map<string, CommittedOffer[]> {
  const map = new Map<string, CommittedOffer[]>();
  for (const offer of Object.values(offers)) {
    for (const key of offer.economyKeys ?? []) {
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(offer);
    }
  }
  return map;
}

/**
 * ClassID стандартных валют Team Fortress 2 (Ключ, Реф, Рек, Скрап).
 * Их НЕЛЬЗЯ сопоставлять слепо по economyKey между разными офферами,
 * так как миллионы рефов имеют одинаковый classinfo/440/2674/0.
 */
export const TF2_CURRENCY_CLASSIDS = new Set(['101785959', '2674', '5564', '2675']);

export function isCurrencyEconomyKey(key: string): boolean {
  for (const cid of TF2_CURRENCY_CLASSIDS) {
    if (key.includes(`/440/${cid}/`)) return true;
  }
  return false;
}

export function isCurrencyClassId(classid: string): boolean {
  return TF2_CURRENCY_CLASSIDS.has(classid);
}

/**
 * Точный поиск JSON-объекта g_rgCurrentTradeStatus методом подсчёта фигурных скобок
 */
function extractTradeStatusJson(html: string): unknown | null {
  const target = 'g_rgCurrentTradeStatus';
  const idx = html.indexOf(target);
  if (idx === -1) return null;

  const firstBrace = html.indexOf('{', idx);
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  let endBrace = -1;

  for (let i = firstBrace; i < html.length; i++) {
    const char = html[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          endBrace = i;
          break;
        }
      }
    }
  }

  if (endBrace === -1) return null;
  try {
    const jsonStr = html.substring(firstBrace, endBrace + 1);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Парсит HTML страницы оффера (steamcommunity.com/tradeoffer/<id>/) для извлечения assetId предметов и имени партнёра.
 */
export function parseTradeOfferHtml(html: string, offerId: string): CommittedOffer | null {
  const assetIdSet = new Set<string>();
  const economyKeySet = new Set<string>();

  // 1. Полноценный JSON-парсинг g_rgCurrentTradeStatus: берем ТОЛЬКО me.assets (наши отдаваемые предметы!)
  const parsedJson = extractTradeStatusJson(html) as {
    me?: { assets?: Array<{ appid: string | number; contextid: string | number; assetid: string }> };
  } | null;

  if (parsedJson?.me?.assets && Array.isArray(parsedJson.me.assets) && parsedJson.me.assets.length > 0) {
    for (const a of parsedJson.me.assets) {
      if (a.assetid) assetIdSet.add(String(a.assetid));
    }
  } else {
    // Резервный поиск assetId ИСКЛЮЧИТЕЛЬНО в секции #your_slots (не захватывая #their_slots!)
    const yourSlotsMatch = html.match(/id=["']your_slots["'][\s\S]*?(?:id=["']their_slots["']|<div class=["']trade_area|$)/i);
    const yourHtml = yourSlotsMatch ? yourSlotsMatch[0] : '';
    const itemMatches = yourHtml.matchAll(/id=["']item440_2_(\d+)["']/g);
    for (const m of itemMatches) {
      assetIdSet.add(m[1]);
    }
  }

  // Извлечение economy-item ключей наших предметов (#your_slots)
  const yourSlotsMatch = html.match(/id=["']your_slots["'][\s\S]*?(?:id=["']their_slots["']|<div class=["']trade_area|$)/i);
  const yourHtml = yourSlotsMatch ? yourSlotsMatch[0] : '';
  const econMatches = yourHtml.matchAll(/data-economy-item=["']([^"']+)["']/g);
  for (const m of econMatches) {
    economyKeySet.add(m[1]);
  }

  // Извлекаем имя партнёра
  let partnerName = 'Трейдер';
  const nameMatch =
    html.match(/<span class="persona[^"]*">([^<]+)<\/span>/) ||
    html.match(/<h1>(?:Trade offer with|Обмен с пользователем)\s+([^<]+)<\/h1>/) ||
    html.match(/You offered\s+([^<]+)\s+a trade/i) ||
    html.match(/Вы предложили пользователю\s+([^<]+)\s+обмен/i);
  if (nameMatch) {
    partnerName = nameMatch[1].trim();
  }

  // Извлекаем SteamID партнёра
  let partnerSteamId = '';
  const partnerMatch =
    html.match(/UserThem\.SetSteamId\(\s*['"](\d+)['"]\s*\)/) ||
    html.match(/g_ulTradePartnerSteamID\s*=\s*['"](\d+)['"]/);
  if (partnerMatch) {
    partnerSteamId = partnerMatch[1];
  }

  return {
    offerId,
    partnerName,
    partnerSteamId,
    createdTime: Date.now(),
    assetIds: Array.from(assetIdSet),
    economyKeys: Array.from(economyKeySet),
  };
}

/**
 * Загружает детали одного активного оффера через same-origin запрос.
 */
export async function fetchOfferDetails(offerId: string): Promise<CommittedOffer | null> {
  try {
    const res = await fetch(`https://steamcommunity.com/tradeoffer/${offerId}/`, {
      credentials: 'same-origin',
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseTradeOfferHtml(html, offerId);
  } catch {
    return null;
  }
}

/**
 * Извлекает имя партнёра из DOM-элемента оффера или заголовка
 */
export function extractPartnerNameFromOfferEl(offerEl: Element): string {
  const header = offerEl.querySelector('.tradeoffer_header');
  if (header) {
    const text = header.textContent?.trim() || '';
    const m = text.match(/(?:You offered|Вы предложили пользователю)\s+([^,]+?)\s+(?:a trade|обмен)/i);
    if (m) return m[1].trim();
  }

  const avatar = offerEl.querySelector('.tradeoffer_partner .persona, .tradeoffer_partner a');
  if (avatar?.textContent?.trim()) {
    return avatar.textContent.trim();
  }

  return 'Трейдер';
}

/**
 * Парсит СТРОГО активные отправленные офферы из DOM или строки HTML страницы /tradeoffers(/sent).
 * Исторические (принятые, отклонённые, отменённые, истекшие) офферы ГАРАНТИРОВАННО игнорируются.
 */
export function parseSentOffersFromDoc(doc: Document | Element): CommittedOffersMap {
  const result: CommittedOffersMap = {};
  const offerElements = doc.querySelectorAll('.tradeoffer');

  for (const offerEl of offerElements) {
    const offerIdMatch = offerEl.id.match(/\d+/);
    if (!offerIdMatch) continue;
    const offerId = offerIdMatch[0];

    // 1. Игнорируем офферы из исторического блока или с классом неактивности
    if (offerEl.closest('.tradeoffers_historical') || offerEl.classList.contains('inactive')) {
      continue;
    }

    // 2. Активный отправленный оффер ОБЯЗАТЕЛЬНО содержит кнопку отмены CancelTradeOffer
    const cancelBtn = offerEl.querySelector('a[href*="CancelTradeOffer"], [onclick*="CancelTradeOffer"]');
    if (!cancelBtn) {
      continue;
    }

    // 3. Проверяем баннер статуса: у активных офферов баннера нет вообще, либо это удержание Steam Escrow
    const banner = offerEl.querySelector('.tradeoffer_items_banner');
    if (banner) {
      const bannerText = (banner.textContent || '').toLowerCase();
      const isProtected = bannerText.includes('trade protected for') || bannerText.includes('удержание предметов');
      if (!isProtected) {
        // Баннер типа "Обмен принят", "Обмен отклонён", "Срок истёк" -> оффер не активен!
        continue;
      }
    }

    // 4. Проверяем, что оффер отправлен нами
    const headerText = offerEl.querySelector('.tradeoffer_header')?.textContent || '';
    const isSent = /You offered|Вы предложили|Items you will offer|Items you offered/i.test(headerText) ||
                   (typeof window !== 'undefined' && window.location.pathname.includes('/sent'));
    if (!isSent) continue;

    const partnerName = extractPartnerNameFromOfferEl(offerEl);

    // Извлекаем предметы со стороны "Вы предложили" (You offered)
    const itemsContainers = offerEl.querySelectorAll('.tradeoffer_items');
    let youOfferedContainer: Element | null = null;

    for (const c of itemsContainers) {
      const h = c.querySelector('.tradeoffer_items_header')?.textContent || '';
      if (/You offered|Вы предложили|Items you will offer|Items you offered|Ваши предметы|Вы отдадите/i.test(h)) {
        youOfferedContainer = c;
        break;
      }
    }
    if (!youOfferedContainer && itemsContainers.length > 0) {
      youOfferedContainer = itemsContainers[0];
    }

    const economyKeys: string[] = [];
    const parsedAssetIds: string[] = [];
    if (youOfferedContainer) {
      const items = youOfferedContainer.querySelectorAll('.trade_item, [data-economy-item]');
      for (const it of items) {
        const key = it.getAttribute('data-economy-item') || it.querySelector('[data-economy-item]')?.getAttribute('data-economy-item');
        if (key) economyKeys.push(key);

        const assetMatch = it.id?.match(/\d+_\d+_(\d+)/) || it.getAttribute('data-assetid');
        if (assetMatch) {
          parsedAssetIds.push(typeof assetMatch === 'string' ? assetMatch : assetMatch[1]);
        } else {
          const onclick = it.getAttribute('onclick') || it.getAttribute('href') || '';
          const hoverMatch = onclick.match(/ShowItemHover\s*\(\s*this,\s*['"](?:item)?\d+_\d+_(\d+)['"]/);
          if (hoverMatch) parsedAssetIds.push(hoverMatch[1]);
        }
      }
    }

    result[offerId] = {
      offerId,
      partnerName,
      partnerSteamId: '',
      createdTime: Date.now(),
      assetIds: parsedAssetIds,
      economyKeys,
    };
  }

  return result;
}

export const STEAM_WEBAPI_TOKEN_STORAGE_KEY = 'local:tf2s_steam_webapi_token';

/**
 * Ищет data-loyalty_webapi_token прямо в DOM страницы или делает запрос к /id/me/edit/info или /my/edit/info
 */
export async function getSteamWebapiToken(): Promise<string | null> {
  if (typeof document !== 'undefined') {
    const appConfig = document.getElementById('application_config');
    if (appConfig) {
      const raw = appConfig.getAttribute('data-loyalty_webapi_token');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'string') {
            await storage.setItem(STEAM_WEBAPI_TOKEN_STORAGE_KEY, parsed);
            return parsed;
          }
        } catch {
          await storage.setItem(STEAM_WEBAPI_TOKEN_STORAGE_KEY, raw);
          return raw;
        }
      }
    }
  }

  try {
    const cached = await storage.getItem<string>(STEAM_WEBAPI_TOKEN_STORAGE_KEY);
    if (cached && typeof cached === 'string' && cached.length > 20) {
      return cached;
    }
  } catch {}

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
    } catch {}
  }

  return null;
}

/**
 * Запрашивает фоновую синхронизацию активных офферов через Background Service Worker (Steam Web API).
 */
export async function requestSyncFromBackground(token?: string): Promise<CommittedOffersMap> {
  const actualToken = token || (await getSteamWebapiToken()) || undefined;

  try {
    const res = (await browser.runtime.sendMessage({
      type: 'SYNC_COMMITTED_OFFERS',
      token: actualToken,
    })) as { success?: boolean; offers?: CommittedOffersMap } | undefined;

    if (res?.success && res.offers) {
      return res.offers;
    }
  } catch (err) {
    console.warn('[TF2Suite] sendMessage SYNC_COMMITTED_OFFERS failed:', err);
  }

  return await getCommittedOffers();
}

let lastSyncTime = 0;
let inFlightSyncPromise: Promise<CommittedOffersMap> | null = null;
const SYNC_COOLDOWN_MS = 60_000;

/**
 * Выполняет синхронизацию активных отправленных офферов:
 * Сначала через Steam Web API через Background Worker, а при недоступности — через same-origin парсинг.
 * Оснащён защитой от спама запросов: кулдаун 60 секунд между сетевыми синкам и дедупликация параллельных вызовов.
 */
export async function syncSentOffersViaNetwork(force = false): Promise<CommittedOffersMap> {
  const now = Date.now();
  if (!force && now - lastSyncTime < SYNC_COOLDOWN_MS) {
    return await getCommittedOffers();
  }

  if (inFlightSyncPromise) {
    return inFlightSyncPromise;
  }

  inFlightSyncPromise = (async () => {
    try {
      // 1. Приоритетный метод: официальный Steam Web API через background worker
      try {
        const apiOffers = await requestSyncFromBackground();
        if (Object.keys(apiOffers).length > 0) {
          lastSyncTime = Date.now();
          return apiOffers;
        }
      } catch {
        // переход к запасному методу
      }

      // 2. Резервный метод: direct same-origin fetch
      try {
        const res = await fetch('https://steamcommunity.com/my/tradeoffers/sent', {
          credentials: 'include',
        });
        if (!res.ok) return await getCommittedOffers();
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const parsedOffers = parseSentOffersFromDoc(doc);

        // Если активных отправленных офферов нет — очищаем хранилище и возвращаем пустоту
        if (Object.keys(parsedOffers).length === 0) {
          await saveCommittedOffers({});
          lastSyncTime = Date.now();
          return {};
        }

        const existing = await getCommittedOffers();
        const result: CommittedOffersMap = {};

        for (const [id, offer] of Object.entries(parsedOffers)) {
          if (existing[id]?.assetIds?.length) {
            offer.assetIds = existing[id].assetIds;
          }
          if (existing[id]?.partnerName && existing[id].partnerName !== 'Трейдер') {
            offer.partnerName = existing[id].partnerName;
          }
          if (existing[id]?.partnerSteamId) {
            offer.partnerSteamId = existing[id].partnerSteamId;
          }

          // Если в оффере есть предметы без точного assetId — догружаем детали оффера
          if (!offer.assetIds || offer.assetIds.length < (offer.economyKeys?.length ?? 1)) {
            try {
              const details = await fetchOfferDetails(id);
              if (details?.assetIds?.length) {
                offer.assetIds = details.assetIds;
                if (details.partnerName && details.partnerName !== 'Трейдер') {
                  offer.partnerName = details.partnerName;
                }
                if (details.partnerSteamId) {
                  offer.partnerSteamId = details.partnerSteamId;
                }
              }
            } catch {}
          }

          result[id] = offer;
        }

        await saveCommittedOffers(result);
        lastSyncTime = Date.now();
        return result;
      } catch {
        return await getCommittedOffers();
      }
    } finally {
      inFlightSyncPromise = null;
    }
  })();

  return inFlightSyncPromise;
}

