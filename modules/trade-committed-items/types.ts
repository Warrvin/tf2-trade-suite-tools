export const COMMITTED_ITEMS_FEATURE_ID = 'trade-committed-items';

export interface CommittedItemsOptions {
  showBadge: boolean;
  showBorder: boolean;
  borderColor: string;
  showBackground: boolean;
  backgroundColor: string;
  backgroundAlpha: number;
  enableQuickAddButtons: boolean;
}

export const DEFAULT_COMMITTED_ITEMS_OPTIONS: CommittedItemsOptions = {
  showBadge: true,
  showBorder: true,
  borderColor: '#f59e0b',
  showBackground: true,
  backgroundColor: '#f59e0b',
  backgroundAlpha: 0.3,
  enableQuickAddButtons: true,
};

export const COMMITTED_OPTIONS_KEY = 'committedOptions';
