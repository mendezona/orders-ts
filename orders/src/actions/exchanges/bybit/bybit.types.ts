import { type CategoryV5 } from "bybit-api";
import type Decimal from "decimal.js";

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

export interface BybitCalculateProfitLossParams {
  bybitPairSymbol: string;
  accountName?: string;
  productCategory?: CategoryV5;
}

export interface BybitGetMostRecentInverseFillToStablecoinParams {
  bybitPairSymbol: string;
  stablecoin?: string;
  accountName?: string;
  productCategory?: CategoryV5;
}

export interface BybitSubmitMarketOrderCustomAmountParams {
  bybitPairSymbol: string;
  dollarAmount: Decimal;
  buySideOrder?: boolean;
  accountName?: string;
  productCategory?: CategoryV5;
}

export interface BybitSubmitMarketOrderCustomPercentageParams {
  bybitPairSymbol: string;
  assetPercentageToDeploy: Decimal;
  buySideOrder?: boolean;
  accountName?: string;
  productCategory?: CategoryV5;
}

export enum BybitProductCategory {
  SPOT = "spot",
}

export enum BybitAccountType {
  UNIFIED = "UNIFIED",
}
