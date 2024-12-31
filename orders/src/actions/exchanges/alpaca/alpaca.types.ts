import type Decimal from "decimal.js";
import { z } from "zod";
import {
  type AlpacaApiGetPosition,
  type AlpacaApiTradeAccountSchema,
  type OrderType,
  type TimeInForce,
} from "./alpacaApi.types";

export interface AlpacaAccountCredentials {
  endpoint: string;
  key: string;
  secret: string;
  paper: boolean;
}

export interface AlpacaAccountBalance {
  account: AlpacaApiTradeAccountSchema;
  accountEquity: Decimal;
  accountCash: Decimal;
}

export interface AlpacaPositionForAsset {
  openPositionFound: boolean;
  position?: AlpacaApiGetPosition;
  qty?: Decimal;
  market_value?: Decimal;
}

export interface AlpacaLatestQuote {
  askPrice: Decimal;
  bidPrice: Decimal;
  askSize: Decimal;
  bidSize: Decimal;
}

export interface AlpacaOrderRequestParams {
  alpacaSymbol: string;
  buyAlert: boolean;
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
  submitTakeProfitOrder?: boolean;
}

export interface AlpacaSubmitLimitOrderCustomQuantityParams
  extends AlpacaOrderRequestParams {
  quantity: Decimal;
  setSlippagePercentage: Decimal;
  limitPrice?: Decimal;
  submitTakeProfitOrder?: boolean;
  takeProfitPercentage?: Decimal;
}

export interface AlpacaSubmitLimitOrderCustomPercentageParams
  extends AlpacaOrderRequestParams {
  setSlippagePercentage: Decimal;
  capitalPercentageToDeploy: Decimal;
  limitPrice?: Decimal;
  submitTakeProfitOrder?: boolean;
  takeProfitPercentage?: Decimal;
}

export interface AlpacaSubmitMarketOrderCustomPercentageParams
  extends AlpacaOrderRequestParams {
  tradingViewPrice: string;
  capitalPercentageToDeploy: Decimal;
  submitTakeProfitOrder?: boolean;
  takeProfitPercentage?: Decimal;
}

export interface AlpacaReverseTradeOnFalseSignalParams {
  tradingViewSymbol: string;
  buyAlert: boolean;
  accountName?: string;
}

export interface AlpacaCronJobSchedulePriceCheckAtNextIntervalParams
  extends AlpacaReverseTradeOnFalseSignalParams {
  tradingViewPrice: string;
  tradingViewInterval: string;
}

export const alpacaCheckLatestPriceAndReverseTradeCronJobParamsSchema =
  z.object({
    tradingViewSymbol: z.string(),
    buyAlert: z.boolean(),
  });
