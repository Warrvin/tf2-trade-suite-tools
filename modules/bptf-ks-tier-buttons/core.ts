import { KILLSTREAK_WEAPONS_SET } from '../../utils/killstreak-weapons';
import type { Locale } from '../../utils/i18n';

// Подписи самих тиров (No Kit/Killstreak/Specialized/Professional, KS_TIERS
// ниже) и Sheen/Killstreaker (SHEEN_OPTIONS/KILLSTREAKER_OPTIONS) намеренно
// НЕ переведены — это английские игровые термины backpack.tf, те же на
// русской и английской версии расширения (как и в самой игре/на сайте).
// Двуязычным делаем только текст, который добавили мы сами, — выпадашку
// "Эффекты"/"Сбросить"/"Применить".
const UI = {
  ru: { effects: 'Эффекты', reset: 'Сбросить', apply: 'Применить' },
  en: { effects: 'Effects', reset: 'Reset', apply: 'Apply' },
} as const;

/**
 * Кнопки переключения килстрик-тиров (No Kit / Killstreak / Specialized /
 * Professional) на classic backpack.tf — `/stats/*` и `/classifieds*`.
 * Портировано из tf2TradingUtils: backpack.tf/oldUI/addKSButtons/content.js
 * + utils/constants/killstreakWeapons.js (см. utils/killstreak-weapons.ts)
 * + utils/constants/colors.js#KS_TIER_COLORS + utils/itemLinks.js
 * #backpackStatsUrl (только classic-ветка — см. ниже, почему только она) —
 * все четыре файла зачитаны целиком через jsdelivr (github.com напрямую
 * зарезал доступ, см. README).
 *
 * ТОЛЬКО classic backpack.tf, БЕЗ next.backpack.tf — по прямому
 * подтверждению пользователя ("classic"). У oldUI-реализации в самом
 * портируемом проекте тоже нет ветки под next (там отдельный, гораздо более
 * простой модуль newUI/addKSButton, на другом стеке — React-компонент, а
 * не content-скрипт над чужим DOM), так что здесь это не "недоделали", а
 * сознательно совпадающий с оригиналом объём.
 *
 * ГЛАВНОЕ, из-за чего вообще существует этот файл (прямая просьба
 * пользователя): не у каждого предмета в TF2 есть Killstreak Kit — кнопки
 * должны появляться только там, где переключение тиров вообще имеет смысл.
 * KILLSTREAK_WEAPONS_SET (kits.tf pricelist, ~140 голых имён оружия) — это
 * и есть тот самый список; #run() ниже не рисует ничего, если текущий
 * предмет страницы в него не попал.
 *
 * DOM-разметка — живой HTML РЕАЛЬНЫХ страниц пользователя (вставлен целиком
 * в чат), а не предположения по чужому исходнику:
 *   - `/stats/Strange/Rocket%20Launcher/Tradable/Craftable`: внутри
 *     `.stats-header-controls` первым (и на момент проверки — единственным)
 *     div-потомком идёт нативный пикер качества/скина
 *     `.btn-group.btn-group-sm.stats-quality-list` — это и есть `firstDiv`
 *     оригинала, точка вставки нашей строки кнопок сразу после него.
 *   - `/classifieds?item=Rocket%20Launcher&quality=11&...&killstreak_tier=0
 *     &...`: внутри `.panel.panel-main .panel-body` есть `#search-crumbs`
 *     (готовый ряд фильтров-крошек Item/Quality/Tradable/Craftable/
 *     Australium/Killstreak Tier/Spell) — точка вставки нашего
 *     `#ks-tier-nav` сразу после него. `killstreak_tier` подтверждён живым
 *     примером как реальный, рабочий на сегодня query-параметр (виден в
 *     href самой ссылки "Expand" одного из листингов).
 *   - На обеих страницах `#ks-tier-nav`/`.stats-killstreak-list` ещё не
 *     существует — фича действительно не реализована нативно.
 *
 * Без MutationObserver, в отличие от bptf-listing-trade-params: там он
 * нужен из-за AJAX-подгрузки объявлений на classic backpack.tf/stats без
 * перезагрузки страницы (см. его doc-блок) — но сама `.stats-header-
 * controls`/`#search-crumbs` часть разметки статична, отдаётся сразу с
 * сервера при каждой загрузке страницы, а пагинация/смена фильтров на
 * classic backpack.tf/classifieds — обычные переходы по ссылке (полная
 * перезагрузка), не SPA-навигация (см. тот же doc-блок другого модуля).
 * Один проход при старте content-скрипта (WXT — `document_idle` по
 * умолчанию, разметка уже в DOM) — этого достаточно.
 *
 * ДОБАВЛЕНО ПОЗЖЕ, по прямой просьбе пользователя: фильтр по конкретным
 * Sheen/Killstreaker на /classifieds (выпадашка "Эффекты" рядом с кнопками
 * тиров, видна только для Specialized/Professional — у остальных тиров
 * Sheen/Killstreaker просто не существует). Реализовано КАК ЧАСТЬ этого же
 * модуля/тумблера, а не отдельной фичей — та же страница, тот же URL, та же
 * зависимость от текущего тира, заводить второй toggle ради одной выпадашки
 * избыточно.
 *
 * Источник значений — НЕ сторонний проект, а собственная Advanced Search
 * модалка backpack.tf (кнопка "Advanced" рядом с полем поиска на
 * /classifieds, id `open-classifieds-search-modal`) — она рендерится в DOM
 * через JS уже в браузере, поэтому в статичном HTML страницы её нет и
 * угадать разметку по обычному "просмотру кода страницы" было нельзя;
 * пользователь открыл её сам и прислал итоговый HTML модалки. В блоке
 * `#panel-killstreak` этой модалки — ровно то, что нужно: чекбоксы
 * `data-key="sheen"` (value 1..7) и `data-key="killstreaker"`
 * (value 2002..2008), плюс комментарий в их же разметке `<!-- Check for
 * conflicts: no/standard killstreak tier and sheen, specialized killstreak
 * tier and killstreaker -->` — прямое подтверждение игровой механики:
 * Sheen существует только у Specialized/Professional, Killstreaker — только
 * у Professional.
 *
 * Формат URL при нескольких отмеченных значениях — подтверждён 4 живыми
 * примерами от пользователя (открыл модалку, отметил чекбоксы, нажал
 * Confirm, прислал итоговый адрес страницы): значения одного и того же
 * фильтра склеиваются через запятую в ОДНОМ параметре —
 * `&sheen=3,7&killstreaker=2004,2008` (запятая в адресной строке видна как
 * `%2C` — `URLSearchParams` кодирует её точно так же сам, вручную ничего
 * дополнительно кодировать не нужно). Один выбранный вариант — без запятой:
 * `&sheen=3`. Соответствие value → название сверено по тексту тех же
 * чекбоксов: Sheen 1..7 = Team Shine/Deadly Daffodil/Manndarin/Mean
 * Green/Agonizing Emerald/Villainous Violet/Hot Rod; Killstreaker
 * 2002..2008 = Fire Horns/Cerebral Discharge/Tornado/Flames/
 * Singularity/Incinerator/Hypno-Beam.
 *
 * Открытие/закрытие выпадашки — СВОИМ обработчиком клика (класс `.open` на
 * `.btn-group`, снимается кликом вне неё), а не через `data-toggle="dropdown"`
 * их Bootstrap: сам компонент `dropdown.js` нигде живым тестом не
 * подтверждён (подтверждены только `modal`/`collapse` — см. Advanced Search
 * и аккордеон её панелей), а рисковать нерабочей выпадашкой из-за
 * неподтверждённого JS-плагина не стоило. CSS-классы (`btn-group`,
 * `dropdown-menu`, `open`) — их же, встроенные в основной bootstrap.css
 * (в отличие от JS-плагинов, он грузится на странице целиком) — поэтому
 * позиционирование/показ панели отрабатывает без единого своего правила
 * `position`.
 */

