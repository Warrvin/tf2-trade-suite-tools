/**
 * Общий рендерer атрибутов предмета (unusual-эффект, strange, uncraft,
 * spell/killstreak/parts-иконки) — вынесен из modules/trade-item-attributes
 * сюда, потому что ровно та же логика нужна и modules/inventory-item-
 * attributes (требование 4 — не дублировать функционал между модулями):
 * это чистая функция "ItemAttributes + DOM-элемент -> навешанные классы/
 * дети", не знающая НИЧЕГО про то, откуда взялись атрибуты и что за
 * страница вокруг — какая MAIN-сторона отдаёт снимок, как сматчить сторону
 * (свой/партнёр в трейде vs просто один инвентарь) и в каком формате id у
 * .item-элементов на каждой странице отличается и остаётся в соответствующем
 * apply.ts модуля.
 */

import { getEffectURL, ICON_URLS } from './icons';
import type { ItemAttributes } from './item-attributes';
import type { IconDetailLevel } from './icon-detail-level';
import { getSpellIconShape, iconPaths, SpellIconShape } from './spell-icons';
import type { SpellColor } from './spells';
import { Locale, t } from './i18n';

/** Единственная русская подсказка во всём файле — остальные тексты (Spell,
 *  Killstreak, Strange Part(s)) намеренно оставлены английскими игровыми
 *  терминами (см. renderSimpleIcons/applyItemAttributesToElement ниже), как
 *  их называет сама игра и все три изученных портируемых проекта — двуязычным
 *  делаем ТОЛЬКО то, что действительно наш текст. */
