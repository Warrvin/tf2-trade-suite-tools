import { CurrencyKind } from './currency';

/**
 * Определение валюты по DOM `.trade_item`/`.history_item` НА СПИСКЕ офферов
 * (`/tradeoffers`(`/sent`)) — вынесено сюда (тот же принцип, что и
 * `offer-list-badges.ts` для бейджа "×N") из `offer-currency-total`, потому
 * что `offer-item-summary` тоже должен уметь узнавать валюту — см. её
 * core.ts за тем, зачем (группировка ключей/металла разных classid в один
 * тайл, а не по имени/тексту — на этой странице их просто нет, см. комментарий
 * в offer-currency-total/core.ts).
 *
 * ДВА CLASSID У ОДНОГО И ТОГО ЖЕ КЛЮЧА (найдено пользователем на живом
 * оффере, подтверждено ответом Steam econ API через steamcollector.com):
 * `classinfo/440/101785959/11040578` И `classinfo/440/339892/11040578` — оба
 * официально резолвятся в "Mann Co. Supply Crate Key", Quality: Unique. Это
 * НЕ баг Steam и не два разных предмета — Valve время от времени переиздаёт
 * classid для того же самого item definition (та же причина, по которой у
 * многих старых предметов есть исторические classid-дубликаты), а
 * инстансы/трейды продолжают ходить под обоими вперемешку.
 *
 * ПОЛНЫЙ СПИСОК (16 ЕЩЁ classid) — предоставлен пользователем как
 * "вроде все classid ключей": `11046885`, `11082610`, `22989166`,
 * `22989168`, `62839543`, `80564440`, `92538037`, `107348033`, `107348667`,
 * `680850844`, `680850846`, `780611622`, `780612158`, `780612279`,
 * `780613452`, `780613803`. САМИ по себе НЕ перепроверены поштучно (у
 * steamcollector.com listing на 6068 записей по 50/страницу, а пагинация
 * за пределами первых страниц не поддалась быстрой проверке) — источник
 * этой части списка ТОЛЬКО пользователь, а не независимое подтверждение,
 * как у двух classid выше. Внесены целиком, потому что цена ложноотрицания
 * здесь (ключ НЕ распознан как валюта) выше цены ложноположительного (что-
 * то другое ошибочно посчиталось бы ключом) — тот же компромисс, что и у
 * резервного пути по хэшу иконки ниже.
 */
export const CURRENCY_KIND_BY_CLASSID: Record<string, CurrencyKind> = {
  '101785959': 'keys',
  '339892': 'keys',
  '11046885': 'keys',
  '11082610': 'keys',
  '22989166': 'keys',
  '22989168': 'keys',
  '62839543': 'keys',
  '80564440': 'keys',
  '92538037': 'keys',
  '107348033': 'keys',
  '107348667': 'keys',
  '680850844': 'keys',
  '680850846': 'keys',
  '780611622': 'keys',
  '780612158': 'keys',
  '780612279': 'keys',
  '780613452': 'keys',
  '780613803': 'keys',
  '2674': 'refined',
  '5564': 'reclaimed',
  '2675': 'scrap',
};

/** Резервный путь по хэшу иконки в src — на случай ЕЩЁ не внесённого сюда
 *  classid (тот же принцип, что и выше с двумя classid ключа — история
 *  вполне может повториться и с рефом/реком/скрапом). НЕ подтверждено
 *  живым тестом, чистая подстраховка. */
export const CURRENCY_KIND_BY_ICON_HASH: Record<string, CurrencyKind> = {
  'fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEAaR4uURrwvz0N252yVaDVWrRTno9m4ccG2GNqxlQoZrC2aG9hcVGUWflbX_drrVu5UGki5sAij6tOtQ':
    'keys',
  'fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEbZQsUYhTkhzJWhsO1Mv6NGucF1Ygzt8ZQijJukFMiMrbhYDEwI1yRVKNfD6xorQ3qW3Jr6546DNPuou9IOVK4p4kWJaA':
    'refined',
  'fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEbZQsUYhTkhzJWhsO0Mv6NGucF1YJlscMEgDdvxVYsMLPkMmFjI1OSUvMHDPBp9lu0CnVluZQxA9Gwp-hIOVK4sMMNWF4':
    'reclaimed',
  'fWFc82js0fmoRAP-qOIPu5THSWqfSmTELLqcUywGkijVjZULUrsm1j-9xgEbZQsUYhTkhzJWhsPZAfOeD-VOn4phtsdQ32ZtxFYoN7PkYmVmIgeaUKNaX_Rjpwy8UHMz6pcxAIfnovUWJ1t9nYFqYw':
    'scrap',
};

/** Определяет валюту одного `.trade_item` на `/tradeoffers`(`/sent`):
 *  сперва по classid из `data-economy-item`, иначе — по хэшу иконки. `null`,
 *  если это не валюта (обычный предмет). */
export function matchTradeItemCurrency(tradeItemEl: Element): CurrencyKind | null {
  const economyItem = tradeItemEl.getAttribute('data-economy-item') ?? '';
  const classid = economyItem.match(/^classinfo\/\d+\/(\d+)\//)?.[1];
  if (classid && CURRENCY_KIND_BY_CLASSID[classid]) return CURRENCY_KIND_BY_CLASSID[classid];

  const src = tradeItemEl.querySelector('img')?.getAttribute('src') ?? '';
  for (const [hash, kind] of Object.entries(CURRENCY_KIND_BY_ICON_HASH)) {
    if (src.includes(hash)) return kind;
  }
  return null;
}
