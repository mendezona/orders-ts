import type Decimal from "decimal.js";
import {
  type AlpacaApiGetPosition,
  type OrderType,
  type TimeInForce,
  type TradeAccount,
} from "./alpacaApi.types";

export interface AlpacaAccountCredentials {
  endpoint: string;
  key: string;
  secret: string;
  paper: boolean;
}

export interface AlpacaGetAccountBalance {
  account: TradeAccount;
  accountEquity: Decimal;
  accountCash: Decimal;
}

export interface AlpacaGetPositionForAsset {
  openPositionFound: boolean;
  position?: AlpacaApiGetPosition;
  qty?: Decimal;
  market_value?: Decimal;
}

export interface AlpacaGetLatestQuote {
  askPrice: Decimal;
  bidPrice: Decimal;
  askSize: Decimal;
  bidSize: Decimal;
}

export interface AlpacaOrderRequestParams {
  alpacaSymbol: string;
  buySideOrder: boolean;
  accountName: string;
  orderType: OrderType;
  timeInForce: TimeInForce;
}

export interface AlpacaSubmitPairTradeOrderParams {
  tradingViewSymbol: string;
  tradingViewPrice: string;
  tradingViewInterval?: string;
  buyAlert?: boolean;
  capitalPercentageToDeploy?: Decimal;
  calculateTax?: boolean;
  accountName?: string;
  scheduleCronJob?: boolean;
}

export interface AlpacaSubmitLimitOrderCustomQuantityParams
  extends AlpacaOrderRequestParams {
  quantity: Decimal;
  setSlippagePercentage: Decimal;
  limitPrice?: Decimal;
}

export interface AlpacaSubmitLimitOrderCustomPercentageParams
  extends AlpacaOrderRequestParams {
  setSlippagePercentage: Decimal;
  capitalPercentageToDeploy: Decimal;
  limitPrice?: Decimal;
}

export interface AlpacaSubmitMarketOrderCustomPercentageParams
  extends AlpacaOrderRequestParams {
  capitalPercentageToDeploy: Decimal;
}

export interface AlpacaCheckLatestPriceAndReverseTradeCronJobParams {
  tradingViewSymbol: string;
  buyAlert: boolean;
}

export interface AlpacaSchedulePriceCheckAtNextInternalCronJobParams {
  tradingViewSymbol: string;
  tradingViewPrice: string;
  tradingViewInterval: string;
  buyAlert: boolean;
}
