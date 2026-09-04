import { buildSteamIdSet, SteamIdSet } from '../../utils/steamid';
import { buildBackpackTfProfileUrl, buildPostsTfProfileUrl, buildSteamHistoryProfileUrl } from './links';
import type { Locale } from '../../utils/i18n';

const UI = {
  ru: { steamId: 'SteamID', copy: 'Скопировать', copied: 'Скопировано!' },
  en: { steamId: 'SteamID', copy: 'Copy', copied: 'Copied!' },
} as const;

/**
 * Ссылки + бейдж SteamID на главной странице профиля Steam — по прямой
 * просьбе пользователя (два скриншота левой панели профиля, см. чат):
 * "ссылки на бекпак, на стимхистоири, на пост тф... находится в после
 * Artwork... в дизайне Стима", плюс кнопка с бейджем
 * SteamID64/SteamID32/SteamID.
 *
 * ── Где вставляем ──────────────────────────────────────────────────────
 * Живой DOM (steamcommunity.com/id/rakovaya_opuhol/, тот самый профиль со
 * скриншотов, проверено через JS-инспекцию страницы) показал: ряд
 * "Игры / Инвентарь / Скриншоты / Работы в мастерской / Обзоры /
 * Иллюстрации" — это `.profile_item_links`, ряд `<div class="profile_count_link
 * ellipsis">` (каждый — ссылка + счётчик), с одним `<div style="clear:
 * left;">` последним ребёнком. "Иллюстрации" (Artwork) — последний реальный
 * пункт перед этим clear-div'ом, ровно там, где пользователь просил вставить
 * новые ссылки. Вставляем СВОИ пункты В ТОТ ЖЕ ряд, ПЕРЕД clear-div'ом —
 * этим и достигается "в дизайне Стима": используем их же классы
 * (`profile_count_link ellipsis`), их же CSS уже загружен на странице,
 * никакой своей палитры для самих ссылок не требуется.
 *
 * Страницы вроде `/games`, `/inventory` и т.д. этого блока не содержат
 * (проверено — на /inventory `.profile_item_links` в DOM просто нет), так
 * что достаточно матчить домен `steamcommunity.com/id/*` и
 * `steamcommunity.com/profiles/*` целиком (как и scrap-item-modal — см.
 * его doc-блок) и молча ничего не делать, если блока нет.
 *
 * ── Откуда SteamID64 ────────────────────────────────────────────────────
 * См. utils/steamid.ts — из `data-miniprofile` на аватаре в шапке
 * (`.playerAvatar.profile_header_size`), проверено живым сравнением с
 * `g_rgProfileData.steamid` той же страницы. Работает для ЛЮБОГО
 * просматриваемого профиля (свой или чужой — партнёра по трейду) — то же
 * самое DOM-поле что у себя, что у другого пользователя, поэтому этот
 * единый модуль и заменяет собой оба изначально запланированных
 * ('trade-partner-links' на странице оффера, 'profile-links' в списках
 * офферов, см. utils/registry.ts) — ссылки на партнёра теперь на самой
 * странице ЕГО профиля, куда и так можно перейти по клику на имя.
 *
 * ── Ссылки ──────────────────────────────────────────────────────────────
 * backpack.tf/posts.tf/steamhistory.net — см. links.ts, форматы проверены
 * (posts.tf — живым переходом, steamhistory.net — из примера пользователя,
 * backpack.tf — общеизвестный устоявшийся формат; подробности там же).
 *
 * ── Бейдж SteamID64/32/классического ────────────────────────────────────
 * Отдельный пункт-кнопка в том же ряду — по клику открывает маленький
 * попап (см. buildIdPopover ниже) с тремя форматами и кнопками копирования.
 * Попап — СВОЙ дизайн (tf2s-root/tf2s-panel из styles/tokens.css), не
 * стимовский: это не часть родной вёрстки страницы (Steam ничего подобного
 * нативно не показывает), поэтому здесь как раз уместна единая палитра
 * расширения, а не мимикрия — то же решение, что и у любого другого
 * всплывающего окна TF2 Trade Suite Tools (напр. scrap-item-modal).
 *
 * ── Community Bans — сознательно УБРАН ──────────────────────────────────
 * Изначально был отдельный пункт-кнопка "Community Bans ↗", ведущая на ту
 * же самую steamhistory.net-ссылку, что и обычный пункт "SteamHistory"
 * рядом — по факту дублировала его (открывала тот же URL). Причина, по
 * которой это не полноценный ВСТРОЕННЫЙ бан-статус, а просто ссылка —
 * честная: steamhistory.net при заходе (даже из настоящего браузера, не
 * headless) отдаёт экран проверки безопасности вместо страницы
 * (Cloudflare/анти-бот), так что даже живой просмотр разметки бан-статуса
 * (нужный, чтобы найти правильные CSS-классы) оказался недоступен — а
 * парсить чужую HTML-структуру, которую ни разу не видел, значило бы
 * гадать вслепую (см. README, "живой HTML вместо догадок"). Раз встроенный
 * статус реализовать честно нельзя, а вести на ту же ссылку, что уже есть
 * — просто дублирование, по прямой просьбе пользователя лишний пункт убран
 * целиком ("если не получается его сделать — лучше просто убрать эту
 * ссылку, тк у нас и так есть ссылка на стимхистори"). Посмотреть Community
 * Bans по-прежнему можно — по обычной ссылке "SteamHistory" в этом же ряду.
 */

