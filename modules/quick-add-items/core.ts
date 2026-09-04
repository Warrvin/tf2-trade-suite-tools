import { respondInMain } from '../../utils/bridge';
import {
  CollectResult,
  TradeOfferWindow,
  addItemsByElements,
  canModifyOffer,
  findKeys,
  forceRefresh,
  getItemsForMetal,
  getSlotAssetIds,
  getVisibleInventoryContainer,
  isItemElementVisible,
  nextFrame,
  offsetIndex,
} from '../../utils/trade-offer';
import { QUICK_ADD_CHANNEL, QuickAddRequest, QuickAddResponse } from './types';

/**
 * MAIN-world "движок" панели быстрого добавления предметов — портирован из
 * Steam Trade Offer Enhancer (juliarose/steam-trade-offer-enhancer,
 * src/js/steamcommunity.com.tradeoffer.js: `collectItems` + `addItemsByElements`
 * + `clearItemsInOffer`), см. README §"Модуль `quick-add-items`" за подробным
 * разбором. ISOLATED-сторона (panel.ts) знает только UI — какой режим, какие
 * amount/index ввёл пользователь — а вся работа с внутренним состоянием
 * страницы (window.g_rgCurrentTradeStatus, GTradeStateManager и т.д., которые
 * ISOLATED-скрипт в принципе не видит) идёт здесь, как и у остальных модулей
 * страницы оффера (wallet-summary/trade-item-attributes/trade-item-summary —
 * тот же bridge.ts, требование 4).
 *
 * Общие с `auto-fill-from-listing` куски (типы window/оффера, поиск
 * ключей/металла, добавление найденных элементов, форс-перерисовка) вынесены
 * в utils/trade-offer.ts, когда та же самая логика понадобилась второй раз —
 * см. её шапку. Здесь остаётся только то, что специфично РОВНО для этой
 * панели: режимы ITEMS/RECENT (собираются из того, что сейчас видно на
 * экране, не переиспользуются больше нигде) и очистка стороны (clearSide).
 *
 * ПОЧЕМУ appid/contextid захардкожены на '440'/'2' в KEYS/METAL, но НЕ в
 * ITEMS/RECENT: оригинал — универсальный скрипт под любую игру Steam, он
 * определяет appid/contextid по тому, какая вкладка инвентаря сейчас
 * отображена (`getInventoryContext`). TF2 Trade Suite Tools — расширение только под TF2
 * (см. README), поэтому "Ключи"/"Металл" ищут именно TF2-предметы независимо
 * от того, какая вкладка сейчас открыта — так и должна работать кнопка
 * "Ключи", даже если пользователь до этого листал инвентарь другой игры. А
 * "Добавить"/"Недавние" (ITEMS/RECENT) в оригинале и не привязаны к
 * конкретной игре — они просто берут то, что СЕЙЧАС видно на экране, эта
 * часть портирована как есть, без хардкода игры.
 *
 * Режим "по списку ID" из оригинала сюда сознательно НЕ портирован — убран
 * по прямой просьбе пользователя как неудобное в использовании поле (нужно
 * знать assetId заранее, взять его особо неоткуда без внешних инструментов
 * — см. историю в README).
 */

/** Ближайшие к `near` числа из `nums`, пока разрыв между соседними по расстоянию
 *  не превышает `gap` — портировано дословно из режима RECENT ("Недавние"):
 *  находит группу предметов с ПОСЛЕДОВАТЕЛЬНО близкими assetId (обычно значит
 *  "получены одним и тем же дропом/трейдом почти подряд"). */
function getNearNumbers(nums: number[], near: number, gap: number): number[] {
  if (nums.length === 0) return [];

  const withDistance = nums.map((num) => ({ num, distance: Math.abs(num - near) })).sort((a, b) => a.distance - b.distance);
  if (withDistance[0].distance > gap) return [];

  const values = [withDistance[0].num];
  for (let i = 1; i < withDistance.length; i++) {
    const diff = Math.abs(withDistance[i - 1].distance - withDistance[i].distance);
    if (diff > gap) break;
    values.push(withDistance[i].num);
  }
  return values;
}

function getVisibleItemIdFromElement(el: HTMLElement): string {
  return el.id.split('_')[2] ?? '';
}

