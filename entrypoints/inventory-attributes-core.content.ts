import { defineContentScript } from 'wxt/sandbox';
import { registerInventoryAttributesCoreHandler } from '../modules/inventory-item-attributes/core';

// MAIN-world половина модуля — наблюдает fetch/XHR-запросы страницы к
// /inventory/<id>/440/2 (не свои собственные, чужие: страница и так их
// делает сама, см. core.ts) и отвечает на запросы ISOLATED-стороны текущим
// снимком атрибутов.
//
// НАШЛИ БАГ: без явного runAt манифест-запись получает "run_at" ПО
// УМОЛЧАНИЮ = "document_idle" (а НЕ "document_start", как ошибочно
// предполагалось раньше) — т.е. наш перехват fetch/XHR ставился ПОЗЖЕ, чем
// собственный inline-скрипт Steam успевал сделать первые несколько запросов
// за первые ~100-150 предметов инвентаря (то же самое, что первые страницы
// пагинации). Эти самые первые запросы проходили мимо перехвата и их
// предметы никогда не попадали в itemByAssetId — отсюда иконки появлялись
// только начиная с той страницы, что подгружается уже ПОСЛЕ установки
// перехватчика. runAt: 'document_start' гарантирует, что патч window.fetch/
// XMLHttpRequest встанет раньше любого скрипта самой страницы.
export default defineContentScript({
  matches: ['*://steamcommunity.com/id/*/inventory*', '*://steamcommunity.com/profiles/*/inventory*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    registerInventoryAttributesCoreHandler();
  },
});
