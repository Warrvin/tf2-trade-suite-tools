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
export function getKillstreakTier(marketHashName: string | undefined): KillstreakTier {
  const name = marketHashName ?? '';
  if (/\bProfessional Killstreak\b/.test(name)) return 3;
  if (/\bSpecialized Killstreak\b/.test(name)) return 2;
  return 1;
}

export function buildKillstreakInfo(marketHashName: string | undefined, sheen?: string, killstreaker?: string): KillstreakInfo {
  const tier = getKillstreakTier(marketHashName);

  if (tier === 1) {
    return { tier, code: 'KS', color: TIER1_COLOR, tooltip: 'Killstreak' };
  }

  const sheenCode = sheen ? SHEEN_CODES[sheen] ?? sheen.slice(0, 2).toUpperCase() : '?';
  const sheenColor = sheen ? SHEEN_COLORS[sheen] ?? TIER1_COLOR : TIER1_COLOR;

  if (tier === 2) {
    return {
      tier,
      sheen,
      code: sheenCode,
      color: sheenColor,
      tooltip: sheen ? `Specialized Killstreak · Sheen: ${sheen}` : 'Specialized Killstreak',
    };
  }

  // tier === 3
  const killstreakerCode = killstreaker ? KILLSTREAKER_CODES[killstreaker] ?? killstreaker.slice(0, 2).toUpperCase() : '?';
  const tooltipParts = ['Professional Killstreak'];
  if (sheen) tooltipParts.push(`Sheen: ${sheen}`);
  if (killstreaker) tooltipParts.push(`Killstreaker: ${killstreaker}`);

  return {
    tier,
    sheen,
    killstreaker,
    code: `${sheenCode}·${killstreakerCode}`,
    color: sheenColor,
    tooltip: tooltipParts.join(' · '),
  };
}
