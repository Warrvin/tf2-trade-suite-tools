/**
 * Пиктограммы для "подробного" вида спеллов — вместо буквенных бейджей
 * (utils/spells.ts всё ещё даёт код/цвет для tooltip и для нераспознанных
 * спеллов, см. apply.ts) рисуем узнаваемую картинку по образцу иконок,
 * которые прислал пользователь (Exorcism — призрак, следы — пара следов,
 * VFB — звуковая волна, Halloween Fire — пламя, Pumpkin Bombs — тыква,
 * paint-спеллы — колба). Сами файлы с Flaticon не бандлились (их CDN был
 * недоступен из песочницы разработки, плюс лицензия Flaticon Free требует
 * атрибуции при поставке файла) — вместо этого нарисованы свои SVG-контуры
 * той же идеи, максимально близко повторяющие форму присланных образцов,
 * каждый как набор <path>/<circle>/<line> с явным fill/stroke, чтобы
 * apply.ts мог перекрашивать их под конкретный вариант спелла через
 * currentColor без доп. логики.
 *
 * viewBox всех иконок — "0 0 24 24".
 */

export type SpellIconShape = 'ghost' | 'footprint' | 'speaker' | 'flame' | 'pumpkin' | 'flask';

/** Отображаемое имя спелла (как в SPELL_CATALOG, utils/spells.ts) -> форма иконки. */
const SPELL_ICON_SHAPE: Record<string, SpellIconShape> = {
  Exorcism: 'ghost',
  'Halloween Fire': 'flame',
  'Pumpkin Bombs': 'pumpkin',
  'Voices From Below': 'speaker',
  // Paint-спеллы (перекраска оружия) — иконка-колба, перекрашивается по варианту.
  'Die Job': 'flask',
  'Chromatic Corruption': 'flask',
  'Putrescent Pigmentation': 'flask',
  'Spectral Spectrum': 'flask',
  'Sinister Staining': 'flask',
  // Следы от киллов — иконка-следы, перекрашивается по варианту.
  'Team Spirit Footprints': 'footprint',
  'Gangreen Footprints': 'footprint',
  'Corpse Gray Footprints': 'footprint',
  'Violent Violet Footprints': 'footprint',
  'Rotten Orange Footprints': 'footprint',
  'Bruised Purple Footprints': 'footprint',
  'Headless Horseshoes': 'footprint',
};

const SPELL_ICON_SHAPE_BY_LOWER: Record<string, SpellIconShape> = Object.fromEntries(
  Object.entries(SPELL_ICON_SHAPE).map(([name, shape]) => [name.toLowerCase(), shape]),
);

/**
 * БАГ (исправлено): раньше apply.ts индексировал SPELL_ICON_SHAPE напрямую
 * по spell.name — а spell.name это РЕАЛЬНЫЙ текст со страницы Steam, не
 * ключ каталога (см. utils/spells.ts — там та же проблема уже была
 * исправлена для самого каталога regex-ом без учёта регистра, но об этой
 * второй, независимой точке доступа по имени тогда забыли). Steam пишет
 * "Voices from Below" со строчной "from", ключ здесь был "Voices From
 * Below" — прямое сравнение не совпадало, иконка не находилась, и рендер
 * откатывался на текстовый бейдж "VFB" вместо картинки. Теперь поиск —
 * тем же способом, без учёта регистра.
 */
export function getSpellIconShape(name: string): SpellIconShape | undefined {
  return SPELL_ICON_SHAPE_BY_LOWER[name.trim().toLowerCase()];
}

interface IconShapeDef {
  tag: 'path' | 'circle' | 'line' | 'ellipse';
  attrs: Record<string, string>;
}

const STROKE_COMMON = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.7',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

/**
 * Заполняет переданный SVG-элемент (viewBox уже выставлен на 0 0 24 24)
 * фигурами конкретной иконки. Каждая фигура несёт СОБСТВЕННЫЙ fill/stroke
 * (а не унаследованный от корня) — часть иконок обводка (как в присланных
 * образцах), часть — сплошная заливка (следы).
 */
