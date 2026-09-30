/**
 * Классификация Killstreak-предметов TF2 — 3 тира с разным набором данных:
 *
 *  - Тир 1 (обычный Killstreak) — только счётчик киллов, БЕЗ sheen и
 *    killstreaker. Бейдж: "KS".
 *  - Тир 2 (Specialized Killstreak) — счётчик + Sheen (цвет свечения
 *    счётчика). Бейдж: код sheen'а (напр. "MN" для Manndarin).
 *  - Тир 3 (Professional Killstreak) — счётчик + Sheen + Killstreaker
 *    (визуальный эффект). Бейдж: код sheen'а + killstreaker'а
 *    (напр. "MN·FH" — Manndarin / Fire Horns).
 *
 * Тир определяется по префиксу market_hash_name предмета (так же делает
 * tf2trader — единственный из трёх изученных проектов, различающий тиры).
 * Sheen/Killstreaker — из строк "Sheen: <имя>" / "Killstreaker: <имя>" в
 * description (список имён — из tf2TradingUtils, utils/constants/tf2Economy.js).
 */

export type KillstreakTier = 1 | 2 | 3;

const SHEEN_CODES: Record<string, string> = {
  'Team Shine': 'TS',
  'Deadly Daffodil': 'DD',
  Manndarin: 'MN',
  'Mean Green': 'MG',
  'Agonizing Emerald': 'AE',
  'Villainous Violet': 'VV',
  'Hot Rod': 'HR',
};

const SHEEN_COLORS: Record<string, string> = {
  'Team Shine': '#c9c9c9',
  'Deadly Daffodil': '#f0d43a',
  Manndarin: '#e67e22',
  'Mean Green': '#4caf50',
  'Agonizing Emerald': '#009d6b',
  'Villainous Violet': '#8650ac',
  'Hot Rod': '#cc3333',
};

const KILLSTREAKER_CODES: Record<string, string> = {
  'Fire Horns': 'FH',
  'Cerebral Discharge': 'CD',
  Tornado: 'TN',
  Flames: 'FL',
  Singularity: 'SG',
  Incinerator: 'IN',
  'Hypno-Beam': 'HB',
};

export interface KillstreakInfo {
  tier: KillstreakTier;
  sheen?: string;
  killstreaker?: string;
  /** Короткий код на бейдж — "KS" / код sheen'а / "sheen·killstreaker". */
  code: string;
  /** Цвет бейджа — серый (тир 1) или цвет sheen'а (тир 2/3). */
  color: string;
  /** Полная подсказка для title="...". */
  tooltip: string;
}

const TIER1_COLOR = '#8a8f98';

/**
 * Тир по market_hash_name — ищем "Professional Killstreak" / "Specialized
 * Killstreak" ГДЕ УГОДНО в имени, не только в начале.
 *
 * БАГ (исправлено): раньше регэксп был заякорен на начало строки
 * (/^Professional Killstreak /), что верно только для НЕ-Strange предметов.
 * У подавляющего большинства реальных killstreak-предметов (все botkiller,
 * все strange-quality) имя выглядит как "Strange Professional Killstreak
 * <Название>" — качество идёт ПЕРЕД тиром килстрика, поэтому "^" никогда не
 * совпадал и всё скатывалось в тир 1 (просто "KS"), даже когда Sheen и
 * Killstreaker были собраны из описания.
 */
const RUSSIAN_SHEEN_MAP: Record<string, string> = {
  'командный блеск': 'Team Shine',
  'лиловое злорадство': 'Villainous Violet',
  'злодейский фиолетовый': 'Villainous Violet',
  'горячая штучка': 'Hot Rod',
  'хот-род': 'Hot Rod',
  'хот род': 'Hot Rod',
  'изумрудная зависть': 'Agonizing Emerald',
  'мучительный изумруд': 'Agonizing Emerald',
  'надгробный нарцисс': 'Deadly Daffodil',
  'смертоносный нарцисс': 'Deadly Daffodil',
  'нарцисс': 'Deadly Daffodil',
  'злобный зеленый': 'Mean Green',
  'злобный зеленый ': 'Mean Green',
  'подлый зеленый': 'Mean Green',
  'манндарин': 'Manndarin',
};

const RUSSIAN_KILLSTREAKER_MAP: Record<string, string> = {
  'мозговой разряд': 'Cerebral Discharge',
  'огненные рога': 'Fire Horns',
  'пламя': 'Flames',
  'языки пламени': 'Flames',
  'гипнолуч': 'Hypno-Beam',
  'гипно-луч': 'Hypno-Beam',
  'испепелитель': 'Incinerator',
  'крематорий': 'Incinerator',
  'сингулярность': 'Singularity',
  'торнадо': 'Tornado',
};

export function getKillstreakTier(marketHashName: string | undefined): KillstreakTier {
  const name = marketHashName ?? '';
  if (/\b(?:Professional Killstreak|профессионального убийцы|высшего порядка)\b/i.test(name)) return 3;
  if (/\b(?:Specialized Killstreak|особо опасного убийцы|особого порядка)\b/i.test(name)) return 2;
  return 1;
}

export function buildKillstreakInfo(marketHashName: string | undefined, sheen?: string, killstreaker?: string): KillstreakInfo {
  let tier = getKillstreakTier(marketHashName);
  if (killstreaker && tier < 3) tier = 3;
  else if (sheen && tier < 2) tier = 2;

  if (tier === 1) {
    return { tier, code: 'KS', color: TIER1_COLOR, tooltip: 'Killstreak' };
  }

  const normSheen = sheen ? (RUSSIAN_SHEEN_MAP[sheen.trim().toLowerCase().replace(/ё/g, 'е')] ?? sheen.trim()) : undefined;
  const normKillstreaker = killstreaker
    ? (RUSSIAN_KILLSTREAKER_MAP[killstreaker.trim().toLowerCase().replace(/ё/g, 'е')] ?? killstreaker.trim())
    : undefined;

  const sheenCode = normSheen ? SHEEN_CODES[normSheen] ?? normSheen.slice(0, 2).toUpperCase() : '?';
  const sheenColor = normSheen ? SHEEN_COLORS[normSheen] ?? TIER1_COLOR : TIER1_COLOR;

  if (tier === 2) {
    return {
      tier,
      sheen: normSheen || sheen,
      code: sheenCode,
      color: sheenColor,
      tooltip: sheen ? `Specialized Killstreak · Sheen: ${sheen}` : 'Specialized Killstreak',
    };
  }

  // tier === 3
  const killstreakerCode = normKillstreaker
    ? KILLSTREAKER_CODES[normKillstreaker] ?? normKillstreaker.slice(0, 2).toUpperCase()
    : '?';
  const tooltipParts = ['Professional Killstreak'];
  if (sheen) tooltipParts.push(`Sheen: ${sheen}`);
  if (killstreaker) tooltipParts.push(`Killstreaker: ${killstreaker}`);

  return {
    tier,
    sheen: normSheen || sheen,
    killstreaker: normKillstreaker || killstreaker,
    code: `${sheenCode}·${killstreakerCode}`,
    color: sheenColor,
    tooltip: tooltipParts.join(' · '),
  };
}
