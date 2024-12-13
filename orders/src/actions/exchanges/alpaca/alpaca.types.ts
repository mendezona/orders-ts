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

export interface AlpacaGetAccountBalance {
  account: AlpacaApiTradeAccountSchema;
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

export const tradingViewAlertSchema = z.object({
  authenticationToken: z.string(),
  ticker: z.string(),
  closePrice: z.string(),
  interval: z.string(),
});

export const alpacaCheckLatestPriceAndReverseTradeCronJobParamsSchema =
  z.object({
    tradingViewSymbol: z.string(),
    buyAlert: z.boolean(),
  });
