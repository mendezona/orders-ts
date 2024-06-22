import { type CategoryV5 } from "bybit-api";

export interface BybitAccountCredentials {
  key: string;
  secret: string;
  testnet: boolean;
}

export interface BybitGetSymbolIncrementsParams {
  bybitPairSymbol: string;
  accountName?: string;
  productCategory?: CategoryV5;
}

export enum BybitDefaultProductCategory {
  SPOT = "spot",
}

export enum BybitAccountType {
  UNIFIED = "UNIFIED",
}
