import type { SteamEconItem } from './item-attributes';

/**
 * MAIN-world наблюдатель за БЕТА-версией Steam Market
 * (steamcommunity.com/market/listings/440/*, когда на странице нет
 * window.g_rgAssets — это React SPA, а не классический рендер, см. README
 * §"Известное ограничение"). ЭКСПЕРИМЕНТАЛЬНО.
 *
 * Перенесён из modules/market-item-attributes/ в utils/ (требование 4):
 * ровно то же состояние нужно и modules/market-pricedb-check-button —
 * см. utils/market-item-source.ts, общую точку чтения "сырых" предметов
 * страницы Market для ОБОИХ модулей (по аналогии с тем, как
 * utils/inventory-watch.ts уже общий между inventory-item-attributes и
 * inventory-currency-counter).
 *
 * У беты нет глобали вроде window.g_rgAssets — данные о листингах приходят
 * через собственные fetch-запросы страницы к
 * /market/actions?q=QueryListingsForItem (подтверждено живой проверкой:
 * DevTools/network на реальной странице), точно так же, как страница
 * инвентаря сама подгружает предметы постранично (см. utils/inventory-watch.ts)
 * — тот же приём: наблюдаем ЧУЖИЕ, уже отправленные страницей запросы.
 *
 * НО есть отличие от инвентаря: САМЫЙ ПЕРВЫЙ батч листингов (первые ~20,
 * которые видны сразу при загрузке страницы) НЕ проходит через видимый
 * fetch/XHR вообще — он отрисован на сервере (SSR) и в window.SSR.loaderData
 * лежат только служебные поля (buckets/listingQuery), а НЕ сами листинги.
 * Поэтому первый батч не подсмотреть перехватом — вместо этого делаем ТОТ
 * ЖЕ запрос сами (start:0), с тем же именем предмета, что и текущая
 * страница (из URL) — same-origin, никакого доп. разрешения не требует,
 * подтверждено живым запросом на реальной странице. Последующие батчи
 * (бесконечная подгрузка при скролле) ловятся уже обычным перехватом.
 *
 * ВАЖНАЯ ОГОВОРКА (см. README): у карточки листинга в разметке беты НЕТ
 * НИКАКОГО идентификатора (ни id, ни data-атрибута — только хэшированные
 * CSS-модули). Поэтому это состояние хранит не только assetId -> предмет,
 * но и ОТДЕЛЬНЫЙ растущий массив assetId В ПОРЯДКЕ ПРИХОДА — apply.ts
 * сопоставляет N-ю ещё не размеченную Buy-кнопку с N-м элементом этого
 * массива. Это позиционное сопоставление ("скорее всего тот самый"), а не
 * точное совпадение по id, как во всех остальных модулях — если Valve
 * когда-нибудь перепишет рендер так, что порядок карточек перестанет
 * совпадать с порядком ответа API, сопоставление собьётся.
 */

const QUERY_LISTINGS_URL_RE = /\/market\/actions\?q=QueryListingsForItem/;

interface BetaListingsResponse {
  data?: {
    listings?: Array<{
      asset?: { assetid?: string };
      description?: SteamEconItem;
    }>;
  };
}

export interface MarketBetaWatchState {
  itemByAssetId: Map<string, SteamEconItem>;
  /** assetId в порядке прихода от API — единственный мост к порядку карточек в DOM. */
  orderedAssetIds: string[];
}

const WINDOW_FLAG = '__tf2suiteMarketBetaWatch';

function urlOf(input: RequestInfo | URL): string | null {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return null;
}

/** Текущий предмет по URL страницы листингов — /market/listings/440/<market_hash_name>. */
function currentMarketHashNameFromUrl(): string | null {
  const match = /\/market\/listings\/440\/([^/?#]+)/.exec(location.pathname);
  return match ? decodeURIComponent(match[1]) : null;
}

export function installMarketBetaWatch(): MarketBetaWatchState {
  const win = window as unknown as Record<string, unknown>;
  const existing = win[WINDOW_FLAG] as MarketBetaWatchState | undefined;
  if (existing) return existing;

  const state: MarketBetaWatchState = { itemByAssetId: new Map(), orderedAssetIds: [] };
  win[WINDOW_FLAG] = state;

  function mergeListingsResponse(data: BetaListingsResponse | null | undefined) {
    const listings = data?.data?.listings;
    if (!listings) return;
    for (const listing of listings) {
      const assetId = listing.asset?.assetid;
      if (!assetId || !listing.description) continue;
      if (!state.itemByAssetId.has(assetId)) state.orderedAssetIds.push(assetId);
      state.itemByAssetId.set(assetId, listing.description);
    }
  }

  // Первый батч (see комментарий выше) не проходит через перехват — добираем
  // его собственным same-origin запросом. Лучшая попытка: если формат
  // запроса Valve когда-нибудь поменяет, просто тихо не получим первые ~20
  // листингов (подхватятся следующим скроллом пользователя через перехват
  // ниже) — не критичная ошибка.
  const itemName = currentMarketHashNameFromUrl();
  if (itemName) {
    const qp = JSON.stringify([{ appid: 440, strItemName: itemName, filters: {}, accessoryFilters: {}, propertyFilters: {}, start: 0 }]);
    fetch(`/market/actions?q=QueryListingsForItem&qp=${encodeURIComponent(qp)}`, { credentials: 'include' })
      .then((res) => res.json())
      .then(mergeListingsResponse)
      .catch(() => {});
  }

  const originalFetch = window.fetch;
  window.fetch = function tf2suitePatchedMarketBetaFetch(...args: Parameters<typeof fetch>) {
    const promise = originalFetch.apply(this, args);
    const url = urlOf(args[0]);
    if (url && QUERY_LISTINGS_URL_RE.test(url)) {
      promise
        .then((res) => res.clone().json())
        .then(mergeListingsResponse)
        .catch(() => {});
    }
    return promise;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function tf2suitePatchedMarketBetaOpen(
    this: XMLHttpRequest & { __tf2suiteMarketBetaUrl?: string },
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    this.__tf2suiteMarketBetaUrl = typeof url === 'string' ? url : url.toString();
    // @ts-expect-error — проксируем оригинальную сигнатуру open как есть.
    return originalOpen.call(this, method, url, ...rest);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function tf2suitePatchedMarketBetaSend(
    this: XMLHttpRequest & { __tf2suiteMarketBetaUrl?: string },
    ...args: unknown[]
  ) {
    const url = this.__tf2suiteMarketBetaUrl;
    if (url && QUERY_LISTINGS_URL_RE.test(url)) {
      this.addEventListener('load', () => {
        try {
          mergeListingsResponse(JSON.parse(this.responseText));
        } catch {
          // см. комментарий в fetch-ветке выше.
        }
      });
    }
    // @ts-expect-error — проксируем оригинальную сигнатуру send как есть.
    return originalSend.apply(this, args);
  };

  return state;
}
