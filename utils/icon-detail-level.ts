/**
 * Уровень детализации spell/killstreak-иконок — общий для ВСЕХ модулей,
 * рисующих атрибуты предметов (сейчас: trade-item-attributes,
 * inventory-item-attributes — оба используют один и тот же рендерer, см.
 * utils/item-attribute-render.ts), чтобы не заводить копию этого типа и
 * дефолта в каждом модуле по отдельности (требование 4 — не дублировать
 * функционал). Сам ВЫБОР уровня хранится у каждого модуля в СВОЕЙ записи
 * moduleOptions (см. utils/settings.ts) — общий тут только тип/константы.
 *
 * "Простой" вид — один общий значок на spell/killstreak без деталей (как
 * было в первой версии модуля, 1:1 со Steam Trade Offer Enhancer). Никогда
 * не ошибается, потому что ничего не классифицирует.
 * "Подробный" — конкретный тип спелла (или несколько, если их 2) и тир
 * killstreak с sheen/killstreaker. Для 4 "эффектных" спеллов и sheen/
 * killstreaker распознавание проверенное; для 12 "paint"/"footprints"
 * спеллов имя — лучшее известное сопоставление, могут быть неточности
 * (см. utils/spells.ts) — сам факт наличия спелла и его точный сырой текст
 * от Steam при этом всегда верны, независимо от того, угадано ли имя.
 */
export type IconDetailLevel = 'simple' | 'detailed';
export const ICON_DETAIL_OPTION_KEY = 'iconDetailLevel';
export const DEFAULT_ICON_DETAIL_LEVEL: IconDetailLevel = 'detailed';
