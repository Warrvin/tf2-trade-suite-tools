import { defineConfig } from 'wxt';

// Единая конфигурация для Chrome / Firefox / Edge / Opera / Brave.
// `wxt build` → Chromium-манифест (MV3), `wxt build -b firefox` → Firefox-манифест
// (WXT сам разруливает разницу в background/manifest под капотом).
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  srcDir: '.',

  manifest: {
    name: 'TF2 Trade Suite Tools',
    description:
      'Настраиваемый набор инструментов для трейда в Team Fortress 2: сводка валюты, атрибуты предметов, быстрые ссылки и автоматизация оффера — каждая функция включается отдельно.',
    permissions: ['storage', 'cookies'],
    host_permissions: [
      'https://pricedb.io/*',
      'https://sku.pricedb.io/*',
      '*://*.steamcommunity.com/*',
      '*://api.steampowered.com/*',
    ],
    browser_specific_settings: {
      gecko: {
        // Заглушка — обязательна для подписи/публикации в Firefox AMO.
        // Перед публикацией замените на реальный уникальный ID.
        id: 'tf2-trade-suite-tools@example.invalid',
        strict_min_version: '109.0',
      },
    },
  },
});