function collectItems(win: TradeOfferWindow, req: QuickAddRequest): CollectResult {
  const { mode, amount, index, isYou } = req;

  switch (mode) {
    case 'KEYS': {
      return findKeys(win, isYou ?? true, amount, index);
    }
    case 'METAL': {
      return getItemsForMetal(win, isYou ?? true, amount, index);
    }
    case 'RECENT': {
      const container = getVisibleInventoryContainer();
      if (!container) return { items: [], satisfied: false };

      let found = [...container.querySelectorAll<HTMLElement>('div.item')].filter(isItemElementVisible);
      let idx = index;
      if (idx < 0) {
        idx = (idx + 1) * -1;
        found = found.reverse();
      }

      const addedIds = getSlotAssetIds(isYou ?? true);
      const candidateIds = found.map((el) => parseInt(getVisibleItemIdFromElement(el), 10)).filter((id) => !addedIds.has(String(id)));
      const highestId = Math.max(0, ...candidateIds);
      const nearIds = new Set(getNearNumbers(candidateIds, highestId, 100).map(String));
      const items = found.filter((el) => nearIds.has(getVisibleItemIdFromElement(el)));

      return { items, satisfied: nearIds.size === items.length };
    }
    case 'ITEMS': {
      const container = getVisibleInventoryContainer();
      if (!container) return { items: [], satisfied: amount === 0 };

      let found = [...container.querySelectorAll<HTMLElement>('div.item')].filter(isItemElementVisible);
      let idx = index;
      if (idx < 0) {
        idx = (idx + 1) * -1;
        found = found.reverse();
      }

      const offset = offsetIndex(idx, amount, found.length);
      const items = found.slice(offset, offset + amount);
      return { items, satisfied: amount === items.length };
    }
    default:
      return { items: [], satisfied: false };
  }
}

/**
 * Убирает все предметы одной стороны из оффера.
 *
 * ИСПРАВЛЕНО (1) (баг-репорт пользователя: кнопки "Очистить" не работали
 * вообще). Оригинал (`clearItemsInOffer`) вызывает
 * `WINDOW.GTradeStateManager.RemoveItemsFromTrade(items)` — недокументированный
 * внутренний API самого Steam. Судя по симптому (Add работает, Clear — нет),
 * эта функция сейчас либо отсутствует, либо называется/ведёт себя иначе, чем
 * на момент написания оригинального скрипта — а
 * `win.GTradeStateManager?.RemoveItemsFromTrade?.(...)` из-за optional
 * chaining в этом случае просто молча ничего не делает, без единой ошибки в
 * консоли, поэтому баг было не сразу заметно.
 *
 * Вместо повторной попытки угадать актуальное имя внутреннего API — тот же
 * приём, что уже ДОКАЗАННО работает у `addItemsByElements` (см.
 * utils/trade-offer.ts): НАПРЯМУЮ работаем с массивом `assets` нужной стороны
 * в `window.g_rgCurrentTradeStatus` и зовём `window.RefreshTradeStatus(...)` —
 * это тот самый источник правды, который Steam использует для перерисовки
 * оффера, и он же не зависит от внутренних вспомогательных объектов вроде
 * GTradeStateManager.
 *
 * ИСПРАВЛЕНО (2) (второй баг-репорт: часть предметов не возвращалась в окно
 * выбора после очистки — пустая ячейка на их месте). Причина —
 * `tradeSide.assets = []` заменяла ссылку на массив НОВЫМ объектом.
 * `addItemsByElements` добавляет предметы через `slots.push(...)` — то есть
 * МУТИРУЕТ тот же самый массив, никогда не заменяя ссылку. Похоже, что-то во
 * внутренней логике Steam, решающей, какие тайлы в окне выбора сейчас скрыты
 * как "уже предложены", держит СВОЮ ссылку именно на этот массив-объект —
 * замена ссылки новым пустым массивом эту логику не находила. Чиним тем же
 * способом: очищаем массив НА МЕСТЕ (`.length = 0`), сохраняя объект-ссылку.
 *
 * ИСПРАВЛЕНО (3) (третий баг-репорт: тот же симптом остался ПОСЛЕ фикса
 * (2) — сначала казалось, что только у стороны партнёра, но подтвердилось,
 * что и у своей тоже, просто реже/на меньшем числе предметов, без явной
 * зависимости от количества — например, из 10 очищенных не возвращались 2,
 * из 11 — 3). Первая попытка чинить это (несколько проходов
 * `RefreshTradeStatus` подряд с задержкой) НЕ ПОМОГЛА — судя по всему, дело
 * не в том, что перерисовка не успевает за один проход, а в чём-то, что
 * `RefreshTradeStatus` в принципе не трогает для окна выбора предметов,
 * сколько раз его ни зови.
 *
 * Ключевая улика — четвёртый баг-репорт: обычная перезагрузка страницы
 * (F5, без переоткрытия оффера) ВСЕГДА возвращает все пропавшие тайлы на
 * место. Значит, дело не в реальном состоянии оффера (`g_rgCurrentTradeStatus`
 * у нас и так корректен — иначе перезагрузка бы это не чинила, она просто
 * заново рисует UI по тому же состоянию с сервера) — а исключительно в
 * клиентской перерисовке ИМЕННО окна выбора предметов, которая делает что-то
 * ПОЛНОСТЬЮ разное на "жёсткой" перезагрузке страницы (весь UI строится с
 * нуля) и на "мягком" `RefreshTradeStatus` (видимо, только частичный/
 * инкрементальный путь, у которого какой-то краевой случай отваливается на
 * части тайлов при массовой очистке).
 *
 * Раз RefreshTradeStatus не годится для ЭТОЙ конкретной перерисовки — не
 * пытаемся звать его ещё агрессивнее, а форсим тот же ПОЛНЫЙ путь
 * перерисовки окна выбора, которым Steam и так надёжно пользуется при
 * обычном переключении вкладки "свой"/"партнёра" (обычное ручное
 * переключение вкладок у пользователя проблем не вызывает — вопрос был
 * закрыт именно про "после очистки", а не "после смены вкладки"). Тот же
 * приём уже есть в оригинале — `forceVisibility()` там кликает по вкладке
 * партнёра и обратно именно чтобы заставить Steam ОТРИСОВАТЬ окно выбора
 * их инвентаря с нуля (правда, по другому поводу — там инвентарь партнёра
 * мог быть вообще ни разу не отрисован). ЭТО ТОЖЕ НЕ ПОМОГЛО (пятый
 * баг-репорт): переключение вкладки туда-обратно ничего не изменило.
 *
 * ИСПРАВЛЕНО (4) — решающая улика (шестой баг-репорт, с диагностикой в
 * консоли по моей просьбе): "зависает" ВСЕГДА ровно то, что превышает
 * первые 8 предметов стороны (10 очищенных → 2 не вернулись; 11 → 3;
 * 10-8=2, 11-8=3 — сходится идеально). 8 — это ровно столько слотов Steam
 * показывает по умолчанию (2 ряда × 4), прежде чем коробка оффера
 * динамически "растягивается" под большее количество. Плюс диагностика
 * подтвердила: `g_rgCurrentTradeStatus.me/them.assets` после очистки —
 * `[]` (пусто), и в DOM `#your_slots`/`#their_slots` — 0 элементов `.item`
 * в ОБОИХ случаях, то есть офферная часть чистится идеально каждый раз.
 * Значит, окно выбора решает "показывать тайл или нет" НЕ по
 * `g_rgCurrentTradeStatus` напрямую (тот уже доказанно корректен) — а по
 * какому-то отдельному, недоступному нам счётчику/кэшу, который, похоже,
 * умеет надёжно обработать только один "кадр" изменений за раз размером
 * до 8 — ровно как если бы предметы убирали по одному, а не оптом.
 *
 * Раз массовая (один вызов `RefreshTradeStatus` на всю пачку) очистка
 * упирается в этот потолок независимо от того, сколько раз или как именно
 * звать перерисовку — убираем предметы ПО ОДНОМУУ, отдельным вызовом
 * `RefreshTradeStatus` на каждый, с паузой в один кадр отрисовки
 * (`requestAnimationFrame`) между ними — тем самым имитируя ровно то, что
 * (судя по всему) единственное гарантированно работает: одно изменение за
 * раз, как при обычном перетаскивании предмета мышью.
 */
