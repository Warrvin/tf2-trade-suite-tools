/**
 * Универсальный RPC-мост MAIN world ↔ ISOLATED world через window.postMessage.
 *
 * Зачем: MAIN-world content-скрипты видят внутренние JS-объекты страницы
 * Steam (UserYou, UserThem, g_rgCurrentTradeStatus и т.д.), но НЕ видят
 * расширенческие API (browser.storage, browser.runtime — их просто нет в
 * контексте страницы). ISOLATED-скрипты — наоборот. Этот файл даёт один
 * переиспользуемый примитив вместо того, чтобы каждый модуль изобретал свой
 * канал сообщений (как это по факту происходит в tf2trader — там несколько
 * почти одинаковых *-bridge.content.ts).
 *
 * Важно понимать модель доверия: window.postMessage с target '*' виден
 * любому скрипту на странице, включая саму страницу. Это та же модель
 * доверия, с которой и так работает MAIN-world код (он и без того читает
 * и пишет в открытое клиентское состояние страницы) — трюк не добавляет
 * новой поверхности атаки сверх той, что уже есть у любого userscript/
 * расширения, работающего в MAIN world.
 */

const NAMESPACE = '__tf2suite__';
const RESPONSE_SUFFIX = ':response';

interface RequestEnvelope<T> {
  ns: typeof NAMESPACE;
  channel: string;
  requestId: string;
  payload: T;
}

interface ResponseEnvelope<T> {
  ns: typeof NAMESPACE;
  channel: string;
  requestId: string;
  ok: boolean;
  data?: T;
  error?: string;
}

function isRequestEnvelope(data: unknown): data is RequestEnvelope<unknown> {
  return typeof data === 'object' && data !== null && (data as { ns?: unknown }).ns === NAMESPACE && 'requestId' in data && !('ok' in data);
}

function isResponseEnvelope(data: unknown): data is ResponseEnvelope<unknown> {
  return typeof data === 'object' && data !== null && (data as { ns?: unknown }).ns === NAMESPACE && 'ok' in data;
}

/**
 * Вызывается со стороны ISOLATED-скрипта: посылает запрос в MAIN world и
 * ждёт ответ на том же канале. Отклоняется по таймауту, если MAIN-world
 * обработчик не зарегистрирован или страница ещё не готова.
 */
export function requestFromMain<TReq, TRes>(channel: string, payload: TReq, timeoutMs = 5000): Promise<TRes> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const responseChannel = channel + RESPONSE_SUFFIX;

    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error(`[tf2suite] timeout waiting for response on channel "${channel}"`));
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (!isResponseEnvelope(event.data)) return;
      const data = event.data as ResponseEnvelope<TRes>;
      if (data.channel !== responseChannel || data.requestId !== requestId) return;

      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      if (data.ok) resolve(data.data as TRes);
      else reject(new Error(data.error ?? '[tf2suite] unknown bridge error'));
    }

    window.addEventListener('message', onMessage);
    const envelope: RequestEnvelope<TReq> = { ns: NAMESPACE, channel, requestId, payload };
    window.postMessage(envelope, '*');
  });
}

/**
 * Вызывается со стороны MAIN-world скрипта: регистрирует обработчик
 * запросов на канале. Возвращает функцию отписки.
 */
export function respondInMain<TReq, TRes>(
  channel: string,
  handler: (payload: TReq) => TRes | Promise<TRes>
): () => void {
  const responseChannel = channel + RESPONSE_SUFFIX;

  async function onMessage(event: MessageEvent) {
    if (event.source !== window) return;
    if (!isRequestEnvelope(event.data)) return;
    const data = event.data as RequestEnvelope<TReq>;
    if (data.channel !== channel) return;

    try {
      const result = await handler(data.payload);
      const response: ResponseEnvelope<TRes> = { ns: NAMESPACE, channel: responseChannel, requestId: data.requestId, ok: true, data: result };
      window.postMessage(response, '*');
    } catch (err) {
      const response: ResponseEnvelope<TRes> = {
        ns: NAMESPACE,
        channel: responseChannel,
        requestId: data.requestId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      window.postMessage(response, '*');
    }
  }

  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