const KS_PREFIXES = ['Killstreak ', 'Specialized Killstreak ', 'Professional Killstreak '] as const;

// Цвета — те же, что использует сам backpack.tf для этих тиров в оригинале
// (utils/constants/colors.js#KS_TIER_COLORS), не наша дизайн-система: кнопки
// встраиваются в чужую bootstrap-разметку рядом с их же нативным пикером
// качества, единообразие с их палитрой тут важнее styles/tokens.css (тот же
// довод, что и в styles/stn-item-links.css).
const KS_TIER_COLORS = {
  none: '#000000',
  killstreak: '#5B6060',
  specialized: '#68765C',
  professional: '#B15820',
} as const;

interface KsTierInfo {
  label: string;
  /** Значение query-параметра `killstreak_tier` на /classifieds. */
  classifiedsTier: '0' | '1' | '2' | '3';
  /** Префикс, вшиваемый в имя предмета на /stats (там отдельного поля под тир нет). */
  statsPrefix: string;
  color: string;
}

const KS_TIERS: readonly KsTierInfo[] = [
  { label: 'No Kit', classifiedsTier: '0', statsPrefix: '', color: KS_TIER_COLORS.none },
  { label: 'Normal KS', classifiedsTier: '1', statsPrefix: 'Killstreak ', color: KS_TIER_COLORS.killstreak },
  { label: 'Specialized KS', classifiedsTier: '2', statsPrefix: 'Specialized Killstreak ', color: KS_TIER_COLORS.specialized },
  { label: 'Professional KS', classifiedsTier: '3', statsPrefix: 'Professional Killstreak ', color: KS_TIER_COLORS.professional },
];

