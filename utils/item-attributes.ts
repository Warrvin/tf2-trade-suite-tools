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
    ((item.market_hash_name && /^Strange /i.test(item.market_hash_name)) ||
      (item.name && /^(?:Strange|Странного типа) /i.test(item.name))) &&
      item.type &&
      // пример EN: "Strange Hat - Points Scored: 0", пример RU: "Шляпа странного типа - Убийств: 0"
      /^(?:Strange|.+странного типа) .+: \d+\n?$/iu.test(item.type),
  );

  const hasStatClock = (description: SteamEconItemDescription): boolean =>
    Boolean(
      description.color?.toUpperCase() === 'CF6A32' &&
        (/Strange Stat Clock Attached/i.test(description.value) ||
          /сч[её]тчик странного типа/i.test(description.value)),
    );

  const matchesLowcraft = item.name?.match(/.* #(\d+)$/);
  if (matchesLowcraft) attributes.lowcraft = parseInt(matchesLowcraft[1], 10);

  if (!isStrangeQuality && hasStrangeItemType) attributes.strange = true;

  // Запчасти роботов MvM (денежная печь, насос юмора, KB-808 и т.д.) — сырьё для ковки,
  // в их описании упоминается "серии убийств", но они сами НЕ являются предметами Killstreak.
  const isRobotPart = Boolean(
    (item.type && /Запчасть робота|Robot Part/i.test(item.type)) ||
      /(?:Battle-Worn|Reinforced|Pristine) Robot/i.test(item.market_hash_name || '') ||
      /(?:Повидавшая битвы|Армированн|Неповрежденн).+робота/i.test(item.name || ''),
  );
  if (isRobotPart) return attributes;

  // Кейсы, ящики, краски, билеты, инструменты не могут нести Killstreak
  const isNonKillstreakType = Boolean(
    (item.type &&
      /Кейс|Ящик|Case|Crate|Запчасть|Robot Part|Инструмент|Tool|Pass|Билет|Ticket|Краска|Paint/i.test(item.type)) &&
      !/\b(?:Kit|Fabricator|Набор|Изготовитель)\b/i.test(item.market_hash_name || item.name || ''),
  );

  if (!item.descriptions) return attributes;

  const isKillstreakItem =
    !isNonKillstreakType &&
    Boolean(
      (item.market_hash_name && /\bKillstreak\b/i.test(item.market_hash_name)) ||
        (item.name && /(?:серийного убийцы|особо опасного убийцы|профессионального убийцы)/i.test(item.name)),
    );
  let hasKillstreak = isKillstreakItem;
  let sheen: string | undefined;
  let killstreaker: string | undefined;

  for (const description of item.descriptions) {
    const matchesEffect =
      attributes.effect === undefined &&
      !isUnique &&
      description.color === 'ffd700' &&
      description.value.match(/^(?:★ Unusual Effect|★ Необычный эффект):\s*(.+)$/i);

    // В отличие от оригинала (один булев флаг spelled), собираем КАЖДУЮ
    // строку-спелл отдельно — предмет может иметь до 2 спеллов одновременно.
    //
    // Поддерживаем как английский формат Steam ("Halloween: <имя> (spell only active during event)"),
    // так и русский ("Хеллоуин: <имя> (заклятия работают лишь во время празднования)").
    const isSpell =
      description.color === '7ea9d1' &&
      (/(?:spell only active during event|заклятия работают лишь во время празднования)/i.test(description.value) ||
        /^(?:Halloween(?: Spell)?|Хеллоуин(?:ское заклят[иь]е)?):\s*/i.test(description.value));

    const spellMatch = isSpell
      ? description.value
          .replace(/^(?:Halloween(?: Spell)?|Хеллоуин(?:ское заклят[иь]е)?):\s*/i, '')
          .replace(/\s*\((?:spell only active during event|заклятия работают лишь во время празднования)\)\s*/gi, '')
          .trim()
      : null;

    const isStrangePartAttached =
      attributes.parts === undefined &&
      description.color === '756b5e' &&
      /^\(?(.+?):\s*\d+\)?$/.test(description.value);

    // Строка "Killstreaks Active" / "Серии убийств включены" — у оружия всегда в цвете 7ea9d1
    const isKillstreakAttached =
      !isNonKillstreakType &&
      description.color?.toLowerCase() === '7ea9d1' &&
      (/^\s*Killstreaks Active\s*$/i.test(description.value) ||
        /^\s*сери[ия] убийств (?:включен[ыа]|активн[ыа])\s*$/i.test(description.value));

    // Извлечение Блеска (Sheen) — на оружии отдельной строкой "Sheen: X" / "Блеск: X",
    // а на наборах/изготовителях может быть внутри скобок "(Блеск: X, Эффект...: Y)"
    const sheenMatch = !isNonKillstreakType ? description.value.match(/(?:Sheen|Блеск):\s*([^,)\n]+)/i) : null;

    // Извлечение Эффекта (Killstreaker) — строго "Killstreaker: Y", "Эффект серийного убийцы: Y", "Серийный убийца: Y", "Килстрикер: Y"
    // (НЕ голое "Эффект:", чтобы не ловить необычные эффекты боевых красок в кейсах)
    const killstreakerMatch = !isNonKillstreakType
      ? description.value.match(/(?:Killstreaker|Серийный убийца|Килстрикер|Эффект серийного убийцы):\s*([^,)\n]+)/i)
      : null;

    const isUncraftable =
      !description.color &&
      /^\(\s*(?:Not.*Usable in Crafting|Нельзя использовать в ковке|Нельзя ковать)/i.test(description.value);

    if (matchesEffect) {
      const effectId = getEffectId(matchesEffect[1]);
      if (effectId) attributes.effect = effectId;
    }
    if (spellMatch) attributes.spells.push(classifySpell(spellMatch));
    if (isStrangePartAttached) attributes.parts = true;
    if (isKillstreakAttached) hasKillstreak = true;
    if (sheenMatch) {
      sheen = sheenMatch[1].trim();
      hasKillstreak = true;
    }
    if (killstreakerMatch) {
      killstreaker = killstreakerMatch[1].trim();
      hasKillstreak = true;
    }
    if (isUncraftable) attributes.uncraft = true;

    // strange-предмет со Strange Stat Clock (не strange-качество само по себе)
    if (!isStrangeQuality && hasStatClock(description)) attributes.strange = true;
  }

  if (hasKillstreak && !isNonKillstreakType) {
    attributes.killstreak = buildKillstreakInfo(item.market_hash_name || item.name, sheen, killstreaker);
  }

  return attributes;
}
