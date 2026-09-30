import type { ItemAttributes } from '../../utils/item-attributes';

export const OFFERS_ATTRIBUTES_FEATURE_ID = 'offers-item-attributes';

export interface EconomyItemKey {
  appId: string;
  classId: string;
  instanceId: string;
}

export type ItemAttributesCache = Map<string, Promise<ItemAttributes | null>>;
