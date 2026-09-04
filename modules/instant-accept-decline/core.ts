import { accountIdToSteamId64 } from '../../utils/steamid';
import { acceptTradeOffer, declineTradeOffer } from '../../utils/steam-trade-offer-api';
import type { Locale } from '../../utils/i18n';

const UI = {
  ru: {
    accept: 'Принять',
    decline: 'Отклонить',
    partnerNotFound: 'Не удалось определить партнёра оффера',
    confirmAccept: (offerId: string) => `Принять трейд-оффер #${offerId}?`,
    accepting: 'Принимаем…',
    error: (message: string | undefined) => `Ошибка: ${message}`,
    needsMobileConfirmation: 'Отправлено — подтвердите в мобильном приложении Steam',
    needsEmailConfirmation: 'Отправлено — подтвердите по email',
    accepted: 'Принято',
    declining: 'Отклоняем…',
    declined: 'Отклонено',
  },
  en: {
    accept: 'Accept',
    decline: 'Decline',
    partnerNotFound: "Couldn't determine the offer's trade partner",
    confirmAccept: (offerId: string) => `Accept trade offer #${offerId}?`,
    accepting: 'Accepting…',
    error: (message: string | undefined) => `Error: ${message}`,
    needsMobileConfirmation: 'Sent — confirm it in the Steam mobile app',
    needsEmailConfirmation: 'Sent — confirm it by email',
    accepted: 'Accepted',
    declining: 'Declining…',
    declined: 'Declined',
  },
} as const;

/**
 * "Мгновенные Accept/Decline" — кнопки принятия/отклонения прямо в списке
 * входящих офферов (`/tradeoffers`), без перехода на страницу оффера.
 *
 * Живой HTML реального `/tradeoffers` пользователя (5 активных офферов,
 * проверено через Просмотр кода страницы) показал: каждая строка —
 * `<div class="tradeoffer" id="tradeofferid_9343679954">`; у АКТИВНЫХ
 * (ожидающих ответа) офферов внутри есть `.tradeoffer_footer_actions` с
 * готовыми ссылками `javascript:ShowTradeOffer('id')` ("Respond to Offer")
 * и `javascript:DeclineTradeOffer('id')` ("Decline Trade") — у уже
 * обработанных (принятых/отклонённых/отменённых, показанных ниже как
 * история на той же странице) `.tradeoffer_footer_actions` в разметке
 * ПРОСТО НЕТ (вместо него — `.tradeoffer_items_banner` с текстом вроде
 * "Trade Accepted..."). Поэтому наличие `.tradeoffer_footer_actions` —
 * одновременно и признак "это активный оффер", и точка вставки: гадать
 * состояние по каким-то другим классам не нужно.
 *
 * ВАЖНО: "Decline Trade" у Steam УЖЕ мгновенный (вызывает их
 * `DeclineTradeOffer()`, AJAX без перезагрузки/перехода) — то есть половина
 * фичи из названия модуля технически уже есть нативно. Чего в списке
 * ДЕЙСТВИТЕЛЬНО не хватает — это мгновенного ACCEPT: "Respond to Offer"
 * лишь открывает модалку/страницу самого оффера, где accept только и
 * доступен. Поэтому ниже добавлены СВОИ кнопки "Принять"/"Отклонить" (обе,
 * не только принять) — decline через собственный AJAX-клиент
 * (utils/steam-trade-offer-api.ts), а не через нативный `DeclineTradeOffer`:
 * так обе кнопки одинаково самодостаточны (не зависят от того, что чужая
 * MAIN-мир-функция вообще определена к моменту клика), и визуально это
 * симметричная пара, а не "новая зелёная кнопка рядом со старой серой
 * ссылкой". Нативные "Respond to Offer | Decline Trade" НЕ убираются —
 * добавление чисто аддитивное, ничего у Steam не трогаем.
 *
 * SteamID64 партнёра (нужен параметром `partner` в accept-запросе, см.
 * utils/steam-trade-offer-api.ts) — из `.tradeoffer_partner
 * .playerAvatar[data-miniprofile]` той же строки (тот же `data-miniprofile`
 * = accountID, что и у steam-profile-links, см. utils/steamid.ts за
 * подтверждением live-сравнением).
 *
 * Подтверждение перед действием: у Accept — да (`window.confirm`), это
 * реальная, необратимая по сути операция (даже если потребуется мобильное
 * подтверждение — сам запрос всё равно уходит). У Decline — нет, как и у
 * нативной ссылки рядом (Decline безопасен и обратим — партнёр всегда
 * может прислать оффер заново).
 */

const FOOTER_PROCESSED_ATTR = 'data-tf2s-instant-actions';

function extractOfferId(row: HTMLElement): string | null {
  const m = row.id.match(/^tradeofferid_(\d+)$/);
  return m ? m[1] : null;
}

