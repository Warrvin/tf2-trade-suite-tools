import { defineContentScript } from 'wxt/sandbox';
import { getLocale, isFeatureEnabled, watchSettings } from '../utils/settings';
import type { Locale } from '../utils/i18n';
import { startSteamProfileLinks } from '../modules/steam-profile-links/core';
import { STEAM_PROFILE_LINKS_FEATURE_ID } from '../modules/steam-profile-links/types';
import '../styles/tokens.css';
import '../styles/steam-profile-links.css';

/**
 * Единственный entrypoint модуля — см. modules/steam-profile-links/core.ts
 * за подробным обоснованием (откуда SteamID64, куда вставляем, почему
 * Community Bans — только ссылка). Как и у stn-item-links/
 * bptf-listing-trade-params: обычный (ISOLATED) content-script без пары
 * MAIN/ISOLATED — нужный SteamID берём из обычного DOM-атрибута
 * (`data-miniprofile`), а не из JS-переменной чужого реалма.
 *
 * Матчим ВЕСЬ `/id/*` и `/profiles/*` на steamcommunity.com (а не только
 * саму главную страницу профиля без хвоста) — тем же приёмом, что и
 * scrap-item-modal (см. его doc-блок): целевой блок `.profile_item_links`
 * есть только на главной странице профиля (проверено живым сравнением с
 * `/inventory` — там его в DOM просто нет), так что модуль сам ничего не
 * найдёт и не сработает на остальных подстраницах — без риска что-то
 * сломать там.
 */
export default defineContentScript({
  matches: ['*://steamcommunity.com/id/*', '*://steamcommunity.com/profiles/*'],
  async main(ctx) {
    let handle: { stop: () => void } | null = null;

    let enabled = await isFeatureEnabled(STEAM_PROFILE_LINKS_FEATURE_ID);
    let locale: Locale = await getLocale();
    if (enabled) handle = startSteamProfileLinks(locale);

    // Смена локали — тем же путём, что и вкл/выкл (полный stop+start, см.
    // utils/i18n.ts за общим объяснением этого решения).
    const stopWatching = watchSettings((settings) => {
      const shouldBeEnabled = settings.features[STEAM_PROFILE_LINKS_FEATURE_ID] ?? false;
      if (shouldBeEnabled !== enabled) {
        enabled = shouldBeEnabled;
        if (enabled) {
          locale = settings.locale;
          handle = startSteamProfileLinks(locale);
        } else {
          handle?.stop();
          handle = null;
        }
        return;
      }
      if (enabled && settings.locale !== locale) {
        locale = settings.locale;
        handle?.stop();
        handle = startSteamProfileLinks(locale);
      }
    });

    ctx.onInvalidated(() => {
      stopWatching();
      handle?.stop();
    });
  },
});