/** Срезает префикс тира, затем Australium/Festive — оставляет голое имя оружия под сверку с KILLSTREAK_WEAPONS_SET. */
function toBaseWeaponName(name: string): string {
  const prefix = KS_PREFIXES.find((p) => name.startsWith(p));
  let stripped = prefix ? name.slice(prefix.length) : name;
  if (stripped.startsWith('Australium ')) stripped = stripped.slice('Australium '.length);
  if (stripped.startsWith('Festive ')) stripped = stripped.slice('Festive '.length);
  return stripped;
}

/** Голое имя предмета текущей страницы — из пути (/stats) или ?item= (/classifieds). */
function getBaseWeaponName(url: URL): string | null {
  if (url.pathname.startsWith('/stats/')) {
    // ['', 'stats', Quality, Item, 'Tradable', 'Craftable'|'Non-Craftable', EffectId?]
    const itemSeg = url.pathname.split('/').map(decodeURIComponent)[3];
    return itemSeg ? toBaseWeaponName(itemSeg) : null;
  }
  if (url.pathname.startsWith('/classifieds')) {
    const item = url.searchParams.get('item');
    return item ? toBaseWeaponName(item) : null;
  }
  return null;
}

/** Классическая (не-next) ссылка на страницу /stats предмета — вариант backpackStatsUrl без next-ветки, она тут не нужна. */
function buildStatsUrl(name: string, quality: string, craftable: boolean, trailingSegment: string | undefined): string {
  const craftSegment = craftable ? 'Craftable' : 'Non-Craftable';
  let url = `https://backpack.tf/stats/${encodeURIComponent(quality)}/${encodeURIComponent(name)}/Tradable/${craftSegment}`;
  if (trailingSegment != null) url += `/${trailingSegment}`;
  return url;
}

const STATS_PROCESSED_ATTR = 'data-tf2s-ks-stats';
const CLASSIFIEDS_NAV_ID = 'ks-tier-nav';
const EFFECTS_FILTER_ID = 'tf2s-ks-effects-filter';

interface EffectOption {
  id: string;
  label: string;
}

// Значения — из их же Advanced Search модалки (#panel-killstreak, см.
// doc-блок файла), не выдуманы и не пересчитаны из чего-то другого.
const SHEEN_OPTIONS: readonly EffectOption[] = [
  { id: '1', label: 'Team Shine' },
  { id: '2', label: 'Deadly Daffodil' },
  { id: '3', label: 'Manndarin' },
  { id: '4', label: 'Mean Green' },
  { id: '5', label: 'Agonizing Emerald' },
  { id: '6', label: 'Villainous Violet' },
  { id: '7', label: 'Hot Rod' },
];

const KILLSTREAKER_OPTIONS: readonly EffectOption[] = [
  { id: '2002', label: 'Fire Horns' },
  { id: '2003', label: 'Cerebral Discharge' },
  { id: '2004', label: 'Tornado' },
  { id: '2005', label: 'Flames' },
  { id: '2006', label: 'Singularity' },
  { id: '2007', label: 'Incinerator' },
  { id: '2008', label: 'Hypno-Beam' },
];

/** Уже выбранные значения фильтра из текущего URL — `?sheen=3,7` -> {'3','7'}. */
function parseSelectedEffects(url: URL, key: string): Set<string> {
  const raw = url.searchParams.get(key);
  return new Set(raw ? raw.split(',').filter(Boolean) : []);
}