const PROCESSED_ATTR = 'data-tf2s-steam-profile-links';
const ROW_ITEM_CLASS = 'tf2s-steamprofile-item';
const POPOVER_CLASS = 'tf2s-steamprofile-popover';

function findAccountId(): number | null {
  const avatar = document.querySelector<HTMLElement>('.playerAvatar.profile_header_size[data-miniprofile]');
  const raw = avatar?.getAttribute('data-miniprofile');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Пункт ряда `.profile_item_links` — обычная ссылка, стимовские классы. */
function buildLinkItem(label: string, href: string): HTMLElement {
  const item = document.createElement('div');
  item.className = `profile_count_link ellipsis ${ROW_ITEM_CLASS}`;
  item.setAttribute('role', 'button');

  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'count_link_label';
  labelSpan.textContent = label;
  a.appendChild(labelSpan);

  item.appendChild(a);
  return item;
}

/** Пункт ряда — кнопка (не ссылка), например бейдж SteamID. */
function buildButtonItem(label: string, onActivate: (anchor: HTMLElement) => void): HTMLElement {
  const item = document.createElement('div');
  item.className = `profile_count_link ellipsis ${ROW_ITEM_CLASS}`;
  item.setAttribute('role', 'button');

  const a = document.createElement('a');
  a.href = 'javascript:void(0)';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'count_link_label';
  labelSpan.textContent = label;
  a.appendChild(labelSpan);

  a.addEventListener('click', (e) => {
    e.preventDefault();
    onActivate(a);
  });

  item.appendChild(a);
  return item;
}

function copyToClipboard(text: string, statusEl: HTMLElement, locale: Locale): void {
  const done = () => {
    const prev = statusEl.textContent;
    statusEl.textContent = UI[locale].copied;
    window.setTimeout(() => {
      statusEl.textContent = prev;
    }, 1200);
  };
  navigator.clipboard?.writeText(text).then(done, () => {
    // Fallback для страниц/окружений без Clipboard API (напр. не-https,
    // хотя steamcommunity.com всегда https) — тихо ничего не делаем,
    // значение всё равно видно текстом и его можно выделить вручную.
  });
}

function buildIdRow(label: string, value: string, locale: Locale): HTMLElement {
  const row = document.createElement('div');
  row.className = 'tf2s-steamprofile-idrow';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'tf2s-muted';
  labelSpan.textContent = label;

  const valueCode = document.createElement('code');
  valueCode.className = 'tf2s-steamprofile-idvalue';
  valueCode.textContent = value;

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'tf2s-btn tf2s-btn--icon';
  copyBtn.title = UI[locale].copy;
  copyBtn.textContent = '⧉';

  const status = document.createElement('span');
  status.className = 'tf2s-steamprofile-idstatus tf2s-muted';

  copyBtn.addEventListener('click', () => copyToClipboard(value, status, locale));

  row.append(labelSpan, valueCode, copyBtn, status);
  return row;
}

function buildIdPopover(ids: SteamIdSet, locale: Locale): HTMLElement {
  const root = document.createElement('div');
  root.className = 'tf2s-root';

  const panel = document.createElement('div');
  panel.className = `tf2s-panel ${POPOVER_CLASS}`;

  const title = document.createElement('div');
  title.className = 'tf2s-steamprofile-popover-title';
  title.textContent = UI[locale].steamId;

  panel.appendChild(title);
  panel.appendChild(buildIdRow('SteamID64', ids.steamId64, locale));
  panel.appendChild(buildIdRow('SteamID32', ids.steamId32, locale));
  panel.appendChild(buildIdRow('SteamID', ids.steamIdClassic, locale));

  root.appendChild(panel);
  return root;
}

function positionPopover(popover: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  popover.style.position = 'absolute';
  popover.style.top = `${window.scrollY + rect.bottom + 4}px`;
  popover.style.left = `${window.scrollX + rect.left}px`;
  popover.style.zIndex = '2147483647';
}

function insertLinks(container: HTMLElement, locale: Locale): void {
  const accountId = findAccountId();
  if (!accountId) return; // приватный/необычный профиль без обычной шапки — молча ничего не делаем

  const ids = buildSteamIdSet(accountId);

  const items = [
    buildLinkItem('backpack.tf', buildBackpackTfProfileUrl(ids.steamId64)),
    buildLinkItem('SteamHistory', buildSteamHistoryProfileUrl(ids.steamId64)),
    buildLinkItem('posts.tf', buildPostsTfProfileUrl(ids.steamId64)),
  ];

  let openPopover: HTMLElement | null = null;
  const closePopover = () => {
    openPopover?.remove();
    openPopover = null;
    document.removeEventListener('mousedown', onOutsideClick, true);
    document.removeEventListener('keydown', onEscape, true);
  };
  function onOutsideClick(e: MouseEvent) {
    if (openPopover && !openPopover.contains(e.target as Node)) closePopover();
  }
  function onEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') closePopover();
  }

  const idButton = buildButtonItem(UI[locale].steamId, (anchor) => {
    if (openPopover) {
      closePopover();
      return;
    }
    const popover = buildIdPopover(ids, locale);
    document.body.appendChild(popover);
    positionPopover(popover, anchor);
    openPopover = popover;
    // Слушатели вешаем на следующий тик — иначе тот же самый click,
    // который открыл попап (bubбl'ится до document), сразу же его закроет.
    window.setTimeout(() => {
      document.addEventListener('mousedown', onOutsideClick, true);
      document.addEventListener('keydown', onEscape, true);
    }, 0);
  });
  items.push(idButton);

  const clearDiv = container.querySelector(':scope > div[style*="clear"]');
  for (const item of items) {
    if (clearDiv) clearDiv.before(item);
    else container.appendChild(item);
  }
}

function scan(locale: Locale): void {
  const container = document.querySelector<HTMLElement>('.profile_item_links');
  if (!container || container.hasAttribute(PROCESSED_ATTR)) return;
  container.setAttribute(PROCESSED_ATTR, '1');
  insertLinks(container, locale);
}

export function startSteamProfileLinks(locale: Locale): { stop: () => void } {
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
      document.querySelectorAll(`.${ROW_ITEM_CLASS}`).forEach((el) => el.remove());
      document.querySelectorAll(`.${POPOVER_CLASS}`).forEach((el) => el.closest('.tf2s-root')?.remove());
      document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach((el) => el.removeAttribute(PROCESSED_ATTR));
    },
  };
}
