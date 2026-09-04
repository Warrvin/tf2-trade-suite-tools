import { getEffectId } from './unusual-effects';
import { classifySpell, SpellInfo } from './spells';
import { buildKillstreakInfo, KillstreakInfo } from './killstreak';

/** Одна строка из item.descriptions (формат Steam economy item). */
export interface SteamEconItemDescription {
  color?: string;
  value: string;
}

/**
 * Минимальная форма экономического предмета Steam, нужная для определения
 * атрибутов — соответствует тому, что реально лежит в
 * window.g_rgAppContextData[440].rgContexts[2].inventory.rgInventory[assetId]
 * (те же поля, что использует Steam Trade Offer Enhancer).
 */
export interface SteamEconItem {
  name?: string;
  market_hash_name?: string;
  name_color?: string;
  type?: string;
  descriptions?: SteamEconItemDescription[];
}

export interface ItemAttributes {
  /** HEX-цвет рамки предмета (name_color), без решётки, в верхнем регистре. */
  color: string;
  /** Числовой id Unusual-частицы (см. utils/unusual-effects.ts), если есть. */
  effect?: number;
  strange?: boolean;
  uncraft?: boolean;
  /** Все спеллы предмета (обычно 0-2) — см. utils/spells.ts. */
  spells: SpellInfo[];
  parts?: boolean;
  /** Присутствует только если предмет Killstreak (любого тира) — см. utils/killstreak.ts. */
  killstreak?: KillstreakInfo;
  /** Номер выделки для low-craft предметов (Bill's Hat #4 и т.п.). */
  lowcraft?: number;
}

/**
 * Определяет визуальные атрибуты предмета (unusual-эффект, strange-рамка,
 * uncraftable, spell(ы)/strange-parts/killstreak) — базовое обнаружение
 * (что считается unusual/strange/uncraft/spelled/parts/killstreak-предметом)
 * портировано ДОСЛОВНО из Steam Trade Offer Enhancer 2.2.8
 * (shared.offers.identifiers.getItemAttributes), чтобы совпадать с
 * оригиналом побитово (требование 6); классификация КОНКРЕТНОГО спелла и
 * тира/sheen/killstreaker killstreak — уже наша надстройка сверху
 * (см. utils/spells.ts, utils/killstreak.ts).
 */
export function getItemAttributes(item: SteamEconItem): ItemAttributes {
  const attributes: ItemAttributes = { color: (item.name_color || '').toUpperCase(), spells: [] };
  const isUnique = attributes.color === '7D6D00';
  // Strange-качественные предметы (оранжевая рамка от самого качества, а не
  // от strange-счётчика) размечены Стимом этим же цветом — их не нужно
  // повторно помечать как "strange" ниже.
  const isStrangeQuality = attributes.color === 'CF6A32';
  const hasStrangeItemType = Boolean(
    item.market_hash_name &&
      /^Strange /.test(item.market_hash_name) &&
      item.type &&
      // пример: "Strange Hat - Points Scored: 0"
      /^Strange ([0-9\w\s\\(\)'\-]+) - ([0-9\w\s\(\)'-]+): (\d+)\n?$/.test(item.type),
  );

  const hasStatClock = (description: SteamEconItemDescription): boolean =>
    Boolean(
      description.color?.toUpperCase() === 'CF6A32' && description.value.trim() === 'Strange Stat Clock Attached',
    );

  const matchesLowcraft = item.name?.match(/.* #(\d+)$/);
  if (matchesLowcraft) attributes.lowcraft = parseInt(matchesLowcraft[1], 10);

  if (!isStrangeQuality && hasStrangeItemType) attributes.strange = true;

  if (!item.descriptions) return attributes;

  let hasKillstreak = false;
  let sheen: string | undefined;
  let killstreaker: string | undefined;

  for (const description of item.descriptions) {
    const matchesEffect =
      attributes.effect === undefined &&
      !isUnique &&
      description.color === 'ffd700' &&
      description.value.match(/^★ Unusual Effect: (.+)$/);

    // В отличие от оригинала (один булев флаг spelled), собираем КАЖДУЮ
    // строку-спелл отдельно — предмет может иметь до 2 спеллов одновременно.
    //
    // БАГ (исправлено дважды): реальный текст Стима — "Halloween: <имя>
    // (spell only active during event)" (префикс "Halloween: ", БЕЗ слова
    // "Spell" — подтверждено скриншотами реального оффера пользователя, а
    // не только wiki-страницей, которая вводила в заблуждение форматом
    // заголовков "Halloween Spell: X"). Раньше вырезался только суффикс,
    // потом — неверный префикс "Halloween Spell: " — оба раза текст не
    // совпадал ни с одним именем в SPELL_CATALOG, и все спеллы валились в
    // fallback. classifySpell дополнительно матчит регистронезависимо
    // (Steam также пишет "Voices from Below" со строчной "from", а не
    // "From" как можно было бы предположить).
    const spellMatch =
      description.color === '7ea9d1' && description.value.indexOf('(spell only active during event)') !== -1
        ? description.value
            .replace(/^Halloween(?: Spell)?:\s*/i, '')
            .replace('(spell only active during event)', '')
            .trim()
        : null;

    const isStrangePartAttached =
      attributes.parts === undefined &&
      description.color === '756b5e' &&
      /^\(?(.+?):\s*\d+\)?$/.test(description.value);

    const isKillstreakAttached = description.color === '7ea9d1' && description.value === 'Killstreaks Active';
    const sheenMatch = description.color === '7ea9d1' && description.value.match(/^Sheen:\s*(.+)$/);
    const killstreakerMatch = description.color === '7ea9d1' && description.value.match(/^Killstreaker:\s*(.+)$/);

    const isUncraftable = !description.color && /^\( Not.* Usable in Crafting/.test(description.value);

    if (matchesEffect) {
      const effectId = getEffectId(matchesEffect[1]);
      if (effectId) attributes.effect = effectId;
    }
    if (spellMatch) attributes.spells.push(classifySpell(spellMatch));
    if (isStrangePartAttached) attributes.parts = true;
    if (isKillstreakAttached) hasKillstreak = true;
    if (sheenMatch) sheen = sheenMatch[1].trim();
    if (killstreakerMatch) killstreaker = killstreakerMatch[1].trim();
    if (isUncraftable) attributes.uncraft = true;

    // strange-предмет со Strange Stat Clock (не strange-качество само по себе)
    if (!isStrangeQuality && hasStatClock(description)) attributes.strange = true;
  }

  if (hasKillstreak) {
    attributes.killstreak = buildKillstreakInfo(item.market_hash_name, sheen, killstreaker);
  }

  return attributes;
}
