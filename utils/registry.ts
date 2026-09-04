import type { LocalizedText } from './i18n';

/**
 * Единый реестр всех функций расширения.
 *
 * Это ЕДИНСТВЕННОЕ место, где перечисляются модули — и для options-страницы
 * (тумблеры сгруппированы по `site`), и для settings.ts (дефолтные значения),
 * и как трассируемость: `portedFrom` явно указывает, из какого из трёх
 * изученных проектов портирована функция — чтобы не реализовать одно и то
 * же дважды под разными именами ("не повторять функционал", требование 4).
 * `portedFrom` — только для разработчика: НЕ показывается на странице
 * настроек (по прямой просьбе пользователя убраны индивидуальные плашки
 * источника у каждой функции — общий список проектов теперь один раз внизу
 * страницы настроек, см. entrypoints/options/App.vue).
 *
 * `title`/`description` — двуязычные (см. utils/i18n.ts#LocalizedText),
 * язык выбирает сама options-страница по текущей locale из настроек.
 * Текст сознательно написан для пользователя, а не для разработчика:
 * без внутренних имён query-параметров, названий функций из портируемых
 * проектов и т.п. — что технически ЛЕЖИТ ПОД капотом функции, а не что
 * она "теперь дописывает в ссылку `listing_intent`" — читать в
 * doc-комментариях самого модуля (modules/<id>/core.ts), не здесь.
 *
 * status: 'ready'   — модуль реализован (см. modules/<id>/)
 *         'planned' — только описан здесь, ещё не реализован. Тумблер в
 *                     настройках всё равно работает и сохраняет выбор
 *                     пользователя — когда модуль будет реализован, он
 *                     сразу подхватит уже сохранённое состояние.
 *
 * По прямой просьбе пользователя из реестра УБРАНЫ 10 функций, которые
 * решено не реализовывать (были только 'planned', ни одна не имела кода):
 * stn-shift-select, stn-copy-name, bptf-select-param, bptf-hotkeys,
 * bptf-item-links, bptf-one-click-offer, market-marketplace-links,
 * item-description-toggle, showcase-item-attributes, trade-bot-rep-badge.
 *
 * Той же просьбой чуть позже убраны ещё 4 функции — на тот момент это были
 * ПОСЛЕДНИЕ оставшиеся 'planned'-модули реестра, так что сейчас у ВСЕХ 22
 * функций статус 'ready' (реализованы), 'planned' не осталось вовсе:
 * copy-item-name, inventory-item-links, bptf-profile-links, bptf-keys-total.
 *
 * Если у пользователя в хранилище уже был сохранён тумблер под одним из
 * всех этих 14 убранных id — он просто останется неиспользуемым ключом в
 * `settings.features` (см. utils/settings.ts) и не мешает ничему: реестр
 * ЕДИНСТВЕННЫЙ источник того, что реально показывается и работает.
 */

export type SiteGroup =
  | 'steamTradeOffer'
  | 'steamOffersList'
  | 'steamInventory'
  | 'steamMarket'
  | 'backpackTf'
  | 'scrapTf'
  | 'stnTrading'
  | 'steamProfile';

export type ModuleStatus = 'ready' | 'planned';

export interface FeatureModule {
  id: string;
  site: SiteGroup;
  title: LocalizedText;
  description: LocalizedText;
  defaultEnabled: boolean;
  status: ModuleStatus;
  /** Из какого изученного проекта портирована функция — только для разработчика, см. doc-блок файла. */
  portedFrom: string;
  /**
   * Известное ограничение/нестабильность — показывается отдельным
   * предупреждением на странице настроек (не тем же абзацем, что
   * description, — предупреждение должно быть заметно отдельно). Указано
   * ТОЛЬКО там, где ограничение реальное и подтверждённое (не выдумано "на
   * всякий случай") — см. отдельные комментарии у соответствующих модулей
   * ниже.
   */
  stability?: LocalizedText;
  /**
   * Другие модули, без которых эта функция не имеет смысла/не работает.
   * Механизм подготовлен для options-страницы (см. components/
   * FeatureToggle.vue — рисует предупреждение "Требует: …"), но на
   * сегодняшний день ни у одной функции реестра НЕТ такой жёсткой
   * зависимости от другой — специально проверено (ни один модуль не
   * импортирует код другого модуля, каждый работает независимо от
   * состояния остальных тумблеров, см. README). Поле оставлено пустым
   * намеренно, а не удалено — понадобится, если такая зависимость
   * появится у будущей функции.
   */
  dependsOn?: string[];
}