export function iconPaths(shape: SpellIconShape): IconShapeDef[] {
  switch (shape) {
    case 'ghost':
      // Контур: купол сверху, волнистый низ (3 "хвоста"); глаза — кольца-обводки.
      return [
        {
          tag: 'path',
          attrs: {
            ...STROKE_COMMON,
            d: 'M4 20.5 V11 A8 8 0 0 1 20 11 V20.5 L17.3 17.8 L14.7 20.5 L12 17.8 L9.3 20.5 L6.7 17.8 Z',
          },
        },
        { tag: 'circle', attrs: { ...STROKE_COMMON, cx: '9', cy: '11.5', r: '1.6' } },
        { tag: 'circle', attrs: { ...STROKE_COMMON, cx: '15', cy: '11.5', r: '1.6' } },
      ];
    case 'footprint':
      // Пара следов (сплошная заливка) — свод стопы (эллипс) + пятка
      // (эллипс) на каждую ногу, расположены по диагонали как при ходьбе.
      return [
        { tag: 'ellipse', attrs: { fill: 'currentColor', cx: '8', cy: '7', rx: '3.3', ry: '4.2' } },
        { tag: 'ellipse', attrs: { fill: 'currentColor', cx: '6.6', cy: '13.6', rx: '2.1', ry: '2.6' } },
        { tag: 'ellipse', attrs: { fill: 'currentColor', cx: '16.4', cy: '13', rx: '3.3', ry: '4.2' } },
        { tag: 'ellipse', attrs: { fill: 'currentColor', cx: '15', cy: '19.6', rx: '2.1', ry: '2.6' } },
      ];
    case 'speaker': {
      // Звуковая волна — ряд вертикальных "штрихов" переменной высоты (эквалайзер).
      const heights = [3, 6, 4, 8, 5, 10, 5, 8, 4, 6, 3];
      const startX = 2.5;
      const step = 1.9;
      return heights.map((h, i) => ({
        tag: 'line' as const,
        attrs: {
          x1: String(startX + i * step),
          x2: String(startX + i * step),
          y1: String(12 - h / 2),
          y2: String(12 + h / 2),
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
        },
      }));
    }
    case 'flame':
      // Контур язычка пламени с характерной "петлёй" слева.
      return [
        {
          tag: 'path',
          attrs: {
            ...STROKE_COMMON,
            d:
              'M12.4 1.8c-.3 2.7-1.8 4.2-3.3 5.9C7.3 9.6 5.8 11.7 5.8 14.4c0 4.4 3.5 7.8 7.8 7.8 3.6 0 6.6-2.9 6.6-6.6 ' +
              '0-3-1.5-4.9-2.9-6.5-.2 1.8-1 2.9-2.2 3.8.5-2.3-.2-4.3-1.6-5.9-.6-.7-1-2.1-1.1-5.2z',
          },
        },
      ];
    case 'pumpkin':
      // Тело (контур) + рёбра + стебель + лицо (треугольные глаза, зигзаг-рот).
      return [
        { tag: 'path', attrs: { ...STROKE_COMMON, d: 'M4 14c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8-8-3.6-8-8z' } },
        { tag: 'path', attrs: { ...STROKE_COMMON, 'stroke-width': '1.2', d: 'M8.3 7.2C7.4 9.3 7 11.6 7 14s.4 4.7 1.3 6.8' } },
        { tag: 'path', attrs: { ...STROKE_COMMON, 'stroke-width': '1.2', d: 'M15.7 7.2c.9 2.1 1.3 4.4 1.3 6.8s-.4 4.7-1.3 6.8' } },
        { tag: 'path', attrs: { ...STROKE_COMMON, 'stroke-width': '1.3', d: 'M11 6.2c-.2-1.4.6-2.6 2-3' } },
        { tag: 'path', attrs: { ...STROKE_COMMON, d: 'M8.7 12.3 L10.6 16 L6.8 16 Z' } },
        { tag: 'path', attrs: { ...STROKE_COMMON, d: 'M15.3 12.3 L17.2 16 L13.4 16 Z' } },
        { tag: 'path', attrs: { ...STROKE_COMMON, d: 'M7.5 17.8 L9 16.3 L10.5 17.8 L12 16.3 L13.5 17.8 L15 16.3 L16.5 17.8' } },
      ];
    case 'flask':
      // Колба (контур горлышка + округлого дна) + линия "жидкости" + пузырьки.
      return [
        {
          tag: 'path',
          attrs: {
            ...STROKE_COMMON,
            d: 'M9.8 2.8 H14.2 M10.3 2.8 V8.3 C10.3 8.3 5.8 12.6 5.8 16.2 A6.2 6.2 0 0 0 18.2 16.2 C18.2 12.6 13.7 8.3 13.7 8.3 V2.8',
          },
        },
        {
          tag: 'path',
          attrs: {
            ...STROKE_COMMON,
            'stroke-width': '1.4',
            d: 'M6.6 15.4c1.6-1.2 3.4 1.2 5.1 0s3.5-1.2 5.1 0',
          },
        },
        { tag: 'circle', attrs: { fill: 'currentColor', cx: '10.2', cy: '18.4', r: '0.7' } },
        { tag: 'circle', attrs: { fill: 'currentColor', cx: '13.6', cy: '19.4', r: '0.9' } },
      ];
  }
}
