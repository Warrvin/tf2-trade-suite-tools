import { declineTradeOffer } from '../../utils/steam-trade-offer-api';
import type { Locale } from '../../utils/i18n';

const UI = {
  ru: {
    declining: 'Отклоняем…',
    declined: 'Отклонено',
    error: (message: string | undefined) => `Ошибка: ${message}`,
    button: (n: number) => `Отклонить все активные (${n})`,
    confirm: (n: number) => `Отклонить ВСЕ ${n} активных входящих оффера(ов)? Это действие нельзя отменить.`,
    done: (done: number, failed: number) => (failed ? `Готово: ${done} отклонено, ${failed} с ошибкой` : `Готово: все ${done} отклонены`),
  },
  en: {
    declining: 'Declining…',
    declined: 'Declined',
    error: (message: string | undefined) => `Error: ${message}`,
    button: (n: number) => `Decline all active (${n})`,
    confirm: (n: number) => `Decline ALL ${n} active incoming offer(s)? This can't be undone.`,
    done: (done: number, failed: number) => (failed ? `Done: ${done} declined, ${failed} failed` : `Done: all ${done} declined`),
  },
} as const;

/**
 * "Decline All Active" — одна кнопка над списком входящих офферов,
 * отклоняющая ВСЕ активные (ожидающие ответа) офферы разом, с
 * подтверждением перед стартом (per registry.ts: `defaultEnabled: false`,
 * "с подтверждением" — единственный planned-модуль в проекте, у которого
 * это явно прописано в описании).
 *
 * Переиспользует ту же живую разметку и тот же AJAX-клиент decline, что и
 * `instant-accept-decline` (utils/steam-trade-offer-api.ts — requirement 4,
 * не дублируем сетевой код): "активный" оффер — строка `.tradeoffer`, у
 * которой есть `.tradeoffer_footer_actions` (у уже принятых/отклонённых/
 * отменённых в истории на той же странице этого блока в разметке просто
 * нет — заменён на `.tradeoffer_items_banner`, см. живой HTML в
 * modules/instant-accept-decline/core.ts).
 *
 * Кнопка вставляется ОДИН раз, перед первой строкой `.tradeoffer`, и только
 * если активных офферов ≥ 1 (нечего отклонять — незачем показывать кнопку).
 * Список отклоняемых офферов — снимок на момент показа кнопки (её один раз
 * и рендерим за весь заход на страницу); если пользователь до клика успел
 * вручную обработать один из них через `instant-accept-decline` — повторный
 * decline на уже неактуальный offerId у Steam просто вернёт ошибку для этой
 * строки (см. `markRowStatus` ниже), без последствий для остальных.
 *
 * Отклонения идут ПОСЛЕДОВАТЕЛЬНО с небольшой паузой (350мс) между запросами
 * — не заваливаем Steam очередью параллельных POST-ов подряд, тот же
 * осторожный темп, которого придерживаются большинство сторонних
 * трейд-инструментов при массовых операциях.
 */

const PANEL_CLASS = 'tf2s-daa-panel';
const ROW_STATUS_CLASS = 'tf2s-daa-row-status';

function isSentOffersPage(): boolean {
  // См. modules/instant-accept-decline/core.ts — тот же приём и та же
  // причина: match-паттерн entrypoint'а не умеет исключить `/sent`.
  return /\/tradeoffers\/sent\b/.test(window.location.pathname);
}

function extractOfferId(row: HTMLElement): string | null {
  const m = row.id.match(/^tradeofferid_(\d+)$/);
  return m ? m[1] : null;
}

function findActiveRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.tradeoffer')].filter((row) =>
    row.querySelector(':scope > .tradeoffer_footer > .tradeoffer_footer_actions'),
  );
}

function markRowStatus(row: HTMLElement, text: string, kind: 'pending' | 'ok' | 'error'): void {
  const footer = row.querySelector<HTMLElement>(':scope > .tradeoffer_footer');
  if (!footer) return;
  let el = footer.querySelector<HTMLElement>(`.${ROW_STATUS_CLASS}`);
  if (!el) {
    el = document.createElement('span');
    el.className = ROW_STATUS_CLASS;
    footer.appendChild(el);
  }
  el.textContent = text;
  el.dataset.kind = kind;
}

async function declineAll(rows: HTMLElement[], progressEl: HTMLElement, button: HTMLButtonElement, locale: Locale): Promise<void> {
  const ui = UI[locale];
  button.disabled = true;
  let done = 0;
  let failed = 0;

  for (const row of rows) {
    const offerId = extractOfferId(row);
    if (!offerId) {
      failed++;
      continue;
    }
    markRowStatus(row, ui.declining, 'pending');
    // eslint-disable-next-line no-await-in-loop -- последовательно намеренно, см. doc-блок файла
    const result = await declineTradeOffer(offerId);
    if (result.ok) {
      done++;
      markRowStatus(row, ui.declined, 'ok');
    } else {
      failed++;
      markRowStatus(row, ui.error(result.error), 'error');
    }
    progressEl.textContent = `${done + failed} / ${rows.length}`;
    // eslint-disable-next-line no-await-in-loop -- пауза между запросами намеренная, см. doc-блок файла
    await new Promise((resolve) => window.setTimeout(resolve, 350));
  }

  button.textContent = ui.done(done, failed);
}

function buildPanel(rows: HTMLElement[], locale: Locale): HTMLElement {
  const ui = UI[locale];
  const panel = document.createElement('div');
  panel.className = PANEL_CLASS;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tf2s-daa-btn';
  button.textContent = ui.button(rows.length);

  const progress = document.createElement('span');
  progress.className = 'tf2s-daa-progress';

  button.addEventListener('click', () => {
    const confirmed = window.confirm(ui.confirm(rows.length));
    if (!confirmed) return;
    void declineAll(rows, progress, button, locale);
  });

  panel.append(button, progress);
  return panel;
}

function scan(locale: Locale): void {
  if (isSentOffersPage()) return;
  if (document.querySelector(`.${PANEL_CLASS}`)) return; // уже вставлено

  const firstRow = document.querySelector<HTMLElement>('.tradeoffer');
  if (!firstRow?.parentElement) return;

  const activeRows = findActiveRows();
  if (activeRows.length === 0) return; // отклонять нечего

  firstRow.parentElement.insertBefore(buildPanel(activeRows, locale), firstRow);
}

export function startDeclineAllActive(locale: Locale): { stop: () => void } {
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
      document.querySelectorAll(`.${PANEL_CLASS}`).forEach((el) => el.remove());
      document.querySelectorAll(`.${ROW_STATUS_CLASS}`).forEach((el) => el.remove());
    },
  };
}
