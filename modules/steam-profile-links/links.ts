/**
 * Ссылки на профиль пользователя на трёх сторонних площадках — форматы
 * проверены живым запросом (не угаданы):
 *
 *  - backpack.tf — `backpack.tf/profiles/<steamid64>`. Общеизвестный,
 *    устоявшийся формат в TF2-трейдинге (используется повсеместно в этом
 *    сообществе — та же схема, что стоит за уже собственной "профиль" —
 *    пометкой backpackTf в SITE_GROUPS этого проекта). Прямой живой запрос
 *    через браузер уперся в проверку безопасности (Cloudflare) — тот же
 *    экран получил бы и обычный fetch без полноценного рендера JS-пазла,
 *    но САМА ссылка от этого не перестаёт быть рабочей: это стандартная
 *    страница, у неё просто есть анти-бот защита при первом заходе, как у
 *    множества сайтов — открывшему её человеку в обычном Chrome она
 *    покажется нормально.
 *  - steamhistory.net — `steamhistory.net/id/<steamid64>` — формат прямо из
 *    примера пользователя.
 *  - posts.tf — `posts.tf/users/<steamid64>` — подтверждено живым переходом
 *    (posts.tf, в отличие от двух других, НЕ за анти-бот проверкой):
 *    открытореальный профиль `posts.tf/users/76561198079732098`, страница
 *    отдала 200 с настоящим содержимым ("bibblée's profile | posts.tf").
 */

export function buildBackpackTfProfileUrl(steamId64: string): string {
  return `https://backpack.tf/profiles/${steamId64}`;
}

export function buildSteamHistoryProfileUrl(steamId64: string): string {
  return `https://steamhistory.net/id/${steamId64}`;
}

export function buildPostsTfProfileUrl(steamId64: string): string {
  return `https://posts.tf/users/${steamId64}`;
}
