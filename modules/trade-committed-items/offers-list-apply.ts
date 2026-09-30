import { storage } from 'wxt/storage';
import {
  COMMITTED_OFFERS_STORAGE_KEY,
  CommittedOffer,
  buildCommittedAssetMap,
  buildCommittedEconomyMap,
  fetchOfferDetails,
  getCommittedOffers,
  isCurrencyEconomyKey,
  parseSentOffersFromDoc,
  saveCommittedOffers,
  syncSentOffersViaNetwork,
} from '../../utils/committed-offers';
import { applyCommittedStyle, removeCommittedStyle, updateCommittedGlobalStyles } from './render';
import {
  COMMITTED_ITEMS_FEATURE_ID,
  COMMITTED_OPTIONS_KEY,
  CommittedItemsOptions,
  DEFAULT_COMMITTED_ITEMS_OPTIONS,
} from './types';
import { getModuleOption, watchSettings } from '../../utils/settings';
import type { Locale } from '../../utils/i18n';

const WARNING_CLASS = 'tf2s-committed-offer-warning';

export function startOffersListCommittedTracker(_locale: Locale): { stop: () => void } {
  let stopped = false;
  let options: CommittedItemsOptions = DEFAULT_COMMITTED_ITEMS_OPTIONS;
  let scanTimer: number | undefined;
  const fetchingOffers = new Set<string>();

  async function syncAndRender() {
    if (stopped) return;

    options = await getModuleOption<CommittedItemsOptions>(
      COMMITTED_ITEMS_FEATURE_ID,
      COMMITTED_OPTIONS_KEY,
      DEFAULT_COMMITTED_ITEMS_OPTIONS,
    );
    updateCommittedGlobalStyles(options);

    // 1. Считываем отправленные офферы прямо из текущего DOM страницы
    const domOffers = parseSentOffersFromDoc(document);
    let storedOffers = await getCommittedOffers();

    // Фоново актуализируем через Steam Web API с кулдауном 60с
    void syncSentOffersViaNetwork().then((fresh) => {
      if (!stopped && fresh && Object.keys(fresh).length > 0) {
        triggerScan(80);
      }
    });

    // Объединяем офферы из DOM с кэшем хранилища, никогда не затирая точные assetIds пустым массивом
    for (const [id, offer] of Object.entries(domOffers)) {
      if (storedOffers[id]) {
        if (storedOffers[id].assetIds?.length > 0 && (!offer.assetIds || offer.assetIds.length === 0)) {
          offer.assetIds = storedOffers[id].assetIds;
        }
        if (storedOffers[id].partnerName && storedOffers[id].partnerName !== 'Трейдер') {
          offer.partnerName = storedOffers[id].partnerName;
        }
        if (storedOffers[id].partnerSteamId) {
          offer.partnerSteamId = storedOffers[id].partnerSteamId;
        }
        if (storedOffers[id].economyKeys?.length) {
          const storedKeys = storedOffers[id].economyKeys ?? [];
          const curKeys = offer.economyKeys ?? [];
          offer.economyKeys = Array.from(new Set([...curKeys, ...storedKeys]));
        }
      }
      storedOffers[id] = offer;

      // Если в DOM-оффере есть предметы без точного assetId — фоново запрашиваем детали оффера
      if (!fetchingOffers.has(id) && (!offer.assetIds || offer.assetIds.length < (offer.economyKeys?.length ?? 1))) {
        fetchingOffers.add(id);
        void fetchOfferDetails(id).then(async (details) => {
          fetchingOffers.delete(id);
          if (!details || details.assetIds.length === 0) return;
          const current = await getCommittedOffers();
          if (current[id]) {
            const prevIds = current[id].assetIds ?? [];
            current[id].assetIds = Array.from(new Set([...prevIds, ...details.assetIds]));
            if (details.partnerName && details.partnerName !== 'Трейдер') {
              current[id].partnerName = details.partnerName;
            }
            if (details.partnerSteamId) {
              current[id].partnerSteamId = details.partnerSteamId;
            }
            await saveCommittedOffers(current);
            triggerScan(80);
          }
        });
      }
    }

    // Если мы на странице отправленных офферов, очищаем те, которые уже не в DOM (были отменены/приняты)
    if (window.location.pathname.includes('/sent')) {
      for (const cachedId of Object.keys(storedOffers)) {
        if (!domOffers[cachedId]) {
          delete storedOffers[cachedId];
        }
      }
    }

    await saveCommittedOffers(storedOffers);

    // Удаляем любые старые предупреждающие плашки ⚠️ (по просьбе пользователя)
    document.querySelectorAll(`.${WARNING_CLASS}`).forEach((el) => el.remove());

    // 2. Строим карты занятости предметов: по assetId (точное совпадение) и по economyKey
    const assetMap = buildCommittedAssetMap(storedOffers);
    const economyMap = buildCommittedEconomyMap(storedOffers);

    const offerElements = document.querySelectorAll<HTMLElement>('.tradeoffer');

    for (const offerEl of offerElements) {
      const offerIdMatch = offerEl.id.match(/\d+/);
      if (!offerIdMatch) continue;
      const offerId = offerIdMatch[0];

      // Находим контейнер с вашими предметами в этом оффере
      const itemsContainers = offerEl.querySelectorAll('.tradeoffer_items');
      let relevantContainer: Element | null = null;
      for (const c of itemsContainers) {
        const h = c.querySelector('.tradeoffer_items_header')?.textContent || '';
        if (/You offered|Вы предложили|Items you will offer|Items you offered|Ваши предметы|Вы отдадите|Items you will give/i.test(h)) {
          relevantContainer = c;
          break;
        }
      }
      if (!relevantContainer && itemsContainers.length > 0) {
        relevantContainer = itemsContainers[0];
      }

      const tradeItems = relevantContainer
        ? relevantContainer.querySelectorAll<HTMLElement>('.trade_item, [data-economy-item]')
        : [];

      // Проверяем каждый предмет в оффере на пересечение
      tradeItems.forEach((itemEl) => {
        const key = itemEl.getAttribute('data-economy-item') || itemEl.querySelector('[data-economy-item]')?.getAttribute('data-economy-item');
        if (!key) return;

        const assetMatch = itemEl.id?.match(/\d+_\d+_(\d+)/) || itemEl.getAttribute('data-assetid');
        let assetId: string | null = null;
        if (assetMatch) {
          assetId = typeof assetMatch === 'string' ? assetMatch : assetMatch[1];
        } else {
          const onclick = itemEl.getAttribute('onclick') || itemEl.getAttribute('href') || '';
          const hoverMatch = onclick.match(/ShowItemHover\s*\(\s*this,\s*['"](?:item)?\d+_\d+_(\d+)['"]/);
          if (hoverMatch) assetId = hoverMatch[1];
        }

        let otherOffers: CommittedOffer[] = [];
        if (assetId && assetMap.has(assetId)) {
          // Точное совпадение по assetId (работает и для валюты, и для уникальных предметов)
          otherOffers = (assetMap.get(assetId) ?? []).filter((o) => o.offerId !== offerId);
        } else if (!isCurrencyEconomyKey(key)) {
          // Для уникальных предметов (шапки, оружие, анъюжиалы) сопоставляем по classinfo
          otherOffers = (economyMap.get(key) ?? []).filter((o) => o.offerId !== offerId);
        }

        if (otherOffers.length > 0) {
          applyCommittedStyle(itemEl, otherOffers, options, assetId ?? key);
        } else if (itemEl.hasAttribute('data-tf2s-committed')) {
          removeCommittedStyle(itemEl);
        }
      });
    }
  }

  function triggerScan(delay = 120) {
    if (stopped) return;
    if (scanTimer) window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(syncAndRender, delay);
  }

  void syncAndRender();

  // Наблюдатель мутаций с фильтрацией собственных элементов
  const observer = new MutationObserver((mutations) => {
    let hasRelevant = false;
    for (const m of mutations) {
      if (m.type === 'childList') {
        for (const n of m.addedNodes) {
          if (n instanceof HTMLElement && (n.classList.contains('tf2s-committed-badge') || n.classList.contains(WARNING_CLASS))) continue;
          hasRelevant = true;
          break;
        }
        if (hasRelevant) break;
      }
    }
    if (hasRelevant) {
      triggerScan(120);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const unwatchSettings = watchSettings(() => {
    triggerScan(50);
  });

  return {
    stop: () => {
      stopped = true;
      if (scanTimer) window.clearTimeout(scanTimer);
      observer.disconnect();
      unwatchSettings();
      document.querySelectorAll(`.${WARNING_CLASS}`).forEach((el) => el.remove());
      document.querySelectorAll<HTMLElement>('[data-tf2s-committed]').forEach((el) => removeCommittedStyle(el));
    },
  };
}
