/**
 * Классификация Halloween-спеллов TF2.
 *
 * Steam всегда помечает строку описания спелла суффиксом
 * "(spell only active during event)" и цветом 7ea9d1, и добавляет префикс
 * "Halloween: " перед именем (item-attributes.ts вырезает и префикс, и
 * суффикс перед тем как передать сюда голый текст).
 *
 * Само ИМЯ надёжно для 4 "эффектных" спеллов (Steam показывает их точным
 * именем — подтверждено официальной wiki TF2: "Spectral Flame... is listed
 * as 'Halloween Fire'", "Gourd Grenades/Sentry Quad-Pumpkins/Squash
 * Rockets... are listed as 'Pumpkin Bombs'", вокальные — как "Voices from
 * Below"). Про оставшиеся 12 (перекраска оружия и следов от киллов) единой
 * проверенной практикой информации о ТОЧНОМ цвете нет; цвета ниже —
 * лучшее сопоставление по словесному описанию эффекта, данному
 * пользователем (риск неточности принят пользователем явно). Поэтому
 * SPELL_CATALOG используется как "плюс": если текст совпал — показываем
 * красивое имя и цвет/иконку; если НЕТ — всё равно показываем точный сырой
 * текст от Steam (см. classifySpell), просто без красивого имени/цвета.
 * Ошибка в каталоге может дать не тот оттенок цвета, но никогда не
 * спрячет и не исказит сам факт наличия спелла или его сырой текст.
 */

export type SpellKind = 'effect' | 'paint' | 'footprints' | 'unknown';

/**
 * Цвет иконки/бейджа спелла. Строка — один сплошной цвет; массив из 2+
 * цветов — спелл описан пользователем как НЕ однородный (переливается
 * между двумя оттенками, или зависит от команды/случайный) — тогда и
 * иконка (utils/spell-icons.ts, через SVG <linearGradient>), и fallback-
 * бейдж рисуются градиентом по этим цветам, а не одним усреднённым тоном.
 */
export type SpellColor = string | string[];

interface SpellCatalogEntry {
  kind: SpellKind;
  /** Короткий код на бейдж (используется только для нераспознанного fallback — см. classifySpell). */
  code: string;
  color: SpellColor;
}

const SPELL_CATALOG: Record<string, SpellCatalogEntry> = {
  // "Эффектные" спеллы — Steam показывает точным именем, тут уверенность полная.
  // Форма иконки (ghost/flame/pumpkin/speaker, см. spell-icons.ts) уже
  // однозначно её называет, цвет — второстепенный акцент.
  'Halloween Fire': { kind: 'effect', code: 'HF', color: '#39d353' }, // яркое зелёное пламя — однородный
  'Pumpkin Bombs': { kind: 'effect', code: 'PB', color: ['#a569bd', '#e67e22'] }, // фиолетовый след ракеты -> оранжевый взрыв
  Exorcism: { kind: 'effect', code: 'EX', color: ['#5dade2', '#e67e22'] }, // случайные синие/лазурные и красные/оранжевые призраки
  'Voices From Below': { kind: 'effect', code: 'VFB', color: '#b8a8d1' }, // потусторонний голос — цвет не описан, взят один

  // Перекраска оружия ("paint" спеллы) — 5 видов, общая иконка-колба.
  // Все 5 описаны пользователем как "переливание между светлым и тёмным
  // оттенком" одного тона — градиент светлый->тёмный того же цвета.
  'Die Job': { kind: 'paint', code: 'DJ', color: ['#f5d883', '#b8860b'] }, // светлый/тёмный Australium Gold
  'Chromatic Corruption': { kind: 'paint', code: 'CC', color: ['#c39bd3', '#6c3483'] }, // светлый/тёмный фиолетовый
  'Putrescent Pigmentation': { kind: 'paint', code: 'PP', color: ['#f7dc6f', '#7d8f3d'] }, // светлый/тёмный жёлто-зелёный
  'Spectral Spectrum': { kind: 'paint', code: 'Spec', color: ['#f4d03f', '#e74c3c', '#ffffff', '#5885a2'] }, // пульсация жёлтый->красный и белый->синий (по команде)
  'Sinister Staining': { kind: 'paint', code: 'SS', color: ['#b5a86b', '#5c5c26'] }, // светлый/тёмный тускло-оливковый

  // Перекраска следов от киллов ("footprints" спеллы) — 7 видов, общая иконка-след.
  'Team Spirit Footprints': { kind: 'footprints', code: 'TS', color: ['#5885a2', '#b8383b'] }, // цвета команд BLU/RED
  'Gangreen Footprints': { kind: 'footprints', code: 'GG', color: '#f5e042' }, // ярко-жёлтый — однородный
  'Corpse Gray Footprints': { kind: 'footprints', code: 'CG', color: '#58d68d' }, // зелёный — однородный
  'Violent Violet Footprints': { kind: 'footprints', code: 'VV', color: '#ffbb99' }, // персиковый — однородный
  'Rotten Orange Footprints': { kind: 'footprints', code: 'RO', color: '#ff8a3d' }, // огненно-оранжевый — однородный
  'Bruised Purple Footprints': { kind: 'footprints', code: 'BP', color: '#ff6f91' }, // красно-розовый — однородный
  'Headless Horseshoes': { kind: 'footprints', code: 'HH', color: '#7c6fdb' }, // иссиня-фиолетовый — однородный
};

export interface SpellInfo {
  kind: SpellKind;
  /** Отображаемое имя — точное (из каталога) или сырой текст от Steam, если не распознали. */
  name: string;
  /** Короткий код — используется только для нераспознанного fallback-бейджа. */
  code: string;
  color: SpellColor;
  /** Сырой текст description (без префикса "Halloween: " и суффикса "(spell only active during event)"), как есть у Steam. */
  raw: string;
}

const FALLBACK_COLOR = '#8a8f98';
// Намеренно НЕ пересекается ни с одним кодом из каталога выше (раньше тут
// был 'SP', что совпадало с реальным кодом Spectral Spectrum — бейдж
// нераспознанного спелла было не отличить от конкретного известного).
const FALLBACK_CODE = '?';

// Поиск по каталогу — БЕЗ учёта регистра: Steam не всегда даёт имя строго
// в "заголовочном" регистре (например реально пишет "Voices from Below" со
// строчной "from"). Ключ каталога остаётся "красивым" — для отображения
// используется РЕАЛЬНЫЙ текст из Steam (raw/trimmed), а не ключ каталога,
// так что регистр в бейдже/подсказке всегда совпадает с тем, что видит
// пользователь на самой странице Steam.
const SPELL_CATALOG_BY_LOWER: Record<string, SpellCatalogEntry> = Object.fromEntries(
  Object.entries(SPELL_CATALOG).map(([name, entry]) => [name.toLowerCase(), entry]),
);

/** Разбирает ОДНУ строку-спелл (уже без префикса/суффикса) в SpellInfo. */
export function classifySpell(raw: string): SpellInfo {
  const trimmed = raw.trim();
  const known = SPELL_CATALOG_BY_LOWER[trimmed.toLowerCase()];
  if (known) {
    return { kind: known.kind, name: trimmed, code: known.code, color: known.color, raw: trimmed };
  }
  // Не совпало ни с одним известным именем — показываем как есть, без выдумывания.
  return { kind: 'unknown', name: trimmed, code: FALLBACK_CODE, color: FALLBACK_COLOR, raw: trimmed };
}
