import type Decimal from 'decimal.js';
import { type RawData, type TradeAccount } from './alpacaApi.types';
export interface AlpacaAccountCredentials {
  endpoint: string;
  key: string;
  secret: string;
  paper: boolean;
}

export interface AlpacaGetAccountBalance {
  account: TradeAccount | RawData;
  accountEquity: Decimal;
  accountCash: Decimal;
}
    
export interface AlpacaGetAvailableAssetBalance {
  position: string;
  qty: Decimal;
  market_value: Decimal;
}
