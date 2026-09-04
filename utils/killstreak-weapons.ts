/**
 * Базовые названия оружия, для которого в игре вообще существует Killstreak
 * Kit / Kit Fabricator — то есть для которого имеет смысл переключатель
 * тиров No Kit / Killstreak / Specialized / Professional
 * (modules/bptf-ks-tier-buttons). Обычные предметы (косметика, ключи,
 * металл, шляпы и т.д.) killstreak-нутыми стать не могут в принципе —
 * без этого списка кнопки переключения тиров появлялись бы вообще на
 * любом предмете classic backpack.tf, включая те, где No Kit — вообще
 * единственный возможный вариант. Именно это пользователь и попросил
 * проверить перед реализацией: "там не у всех предметов есть вообще
 * No Kit / Killstreak / Specialized / Professional".
 *
 * Источник — прайслист китов kits.tf (https://kits.tf/pricelist): каждое
 * оружие, у которого там есть хотя бы один торгуемый листинг вида
 * "<Тир> Killstreak <Оружие> Kit". Портировано «как есть», значением, а
 * не пересобрано вручную — из tf2TradingUtils
 * (utils/constants/killstreakWeapons.js, ветка main, ~140 названий,
 * подтверждено содержимым файла через jsdelivr) — тот же самый список,
 * тот же источник данных.
 *
 * НЕ то же самое, что utils/killstreak.ts (requirement 4 — не дублируем,
 * это разные по смыслу вещи, а не два способа решить одну задачу):
 *   - utils/killstreak.ts определяет тир/Sheen/Killstreaker УЖЕ ИМЕЮЩЕГОСЯ
 *     killstreak-предмета по его market_hash_name — для рендера бейджа на
 *     СВОИХ предметах (trade-item-attributes и т.п.), когда сам предмет
 *     (со своим описанием) уже есть.
 *   - Этот файл — наоборот, список того, какое оружие В ПРИНЦИПЕ можно
 *     killstreak-нуть, нужен там, где предмета с описанием ещё нет —
 *     только голое имя из URL страницы backpack.tf (/stats, /classifieds),
 *     см. modules/bptf-ks-tier-buttons/core.ts#getBaseWeaponName.
 *
 * Имена — голые: без префикса тира ("Killstreak "/"Specialized Killstreak "/
 * "Professional Killstreak "), без качества, без "Kit"/"Kit Fabricator" —
 * сверяются с именем, из которого эти префиксы (и Australium/Festive)
 * уже вырезаны, см. modules/bptf-ks-tier-buttons/core.ts#toBaseWeaponName.
 */
export const KILLSTREAK_WEAPONS: readonly string[] = [
  "AWPer Hand", "Air Strike", "Ambassador", "Amputator", "Apoco-Fists",
  "Atomizer", "Axtinguisher", "Baby Face's Blaster", "Back Scatter",
  "Back Scratcher", "Backburner", "Bat", "Bat Outta Hell", "Batsaber",
  "Bazaar Bargain", "Beggar's Bazooka", "Big Earner", "Big Kill",
  "Black Box", "Black Rose", "Blutsauger", "Bonesaw", "Boston Basher",
  "Bottle", "Brass Beast", "Bread Bite", "Bushwacka", "Candy Cane",
  "Chargin' Targe", "Claidheamh Mòr", "Classic", "Cleaner's Carbine",
  "Conniver's Kunai", "Conscientious Objector", "Cow Mangler 5000",
  "Crusader's Crossbow", "Degreaser", "Detonator", "Diamondback",
  "Direct Hit", "Disciplinary Action", "Dragon's Fury", "Enforcer",
  "Equalizer", "Escape Plan", "Eureka Effect", "Eviction Notice",
  "Eyelander", "Family Business", "Fan O'War", "Fire Axe", "Fists",
  "Fists of Steel", "Flame Thrower", "Flare Gun", "Flying Guillotine",
  "Force-a-Nature", "Fortified Compound", "Freedom Staff",
  "Frontier Justice", "Frying Pan", "Gloves of Running Urgently",
  "Grenade Launcher", "Gunslinger", "Half-Zatoichi", "Ham Shank",
  "Hitman's Heatmaker", "Holiday Punch", "Holy Mackerel", "Homewrecker",
  "Hot Hand", "Huntsman", "Huo-Long Heater", "Iron Bomber", "Iron Curtain",
  "Jag", "Killing Gloves of Boxing", "Knife", "Kritzkrieg", "Kukri",
  "L'Etranger", "Liberty Launcher", "Loch-n-Load", "Lollichop",
  "Loose Cannon", "Lugermorph", "Machina", "Manmelter", "Mantreads",
  "Market Gardener", "Maul", "Medi Gun", "Minigun", "Natascha",
  "Neon Annihilator", "Nessie's Nine Iron", "Nostromo Napalmer", "Original", "Overdose",
  "Pain Train", "Panic Attack", "Persian Persuader", "Phlogistinator",
  "Pistol", "Pomson 6000", "Postal Pummeler", "Powerjack",
  "Pretty Boy's Pocket Pistol", "Quick-Fix", "Quickiebomb Launcher",
  "Rainblower", "Rescue Ranger", "Reserve Shooter", "Revolver",
  "Righteous Bison", "Rocket Launcher", "Sandman", "Scattergun",
  "Scorch Shot", "Scotsman's Skullcutter", "Scottish Handshake",
  "Scottish Resistance", "Shahanshah", "Sharp Dresser",
  "Sharpened Volcano Fragment", "Shooting Star", "Short Circuit",
  "Shortstop", "Shotgun", "Shovel", "SMG", "Sniper Rifle", "Solemn Vow",
  "Southern Hospitality", "Splendid Screen", "Spy-Cicle",
  "Stickybomb Launcher", "Sun-on-a-Stick", "Sydney Sleeper",
  "Syringe Gun", "Third Degree", "Three-Rune Blade", "Tide Turner",
  "Tomislav", "Tribalman's Shiv", "Ullapool Caber", "Unarmed Combat",
  "Vaccinator", "Vita-Saw", "Wanga Prick", "Warrior's Spirit",
  "Widowmaker", "Winger", "Wrap Assassin", "Wrench",
  "Your Eternal Reward", "Übersaw",
];

/** Тот же список Set'ом — O(1) проверка "у этого оружия вообще бывает килстрик?". */
export const KILLSTREAK_WEAPONS_SET: ReadonlySet<string> = new Set(KILLSTREAK_WEAPONS);
