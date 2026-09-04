/**
 * Конвертация между тремя представлениями SteamID — чистая арифметика,
 * никакого запроса в сеть не нужно, если уже известен accountID (32-битная
 * часть SteamID64).
 *
 * Источник accountID — ЖИВОЙ DOM: и на главной странице профиля
 * (`.playerAvatar.profile_header_size[data-miniprofile]`, см.
 * modules/steam-profile-links/core.ts), и на странице списка офферов
 * (`.tradeoffer_partner .playerAvatar[data-miniprofile]` у каждой строки,
 * см. modules/instant-accept-decline/core.ts) Steam кладёт `data-miniprofile`
 * с accountID прямо в разметку. Проверено живым сравнением на реальном
 * профиле: `data-miniprofile="77887257"` у аватара, `g_rgProfileData.steamid`
 * той же страницы = `"76561198038152985"`, и
 * 76561198038152985 - 76561197960265728 = 77887257 — сходится тютелька в
 * тютельку. Поэтому SteamID64 везде ниже собирается ИЗ accountID, а не
 * читается из `g_rgProfileData` напрямую — `data-miniprofile` лежит в
 * обычном DOM-атрибуте и виден ISOLATED-миру content-скрипта без костылей
 * с чтением чужих JS-переменных страницы (g_rgProfileData — MAIN-мир,
 * недоступен обычному content-скрипту без инъекции <script>, которая тут
 * просто не нужна).
 *
 * Общий для нескольких модулей (steam-profile-links, instant-accept-decline)
 * — вынесено в utils, а не оставлено локально в одном модуле, чтобы не
 * дублировать (requirement 4).
 *
 * 76561197960265728 — стандартный публичный оффсет Valve между accountID
 * и SteamID64 (та же константа у любого стороннего SteamID-конвертера).
 * Используем BigInt — сумма (~7.66×10^16) уже превышает
 * Number.MAX_SAFE_INTEGER (~9×10^15), обычный Number потерял бы точность
 * в младших разрядах.
 */

const STEAM64_ACCOUNT_OFFSET = 76561197960265728n;

export interface SteamIdSet {
  accountId: number;
  steamId64: string;
  /** Формат [U:1:accountId] */
  steamId32: string;
  /** Классический формат STEAM_0:Y:Z */
  steamIdClassic: string;
}

export function accountIdToSteamId64(accountId: number): string {
  return (BigInt(accountId) + STEAM64_ACCOUNT_OFFSET).toString();
}

export function buildSteamIdSet(accountId: number): SteamIdSet {
  const y = accountId % 2;
  const z = Math.floor(accountId / 2);
  return {
    accountId,
    steamId64: accountIdToSteamId64(accountId),
    steamId32: `[U:1:${accountId}]`,
    steamIdClassic: `STEAM_0:${y}:${z}`,
  };
}