/** Ссылка "Применить"/"Сбросить" — те же остальные параметры, сброс page на 1 (как у кнопок тира). */
function buildEffectsFilterUrl(url: URL, sheens: ReadonlySet<string>, killstreakers: ReadonlySet<string>): string {
  const params = new URLSearchParams(url.search);
  if (sheens.size > 0) params.set('sheen', [...sheens].join(','));
  else params.delete('sheen');
  if (killstreakers.size > 0) params.set('killstreaker', [...killstreakers].join(','));
  else params.delete('killstreaker');
  params.set('page', '1');
  return `${url.pathname}?${params.toString()}`;
}

/** Одна секция чекбоксов (Sheen ИЛИ Killstreaker) внутри выпадашки. */
function buildEffectGroup(title: string, kind: 'sheen' | 'killstreaker', options: readonly EffectOption[], selected: ReadonlySet<string>): HTMLElement {
  const group = document.createElement('div');
  group.className = 'tf2s-ks-effect-group';

  const heading = document.createElement('h5');
  heading.textContent = title;
  // killstreak-filter-header — их же класс заголовка секции в той же
  // Advanced Search модалке (см. doc-блок файла) — переиспользуем ради
  // единообразия, своих отступов под заголовок не пишем.
  heading.className = 'killstreak-filter-header';
  group.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'tf2s-ks-effect-list';

  for (const opt of options) {
    // btn/btn-default/btn-multi-filter/btn-xs — их же классы чекбокса-кнопки
    // из той же модалки (см. doc-блок файла) — визуальный переключатель
    // `.active` вешаем сами (ниже, на change), а не полагаемся на их JS: та
    // логика привязана конкретно к форме Advanced Search, а не ко всей
    // странице, и живым тестом на СВОИХ элементах не подтверждена.
    const label = document.createElement('label');
    label.className = 'btn btn-default btn-multi-filter btn-xs';
    if (selected.has(opt.id)) label.classList.add('active');

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = opt.id;
    input.checked = selected.has(opt.id);
    input.dataset.effectKind = kind;
    input.addEventListener('change', () => label.classList.toggle('active', input.checked));

    label.append(input, document.createTextNode(opt.label));
    list.appendChild(label);
  }

  group.appendChild(list);
  return group;
}

// Слушатель "клик вне выпадашки — закрыть", живёт на document, пока модуль
// запущен — снимается в stop() (см. ниже), а не оставляется висеть.
let effectsOutsideClickHandler: ((e: MouseEvent) => void) | null = null;

/**
 * Выпадашка "Эффекты" — чекбоксы Sheen (Specialized/Professional) и
 * Killstreaker (только Professional), см. doc-блок файла. `null`, если для
 * текущего тира эффектов не бывает (No Kit/Standard) — тогда вызывающий
 * код просто ничего не вставляет.
 */
function createEffectsFilter(url: URL, currentTier: string, locale: Locale): HTMLElement | null {
  if (currentTier !== '2' && currentTier !== '3') return null;

  const selectedSheens = parseSelectedEffects(url, 'sheen');
  const selectedKillstreakers = currentTier === '3' ? parseSelectedEffects(url, 'killstreaker') : new Set<string>();

  const wrap = document.createElement('div');
  wrap.id = EFFECTS_FILTER_ID;
  wrap.classList.add('btn-group', 'btn-group-sm', 'dropdown');
  wrap.style.marginLeft = '8px';

  const activeCount = selectedSheens.size + selectedKillstreakers.size;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn btn-default btn-sm dropdown-toggle';
  toggle.textContent = activeCount > 0 ? `${UI[locale].effects} (${activeCount}) ` : `${UI[locale].effects} `;
  toggle.appendChild(Object.assign(document.createElement('span'), { className: 'caret' }));
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    wrap.classList.toggle('open');
  });
  wrap.appendChild(toggle);

  const menu = document.createElement('div');
  menu.className = 'dropdown-menu tf2s-ks-effects-menu';
  // Клики внутри (чекбоксы, "Применить"/"Сбросить") не должны всплыть до
  // document-обработчика ниже и закрыть панель раньше времени.
  menu.addEventListener('click', (e) => e.stopPropagation());

  menu.appendChild(buildEffectGroup('Sheen', 'sheen', SHEEN_OPTIONS, selectedSheens));
  if (currentTier === '3') {
    menu.appendChild(buildEffectGroup('Killstreaker', 'killstreaker', KILLSTREAKER_OPTIONS, selectedKillstreakers));
  }

  const actions = document.createElement('div');
  actions.className = 'tf2s-ks-effects-actions';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'btn btn-link btn-xs';
  resetBtn.textContent = UI[locale].reset;
  resetBtn.addEventListener('click', () => {
    window.location.href = buildEffectsFilterUrl(url, new Set(), new Set());
  });

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'btn btn-primary btn-xs';
  applyBtn.textContent = UI[locale].apply;
  applyBtn.addEventListener('click', () => {
    const checked = (kind: 'sheen' | 'killstreaker') =>
      new Set(
        [...menu.querySelectorAll<HTMLInputElement>(`input[data-effect-kind="${kind}"]`)]
          .filter((input) => input.checked)
          .map((input) => input.value),
      );
    window.location.href = buildEffectsFilterUrl(url, checked('sheen'), checked('killstreaker'));
  });

  actions.append(resetBtn, applyBtn);
  menu.appendChild(actions);
  wrap.appendChild(menu);

  effectsOutsideClickHandler = (e: MouseEvent) => {
    if (!wrap.contains(e.target as Node)) wrap.classList.remove('open');
  };
  document.addEventListener('click', effectsOutsideClickHandler);

  return wrap;
}

