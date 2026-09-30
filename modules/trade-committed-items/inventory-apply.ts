import { storage } from 'wxt/storage';
import {
  COMMITTED_OFFERS_STORAGE_KEY,
  CommittedOffer,
  buildCommittedAssetMap,
  buildCommittedEconomyMap,
  getCommittedOffers,
  isCurrencyEconomyKey,
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

const ITEM_ID_RE = /^(?:item)?440_2_(\d+)$/;

export function startInventoryCommittedTracker(): { stop: () => void } {
  let stopped = false;
  let options: CommittedItemsOptions = DEFAULT_COMMITTED_ITEMS_OPTIONS;
  let committedMap = new Map<string, CommittedOffer[]>();
  let committedEconomyMap = new Map<string, CommittedOffer[]>();
  let scanTimer: number | undefined;

  async function updateData() {
    options = await getModuleOption<CommittedItemsOptions>(
      COMMITTED_ITEMS_FEATURE_ID,
      COMMITTED_OPTIONS_KEY,
      DEFAULT_COMMITTED_ITEMS_OPTIONS,
    );
    updateCommittedGlobalStyles(options);

    const rawOffers = await getCommittedOffers();
    applyOffersData(rawOffers);

    // Фоновая актуализация с защитным кулдауном 60с
    void syncSentOffersViaNetwork().then((fresh) => {
      if (!stopped && fresh && Object.keys(fresh).length > 0) {
        applyOffersData(fresh);
      }
    });
  }

  function applyOffersData(offers: Record<string, CommittedOffer>) {
    committedMap = buildCommittedAssetMap(offers);
    committedEconomyMap = buildCommittedEconomyMap(offers);
    triggerScan(50);
  }

  function scan() {
    if (stopped) return;

    if (committedMap.size === 0 && committedEconomyMap.size === 0) {
      document.querySelectorAll<HTMLElement>('.item[data-tf2s-committed]').forEach(removeCommittedStyle);
      return;
    }

    // В инвентаре Steam элементы имеют id="440_2_<assetId>" внутри .itemHolder
    const items = document.querySelectorAll<HTMLElement>('.itemHolder .item[id], div.item[id^="440_2_"]');
    items.forEach((el) => {
      const match = el.id.match(ITEM_ID_RE);
      if (!match) return;

      const assetId = match[1];
      let offers = committedMap.get(assetId);

      // Если по точному assetId не найдено — проверяем по classinfo (для шапок и оружия, кроме валюты)
      if (!offers || offers.length === 0) {
        const holder = el.closest('.itemHolder') || el;
        const econKey =
          el.getAttribute('data-economy-item') ||
          holder.getAttribute('data-economy-item') ||
          holder.querySelector('[data-economy-item]')?.getAttribute('data-economy-item');
        if (econKey && !isCurrencyEconomyKey(econKey) && committedEconomyMap.has(econKey)) {
          offers = committedEconomyMap.get(econKey);
        }
      }

      if (offers && offers.length > 0) {
        applyCommittedStyle(el, offers, options, assetId);
      } else if (el.hasAttribute('data-tf2s-committed')) {
        removeCommittedStyle(el);
      }
    });
  }

  function triggerScan(delay = 100) {
    if (stopped) return;
    if (scanTimer) window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, delay);
  }

  void updateData();

  // Кэшируем loyalty_webapi_token, если страница его содержит
  const appConfig = document.getElementById('application_config');
  if (appConfig) {
    const raw = appConfig.getAttribute('data-loyalty_webapi_token');
    if (raw) {
      try {
        const t = JSON.parse(raw);
        if (t && typeof t === 'string') void storage.setItem('local:tf2s_steam_webapi_token', t);
      } catch {
        void storage.setItem('local:tf2s_steam_webapi_token', raw);
      }
    }
  }

  // Наблюдатель за переключением страниц инвентаря (< N из M >) с защитой от циклов
  const observer = new MutationObserver((mutations) => {
    let hasRelevant = false;
    for (const m of mutations) {
      if (m.type === 'childList') {
        for (const n of m.addedNodes) {
          if (n instanceof HTMLElement && n.classList.contains('tf2s-committed-badge')) continue;
          hasRelevant = true;
          break;
        }
        if (hasRelevant) break;
      } else if (m.type === 'attributes') {
        const target = m.target as HTMLElement;
        if (target.classList.contains('tf2s-committed-badge')) continue;
        if (m.attributeName === 'class' && (target.classList.contains('tf2s-committed--border') || target.classList.contains('tf2s-committed--bg'))) {
          continue;
        }
        hasRelevant = true;
        break;
      }
    }
    if (hasRelevant) {
      triggerScan(100);
    }
  });

  const inventoryContainer = document.getElementById('inventories') || document.body;
  observer.observe(inventoryContainer, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['id', 'class'],
  });

  // Реакция только на клики перелистывания страниц и смены фильтров инвентаря
  const onPageClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('.pagebtn, .inventory_page, .inventory_filters, [id^="inventory_tab"], .inventory_pagecontrols')) {
      triggerScan(80);
    }
  };
  document.addEventListener('click', onPageClick, false);

  const pollTimer = window.setInterval(() => triggerScan(150), 4000);

  const unwatchSettings = watchSettings((settings) => {
    const nextOptions =
      (settings.moduleOptions[COMMITTED_ITEMS_FEATURE_ID]?.[COMMITTED_OPTIONS_KEY] as CommittedItemsOptions | undefined) ??
      DEFAULT_COMMITTED_ITEMS_OPTIONS;
    options = nextOptions;
    updateCommittedGlobalStyles(options);
    triggerScan(50);
  });

  const unwatchStorage = storage.watch<Record<string, CommittedOffer>>(COMMITTED_OFFERS_STORAGE_KEY, (newVal) => {
    applyOffersData(newVal ?? {});
  });

  return {
    stop: () => {
      stopped = true;
      if (scanTimer) window.clearTimeout(scanTimer);
      window.clearInterval(pollTimer);
      document.removeEventListener('click', onPageClick, false);
      observer.disconnect();
      unwatchSettings();
      unwatchStorage();

      document.querySelectorAll<HTMLElement>('[data-tf2s-committed]').forEach((el) => {
        removeCommittedStyle(el);
      });
    },
  };
}
