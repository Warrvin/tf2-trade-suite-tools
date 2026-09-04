import { CurrencyCounts, emptyCurrencyCounts, getCurrencyKind, getCurrencyKindFromName } from './currency';

/**
 * Читает ПОЛНЫЙ инвентарь TF2 (appid 440, contextid 2) пользователя со
 * страницы steamcommunity.com САМ (не дожидаясь, пока Steam сам отрендерит
 * вкладку инвентаря в DOM трейд-оффера) и тally-ит валютные предметы.
 *
 * Вызывается ТОЛЬКО из MAIN-world контент-скрипта на steamcommunity.com —
 * поэтому это same-origin fetch (страница steamcommunity.com обращается к
 * steamcommunity.com), никакого host_permissions/CORS-обхода не требуется,
 * в отличие от запросов к сторонним price-API.
 */

interface SteamInventoryDescription {
  classid: string;
  instanceid?: string;
  name?: string;
  market_hash_name?: string;
  app_data?: { def_index?: string | number };
}

interface SteamInventoryAsset {
  classid: string;
  instanceid?: string;
  amount?: string | number;
}

interface SteamInventoryResponse {
  success?: boolean | number;
  Error?: string;
  assets?: SteamInventoryAsset[];
  descriptions?: SteamInventoryDescription[];
  more_items?: boolean | number;
  last_assetid?: string;
  total_inventory_count?: number;
}

export type WalletFetchResult =
  | { ok: true; counts: CurrencyCounts; totalItems: number }
  | { ok: false; reason: 'private' | 'network' | 'unknown' };

export async function fetchCurrencyWallet(steamId64: string, opts?: { maxPages?: number }): Promise<WalletFetchResult> {
  const counts = emptyCurrencyCounts();
  let totalItems = 0;
  let startAssetId: string | undefined;
  // 10 страниц × 2000 предметов = до 20 000 предметов на сторону — с большим
  // запасом покрывает даже самые крупные трейд-инвентари.
  const maxPages = opts?.maxPages ?? 10;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`https://steamcommunity.com/inventory/${steamId64}/440/2`);
    url.searchParams.set('l', 'english');
    url.searchParams.set('count', '2000');
    // raw_asset_properties=1 подтверждённо используется в рабочем запросе
    // tf2TradingUtils (inventoryCurrencyCounter) — не мешает name-based
    // сопоставлению ниже, но иногда даёт app_data, используемый как fallback.
    url.searchParams.set('raw_asset_properties', '1');
    if (startAssetId) url.searchParams.set('start_assetid', startAssetId);

    let res: Response;
    try {
      res = await fetch(url.toString(), { credentials: 'include' });
    } catch {
      return { ok: false, reason: 'network' };
    }

    if (res.status === 403) return { ok: false, reason: 'private' };
    if (!res.ok) return { ok: false, reason: 'unknown' };

    const data = (await res.json().catch(() => null)) as SteamInventoryResponse | null;
    if (!data || data.success === false || data.success === 0) {
      const isPrivate = /private/i.test(data?.Error ?? '');
      return { ok: false, reason: isPrivate ? 'private' : 'unknown' };
    }

    const descByKey = new Map<string, SteamInventoryDescription>();
    for (const d of data.descriptions ?? []) {
      descByKey.set(`${d.classid}_${d.instanceid ?? '0'}`, d);
    }

    for (const asset of data.assets ?? []) {
      totalItems++;
      const desc = descByKey.get(`${asset.classid}_${asset.instanceid ?? '0'}`);

      // Основной путь — по имени (всегда присутствует в description).
      // defindex — запасной вариант на случай, если он вдруг есть, а имя
      // почему-то нет (staging-аккаунты со сломанной локализацией и т.п.).
      let kind = getCurrencyKindFromName(desc?.market_hash_name ?? desc?.name);
      if (!kind) {
        const rawDefindex = desc?.app_data?.def_index;
        const defindex = rawDefindex !== undefined ? Number(rawDefindex) : NaN;
        kind = Number.isFinite(defindex) ? getCurrencyKind(defindex) : null;
      }

      if (kind) counts[kind] += Number(asset.amount ?? 1);
    }

    if (!data.more_items || !data.last_assetid) break;
    startAssetId = String(data.last_assetid);
  }

  return { ok: true, counts, totalItems };
}
