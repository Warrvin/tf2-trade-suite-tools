import { defineContentScript } from 'wxt/sandbox';
import { registerInventoryCurrencyCoreHandler } from '../modules/inventory-currency-counter/core';

// MAIN-world половина модуля "Живой счётчик валюты в инвентаре". Как и
// inventory-attributes-core.content.ts, ставит document_start: общий
// перехватчик fetch/XHR (utils/inventory-watch.ts) должен встать раньше
// первого собственного запроса страницы Steam к /inventory/<id>/440/2,
// иначе быстрая оценка молча пропустит первые подгруженные страницы
// инвентаря (тот же баг, что был найден и исправлен в
// inventory-item-attributes — см. README).
//
// Если модуль inventory-item-attributes тоже включён, его core-скрипт
// ставит ровно тот же общий перехватчик — installInventoryWatch()
// идемпотентен per-window, поэтому дважды он не патчит fetch/XHR, какой бы
// из двух скриптов ни выполнился первым (см. utils/inventory-watch.ts).
export default defineContentScript({
  matches: ['*://steamcommunity.com/id/*/inventory*', '*://steamcommunity.com/profiles/*/inventory*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    registerInventoryCurrencyCoreHandler();
  },
});
