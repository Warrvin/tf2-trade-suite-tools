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
    permissions: ['storage'],
    // Большинство запросов — same-origin (steamcommunity.com), host_permissions
    // для них не нужны. Единственное исключение — реальный сторонний домен,
    // PriceDB.io (utils/pricedb.ts), которым пользуются ПЯТЬ модулей:
    // trade-item-summary (режим 'priced'), pricedb-check-button,
    // market-pricedb-check-button, stn-item-links и scrap-item-modal
    // (последние три — просто ссылка на страницу цены, но резолв SKU для
    // неё тоже идёт через сеть, см. utils/pricedb.ts). host_permissions
    // здесь даёт content-скрипту (ISOLATED world) fetch в обход CORS-ответа
    // их сервера — без этой записи браузер блокирует кросс-доменный запрос
    // обычной политикой CORS, и все пять модулей тихо деградируют к "нет
    // цены"/ссылке на поиск вместо точной страницы (см. try/catch в
    // utils/pricedb.ts — сбой не ломает панель, просто ничего не находит).
    host_permissions: ['https://pricedb.io/*', 'https://sku.pricedb.io/*'],
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