const RECOGNITION_UNCERTAIN_SUFFIX = {
  ru: ' (возможна неточность распознавания)',
  en: ' (recognition may be inaccurate)',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Уже обработанный элемент помечается этим атрибутом — значение это
 * assetId предмета, для которого элемент был размечен (НЕ просто "1"/флаг).
 * Это важно: страница инвентаря Steam при постраничной навигации (кнопки
 * "<"/"1 из N"/">") переиспользует один и тот же пул DOM-узлов .item под
 * РАЗНЫЕ предметы на разных страницах (виртуализация), просто меняя их
 * id/фон — childList при этом не меняется, и если бы тут хранился просто
 * флаг "обработан", такой переиспользованный узел с чужой пометкой
 * навсегда пропускал бы сканирование и оставался без иконок. Сравнивая
 * значение атрибута с actual assetId текущего элемента (см. getProcessedKey),
 * вызывающая сторона видит переиспользование и перерисовывает элемент
 * заново вместо того, чтобы его пропустить.
 */
export const PROCESSED_ATTR = 'data-tf2s-attr';

/** Ключ (assetId), для которого элемент был размечен в последний раз, или
 *  null, если ещё не обрабатывался. Сравнить с текущим assetId элемента —
 *  единственный надёжный способ понять, актуальна ли разметка. */
export function getProcessedKey(el: Element): string | null {
  return el.getAttribute(PROCESSED_ATTR);
}
/** Классы/фон, которые applyItemAttributesToElement может добавить на сам .item — нужны для undecorateItemAttributesElement. */
const APPLIED_CLASSES = ['tf2s-attr-unusual', 'tf2s-attr-strange', 'tf2s-attr-uncraft'];

/** Уникальные id для <linearGradient> — на странице одновременно может быть
 *  много иконок одного "неоднородного" спелла (например несколько Team
 *  Spirit Footprints в инвентаре), у каждой свой <defs>, id должны не
 *  совпадать, иначе url(#id) у одной иконки случайно сошлётся на градиент
 *  другой. Просто растущий счётчик — переполнение практически невозможно. */
let gradientCounter = 0;

/** SpellColor -> CSS-заливка (для текстовых бейджей): один цвет как есть,
 *  массив — линейный градиент по всем цветам по порядку. */
function toCssPaint(color: SpellColor): string {
  return Array.isArray(color) ? `linear-gradient(90deg, ${color.join(', ')})` : color;
}

function makeBadge(code: string, color: SpellColor, tooltip: string, shapeClass?: string): HTMLElement {
  const badge = document.createElement('span');
  badge.className = shapeClass ? `tf2s-attr-badge ${shapeClass}` : 'tf2s-attr-badge';
  badge.textContent = code;
  badge.title = tooltip;
  badge.style.background = toCssPaint(color);
  return badge;
}

function makeIconImg(src: string, kind: string, tooltip?: string): HTMLImageElement {
  const img = document.createElement('img');
  img.src = src;
  img.className = `tf2s-attr-icon tf2s-attr-icon--${kind}`;
  if (tooltip) img.title = tooltip;
  return img;
}

/**
 * Рисует картиночную иконку спелла (по мотивам иконок, которые прислал
 * пользователь — ghost/footprints/sounds/fire/pumpkin/flask; см.
 * utils/spell-icons.ts) через createElementNS — элемент попадает на
 * настоящую страницу Steam (не shadow root), поэтому никакого innerHTML с
 * чужим SVG-текстом, только DOM-узлы.
 */
function makeSpellIconSVG(shapeKey: SpellIconShape, color: SpellColor, tooltip: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'tf2s-attr-svg-icon');

  // color может быть массивом ("неоднородный" спелл — командные цвета,
  // переливание между оттенками и т.п., см. utils/spells.ts) — тогда вместо
  // currentColor фигуры красятся через <linearGradient> с уникальным id;
  // для одного цвета просто выставляем его через style.color (currentColor).
  let paintRef: string;
  if (Array.isArray(color)) {
    const gradId = `tf2s-grad-${++gradientCounter}`;
    const defs = document.createElementNS(SVG_NS, 'defs');
    const gradient = document.createElementNS(SVG_NS, 'linearGradient');
    gradient.setAttribute('id', gradId);
    // По умолчанию у <linearGradient> gradientUnits="objectBoundingBox" —
    // координаты 0%..100% считаются ОТДЕЛЬНО для КАЖДОЙ фигуры (у иконки-
    // следов их 4 — по 2 эллипса на ногу), из-за чего каждая фигура красится
    // своим мини-градиентом от края до края и вся иконка превращается в
    // "конфетти" вместо одного плавного перехода по всей картинке.
    // userSpaceOnUse + координаты в системе viewBox (0..24) — все фигуры
    // красятся ОДНИМ общим градиентом, как и задумано.
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
    gradient.setAttribute('x1', '0');
    gradient.setAttribute('y1', '12');
    gradient.setAttribute('x2', '24');
    gradient.setAttribute('y2', '12');
    color.forEach((stopColor, i) => {
      const stop = document.createElementNS(SVG_NS, 'stop');
      stop.setAttribute('offset', `${(i / (color.length - 1)) * 100}%`);
      stop.setAttribute('stop-color', stopColor);
      gradient.appendChild(stop);
    });
    defs.appendChild(gradient);
    svg.appendChild(defs);
    paintRef = `url(#${gradId})`;
  } else {
    svg.style.color = color;
    paintRef = 'currentColor';
  }

  const title = document.createElementNS(SVG_NS, 'title');
  title.textContent = tooltip;
  svg.appendChild(title);

  for (const shape of iconPaths(shapeKey)) {
    const el = document.createElementNS(SVG_NS, shape.tag);
    for (const [attr, value] of Object.entries(shape.attrs)) {
      // Фигуры из iconPaths() пишут 'currentColor' как заглушку "покрась
      // меня в цвет иконки" — тут она разрешается либо в буквальный
      // currentColor (одноцветные иконки), либо в ссылку на градиент выше.
      const resolved = (attr === 'fill' || attr === 'stroke') && value === 'currentColor' ? paintRef : value;
      el.setAttribute(attr, resolved);
    }
    svg.appendChild(el);
  }
  return svg;
}

/** Отрисовывает spell/killstreak-иконки в "простом" виде — 1:1 со Steam Trade
 *  Offer Enhancer: общий значок, без деталей, никогда не ошибается. */
function renderSimpleIcons(wrap: HTMLElement, attrs: ItemAttributes) {
  if (attrs.spells.length > 0) {
    wrap.appendChild(makeIconImg(ICON_URLS.spell, 'spell', 'Spell'));
  }
  if (attrs.killstreak) {
    wrap.appendChild(makeIconImg(ICON_URLS.killstreak, 'killstreak', 'Killstreak'));
  }
}

