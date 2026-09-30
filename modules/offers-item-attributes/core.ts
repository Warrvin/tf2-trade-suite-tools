import { CURRENCY_KIND_BY_CLASSID } from '../../utils/offer-list-currency';
import { getItemAttributes, ItemAttributes, SteamEconItem } from '../../utils/item-attributes';
import type { EconomyItemKey } from './types';

/**
 * Парсер ответа BuildHover('...', { ... }) эндпоинта /economy/itemclasshover/440/...
 * Находит вызов BuildHover и точно извлекает второй аргумент (JSON-объект предмета)
 * методом подсчёта парных фигурных скобок с учётом экранирования строк.
 */
export function parseBuildHoverResponse(text: string): SteamEconItem | null {
  const idx = text.indexOf('BuildHover');
  if (idx === -1) return null;
  const firstBrace = text.indexOf('{', idx);
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  let endBrace = -1;

  for (let i = firstBrace; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          endBrace = i;
          break;
        }
      }
    }
  }

  if (endBrace === -1) return null;
  try {
    const jsonStr = text.substring(firstBrace, endBrace + 1);
    return JSON.parse(jsonStr) as SteamEconItem;
  } catch {
    return null;
  }
}

/**
 * Извлекает параметры предмета из атрибута data-economy-item="classinfo/440/<classid>/<instanceid>".
 */
export function parseEconomyItem(attr: string | null): EconomyItemKey | null {
  if (!attr) return null;
  const clean = attr.replace(/^\/+/, '');
  const parts = clean.split('/');
  if (parts.length >= 3 && parts[0] === 'classinfo') {
    return {
      appId: parts[1],
      classId: parts[2],
      instanceId: parts[3] ? parts[3] : '0',
    };
  }
  return null;
}

/**
 * Очередь запросов с ограничением параллельности и задержкой между вызовами
 * для защиты от 429 Too Many Requests при просмотре офферов с десятками предметов.
 */
class RequestQueue {
  private queue: (() => Promise<void>)[] = [];
  private activeCount = 0;
  private readonly maxConcurrent: number;
  private readonly delayMs: number;

  constructor(maxConcurrent = 5, delayMs = 40) {
    this.maxConcurrent = maxConcurrent;
    this.delayMs = delayMs;
  }

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const res = await task();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
      this.processNext();
    });
  }

  private processNext() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }
    this.activeCount++;
    const nextTask = this.queue.shift()!;
    nextTask().finally(() => {
      setTimeout(() => {
        this.activeCount--;
        this.processNext();
      }, this.delayMs);
    });
  }
}

const requestQueue = new RequestQueue(5, 40);

/**
 * Сессионный кэш дедупликации: если на странице 20 одинаковых предметов,
 * отправляется только 1 HTTP-запрос, а все элементы ждут один и тот же Promise.
 */
const attributesCache = new Map<string, Promise<ItemAttributes | null>>();

/**
 * Загружает и возвращает атрибуты предмета по его classid и instanceid.
 */
export function getOffersItemAttributes(appId: string, classId: string, instanceId: string): Promise<ItemAttributes | null> {
  // Только Team Fortress 2
  if (appId !== '440') return Promise.resolve(null);

  // Быстрый путь для валюты: чистые ключи и металл гарантированно не имеют эффектов/спеллов
  if (CURRENCY_KIND_BY_CLASSID[classId]) {
    return Promise.resolve({ color: '7D6D00', spells: [] });
  }

  const cacheKey = `${classId}:${instanceId}`;
  const existing = attributesCache.get(cacheKey);
  if (existing) return existing;

  const promise = requestQueue.add(async () => {
    try {
      const url = `https://steamcommunity.com/economy/itemclasshover/440/${classId}/${instanceId}?content_only=1&l=english`;
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) {
        return null;
      }
      const text = await res.text();
      const econItem = parseBuildHoverResponse(text);
      if (!econItem) return null;
      return getItemAttributes(econItem);
    } catch {
      return null;
    }
  });

  promise.then((result) => {
    if (result === null) {
      // При ошибке очищаем кэш через 5 сек, чтобы можно было повторить при перезагрузке/скролле
      setTimeout(() => {
        if (attributesCache.get(cacheKey) === promise) {
          attributesCache.delete(cacheKey);
        }
      }, 5000);
    }
  });

  attributesCache.set(cacheKey, promise);
  return promise;
}