/**
 * Строка кнопок на /stats — встраивается в `.stats-header-controls` сразу
 * после нативного пикера качества/скина (см. doc-блок файла).
 */
function createButtonsStats(url: URL): void {
  const parentHead = document.querySelector<HTMLElement>('.stats-header-controls');
  if (!parentHead || parentHead.hasAttribute(STATS_PROCESSED_ATTR)) return;

  // ['', 'stats', Quality, Item, 'Tradable', 'Craftable'|'Non-Craftable', EffectId?]
  const parts = url.pathname.split('/').map(decodeURIComponent);
  const quality = parts[2];
  const itemSeg = parts[3];
  if (!quality || !itemSeg) return; // неожиданная форма пути — лучше ничего, чем не туда
  const craftable = parts[5] !== 'Non-Craftable';
  const effectId = parts[6];

  parentHead.setAttribute(STATS_PROCESSED_ATTR, '1');

  // Первый div-РЕБЁНОК контейнера (:scope >, а не просто querySelector) —
  // именно он, а не произвольный вложенный div, должен получить нашу строку
  // кнопок сразу после себя через insertBefore/nextSibling ниже; в живой
  // разметке это ровно `.stats-quality-list`.
  const firstDiv = parentHead.querySelector<HTMLElement>(':scope > div');

  const currentPrefix = KS_PREFIXES.find((p) => itemSeg.startsWith(p)) ?? '';
  const baseItemName = itemSeg.slice(currentPrefix.length);

  const divButtons = document.createElement('div');
  divButtons.classList.add('btn-group', 'btn-group-sm', 'stats-killstreak-list');

  for (const info of KS_TIERS) {
    const link = document.createElement('a');
    link.textContent = info.label;
    // btn/btn-variety — те же классы, что у нативных кнопок пикера качества
    // рядом (см. doc-блок файла) — подхватывают их же bootstrap-стили/hover.
    link.classList.add('btn', 'btn-variety');
    if (info.statsPrefix === currentPrefix) link.classList.add('active');
    link.style.color = info.color;
    link.href = buildStatsUrl(info.statsPrefix + baseItemName, quality, craftable, effectId);
    divButtons.appendChild(link);
  }

  // Портировано буквально как в оригинале, включая крайний случай "у
  // firstDiv нет nextSibling" (тогда <br> не добавляется вовсе, только
  // divButtons через appendChild) — на живой разметке страницы после
  // .stats-quality-list всегда есть хотя бы текстовый узел (перенос
  // строки/пробел из HTML-исходника), так что основная ветка срабатывает.
  if (firstDiv && firstDiv.nextSibling) {
    parentHead.insertBefore(divButtons, firstDiv.nextSibling);
    parentHead.insertBefore(document.createElement('br'), firstDiv.nextSibling);
  } else {
    parentHead.appendChild(divButtons);
  }
}

/**
 * Нав-панель на /classifieds — встраивается в `.panel.panel-main
 * .panel-body` сразу после `#search-crumbs` (см. doc-блок файла), сохраняя
 * все остальные активные фильтры и сбрасывая `page` на 1 (смена тира меняет
 * набор результатов — старый номер страницы мог перестать существовать).
 * Следом, если тир это позволяет (Specialized/Professional), вставляется
 * выпадашка "Эффекты" (см. createEffectsFilter выше).
 */
