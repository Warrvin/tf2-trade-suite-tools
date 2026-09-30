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

const ITEM_ID_RE = /^item440_2_(\d+)$/;

export function startTradeOfferCommittedTracker(): { stop: () => void } {
  let stopped = false;
  let options: CommittedItemsOptions = DEFAULT_COMMITTED_ITEMS_OPTIONS;
  let committedMap = new Map<string, CommittedOffer[]>();
  let committedEconomyMap = new Map<string, CommittedOffer[]>();
  let scanTimer: number | undefined;

  let meSteamId: string | null = null;
  let partnerSteamId: string | null = null;

  function findScriptMatch(re: RegExp): string | null {
    for (const script of Array.from(document.scripts)) {
      if (!script.src && script.textContent) {
        const match = script.textContent.match(re);
        if (match) return match[1];
      }
    }
    return null;
  }

  function getMySteamId(): string | null {
    const cookieMatch = document.cookie.match(/steamLoginSecure=(\d{17})/);
    if (cookieMatch) return cookieMatch[1];
    return findScriptMatch(/UserYou\.SetSteamId\(\s*['"](\d+)['"]\s*\)/);
  }

  function getPartnerSteamId(): string | null {
    const win = window as unknown as Record<string, unknown>;
    const themObj = win.UserThem as { strSteamId?: string } | undefined;
    if (themObj?.strSteamId) return themObj.strSteamId;
    if (win.g_ulTradePartnerSteamID) return String(win.g_ulTradePartnerSteamID);
    return findScriptMatch(/UserThem\.SetSteamId\(\s*['"](\d+)['"]\s*\)/);
  }

  function parsePageSteamIds() {
    meSteamId = getMySteamId();
    partnerSteamId = getPartnerSteamId();
  }
  parsePageSteamIds();

  const currentOfferMatch = window.location.pathname.match(/\/tradeoffer\/(\d+)/);
  const currentOfferId = currentOfferMatch ? currentOfferMatch[1] : null;

  async function updateData() {
    options = await getModuleOption<CommittedItemsOptions>(
      COMMITTED_ITEMS_FEATURE_ID,
      COMMITTED_OPTIONS_KEY,
      DEFAULT_COMMITTED_ITEMS_OPTIONS,
    );
    updateCommittedGlobalStyles(options);

    const rawOffers = await getCommittedOffers();
    applyOffersData(rawOffers);

    // Фоновая актуализация через Steam Web API с кулдауном 60с
    void syncSentOffersViaNetwork().then((fresh) => {
      if (!stopped && fresh && Object.keys(fresh).length > 0) {
        applyOffersData(fresh);
      }
    });
  }

  function applyOffersData(offers: Record<string, CommittedOffer>) {
    const activeOffers: Record<string, CommittedOffer> = {};

    for (const [id, offer] of Object.entries(offers)) {
      if (currentOfferId && id === currentOfferId) continue;
      activeOffers[id] = offer;
    }

    committedMap = buildCommittedAssetMap(activeOffers);
    committedEconomyMap = buildCommittedEconomyMap(activeOffers);
    triggerScan(50);
  }

  function scan() {
    if (stopped) return;

    if (!meSteamId || !partnerSteamId) {
      parsePageSteamIds();
    }

    if (committedMap.size === 0 && committedEconomyMap.size === 0) {
      document.querySelectorAll<HTMLElement>('div.item[data-tf2s-committed]').forEach(removeCommittedStyle);
      return;
    }

    // Быстрый поиск контейнеров для фильтрации стороны трейда
    const theirSlots = document.getElementById('their_slots');
    const partnerInv = partnerSteamId ? document.getElementById(`inventory_${partnerSteamId}_440_2`) : null;
    const theirInvTab = document.getElementById('inventory_select_their_inventory');
    const isTheirTabActive = theirInvTab?.classList.contains('active') ?? false;

    // Сканируем только свои слоты и область инвентаря
    const items = document.querySelectorAll<HTMLElement>('#your_slots div.item[id^="item440_2_"], #inventory_box div.item[id^="item440_2_"]');

    items.forEach((el) => {
      const match = el.id.match(ITEM_ID_RE);
      if (!match) return;

      // Быстрая проверка принадлежности предмета без медленных traversal .closest()
      if (theirSlots && theirSlots.contains(el)) {
        if (el.hasAttribute('data-tf2s-committed')) removeCommittedStyle(el);
        return;
      }
      if (partnerInv && partnerInv.contains(el)) {
        if (el.hasAttribute('data-tf2s-committed')) removeCommittedStyle(el);
        return;
      }
      if (isTheirTabActive && !el.closest('#your_slots')) {
        if (el.hasAttribute('data-tf2s-committed')) removeCommittedStyle(el);
        return;
      }

      const assetId = match[1];
      let offers = committedMap.get(assetId);

      // Если по точному assetId не найдено — проверяем по classinfo (для шапок и оружия, кроме валюты)
      if (!offers || offers.length === 0) {
        const econKey =
          el.getAttribute('data-economy-item') ||
          el.querySelector('[data-economy-item]')?.getAttribute('data-economy-item');
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

  // Наблюдатель мутаций с защитой от зацикливания собственных классов
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

  const invBox = document.getElementById('inventory_box') || document.body;
  observer.observe(invBox, { childList: true, subtree: true, attributes: true, attributeFilter: ['id', 'class'] });

  const yourSlots = document.getElementById('your_slots');
  if (yourSlots) {
    observer.observe(yourSlots, { childList: true, subtree: true, attributes: true, attributeFilter: ['id', 'class'] });
  }

  // Реакция только на целевые клики (вкладки инвентарей, кнопки страниц, перетаскивание слотов)
  const onPageClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('.inventory_tab, [id^="inventory_select_"], .pagebtn, .item, .slot, .trade_partner_header')) {
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