async function clearSide(win: TradeOfferWindow, side: 'me' | 'them'): Promise<boolean> {
  const status = win.g_rgCurrentTradeStatus;
  if (!status) return false; // страница ещё не готова — редкий случай, стоит показать ошибку

  const tradeSide = status[side];
  if (tradeSide.assets.length === 0) return true; // уже пусто — нечего чистить, но это не ошибка

  // По одному предмету за раз — см. ИСПРАВЛЕНО (4) выше.
  while (tradeSide.assets.length > 0) {
    tradeSide.assets.pop();
    if (win.GTradeStateManager) win.GTradeStateManager.m_bChangesMade = true;
    forceRefresh(win, status);
    await nextFrame();
  }

  return true;
}

/**
 * Регистрирует обработчик в MAIN world для всей панели "Быстрое добавление
 * предметов". В отличие от wallet-summary/trade-item-attributes (только
 * ЧТЕНИЕ состояния) этот канал ИЗМЕНЯЕТ оффер — но модель та же: ISOLATED
 * решает, что показать пользователю и что он нажал, MAIN — единственная
 * сторона, которая умеет действительно тронуть g_rgCurrentTradeStatus.
 */
export function registerQuickAddCoreHandler(): () => void {
  return respondInMain<QuickAddRequest, QuickAddResponse>(QUICK_ADD_CHANNEL, async (req) => {
    const win = window as unknown as TradeOfferWindow;

    if (req.mode === 'CLEAR_ME' || req.mode === 'CLEAR_THEM') {
      const ok = await clearSide(win, req.mode === 'CLEAR_ME' ? 'me' : 'them');
      return { satisfied: ok ? true : null };
    }

    if (!canModifyOffer()) return { satisfied: null };

    const { items, satisfied } = collectItems(win, req);
    addItemsByElements(win, items);
    return { satisfied };
  });
}
