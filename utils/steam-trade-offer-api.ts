/**
 * Общий AJAX-клиент accept/decline трейд-офферов Steam — используется двумя
 * модулями (`instant-accept-decline`, `decline-all-active`), вынесено сюда,
 * а не продублировано в каждом (requirement 4).
 *
 * Эндпоинты и формат тела запроса — публичный, стабильный годами контракт
 * самого steamcommunity.com:
 *   POST /tradeoffer/<id>/decline   body: sessionid
 *   POST /tradeoffer/<id>/accept    body: sessionid, serverid=1, tradeofferid,
 *                                         partner=<SteamID64 партнёра>, captcha=''
 * Это ровно тот же контракт, которым пользуется указанный в utils/registry.ts
 * portedFrom источник (Steam Trade Offer Enhancer) и множество других
 * независимых инструментов трейдинга (node-steamcommunity и т.п.) — не
 * что-то, вычитанное из разметки страницы списка офферов (там готового
 * JS-вызова именно под accept вообще нет — только `ShowTradeOffer(id)`,
 * открывающий модалку/страницу оффера, и `DeclineTradeOffer(id)` под
 * decline, но это MAIN-мир-функции страницы, недоступные ISOLATED
 * content-скрипту напрямую — реализуем тот же результат своим fetch()
 * вместо инъекции чужого JS).
 *
 * sessionid — читаем из cookie `sessionid` (та же cookie, что Steam ставит
 * каждому залогиненному пользователю на steamcommunity.com), а не из
 * `g_sessionID` (MAIN-мир страницы) — подтверждено живым HTML реальной
 * страницы /tradeoffers пользователя: `g_sessionID = "7b1da28d22c988ff…"`
 * присутствует, и это тот же формат/значение, что Steam параллельно кладёт
 * в cookie с тем же именем.
 *
 * `fetch()` — same-origin запрос (мы уже на steamcommunity.com), поэтому
 * `credentials: 'same-origin'` достаточно, cookies уходят сами, никакого
 * host_permissions в wxt.config.ts под это не нужно (в отличие от
 * PriceDB.io — см. его комментарий там).
 *
 * ВАЖНО (найдено после первого релиза — реальный `accept` у пользователя
 * возвращал HTTP 403): оба эндпоинта проверяют заголовок Referer — он
 * должен быть страницей САМОГО оффера, `https://steamcommunity.com
 * /tradeoffer/<id>/`, а не страницей списка офферов, с которой уходит
 * запрос. Это тот же контракт, которого придерживаются независимые
 * реализации того же эндпоинта (node-steamcommunity и аналоги) — они явно
 * выставляют такой Referer, а не полагаются на дефолтный браузерный.
 * Обычный `fetch()` без опции `referrer` шлёт в качестве Referer URL
 * страницы, с которой сделан запрос (т.е. `/tradeoffers`), что для accept
 * Steam не устраивает — отсюда 403 именно на "Принять" (Decline эту
 * проверку либо не делает, либо менее строгий — в живом тесте пользователя
 * ломался только accept). Опция `referrer` в fetch() позволяет явно
 * задать другой URL как значение Referer, оставаясь при этом
 * same-origin-запросом (сам URL — тот же steamcommunity.com, поэтому
 * браузер это разрешает без каких-либо доп. прав).
 */

function getSessionId(): string | null {
  const match = document.cookie.match(/(?:^|; )sessionid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

interface RawActionResult {
  ok: boolean;
  data?: Record<string, unknown> | null;
  error?: string;
}

async function postTradeOfferAction(
  offerId: string,
  action: 'accept' | 'decline',
  extraBody: Record<string, string>,
): Promise<RawActionResult> {
  const sessionid = getSessionId();
  if (!sessionid) {
    return { ok: false, error: 'Не найден sessionid — обновите страницу и попробуйте снова.' };
  }

  const body = new URLSearchParams({ sessionid, ...extraBody });
  try {
    const res = await fetch(`https://steamcommunity.com/tradeoffer/${offerId}/${action}`, {
      method: 'POST',
      credentials: 'same-origin',
      referrer: `https://steamcommunity.com/tradeoffer/${offerId}/`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: body.toString(),
    });

    let data: Record<string, unknown> | null = null;
    try {
      data = await res.json();
    } catch {
      // Ответ не JSON — оставляем data = null, ниже решает res.ok.
    }

    if (!res.ok) {
      const strError = typeof data?.strError === 'string' ? data.strError : undefined;
      return { ok: false, error: strError || `HTTP ${res.status}` };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface DeclineResult {
  ok: boolean;
  error?: string;
}

export async function declineTradeOffer(offerId: string): Promise<DeclineResult> {
  const result = await postTradeOfferAction(offerId, 'decline', {});
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export interface AcceptResult {
  ok: boolean;
  needsMobileConfirmation?: boolean;
  needsEmailConfirmation?: boolean;
  error?: string;
}

export async function acceptTradeOffer(offerId: string, partnerSteamId64: string): Promise<AcceptResult> {
  const result = await postTradeOfferAction(offerId, 'accept', {
    serverid: '1',
    tradeofferid: offerId,
    partner: partnerSteamId64,
    captcha: '',
  });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    needsMobileConfirmation: Boolean(result.data?.needs_mobile_confirmation),
    needsEmailConfirmation: Boolean(result.data?.needs_email_confirmation),
  };
}
