import type { CurrencyCounts } from '../../utils/currency';

export const TRADE_SUMMARY_CHANNEL = 'tf2suite:trade-item-summary';
export const TRADE_SUMMARY_FEATURE_ID = 'trade-item-summary';

// Режим ('simple' | 'priced') переехал в utils/trade-summary-mode.ts —
// общий формат опции модуля, тот же паттерн, что и IconDetailLevel у
// trade-item-attributes (см. её types.ts). Реэкспорт здесь, чтобы не
// трогать импорты по всему модулю.
export { TRADE_SUMMARY_MODE_OPTION_KEY, DEFAULT_TRADE_SUMMARY_MODE } from '../../utils/trade-summary-mode';
export type { TradeSummaryMode } from '../../utils/trade-summary-mode';

/** Запрос без параметров — MAIN всегда отдаёт снимок по обеим сторонам сразу
 *  (дешёвое синхронное чтение window.g_rgCurrentTradeStatus, не сеть). */
export type TradeSummaryRequest = Record<string, never>;

/** Один "вид" НЕ-валютного предмета с этой стороны — сгруппировано по имени
 *  (см. core.ts), amount — суммарное количество штук этого имени. */
export interface TradeOtherItem {
  /** "Прайсабельное" имя — см. utils/pricedb.ts#buildPriceableName. */
  name: string;
  amount: number;
}

export interface TradeSideSummary {
  /** Валюта (keys/refined/reclaimed/scrap), реально положенная в оффер с этой стороны прямо сейчас. */
  currency: CurrencyCounts;
  /** Кол-во НЕ-валютных предметов с этой стороны — просто счётчик штук (режим 'simple'). */
  otherCount: number;
  /**
   * Те же не-валютные предметы, сгруппированные по имени — источник данных
   * для режима 'priced' (utils/pricedb.ts#priceOtherItems, зовётся УЖЕ на
   * ISOLATED-стороне в panel.ts, не здесь: цену не резолвит сам MAIN —
   * pricedb.io чужой домен, кросс-доменный fetch с обходом CORS доступен
   * только привилегированному content-скрипту, см. комментарий в шапке
   * utils/pricedb.ts).
   */
  otherItems: TradeOtherItem[];
}

export interface TradeSummarySnapshot {
  me: TradeSideSummary;
  partner: TradeSideSummary;
}
