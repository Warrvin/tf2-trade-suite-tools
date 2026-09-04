import type { CurrencyCounts } from '../../utils/currency';

export const INVENTORY_CURRENCY_CHANNEL = 'tf2suite:inventory-currency-counter';
export const INVENTORY_CURRENCY_FEATURE_ID = 'inventory-currency-counter';

export interface InventoryCurrencyRequest {
  /**
   * false (по умолчанию) — быстрая БЕСПЛАТНАЯ оценка: считает валюту по
   * предметам, которые Steam САМ уже подгрузил на этой вкладке (0
   * дополнительных запросов, см. utils/inventory-watch.ts — общий
   * перехватчик с inventory-item-attributes, требование 4).
   * true (кнопка "Обновить") — авторитетный полный постраничный фетч
   * ВСЕГО инвентаря через utils/inventory-fetch.ts (тот же путь, что
   * использует wallet-summary для окна трейд-оффера).
   */
  forceFullFetch: boolean;
}

export type InventoryCurrencySnapshot =
  | {
      ok: true;
      counts: CurrencyCounts;
      /** true — неполная оценка (часть инвентаря ещё не подгружена Steam'ом
       *  на этой вкладке / полный фетч ещё ни разу не запускали), false —
       *  авторитетные данные (после успешного forceFullFetch). */
      partial: boolean;
      /** Сколько предметов реально учтено в counts (для partial — сколько
       *  Steam успел показать на вкладке; для полного фетча — весь инвентарь). */
      loadedCount: number;
      /** Общий размер инвентаря, если известен (Steam присылает его уже в
       *  первом постраничном ответе) — null, пока ничего не увидели. */
      totalCount: number | null;
    }
  | { ok: false; reason: 'private' | 'network' | 'unknown' };
