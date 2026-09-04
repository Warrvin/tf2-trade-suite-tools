import { storage } from 'wxt/storage';
import { FEATURE_REGISTRY } from './registry';
import { DEFAULT_LOCALE, Locale } from './i18n';

export interface TF2SuiteSettings {
  features: Record<string, boolean>;
  /**
   * Доп. настройки КОНКРЕТНОГО модуля, для которого простого вкл/выкл не
   * хватает (напр. trade-item-attributes: "простой" или "подробный" вид
   * иконок — см. getModuleOption/setModuleOption ниже). Ключ верхнего
   * уровня — featureId, внутри — произвольные пары ключ/значение модуля.
   */
  moduleOptions: Record<string, Record<string, unknown>>;
  /** Язык интерфейса расширения — см. utils/i18n.ts. */
  locale: Locale;
}

function defaultFeatures(): Record<string, boolean> {
  const features: Record<string, boolean> = {};
  for (const mod of FEATURE_REGISTRY) {
    features[mod.id] = mod.defaultEnabled;
  }
  return features;
}

/**
 * Единственный элемент хранилища для всего расширения. Используем `local`
 * (не `sync`) сознательно: список фич может расти, а sync-хранилище имеет
 * жёсткие квоты на размер записи — local не ограничен так жёстко и не
 * зависит от того, залогинен ли пользователь в браузере.
 */
export const settingsItem = storage.defineItem<TF2SuiteSettings>('local:tf2suite_settings', {
  version: 1,
  fallback: { features: defaultFeatures(), moduleOptions: {}, locale: DEFAULT_LOCALE },
});

/**
 * Возвращает настройки, гарантированно содержащие значение для КАЖДОГО
 * модуля из FEATURE_REGISTRY. Если модуль добавили после того, как
 * пользователь уже сохранил свои настройки, он получает свой defaultEnabled,
 * а не `undefined` — ничего из уже сделанного пользователем выбора при
 * этом не перезаписывается (урок из mergeWithDefaults в tf2trader).
 *
 * `locale` — тем же способом (мёрдж со значением по умолчанию): у
 * пользователей, сохранивших настройки ДО появления языка интерфейса,
 * в хранилище этого поля ещё нет — вместо `undefined` они получают
 * DEFAULT_LOCALE ('ru'), а не поломку сравнения `settings.locale === 'en'`
 * где-либо в коде.
 */
export async function getSettings(): Promise<TF2SuiteSettings> {
  const stored = await settingsItem.getValue();
  return {
    features: { ...defaultFeatures(), ...(stored?.features ?? {}) },
    moduleOptions: stored?.moduleOptions ?? {},
    locale: stored?.locale ?? DEFAULT_LOCALE,
  };
}

export async function getLocale(): Promise<Locale> {
  return (await getSettings()).locale;
}

export async function setLocale(locale: Locale): Promise<void> {
  const current = await getSettings();
  await settingsItem.setValue({ features: current.features, moduleOptions: current.moduleOptions, locale });
}

export async function isFeatureEnabled(featureId: string): Promise<boolean> {
  const settings = await getSettings();
  return settings.features[featureId] ?? false;
}

export async function setFeatureEnabled(featureId: string, enabled: boolean): Promise<void> {
  const current = await getSettings();
  await settingsItem.setValue({ ...current, features: { ...current.features, [featureId]: enabled } });
}

export async function setManyFeatures(patch: Record<string, boolean>): Promise<void> {
  const current = await getSettings();
  await settingsItem.setValue({ ...current, features: { ...current.features, ...patch } });
}

/** Читает одну опцию конкретного модуля, с фолбэком, если ещё не сохранена. */
export async function getModuleOption<T>(featureId: string, key: string, fallback: T): Promise<T> {
  const settings = await getSettings();
  const value = settings.moduleOptions[featureId]?.[key];
  return value === undefined ? fallback : (value as T);
}

/** Сохраняет одну опцию конкретного модуля, не трогая остальные модули/опции. */
export async function setModuleOption(featureId: string, key: string, value: unknown): Promise<void> {
  const current = await getSettings();
  const featureOptions = { ...(current.moduleOptions[featureId] ?? {}), [key]: value };
  await settingsItem.setValue({
    ...current,
    moduleOptions: { ...current.moduleOptions, [featureId]: featureOptions },
  });
}

/**
 * Живая подписка на изменения настроек — используется в content-скриптах,
 * чтобы модуль включался/выключался БЕЗ перезагрузки страницы, как только
 * пользователь щёлкнул тумблер на options-странице.
 */
export function watchSettings(cb: (settings: TF2SuiteSettings) => void): () => void {
  return settingsItem.watch((newValue) => {
    cb({
      features: { ...defaultFeatures(), ...(newValue?.features ?? {}) },
      moduleOptions: newValue?.moduleOptions ?? {},
      locale: newValue?.locale ?? DEFAULT_LOCALE,
    });
  });
}