function createButtonsClassifieds(url: URL, locale: Locale): void {
  const panelBody = document.querySelector<HTMLElement>('.panel.panel-main .panel-body');
  if (!panelBody || document.getElementById(CLASSIFIEDS_NAV_ID)) return;

  const currentTier = url.searchParams.get('killstreak_tier') ?? '0';

  const navWrap = document.createElement('div');
  navWrap.id = CLASSIFIEDS_NAV_ID;
  navWrap.classList.add('btn-group', 'btn-group-sm');
  navWrap.style.padding = '8px 0px';

  KS_TIERS.forEach((info, i) => {
    const link = document.createElement('a');
    // btn/btn-default — нативные классы их же крошек-фильтров #search-crumbs
    // (см. doc-блок файла), не своя палитра.
    link.className = 'btn btn-default';
    link.textContent = info.label;
    link.style.color = info.color;

    const params = new URLSearchParams(url.search);
    params.set('killstreak_tier', info.classifiedsTier);
    params.set('page', '1');
    // Sheen существует только у Specialized/Professional, Killstreaker —
    // только у Professional (их же комментарий в разметке Advanced Search:
    // "Check for conflicts: no/standard killstreak tier and sheen,
    // specialized killstreak tier and killstreaker" — см. doc-блок файла).
    // При переключении на тир, где старый фильтр эффектов уже недействителен,
    // чистим его, а не тащим невалидный параметр в новый URL.
    if (info.classifiedsTier === '0' || info.classifiedsTier === '1') {
      params.delete('sheen');
      params.delete('killstreaker');
    } else if (info.classifiedsTier === '2') {
      params.delete('killstreaker');
    }
    link.href = `${url.pathname}?${params.toString()}`;

    if (currentTier === info.classifiedsTier) link.classList.add('active');
    if (i === 0) link.style.borderRadius = '5px 0 0 5px';
    if (i === KS_TIERS.length - 1) link.style.borderRadius = '0 5px 5px 0';

    navWrap.appendChild(link);
  });

  const crumbs = panelBody.querySelector<HTMLElement>('#search-crumbs');
  if (crumbs) {
    crumbs.insertAdjacentElement('afterend', navWrap);
  } else {
    panelBody.prepend(navWrap);
  }

  const effectsFilter = createEffectsFilter(url, currentTier, locale);
  if (effectsFilter) navWrap.insertAdjacentElement('afterend', effectsFilter);
}

/**
 * "Мои листинги" (`/classifieds?steamid=...`) и архив (`/classifieds/
 * archive`) показывают сразу много разных предметов одного пользователя —
 * фильтр килстрик-тира ОДНОГО предмета там не имеет смысла (перенесено из
 * оригинала как есть, включая TODO-комментарий там же: relist/страница
 * первичного выставления лота по-прежнему не разобраны отдельно).
 */
function isExcludedClassifiedsPage(url: URL): boolean {
  return url.pathname.includes('/classifieds/archive') || url.searchParams.has('steamid');
}

function run(locale: Locale): void {
  const url = new URL(window.location.href);

  if (url.pathname.startsWith('/classifieds') && isExcludedClassifiedsPage(url)) return;

  const weaponName = getBaseWeaponName(url);
  if (!weaponName || !KILLSTREAK_WEAPONS_SET.has(weaponName)) return;

  if (url.pathname.startsWith('/stats/')) {
    createButtonsStats(url);
  } else if (url.pathname.startsWith('/classifieds')) {
    createButtonsClassifieds(url, locale);
  }
}

export function startBptfKsTierButtons(locale: Locale): { stop: () => void } {
  run(locale);

  return {
    stop: () => {
      const parentHead = document.querySelector<HTMLElement>('.stats-header-controls');
      if (parentHead) {
        parentHead.removeAttribute(STATS_PROCESSED_ATTR);
        const buttons = parentHead.querySelector('.stats-killstreak-list');
        if (buttons) {
          // Наш <br> вставлен ИММЕДИАТНО перед divButtons (см. createButtonsStats) —
          // соседний по DOM узел, без промежуточных текстовых узлов от нас самих.
          const maybeBr = buttons.previousSibling;
          if (maybeBr instanceof HTMLElement && maybeBr.tagName === 'BR') maybeBr.remove();
          buttons.remove();
        }
      }
      document.getElementById(CLASSIFIEDS_NAV_ID)?.remove();
      document.getElementById(EFFECTS_FILTER_ID)?.remove();
      if (effectsOutsideClickHandler) {
        document.removeEventListener('click', effectsOutsideClickHandler);
        effectsOutsideClickHandler = null;
      }
    },
  };
}