export interface SiteGroupInfo {
  label: LocalizedText;
  hint: LocalizedText;
  /** Короткая аббревиатура для бейджа в навигации (2-4 символа) — одна и та же на обоих языках. */
  abbr: string;
  /** Акцентный цвет блока — взят из палитры качества предметов TF2 (styles/tokens.css),
   *  чтобы каждый сайт визуально узнавался с первого взгляда в списке настроек. */
  color: string;
}

export const SITE_GROUPS: Record<SiteGroup, SiteGroupInfo> = {
  steamTradeOffer: {
    label: { ru: 'Окно трейд-оффера', en: 'Trade offer window' },
    hint: { ru: 'steamcommunity.com/tradeoffer/*', en: 'steamcommunity.com/tradeoffer/*' },
    abbr: 'TO',
    color: '#cf6a32',
  },
  steamOffersList: {
    label: { ru: 'Список офферов, история, профиль', en: 'Offers list, history, profile' },
    hint: { ru: '/tradeoffers, /tradehistory, витрина профиля', en: '/tradeoffers, /tradehistory, profile showcase' },
    abbr: 'OL',
    color: '#476291',
  },
  steamInventory: {
    label: { ru: 'Инвентарь Steam', en: 'Steam inventory' },
    hint: { ru: '/profiles|id/*/inventory', en: '/profiles|id/*/inventory' },
    abbr: 'INV',
    color: '#4d7455',
  },
  steamMarket: {
    label: { ru: 'Торговая площадка Steam', en: 'Steam Community Market' },
    hint: { ru: '/market/listings/440/*', en: '/market/listings/440/*' },
    abbr: 'MKT',
    color: '#e0b400',
  },
  backpackTf: {
    label: { ru: 'backpack.tf', en: 'backpack.tf' },
    hint: { ru: 'stats, classifieds, профиль · next.backpack.tf', en: 'stats, classifieds, profile · next.backpack.tf' },
    abbr: 'BP',
    color: '#8650ac',
  },
  scrapTf: {
    label: { ru: 'scrap.tf', en: 'scrap.tf' },
    hint: { ru: 'item banking, buy/sell', en: 'item banking, buy/sell' },
    abbr: 'SCR',
    color: '#2fbf91',
  },
  stnTrading: {
    label: { ru: 'stntrading.eu', en: 'stntrading.eu' },
    hint: { ru: 'инвентарь, страница предмета', en: 'inventory, item page' },
    abbr: 'STN',
    color: '#c0392b',
  },
  steamProfile: {
    label: { ru: 'Профиль Steam', en: 'Steam profile' },
    hint: { ru: 'steamcommunity.com/id|profiles/* — главная страница профиля', en: 'steamcommunity.com/id|profiles/* — main profile page' },
    abbr: 'PRF',
    color: '#1a9fff',
  },
};

/** Общая формулировка ограничения PriceDB.io-кнопок, которые ищут цену по
 *  имени предмета (а не по точному SKU с частями/спеллом/шайном) — та же
 *  причина, что документирована в doc-блоках самих модулей
 *  (utils/pricedb.ts, modules/*-pricedb-check-button, stn-item-links,
 *  scrap-item-modal): резолвер PriceDB.io сопоставляет по человеческому
 *  имени, которое не содержит strange part'ы/спеллы/конкретный
 *  sheen/killstreaker — показанная цена усреднённая, не для варианта на
 *  руках у пользователя. Один и тот же текст переиспользуется во всех
 *  четырёх местах (requirement 4 — не дублировать формулировку по кускам).
 */