function extractPartnerSteamId64(row: HTMLElement): string | null {
  const avatar = row.querySelector<HTMLElement>('.tradeoffer_partner .playerAvatar[data-miniprofile]');
  const raw = avatar?.getAttribute('data-miniprofile');
  const accountId = raw ? Number(raw) : NaN;
  return Number.isFinite(accountId) && accountId > 0 ? accountIdToSteamId64(accountId) : null;
}

function setStatus(container: HTMLElement, text: string, kind: 'pending' | 'ok' | 'error'): void {
  let status = container.querySelector<HTMLElement>('.tf2s-iad-status');
  if (!status) {
    status = document.createElement('span');
    status.className = 'tf2s-iad-status';
    container.appendChild(status);
  }
  status.textContent = text;
  status.className = `tf2s-iad-status tf2s-iad-status--${kind}`;
}

function processFooter(footer: HTMLElement, row: HTMLElement, locale: Locale): void {
  if (footer.hasAttribute(FOOTER_PROCESSED_ATTR)) return;
  footer.setAttribute(FOOTER_PROCESSED_ATTR, '1');

  const offerId = extractOfferId(row);
  if (!offerId) return; // неожиданный id — молча не добавляем кнопки, лучше ничего, чем не туда

  const ui = UI[locale];

  const acceptBtn = document.createElement('button');
  acceptBtn.type = 'button';
  acceptBtn.className = 'tf2s-iad-btn tf2s-iad-btn--accept';
  acceptBtn.textContent = ui.accept;

  const declineBtn = document.createElement('button');
  declineBtn.type = 'button';
  declineBtn.className = 'tf2s-iad-btn tf2s-iad-btn--decline';
  declineBtn.textContent = ui.decline;

  function setButtonsDisabled(disabled: boolean) {
    acceptBtn.disabled = disabled;
    declineBtn.disabled = disabled;
  }

  acceptBtn.addEventListener('click', async () => {
    const partnerSteamId64 = extractPartnerSteamId64(row);
    if (!partnerSteamId64) {
      setStatus(footer, ui.partnerNotFound, 'error');
      return;
    }
    if (!window.confirm(ui.confirmAccept(offerId))) return;

    setButtonsDisabled(true);
    setStatus(footer, ui.accepting, 'pending');
    const result = await acceptTradeOffer(offerId, partnerSteamId64);
    if (!result.ok) {
      setStatus(footer, ui.error(result.error), 'error');
      setButtonsDisabled(false);
      return;
    }
    if (result.needsMobileConfirmation) {
      setStatus(footer, ui.needsMobileConfirmation, 'ok');
    } else if (result.needsEmailConfirmation) {
      setStatus(footer, ui.needsEmailConfirmation, 'ok');
    } else {
      setStatus(footer, ui.accepted, 'ok');
    }
  });

  declineBtn.addEventListener('click', async () => {
    setButtonsDisabled(true);
    setStatus(footer, ui.declining, 'pending');
    const result = await declineTradeOffer(offerId);
    if (!result.ok) {
      setStatus(footer, ui.error(result.error), 'error');
      setButtonsDisabled(false);
      return;
    }
    setStatus(footer, ui.declined, 'ok');
  });

  const group = document.createElement('span');
  group.className = 'tf2s-iad-group';
  group.append(' | ', acceptBtn, declineBtn);
  footer.appendChild(group);
}

/**
 * Матч-паттерн `.../tradeoffers*` в matches entrypoint'а (см. его doc-блок)
 * технически ловит и `/tradeoffers/sent` — сам синтаксис WXT/manifest match patterns
 * не умеет "всё, кроме конкретного хвоста". На `/sent` те же по виду
 * действия у Steam означают другое (наш собственный отправленный оффер
 * можно только Cancel, не Accept/Decline — это другая по смыслу операция,
 * вне рамок этой функции) — поэтому здесь, а не в матчере, отсекаем `/sent`
 * рантайм-проверкой пути, не полагаясь на предположения о разметке той
 * страницы (её живой HTML не проверялся).
 */
function isSentOffersPage(): boolean {
  return /\/tradeoffers\/sent\b/.test(window.location.pathname);
}

function scan(locale: Locale): void {
  if (isSentOffersPage()) return;
  document.querySelectorAll<HTMLElement>('.tradeoffer').forEach((row) => {
    const footer = row.querySelector<HTMLElement>(':scope > .tradeoffer_footer > .tradeoffer_footer_actions');
    if (footer) processFooter(footer, row, locale);
  });
}

export function startInstantAcceptDecline(locale: Locale): { stop: () => void } {
  scan(locale);

  let debounceTimer: number | undefined;
  const observer = new MutationObserver(() => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => scan(locale), 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return {
    stop: () => {
      observer.disconnect();
      window.clearTimeout(debounceTimer);
      document.querySelectorAll('.tf2s-iad-group').forEach((el) => el.remove());
      document.querySelectorAll(`[${FOOTER_PROCESSED_ATTR}]`).forEach((el) => el.removeAttribute(FOOTER_PROCESSED_ATTR));
    },
  };
}
