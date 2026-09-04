import type { WalletFetchResult } from '../../utils/inventory-fetch';

export interface WalletRequest {
  who: 'me' | 'partner';
}

export type WalletResponse = { who: 'me' | 'partner' } & WalletFetchResult;

export const WALLET_CHANNEL = 'tf2suite:wallet-summary';
export const WALLET_FEATURE_ID = 'wallet-summary';
