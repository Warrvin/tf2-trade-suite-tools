import type { SteamEconItem } from './item-attributes';

/**
 * Общий MAIN-world наблюдатель за постраничными fetch/XHR-запросами страницы
 * инвентаря (steamcommunity.com/inventory/<id>/440/2) — вынесен из
 * modules/inventory-item-attributes/core.ts сюда, потому что ровно то же
 * самое нужно и modules/inventory-currency-counter (требование 4 — не
 * дублировать функционал): оба модуля хотят знать, какие предметы Steam уже
 * показал пользователю на этой вкладке, просто используют это по-разному
 * (значки атрибутов vs подсчёт валюты).
 *
 * ВАЖНО: singleton держится на самом window (WINDOW_FLAG), а не на
 * module-level переменной. Причина: inventory-item-attributes и
 * inventory-currency-counter — это ДВА РАЗНЫХ content-script'а (WXT собирает
 * каждый entrypoint в свой отдельный файл/<script>-тег), у каждого своя
 * копия этого модуля в бандле и, значит, свой собственный module-level
 * scope — обычный "let installed = false" в двух разных бандлах НЕ увидят
 * друг друга и оба патчили бы window.fetch/XHR независимо (не сломалось бы,
 * но патчило бы дважды впустую и завело бы две отдельные карты предметов).
 * window — единственное состояние, которое реально общее для любого
 * количества MAIN-world content-script'ов на одной странице.
 */

const INVENTORY_URL_RE = /\/inventory\/\d+\/440\/2(?:\?|$)/;

/** Одна запись из ответа .../inventory/<id>/440/2 — расширяет SteamEconItem
 *  полями, нужными только чтобы сматчить её с конкретным ассетом. */
interface InventoryResponseDescription extends SteamEconItem {
  classid: string;
  instanceid?: string;
}

interface InventoryResponseAsset {
  classid: string;
  instanceid?: string;
  assetid: string;
  /** Количество (для валюты и т.п. — на практике у ключей/металла Steam
   *  почти всегда кладёт отдельный ассет на каждую единицу, но amount
   *  учитываем на всякий случай, а не считаем 1 жёстко). */
  amount?: string | number;
}

interface InventoryResponse {
  success?: boolean | number;
  assets?: InventoryResponseAsset[];
  descriptions?: InventoryResponseDescription[];
  /** Реальное количество предметов во ВСЁМ инвентаре — приходит уже в
   *  первом ответе, даже если сами предметы ещё подгружаются постранично.
   *  Нужно inventory-currency-counter, чтобы показывать "показано X из Y"
   *  вместо голого "неподтверждённая оценка". */
  total_inventory_count?: number;
}

export interface InventoryWatchState {
  /** assetId -> его описание предмета, копится по мере того как приходят
   *  ответы страницы — только растёт, никогда не очищается (соответствует
   *  тому, что видел сам Steam на этой вкладке за время её жизни). */
  itemByAssetId: Map<string, SteamEconItem>;
  /** amount на каждый assetId (обычно 1) — отдельно от SteamEconItem, т.к.
   *  это свойство АССЕТА (конкретного экземпляра), а не описания предмета
   *  (которое общее на все одинаковые предметы). */
  amountByAssetId: Map<string, number>;
  totalInventoryCount: number | null;
}

const WINDOW_FLAG = '__tf2suiteInventoryWatch';

function urlOf(input: RequestInfo | URL): string | null {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return null;
}

/**
 * Ставит обёртки fetch/XHR ОДИН раз за жизнь страницы (per window — см.
 * комментарий выше) и возвращает растущее состояние. Идемпотентно: какой бы
 * из модулей ни запустился первым, второй просто получит ту же самую
 * структуру вместо повторной установки перехвата.
 */
export function installInventoryWatch(): InventoryWatchState {
  const win = window as unknown as Record<string, unknown>;
  const existing = win[WINDOW_FLAG] as InventoryWatchState | undefined;
  if (existing) return existing;

  const state: InventoryWatchState = {
    itemByAssetId: new Map(),
    amountByAssetId: new Map(),
    totalInventoryCount: null,
  };
  win[WINDOW_FLAG] = state;

  function mergeInventoryResponse(data: InventoryResponse | null | undefined) {
    if (!data || !data.assets || !data.descriptions) return;
    if (typeof data.total_inventory_count === 'number') state.totalInventoryCount = data.total_inventory_count;

    const descByClassInstance = new Map<string, InventoryResponseDescription>();
    for (const desc of data.descriptions) {
      descByClassInstance.set(`${desc.classid}_${desc.instanceid ?? '0'}`, desc);
    }

    for (const asset of data.assets) {
      const desc = descByClassInstance.get(`${asset.classid}_${asset.instanceid ?? '0'}`);
      if (!desc) continue;
      state.itemByAssetId.set(asset.assetid, desc);
      state.amountByAssetId.set(asset.assetid, Number(asset.amount ?? 1));
    }
  }

  const originalFetch = window.fetch;
  window.fetch = function tf2suitePatchedFetch(...args: Parameters<typeof fetch>) {
    const promise = originalFetch.apply(this, args);
    const url = urlOf(args[0]);
    if (url && INVENTORY_URL_RE.test(url)) {
      promise
        .then((res) => res.clone().json())
        .then(mergeInventoryResponse)
        .catch(() => {
          // Ответ не JSON/сеть подвела — не критично, просто не увидим эти
          // предметы; следующий постраничный запрос страницы даст ещё шанс.
        });
    }
    return promise;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function tf2suitePatchedOpen(
    this: XMLHttpRequest & { __tf2suiteUrl?: string },
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    this.__tf2suiteUrl = typeof url === 'string' ? url : url.toString();
    // @ts-expect-error — проксируем оригинальную сигнатуру open как есть.
    return originalOpen.call(this, method, url, ...rest);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function tf2suitePatchedSend(this: XMLHttpRequest & { __tf2suiteUrl?: string }, ...args: unknown[]) {
    const url = this.__tf2suiteUrl;
    if (url && INVENTORY_URL_RE.test(url)) {
      this.addEventListener('load', () => {
        try {
          mergeInventoryResponse(JSON.parse(this.responseText));
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
