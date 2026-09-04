/**
 * Разбор атрибутов предмета scrap.tf — портировано из tf2TradingUtils
 * (scrap.tf/itemLinks/content.js, см. README), но с ОДНИМ сознательным
 * отличием от оригинала: там всё читается из ЖИВОЙ подсказки при наведении
 * (document.querySelector(".hover-over") — единственный на всю страницу
 * элемент, который сайт сам заполняет текстом наведённого предмета), а
 * здесь — прямо из атрибутов САМОГО кликнутого `.item.hoverable` (`data-title`/
 * `data-content` — тот же самый текст, которым сайт заполняет свою
 * подсказку, только уже лежащий на каждом предмете индивидуально). Это
 * надёжнее: не зависит от того, успел ли реально показаться tooltip перед
 * кликом (Ctrl+клик без предварительного наведения у оригинала просто не
 * сработал бы — `selectedHoverEl.style.display === "none"` обрывает
 * функцию), и работает одинаково что на карточках /buy/*, что на
 * /auctions и /auctions/<код> (везде один и тот же `.item.hoverable`).
 *
 * Живой HTML подтверждён пользователем на 4 реальных страницах: /buy/weapons,
 * /buy/hats, /auctions, /auctions/SRRHAB — везде один и тот же набор
 * атрибутов: data-title, data-content, data-classes, data-defindex,
 * data-slot, класс качества qualityN (0/1/3/5/6/9/11/13/14/15) и класс
 * killstreakN (1/2/3) на самом div'е.
 */

export type ScrapQuality =
  | 'Normal'
  | 'Genuine'
  | 'Vintage'
  | 'Unusual'
  | 'Unique'
  | 'Self-Made'
  | 'Strange'
  | 'Haunted'
  | "Collector's"
  | 'Decorated Weapon';

export interface ScrapItemAttributes {
  /** Базовое имя — БЕЗ префиксов качества/killstreak-тира/Festivized/Non-Craftable/Australium (они добавляются заново под конкретную ссылку, см. links.ts). */
  name: string;
  quality: ScrapQuality;
  craftable: boolean;
  ksTier: 0 | 1 | 2 | 3;
  australium: boolean;
  festivized: boolean;
  /** Название Unusual-эффекта — только для quality === 'Unusual'. Нужно PriceDB.io SKU-резолверу (см. links.ts) — без него "Unusual X" резолвится в пустой эффект. */
  effectName: string | null;
  /** Strange Part защищён от срезания слова "Strange" как признака качества (у самого предмета качество почти всегда Unique). */
  isStrangePart: boolean;
}

// scrap.tf теряет диакритику минимум для этого предмета — родная подсказка
// сайта пишет "Quackenbirdt" без умлаута (проверено сравнением с backpack.tf/
// stntrading.eu, где акцент показан верно) — правится сразу при чтении
// имени из DOM, до того как оно попадёт в любую ссылку/заголовок виджета.
const SCRAP_TF_NAME_CORRECTIONS: Record<string, string> = {
  Quackenbirdt: 'Quäckenbirdt',
};

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function getQualityFromClasses(el: Element): ScrapQuality {
  const qualityClass = [...el.classList].find((c) => /^quality\d+$/.test(c));
  switch (qualityClass) {
    case 'quality0':
      return 'Normal';
    case 'quality1':
      return 'Genuine';
    case 'quality3':
      return 'Vintage';
    case 'quality5':
      return 'Unusual';
    case 'quality9':
      return 'Self-Made';
    case 'quality11':
      return 'Strange';
    case 'quality13':
      return 'Haunted';
    case 'quality14':
      return "Collector's";
    // War Paint / decorated-оружие — подтверждено живым HTML (/auctions),
    // но их настоящее имя устроено иначе (паттерн раскраски + степень
    // изношенности, напр. "War Paint: Cutter's Fever (Field-Tested)"), и мы
    // не парсим это отдельно — базовое имя из data-title используется как
    // есть, ссылки для таких предметов могут получиться неточными
    // (см. README, известное ограничение).
    case 'quality15':
      return 'Decorated Weapon';
    default:
      return 'Unique';
  }
}

function getKillstreakTierFromClasses(el: Element): 0 | 1 | 2 | 3 {
  if (el.classList.contains('killstreak3')) return 3;
  if (el.classList.contains('killstreak2')) return 2;
  if (el.classList.contains('killstreak1')) return 1;
  return 0;
}

/** Текст подсказки (data-content) без HTML — <br> -> перевод строки, остальные теги вырезаны. Тот же текст, что оригинал читает из живого .hover-over-content. */
function getContentText(el: Element): string {
  const raw = el.getAttribute('data-content') || '';
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/** Одна строка "<label>: <значение>" из текста подсказки. */
function getContentLine(text: string, label: string): string | null {
  const match = text.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
  return match ? match[1].trim() : null;
}

export function parseScrapItemAttributes(el: Element): ScrapItemAttributes {
  const rawTitle = stripTags(el.getAttribute('data-title') || '');
  const titleName = SCRAP_TF_NAME_CORRECTIONS[rawTitle] || rawTitle;

  const quality = getQualityFromClasses(el);
  const ksTier = getKillstreakTierFromClasses(el);
  const contentText = getContentText(el);

  // "Non-Craftable"/"Festivized" не всегда попадают в сам текст названия
  // (data-title) — это отдельные строки внутри подсказки (data-content),
  // как и класс "uncraft" на самом div'е (когда он есть).
  const craftable = !(el.classList.contains('uncraft') || contentText.includes('Uncraftable'));
  const festivized = contentText.includes('Festivized');
  const isStrangePart = /^Strange Part:/i.test(titleName);
  const australium = titleName.includes('Australium');

  const effectName = quality === 'Unusual' ? getContentLine(contentText, 'Effect') : null;

  // Срезаем Festivized/killstreak-тир/качество (только если это слово
  // реально стоит в начале titleName — Genuine/Unusual, например, туда
  // почти никогда не попадают как литеральный текст, поэтому для них
  // паттерна нет: срезать нечего, а достраивает их обратно под конкретную
  // ссылку ensureQualityPrefix() в links.ts). Цикл — предметы могут
  // сочетать несколько префиксов разом ("Collector's Festivized
  // Professional Killstreak ...").
  let baseName = titleName;
  if (!isStrangePart) {
    const patterns = [/^Festivized\s+/i, /^(?:Professional Killstreak|Specialized Killstreak|Killstreak)\s+/i];
    if (quality === 'Strange' || quality === 'Vintage' || quality === "Collector's") {
      const escaped = quality.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      patterns.push(new RegExp(`^${escaped}\\s+`, 'i'));
    }
    let stripped = true;
    while (stripped) {
      stripped = false;
      for (const pattern of patterns) {
        const next = baseName.replace(pattern, '');
        if (next !== baseName) {
          baseName = next;
          stripped = true;
        }
      }
    }
  }
  baseName = baseName.replace(/^Australium\s+/i, '');

  return {
    name: baseName,
    quality,
    craftable,
    ksTier,
    australium,
    festivized,
    effectName,
    isStrangePart,
  };
}
