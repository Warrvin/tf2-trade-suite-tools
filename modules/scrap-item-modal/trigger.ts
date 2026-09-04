/**
 * Настраиваемая комбинация активации виджета — по прямой просьбе
 * пользователя ("сделать чтобы пользователь сам мог задать бинд, а не
 * чтобы только Ctrl или СКМ") вместо ЖЁСТКО зашитых среднего клика и
 * Ctrl/Cmd+клика. Раньше поддерживались ОБА триггера одновременно
 * (основной + запасной вариант); теперь — ровно ОДНА, полностью
 * настраиваемая комбинация "кнопка мыши + любой набор Ctrl/Alt/Shift/Cmd",
 * хранится как обычная module option (utils/settings.ts#getModuleOption/
 * setModuleOption, ключуется по SCRAP_ITEM_MODAL_FEATURE_ID — та же схема,
 * что и у icon-detail-level/trade-summary-mode). UI записи — components/
 * FeatureToggle.vue.
 *
 * Значение по умолчанию — средняя кнопка без модификаторов: то, что
 * пользователь буквально попросил самым первым сообщением ("тыкаем
 * средней кнопкой мышки СКМ"). Запасной вариант Ctrl+клик был моей
 * собственной добавкой поверх этого — раз теперь любой бинд настраивается,
 * его можно вернуть вручную через "Записать", отдельного дефолта под него
 * больше нет.
 */

import type { Locale } from '../../utils/i18n';

export type ScrapModalMouseButton = 'left' | 'middle' | 'right';

export interface ScrapModalTrigger {
  button: ScrapModalMouseButton;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export const SCRAP_MODAL_TRIGGER_OPTION_KEY = 'trigger';

export const DEFAULT_SCRAP_MODAL_TRIGGER: ScrapModalTrigger = {
  button: 'middle',
  ctrl: false,
  alt: false,
  shift: false,
  meta: false,
};

const BUTTON_CODE: Record<ScrapModalMouseButton, number> = { left: 0, middle: 1, right: 2 };

/** MouseEvent.button (0/1/2) -> наш union — тот же порядок, что использует сам браузер. */
export function mouseButtonFromCode(code: number): ScrapModalMouseButton {
  if (code === 1) return 'middle';
  if (code === 2) return 'right';
  return 'left';
}

/**
 * Событие подходит под настроенный триггер, только если совпадает И кнопка,
 * И РОВНО тот же набор модификаторов (не "как минимум эти", а "именно эти,
 * не больше и не меньше") — предсказуемее для системы биндов: Ctrl+клик и
 * Ctrl+Shift+клик так не путаются друг с другом, даже если у пользователя
 * настроен только первый из них.
 */
export function matchesScrapModalTrigger(e: MouseEvent, trigger: ScrapModalTrigger): boolean {
  return (
    e.button === BUTTON_CODE[trigger.button] &&
    e.ctrlKey === trigger.ctrl &&
    e.altKey === trigger.alt &&
    e.shiftKey === trigger.shift &&
    e.metaKey === trigger.meta
  );
}

const BUTTON_LABEL: Record<Locale, Record<ScrapModalMouseButton, string>> = {
  ru: { left: 'Левая кнопка', middle: 'Средняя кнопка', right: 'Правая кнопка' },
  en: { left: 'Left button', middle: 'Middle button', right: 'Right button' },
};

/** Человеческое описание для UI, напр. "Ctrl+Shift + Средняя кнопка" — сами
 *  названия модификаторов (Ctrl/Alt/Shift/Cmd) не переводим: это те же
 *  клавиши, что показывает сама ОС/клавиатура, в обеих локалях. */
export function formatScrapModalTrigger(trigger: ScrapModalTrigger, locale: Locale): string {
  const mods: string[] = [];
  if (trigger.ctrl) mods.push('Ctrl');
  if (trigger.alt) mods.push('Alt');
  if (trigger.shift) mods.push('Shift');
  if (trigger.meta) mods.push('Cmd');
  const modsText = mods.length ? `${mods.join('+')} + ` : '';
  return modsText + BUTTON_LABEL[locale][trigger.button];
}