/** Отрисовывает spell/killstreak в "подробном" виде — картиночная иконка для
 *  распознанных спеллов (с подсказкой), бейдж-код для killstreak и для
 *  совсем нераспознанного текста спелла (для которого нет готовой картинки).
 *  Для paint/footprints-спеллов и неопознанного текста подсказка честно
 *  помечена как возможно неточная (см. utils/spells.ts). */
function renderDetailedIcons(wrap: HTMLElement, attrs: ItemAttributes, locale: Locale) {
  for (const spell of attrs.spells) {
    const uncertain = spell.kind === 'paint' || spell.kind === 'footprints' || spell.kind === 'unknown';
    const tooltip = uncertain ? `${spell.name}${t(locale, RECOGNITION_UNCERTAIN_SUFFIX)}` : spell.name;
    const shape = getSpellIconShape(spell.name);
    if (shape) {
      // Известный спелл — рисуем узнаваемую картинку (см. utils/spell-icons.ts),
      // перекрашенную в цвет конкретного варианта.
      wrap.appendChild(makeSpellIconSVG(shape, spell.color, tooltip));
    } else {
      // Совсем не распознанный текст — картинки для него нет; честно
      // показываем пунктирный бейдж с "?" (см. utils/spells.ts fallback),
      // а не выдумываем иконку.
      wrap.appendChild(makeBadge(spell.code, spell.color, tooltip, 'tf2s-attr-badge--unknown'));
    }
  }
  if (attrs.killstreak) {
    wrap.appendChild(makeBadge(attrs.killstreak.code, attrs.killstreak.color, attrs.killstreak.tooltip));
  }
}

/**
 * Размечает ОДИН .item-элемент атрибутами предмета — навешивает
 * unusual/strange/uncraft классы, background предмета (для unusual), значки
 * spell/killstreak/parts. `key` — assetId предмета, записывается в
 * PROCESSED_ATTR (см. его комментарий про переиспользуемые DOM-узлы на
 * страницах с пагинацией/виртуализацией) — вызывающая сторона сверяет его на
 * следующем скане, чтобы понять, не подменил ли Steam содержимое узла.
 */
export function applyItemAttributesToElement(
  el: HTMLElement,
  attrs: ItemAttributes,
  detailLevel: IconDetailLevel,
  key: string,
  locale: Locale,
) {
  el.setAttribute(PROCESSED_ATTR, key);

  const classes: string[] = [];
  if (attrs.effect) {
    el.style.backgroundImage = `url('${getEffectURL(attrs.effect)}')`;
    classes.push('tf2s-attr-unusual');
  }
  if (attrs.strange) classes.push('tf2s-attr-strange');
  if (attrs.uncraft) classes.push('tf2s-attr-uncraft');
  if (classes.length > 0) el.classList.add(...classes);

  if (attrs.lowcraft) {
    const badge = document.createElement('div');
    badge.className = 'tf2s-attr-lowcraft';
    badge.textContent = `#${attrs.lowcraft}`;
    if (attrs.color) badge.style.color = `#${attrs.color}`;
    el.appendChild(badge);
  }

  const hasSpellOrKillstreak = attrs.spells.length > 0 || attrs.killstreak;
  const hasParts = attrs.parts;
  if (hasSpellOrKillstreak || hasParts) {
    const wrap = document.createElement('div');
    wrap.className = 'tf2s-attr-icons';

    if (detailLevel === 'simple') renderSimpleIcons(wrap, attrs);
    else renderDetailedIcons(wrap, attrs, locale);

    if (hasParts) wrap.appendChild(makeIconImg(ICON_URLS.parts, 'parts', 'Strange Part(s)'));

    el.appendChild(wrap);
  }
}

/** Откатывает всё, что applyItemAttributesToElement мог добавить —
 *  используется при смене уровня детализации "на лету", чтобы перерисовать
 *  уже обработанные предметы. */
export function undecorateItemAttributesElement(el: HTMLElement) {
  el.removeAttribute(PROCESSED_ATTR);
  el.classList.remove(...APPLIED_CLASSES);
  el.style.backgroundImage = '';
  el.querySelectorAll(':scope > .tf2s-attr-icons, :scope > .tf2s-attr-lowcraft').forEach((node) => node.remove());
}