const PRICEDB_NAME_LOOKUP_CAVEAT: LocalizedText = {
  ru: 'Поиск идёт по названию предмета — цена не учитывает конкретные strange part’ы, спеллы и вариации sheen/killstreaker. Ориентир, а не точная оценка редких вариаций.',
  en: 'The lookup is by item name — the price doesn’t account for specific strange parts, spells, or sheen/killstreaker variations. Use it as a ballpark, not an exact valuation for rare variants.',
};

export const FEATURE_REGISTRY: FeatureModule[] = [
  // ───────────────────────── steamTradeOffer ─────────────────────────
  {
    id: 'wallet-summary',
    site: 'steamTradeOffer',
    title: { ru: 'Сводка валюты в кошельке', en: 'Wallet currency summary' },
    description: {
      ru: 'Показывает, сколько ключей, рефов, рекламированных и скрапов есть у вас и у партнёра во всём инвентаре, а не только в оффере — обновляется по нажатию кнопки.',
      en: 'Shows how many keys, refined, reclaimed and scrap you and your trade partner have in your ENTIRE inventory, not just what’s in the offer — updates on a button click.',
    },
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'новая функция — ни у одного из 3 изученных проектов её нет',
  },
  {
    id: 'quick-add-items',
    site: 'steamTradeOffer',
    title: { ru: 'Быстрое добавление предметов', en: 'Quick item add' },
    description: {
      ru: 'Панель прямо в окне оффера: кнопки «Добавить», «Ключи», «Металл» и «Недавние», плюс быстрая очистка своей или чужой стороны.',
      en: 'A panel inside the trade offer window: Add, Keys, Metal and Recent buttons, plus a one-click way to clear your side or your partner’s.',
    },
    stability: {
      ru: '«Недавние» добавляет предметы по их позиции на странице — если инвентарь только что перезагрузился или отсортирован иначе, может добавить не тот предмет. Всегда проверяйте итоговый список перед отправкой оффера.',
      en: '“Recent” adds items based on their position on the page — if the inventory just reloaded or is sorted differently, it may add the wrong item. Always double-check the final offer before sending it.',
    },
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'Steam Trade Offer Enhancer (juliarose fork, collectItems/addItemsByElements)',
  },
  {
    id: 'trade-item-summary',
    site: 'steamTradeOffer',
    title: { ru: 'Итог по сторонам оффера', en: 'Per-side offer totals' },
    description: {
      ru: 'Под аватаром каждой стороны — сколько ключей и металла (в ref) реально лежит в оффере прямо сейчас, обновляется по мере перетаскивания предметов. Остальные предметы можно показывать просто числом или их суммарной оценкой по ценам PriceDB.io — переключается в настройках функции.',
      en: 'Under each side’s avatar — how many keys and how much metal (in ref) are actually in the offer right now, updating live as items are dragged in. Other items can be shown as a plain count or priced via PriceDB.io — switch the mode in this feature’s settings.',
    },
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'собственная реализация под этот проект (идея — Steam Trade Offer Enhancer/tf2trader, реализация не портирована)',
  },
  {
    id: 'auto-fill-from-listing',
    site: 'steamTradeOffer',
    title: { ru: 'Автозаполнение по ссылке с backpack.tf', en: 'Auto-fill from a backpack.tf link' },
    description: {
      ru: 'Если оффер открыт по ссылке с backpack.tf — сама, без единого клика, добавляет нужный предмет и валюту.',
      en: 'When the trade offer is opened from a backpack.tf link, automatically adds the right item and currency — no clicks needed.',
    },
    stability: {
      ru: 'Точный автоматический выбор предмета работает только для объявлений на продажу — ссылка с backpack.tf для них содержит конкретный предмет партнёра. Для объявлений на покупку предмет ищется по названию в вашем инвентаре: если подходящих предметов несколько (разное качество/тир/spell), расширение не гадает и не добавляет ничего само — вместо этого покажет сообщение, и предмет нужно будет выбрать и добавить вручную.',
      en: 'The exact automatic item pick only works for sell listings — the backpack.tf link for those points to one specific item in your partner’s inventory. For buy listings, the item is matched by name in your own inventory: if several items match (different quality/tier/spell), the extension won’t guess and won’t add anything on its own — it shows a message instead, and you’ll need to pick and add the item yourself.',
    },
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'Steam Trade Offer Enhancer (juliarose fork, urlParams.for_item/listing_intent + addListingPrice)',
  },
  {
    id: 'listing-price-button',
    site: 'steamTradeOffer',
    title: { ru: 'Кнопка «Добавить цену объявления»', en: '“Add listing price” button' },
    description: {
      ru: 'Отдельная кнопка — по клику добавляет в оффер валюту из ссылки backpack.tf. Работает независимо от автозаполнения выше.',
      en: 'A standalone button that adds the currency from a backpack.tf link to the offer on click. Works independently of auto-fill above.',
    },
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'Steam Trade Offer Enhancer (juliarose fork, addListingPrice) — вынесена в отдельный тумблер по просьбе пользователя',
  },
  // 'trade-partner-links' (bp.tf/rep.tf/posts.tf на странице самого оффера)
  // сюда сознательно НЕ включён — по прямой просьбе пользователя убран как
  // дублирующий: та же идея внешних ссылок на пользователя реализована
  // один раз, в другом месте — прямо на самой странице профиля Steam,
  // см. 'steam-profile-links' в самом конце файла (requirement 4, "не
  // повторять функционал"). Там же — причина, почему это удобнее: ссылки
  // на профиль работают для ЛЮБОЙ страницы, где этот профиль потом
  // встретится (оффер, список офферов, где угодно), а не только на самой
  // странице оффера.
  // 'trade-bot-rep-badge' (бейдж репутации бота) сюда больше НЕ включён —
  // по прямой просьбе пользователя убран из реестра, реализовывать не
  // будем (см. doc-блок файла).
  {
    id: 'trade-item-attributes',
    site: 'steamTradeOffer',
    title: { ru: 'Иконки и рамки предметов в оффере', en: 'Item icons & borders in the offer' },
    description: {
      ru: 'Подсвечивает Unusual-эффект, strange-рамку, пунктир у некрафтового предмета и значки spell/strange part/killstreak прямо на иконках предметов в оффере.',
      en: 'Highlights Unusual effects, the Strange border, a dashed outline for non-craftable items, and spell/strange part/killstreak icons right on the item tiles in the offer.',
    },
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'Steam Trade Offer Enhancer (shared.offers.identifiers) + tf2trader',
  },

  // ───────────────────────── steamOffersList ─────────────────────────
  {
    id: 'instant-accept-decline',
    site: 'steamOffersList',
    title: { ru: 'Мгновенные Accept/Decline', en: 'Instant Accept/Decline' },
    description: {
      ru: 'Кнопки «Принять» и «Отклонить» прямо в списке входящих офферов — не нужно открывать каждый оффер отдельно. «Принять» переспросит перед подтверждением.',
      en: 'Accept and Decline buttons right in the list of incoming offers — no need to open each one. “Accept” asks for confirmation first.',
    },
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'tf2trader + tf2TradingUtils (acceptTradeOffers)',
  },
  {
    id: 'decline-all-active',
    site: 'steamOffersList',
    title: { ru: 'Отклонить все офферы разом', en: 'Decline all offers at once' },
    description: {
      ru: 'Одна кнопка над списком — отклоняет сразу все активные входящие офферы (с подтверждением).',
      en: 'One button above the list — declines every active incoming offer at once (with a confirmation prompt).',
    },
    defaultEnabled: false,
    status: 'ready',
    portedFrom: 'Steam Trade Offer Enhancer',
  },
  {
    id: 'offer-item-summary',
    site: 'steamOffersList',
    title: { ru: 'Группировка одинаковых предметов', en: 'Group identical items' },
    description: {
      ru: 'В списке офферов и в истории трейдов одинаковые предметы схлопываются в один со значком ×N вместо длинного повтора.',
      en: 'In the offers list and trade history, identical items collapse into one with a ×N badge instead of a long repeated list.',
    },
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'tf2TradingUtils (groupTradeItems)',
  },
  {
    id: 'offer-currency-total',
    site: 'steamOffersList',
    title: { ru: 'Сумма валюты по офферу', en: 'Currency total per offer' },
    description: {
      ru: 'Показывает итог валюты (или количество предметов, если валюты нет) отдельно для каждой стороны — прямо в списке офферов и в истории.',
      en: 'Shows the currency total (or item count, if there’s no currency) for each side — right in the offers list and trade history.',
    },
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'tf2TradingUtils (tradeOfferCurrency)',
  },
  // 'profile-links' (bp.tf/rep.tf/posts.tf/steamdb.info/liquid.tf в списках
  // офферов) сюда тоже сознательно НЕ включён — та же причина, что и у
  // 'trade-partner-links' выше: заменён на 'steam-profile-links' на самой
  // странице профиля (requirement 4).
  // 'showcase-item-attributes' сюда больше НЕ включён — по прямой просьбе
  // пользователя убран из реестра, реализовывать не будем (см. doc-блок
  // файла).

  // ───────────────────────── steamInventory ─────────────────────────
  {
    id: 'inventory-item-attributes',
    site: 'steamInventory',
    title: { ru: 'Атрибуты предметов в инвентаре', en: 'Item attributes in your inventory' },
    description: {
      ru: 'Тот же движок, что и в оффере: Unusual-эффект, strange, некрафт, значки spell/strange part/killstreak — прямо на тайлах вашего инвентаря.',
      en: 'Same engine as in the trade offer window: Unusual effects, Strange, non-craftable, spell/strange part/killstreak icons — right on your inventory tiles.',
    },
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'tf2TradingUtils (inventoryFetchBridge) + Steam TO Enhancer',
  },
  {
    id: 'inventory-currency-counter',
    site: 'steamInventory',
    title: { ru: 'Живой счётчик валюты в инвентаре', en: 'Live currency counter in your inventory' },
    description: {
      ru: 'Количество keys/ref/rec/scrap и общая стоимость встроены прямо в страницу вашего инвентаря — примерная оценка обновляется по мере прокрутки, точный подсчёт — по кнопке.',
      en: 'The count of keys/ref/rec/scrap and the total value are built right into your inventory page — a rough estimate updates as you scroll, an exact count is one button away.',
    },
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'tf2TradingUtils (inventoryCurrencyCounter)',
  },
  // 'item-description-toggle' сюда больше НЕ включён — по прямой просьбе
  // пользователя убран из реестра, реализовывать не будем (см. doc-блок
  // файла).
  // 'copy-item-name' и 'inventory-item-links' сюда больше НЕ включены — по
  // прямой просьбе пользователя убраны из реестра, реализовывать не будем
  // (см. doc-блок файла).
  {
    id: 'pricedb-check-button',
    site: 'steamInventory',
    title: { ru: 'Проверить цену на PriceDB.io', en: 'Check price on PriceDB.io' },
    description: {
      ru: 'Кнопка в панели предмета открывает его страницу на PriceDB.io (или страницу поиска, если точный вариант не нашёлся), чтобы глазами свериться, что цена посчитана для правильного предмета/эффекта.',
      en: 'A button in the item panel opens its page on PriceDB.io (or a search page, if an exact match wasn’t found) so you can double-check the price is for the right item/effect.',
    },
    stability: PRICEDB_NAME_LOOKUP_CAVEAT,
    defaultEnabled: false,
    status: 'ready',
    portedFrom: 'tf2trader (идея), реализация собственная под этот проект',
  },

  // ───────────────────────── steamMarket ─────────────────────────
  {
    id: 'market-item-attributes',
    site: 'steamMarket',
    title: { ru: 'Атрибуты предметов в листингах Market', en: 'Item attributes in Market listings' },
    description: {
      ru: 'Тот же движок, что и в оффере/инвентаре: Unusual, strange, некрафт, значки spell/strange part/killstreak на иконках листингов Steam Market. Работает и на классическом, и на бета-дизайне Market.',
      en: 'Same engine as the offer window and your inventory: Unusual, Strange, non-craftable, spell/strange part/killstreak icons on Steam Market listing icons. Works on both the classic and the beta Market design.',
    },
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'tf2trader (разбор Buy-ссылки, g_rgAssets) + Steam TO Enhancer',
  },
  // 'market-marketplace-links' сюда больше НЕ включён — по прямой просьбе
  // пользователя убран из реестра, реализовывать не будем (см. doc-блок
  // файла).
  {
    id: 'market-pricedb-check-button',
    site: 'steamMarket',
    title: { ru: 'Проверить цену на PriceDB.io', en: 'Check price on PriceDB.io' },
    description: {
      ru: 'Маленькая кнопка «↗» у каждой строки листинга открывает страницу именно этого варианта предмета на PriceDB.io. Нужна отдельно от инвентарной, потому что сам Market показывает одну цену для всех вариантов сразу, не различая эффект/sheen/spell.',
      en: 'A small “↗” button on each listing row opens that exact item’s page on PriceDB.io. Needed separately from the inventory version because Market itself shows one price for every variant, without telling effect/sheen/spell apart.',
    },
    stability: PRICEDB_NAME_LOOKUP_CAVEAT,
    defaultEnabled: false,
    status: 'ready',
    portedFrom: 'собственная реализация под этот проект',
  },

  // ───────────────────────── backpackTf ─────────────────────────
  {
    id: 'bptf-ks-tier-buttons',
    site: 'backpackTf',
    title: { ru: 'Переключение килстрик-тиров', en: 'Killstreak tier switcher' },
    description: {
      ru: 'Кнопки быстрого перехода между No Kit / Killstreak / Specialized / Professional на страницах /stats и /classifieds, плюс фильтр по конкретным Sheen/Killstreaker (только на classic backpack.tf).',
      en: 'Quick-switch buttons between No Kit / Killstreak / Specialized / Professional on /stats and /classifieds pages, plus a filter for specific Sheen/Killstreaker effects (classic backpack.tf only).',
    },
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'tf2TradingUtils (oldUI/addKSButtons)',
  },
  {
    id: 'bptf-filter-special',
    site: 'backpackTf',
    title: { ru: 'Фильтр spells и strange parts в листингах', en: 'Spells & strange parts filter' },
    description: {
      ru: 'Кнопки «Только spells» и «Только strange parts» над списком объявлений — показывают лоты с нужным атрибутом, можно включить обе сразу.',
      en: '“Spells only” and “Strange parts only” buttons above the listings — show only lots with that attribute, both can be on at once.',
    },
    defaultEnabled: false,
    status: 'ready',
    portedFrom: 'tf2TradingUtils (filterSpecialListings, логика инвертирована по просьбе пользователя — показывать только нужное, а не скрывать)',
  },
  // 'bptf-one-click-offer' и 'bptf-item-links' сюда больше НЕ включены — по
  // прямой просьбе пользователя убраны из реестра, реализовывать не будем
  // (см. doc-блок файла).
  // 'bptf-profile-links' и 'bptf-keys-total' сюда больше НЕ включены — по
  // прямой просьбе пользователя убраны из реестра, реализовывать не будем
  // (см. doc-блок файла).
  // 'bptf-hotkeys' и 'bptf-select-param' сюда больше НЕ включены — по
  // прямой просьбе пользователя убраны из реестра, реализовывать не будем
  // (см. doc-блок файла).
  {
    id: 'bptf-listing-trade-params',
    site: 'backpackTf',
    title: { ru: 'Параметры оффера в ссылках листингов', en: 'Trade offer details in listing links' },
    description: {
      ru: 'Дополняет ссылку «Предложить сделку» под объявлением нужными деталями (что за предмет, какая цена), чтобы окно оффера открылось сразу с правильно выставленной валютой.',
      en: 'Fills in the “Make offer” link under a listing with the right details (which item, what price), so the trade offer window opens with the currency already set correctly.',
    },
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'tf2trader (offish/tf2-trader, utils/backpack.ts#processListings)',
  },
  {
    id: 'bptf-price-graph',
    site: 'backpackTf',
    title: { ru: 'График цены PriceDB.io', en: 'PriceDB.io price graph' },
    description: {
      ru: 'Встроенный график цены на странице предмета (/stats), прямо перед списком объявлений — в нативном стиле backpack.tf.',
      en: 'An embedded price graph on the item’s /stats page, placed right before the listings — styled to match backpack.tf’s native look.',
    },
    stability: {
      ru: 'У PriceDB.io есть график не для каждого предмета — если для этой конкретной вариации графика на сайте нет, блок просто не появится.',
      en: 'PriceDB.io doesn’t have a graph for every item — if there isn’t one for this exact variant, the block simply won’t appear.',
    },
    defaultEnabled: false,
    status: 'ready',
    portedFrom: 'tf2trader (offish/tf2-trader, utils/graph.ts#createPricedbGraphIframe — точка вставки и стиль изменены по просьбе пользователя, см. README)',
  },

  // ───────────────────────── scrapTf ─────────────────────────
  // scrap-table-links (ссылки в таблице персонального item banking,
  // #itembanking-list) сюда сознательно НЕ включена — по прямой просьбе
  // пользователя убрана из реестра: страница /bank, на которой она должна
  // была работать, не нашлась у пользователя ("scrap.tf/bank чет найти не
  // могу, в интернете страницы нет"), а без живого HTML этой страницы
  // кодить её означало бы гадать на устаревшем tf2TradingUtils-референсе
  // (см. README) — та же причина, по которой этот проект вообще требует
  // живой DOM перед кодом. Если пользователь позже найдёт эту страницу под
  // другим адресом — функцию можно будет вернуть в реестр.
  // scrap-pricedb-context-menu ("PriceDB.io по правому клику") сюда
  // сознательно НЕ включена — по прямой просьбе пользователя убрана как
  // дублирующая: правая кнопка теперь один из вариантов настраиваемой
  // комбинации активации scrap-item-modal (см. ниже и modules/scrap-item-modal/
  // trigger.ts) — та же самая "PriceDB.io по клику на предмете", только не
  // жёстко на правой кнопке, а на любой, какую выберет пользователь.
  // Отдельный планируемый модуль под ровно ту же цель дублировал бы
  // функционал (requirement 4).
  {
    id: 'scrap-item-modal',
    site: 'scrapTf',
    title: { ru: 'Окошко ссылок по клику на предмет', en: 'Item-click links popup' },
    description: {
      ru: 'Плавающее окошко (можно двигать и менять размер) по настраиваемой комбинации клика на предмет (по умолчанию — средняя кнопка мыши) с кнопкой «Проверить на PriceDB.io» (а оттуда — на Steam Market, backpack.tf и другие). Комбинацию клика можно поменять в настройках функции.',
      en: 'A floating window (movable and resizable) that opens on a customizable click combo over an item (middle-click by default) with a “Check on PriceDB.io” button (and from there — Steam Market, backpack.tf, and more). The click combo can be changed in this feature’s settings.',
    },
    stability: PRICEDB_NAME_LOOKUP_CAVEAT,
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'tf2TradingUtils (scrap.tf/itemLinks) — упрощено до одной ссылки на PriceDB.io вместо 12 у оригинала, см. README',
  },

  // ───────────────────────── stnTrading ─────────────────────────
  // 'stn-copy-name' и 'stn-shift-select' сюда больше НЕ включены — по
  // прямой просьбе пользователя убраны из реестра, реализовывать не будем
  // (см. doc-блок файла).
  {
    id: 'stn-item-links',
    site: 'stnTrading',
    title: { ru: 'Ссылки на предмет', en: 'Item links' },
    description: {
      ru: 'Кнопка «Проверить на PriceDB.io» на странице предмета stntrading.eu (а оттуда — Steam Market, backpack.tf, mannco.store, Skinport, Merchant.tf и другие).',
      en: 'A “Check on PriceDB.io” button on the stntrading.eu item page (and from there — Steam Market, backpack.tf, mannco.store, Skinport, Merchant.tf and more).',
    },
    stability: PRICEDB_NAME_LOOKUP_CAVEAT,
    defaultEnabled: true,
    status: 'ready',
    portedFrom: 'tf2TradingUtils (упрощено — sku через PriceDB.io вместо своей TF2-схемы)',
  },

  // ───────────────────────── steamProfile ─────────────────────────
  // Новая функция, заменяющая собой 'trade-partner-links' и 'profile-links'
  // (см. комментарии в steamTradeOffer/steamOffersList выше) — по прямой
  // просьбе пользователя вместо ссылок на партнёра на странице оффера/в
  // списках офферов сделано один раз, на самой странице профиля Steam,
  // сразу под аватаром пользователя, в родном дизайне Steam (requirement 4).
  {
    id: 'steam-profile-links',
    site: 'steamProfile',
    title: { ru: 'Ссылки и SteamID на профиле', en: 'Profile links & SteamID' },
    description: {
      ru: 'На странице профиля Steam — ссылки на backpack.tf, steamhistory.net (включая бан-историю) и posts.tf этого пользователя, плюс кнопка с SteamID64/SteamID32/SteamID и копированием в один клик.',
      en: 'On the Steam profile page — links to that user’s backpack.tf, steamhistory.net (ban history included) and posts.tf, plus a button with SteamID64/SteamID32/SteamID and one-click copy.',
    },
    defaultEnabled: true,
    status: 'ready',
    portedFrom:
      'новая функция — заменяет trade-partner-links + profile-links (tf2TradingUtils/tf2trader), реализована как единый модуль по прямой просьбе пользователя',
  },
];

export function getModulesBySite(site: SiteGroup): FeatureModule[] {
  return FEATURE_REGISTRY.filter((m) => m.site === site);
}

export function getModule(id: string): FeatureModule | undefined {
  return FEATURE_REGISTRY.find((m) => m.id === id);
}

/** Список источников для общего блока "credits" внизу страницы настроек
 *  (см. entrypoints/options/App.vue) — собран из уникальных портируемых
 *  проектов, встречающихся в portedFrom выше по всему реестру. Здесь, а не
 *  вычислением из FEATURE_REGISTRY на лету — сами portedFrom пишутся
 *  свободным текстом для трассируемости конкретной функции (см. doc-блок
 *  файла) и не являются чистым списком названий проектов, парсить их
 *  программно было бы хрупко.
 */
export const CREDIT_PROJECTS: readonly string[] = [
  'Steam Trade Offer Enhancer (juliarose fork)',
  'tf2trader (offish/tf2-trader)',
  'tf2TradingUtils',
];
