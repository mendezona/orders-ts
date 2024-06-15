import type Decimal from 'decimal.js';

// Types returned by the Alpaca API
export interface AlpacaAPIGetPosition {
  position: string;
  qty: string;
  market_value: string;
}

// Custom types for my own functions
export interface AlpacaAccountCredentials {
  endpoint: string;
  key: string;
  secret: string;
  paper: boolean;
}
    
export interface AlpacaGetAvailableAssetBalance {
  position: string;
  qty: Decimal;
  market_value: Decimal;
}
