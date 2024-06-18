import Alpaca from "@alpacahq/alpaca-trade-api";
import * as Sentry from "@sentry/nextjs";
import Decimal from "decimal.js";
import {
  saveBuyTradeToDatabaseFlipTradeAlertTable,
  saveSellTradeToDatabaseSellTable,
} from "~/server/queries";
import {
  type SaveBuyTradeToDatabaseFlipTradeAlertTableProps,
  type SaveSellTradeToDatabaseSellTableProps,
} from "~/server/queries.types";
import {
  EXCHANGES,
  EXCHANGE_CAPITAL_GAINS_TAX_RATE,
} from "../exchanges.contants";
import {
  isOutsideNasdaqTradingHours,
  logTimesInNewYorkAndLocalTimezone,
  wait,
} from "../exchanges.utils";
import {
  ALPACA_CAPITAL_TO_DEPLOY_EQUITY_PERCENTAGE,
  ALPACA_TOLERATED_EXTENDED_HOURS_SLIPPAGE,
  ALPACA_TRADINGVIEW_INVERSE_PAIRS,
  ALPACA_TRADINGVIEW_SYMBOLS,
  ALPACA_TRADING_ACCOUNT_NAME_LIVE,
} from "./alpaca.constants";
import {
  type AlpacaGetLatestQuote,
  type AlpacaSchedulePriceCheckAtNextInternalCronJobParams,
  type AlpacaSubmitLimitOrderCustomPercentageParams,
  type AlpacaSubmitLimitOrderCustomQuantityParams,
  type AlpacaSubmitMarketOrderCustomPercentageParams,
  type AlpacaSubmitPairTradeOrderParams,
} from "./alpaca.types";
import {
  alpacaGetAccountBalance,
  alpacaGetAvailableAssetBalance,
  alpacaGetCredentials,
} from "./alpacaAccount.utils";
import {
  OrderSide,
  OrderType,
  TimeInForce,
  type OrderRequest,
} from "./alpacaApi.types";
import { alpacaSchedulePriceCheckAtNextIntervalCronJob } from "./alpacaCronJobs";
import { alpacaCheckLastFilledOrderType } from "./alpacaOrderHistory.utils";
import {
  alpacaAreHoldingsClosed,
  alpacaCalculateProfitLoss,
  alpacaGetLatestQuote,
  alpacaIsAssetFractionable,
} from "./alpacaOrders.helpers";

/**
 * Submits a pair trade order, intended to flip from long to short position or vice versa.
 *
 * @param tradingViewSymbol - The ticker symbol of the asset to trade.
 * @param tradingViewPrice - The price of the asset to trade.
 * @param buyAlert - If alert is a buy or a sell alert (intended to flip long to short or vice versa).
 * @param capitalPercentageToDeploy - The percentage of equity to deploy.
 * @param calculateTax - Calculate and save taxable amount.
 * @param buyAlert - If alert is a buy or a sell alert (intended to flip long to short or vice versa).
 * @param accountName - The Alpaca account to use for the operation. Defaults to live trading account.
 * @param scheduleCronJob - Whether to schedule a cron job to check the price at the next defined interval.
 */
export const alpacaSubmitPairTradeOrder = async ({
  tradingViewSymbol,
  tradingViewPrice,
  tradingViewInterval,
  capitalPercentageToDeploy = ALPACA_CAPITAL_TO_DEPLOY_EQUITY_PERCENTAGE,
  calculateTax = true,
  buyAlert = true,
  accountName = ALPACA_TRADING_ACCOUNT_NAME_LIVE,
  scheduleCronJob = true,
}: AlpacaSubmitPairTradeOrderParams): Promise<void> => {
  console.log("Alpaca Order Begin - alpacaSubmitPairTradeOrder");
  logTimesInNewYorkAndLocalTimezone();

  // IMPORTANT: Symbols will automatically be flipped if the current symbol is the inverse of the tradingViewSymbol.
  // Eg. alpacaSymbol will also be the asset to purchase.
  // Eg. alpacaInverseSymbol will be the inverse stock to sell (potential current holding).
  const alpacaSymbol: string | undefined = buyAlert
    ? ALPACA_TRADINGVIEW_SYMBOLS[tradingViewSymbol]
    : ALPACA_TRADINGVIEW_INVERSE_PAIRS[tradingViewSymbol];
  const alpacaInverseSymbol: string | undefined = buyAlert
    ? ALPACA_TRADINGVIEW_INVERSE_PAIRS[tradingViewSymbol]
    : ALPACA_TRADINGVIEW_SYMBOLS[tradingViewSymbol];

  if (!alpacaSymbol || !alpacaInverseSymbol) {
    throw new Error(
      `Error - alpacaSubmitPairTradeOrder: ${tradingViewSymbol} not found`,
    );
  }

  console.log("alpacaSymbol", alpacaSymbol);
  console.log("alpacaInverseSymbol", alpacaInverseSymbol);

  /**
   *  If there is no sell order found for currentsymbol, sell all holdings and save CGT to database.
   *
   * Assumes there is only one order open at a time for a given symbol
   **/
  if (
    (await alpacaCheckLastFilledOrderType(alpacaInverseSymbol, accountName)) ===
    OrderSide.BUY
  ) {
    if (isOutsideNasdaqTradingHours()) {
      const assetBalance: Decimal = (
        await alpacaGetAvailableAssetBalance(alpacaInverseSymbol)
      ).qty;
      await alpacaSubmitLimitOrderCustomQuantity({
        alpacaSymbol: alpacaInverseSymbol,
        quantity: assetBalance,
        buySideOrder: false,
        setSlippagePercentage: new Decimal("0.01"),
      } as AlpacaSubmitLimitOrderCustomQuantityParams);
    } else {
      await alpacaCloseAllHoldingsOfAsset(alpacaInverseSymbol, accountName);
    }

    // Wait 10 seconds for trades to close
    const timeout = 10;
    const startTime: number = Date.now();
    while ((Date.now() - startTime) / 1000 < timeout) {
      if (await alpacaAreHoldingsClosed(alpacaInverseSymbol, accountName)) {
        break;
      }
      await wait(1000);
    }

    // Calculate and save tax, if applicable
    if (calculateTax) {
      const profitLossAmount: Decimal = await alpacaCalculateProfitLoss(
        alpacaInverseSymbol,
        accountName,
      );
      const taxAmount: Decimal = profitLossAmount
        .times(EXCHANGE_CAPITAL_GAINS_TAX_RATE)
        .toDecimalPlaces(2, Decimal.ROUND_UP);
      console.log("tax_amount", profitLossAmount.toString(), "\n");

      if (taxAmount.gt(0)) {
        await saveSellTradeToDatabaseSellTable({
          symbol: alpacaInverseSymbol,
          profitOrLossAmount: profitLossAmount.toString(),
          taxableAmount: taxAmount.toString(),
          buyAlert,
        } as SaveSellTradeToDatabaseSellTableProps);
      }
    }
  }

  if (isOutsideNasdaqTradingHours()) {
    await alpacaSubmitLimitOrderCustomPercentage({
      alpacaSymbol: alpacaSymbol,
      capitalPercentageToDeploy,
      setSlippagePercentage: ALPACA_TOLERATED_EXTENDED_HOURS_SLIPPAGE,
      accountName,
    } as AlpacaSubmitLimitOrderCustomPercentageParams);
  } else {
    await alpacaSubmitMarketOrderCustomPercentage({
      alpacaSymbol: alpacaSymbol,
      capitalPercentageToDeploy,
      accountName,
    } as AlpacaSubmitMarketOrderCustomPercentageParams);
  }

  await saveBuyTradeToDatabaseFlipTradeAlertTable({
    exchange: EXCHANGES.ALPACA,
    symbol: tradingViewSymbol,
    price: tradingViewPrice,
  } as SaveBuyTradeToDatabaseFlipTradeAlertTableProps);

  if (scheduleCronJob) {
    if (!tradingViewInterval) {
      throw new Error("Error - Interval required to set cron job");
    }
    await alpacaSchedulePriceCheckAtNextIntervalCronJob({
      tradingViewSymbol,
      tradingViewPrice,
      tradingViewInterval,
    } as AlpacaSchedulePriceCheckAtNextInternalCronJobParams);
  }
};

/**
 * Submits a limit order with a custom quantity for the specified asset.
 *
 * @param alpacaSymbol - The ticker symbol of the asset to trade.
 * @param quantity - The quantity of the asset to trade.
 * @param limitPrice - The limit price for the order. If not provided, it will be calculated.
 * @param buySideOrder - If true, places a buy order; otherwise, places a sell order.
 * @param accountName - The Alpaca account to use for the operation. Defaults to live trading account.
 * @param orderType - The type of order to submit.
 * @param timeInForce - The time in force for the order. Defaults to 'day'.
 * @param setSlippagePercentage - The slippage percentage to adjust the limit price. Defaults to 0.
 */
export const alpacaSubmitLimitOrderCustomQuantity = async ({
  alpacaSymbol,
  quantity,
  limitPrice,
  buySideOrder = true,
  accountName = ALPACA_TRADING_ACCOUNT_NAME_LIVE,
  orderType = OrderType.LIMIT,
  timeInForce = TimeInForce.DAY,
  setSlippagePercentage = new Decimal(0),
}: AlpacaSubmitLimitOrderCustomQuantityParams): Promise<void> => {
  const credentials = alpacaGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Alpaca account credentials not found");
  }

  console.log("Alpaca Order Begin - alpacaSubmitLimitOrderCustomQuantity");
  logTimesInNewYorkAndLocalTimezone();

  if (!limitPrice) {
    let quotePrice: Decimal;
    const latestQuote: AlpacaGetLatestQuote = await alpacaGetLatestQuote(
      alpacaSymbol,
      accountName,
    );

    if (buySideOrder) {
      quotePrice = latestQuote.askPrice.gt(0)
        ? latestQuote.askPrice
        : latestQuote.bidPrice;
      limitPrice = quotePrice
        .minus(quotePrice.times(setSlippagePercentage))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else {
      quotePrice = latestQuote.bidPrice.gt(0)
        ? latestQuote.bidPrice
        : latestQuote.askPrice;
      limitPrice = quotePrice
        .minus(quotePrice.times(setSlippagePercentage))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
  }

  const orderSide: OrderSide = buySideOrder ? OrderSide.BUY : OrderSide.SELL;
  let orderRequest: OrderRequest;
  const fractionable: boolean = await alpacaIsAssetFractionable(
    alpacaSymbol,
    accountName,
  );

  if (fractionable) {
    orderRequest = {
      symbol: alpacaSymbol,
      notional: new Decimal(quantity).times(limitPrice).toNumber(),
      side: orderSide,
      type: orderType,
      time_in_force: timeInForce,
      limit_price: limitPrice.toNumber(),
      extended_hours: true,
    };
  } else {
    orderRequest = {
      symbol: alpacaSymbol,
      qty: new Decimal(quantity)
        .toDecimalPlaces(0, Decimal.ROUND_DOWN)
        .toNumber(),
      side: orderSide,
      type: orderType,
      time_in_force: timeInForce,
      limit_price: limitPrice.toNumber(),
      extended_hours: true,
    };
  }

  try {
    const alpaca: Alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

    console.log("orderRequest:", orderRequest);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const orderResponse = await alpaca.createOrder(orderRequest);
    console.log(`Limit ${orderSide} order submitted: \n`, orderResponse);
    console.log("Alpaca Order End - alpacaSubmitLimitOrderCustomQuantity");
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error - alpacaSubmitLimitOrderCustomQuantity:", error);
    throw error;
  }
};

/**
 * Submits a limit order with a custom percentage of the account's capital.
 *
 * @param alpacaSymbol - The ticker symbol of the asset to trade.
 * @param buySideOrder - If true, places a buy order; otherwise, places a sell order.
 * @param capitalPercentageToDeploy - The percentage of the account's capital to deploy.
 * @param accountName - The Alpaca account to use for the operation. Defaults to live trading account.
 * @param orderType - The type of order to submit.
 * @param timeInForce - The time in force for the order. Defaults to 'day'.
 * @param limitPrice - The limit price for the order. If not provided, it will be calculated.
 * @param setSlippagePercentage - The slippage percentage to add to the limit price. Defaults to 0.
 */
export const alpacaSubmitLimitOrderCustomPercentage = async ({
  alpacaSymbol,
  buySideOrder = true,
  capitalPercentageToDeploy = ALPACA_CAPITAL_TO_DEPLOY_EQUITY_PERCENTAGE,
  accountName = ALPACA_TRADING_ACCOUNT_NAME_LIVE,
  orderType = OrderType.LIMIT,
  timeInForce = TimeInForce.DAY,
  limitPrice,
  setSlippagePercentage = new Decimal(0),
}: AlpacaSubmitLimitOrderCustomPercentageParams): Promise<void> => {
  const credentials = alpacaGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Alpaca account credentials not found");
  }

  console.log("Alpaca Order Begin - alpacaSubmitLimitOrderCustomPercentage");
  logTimesInNewYorkAndLocalTimezone();

  const accountInfo = await alpacaGetAccountBalance(accountName);
  const accountEquity = accountInfo.accountEquity;
  const accountCash = accountInfo.accountCash;
  let fundsToDeploy = accountEquity
    .times(capitalPercentageToDeploy)
    .toDecimalPlaces(2, Decimal.ROUND_DOWN);

  if (fundsToDeploy.lte(0)) {
    console.log("Error - Insufficient funds to deploy");
    throw new Error("Error - Insufficient funds to deploy");
  }

  if (fundsToDeploy.gt(accountCash)) {
    fundsToDeploy = accountCash.toDecimalPlaces(2, Decimal.ROUND_DOWN);
  }

  if (!limitPrice) {
    let quotePrice: Decimal;
    const latestQuote: AlpacaGetLatestQuote = await alpacaGetLatestQuote(
      alpacaSymbol,
      accountName,
    );

    if (buySideOrder) {
      quotePrice = latestQuote.askPrice.gt(0)
        ? latestQuote.askPrice
        : latestQuote.bidPrice;
      limitPrice = quotePrice
        .plus(quotePrice.times(setSlippagePercentage))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else {
      quotePrice = latestQuote.bidPrice.gt(0)
        ? latestQuote.bidPrice
        : latestQuote.askPrice;
      limitPrice = quotePrice
        .plus(quotePrice.times(setSlippagePercentage))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
  }

  const orderSide: OrderSide = buySideOrder ? OrderSide.BUY : OrderSide.SELL;
  const fractionable: boolean = await alpacaIsAssetFractionable(
    alpacaSymbol,
    accountName,
  );

  let orderRequest: OrderRequest;
  if (fractionable) {
    orderRequest = {
      symbol: alpacaSymbol,
      notional: fundsToDeploy.toDecimalPlaces(2, Decimal.ROUND_DOWN).toNumber(),
      side: orderSide,
      type: orderType,
      time_in_force: timeInForce,
      limit_price: limitPrice.toNumber(),
      extended_hours: true,
    };
  } else {
    const latestQuote: AlpacaGetLatestQuote = await alpacaGetLatestQuote(
      alpacaSymbol,
      accountName,
    );
    const price: Decimal = latestQuote.askPrice.gt(0)
      ? latestQuote.askPrice
      : latestQuote.bidPrice;
    const quantity: Decimal = fundsToDeploy
      .times(0.97)
      .dividedBy(price)
      .toDecimalPlaces(0, Decimal.ROUND_DOWN);

    orderRequest = {
      symbol: alpacaSymbol,
      qty: quantity.toNumber(),
      side: orderSide,
      type: orderType,
      time_in_force: timeInForce,
      limit_price: limitPrice.toNumber(),
      extended_hours: true,
    };
  }

  try {
    const alpaca: Alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

    console.log("Limit order request:", orderRequest);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const orderResponse = await alpaca.createOrder(orderRequest);
    console.log(`Limit ${orderSide} order submitted: \n`, orderResponse);
    console.log("Alpaca Order End - alpacaSubmitLimitOrderCustomPercentage");
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error - alpacaSubmitLimitOrderCustomPercentage:", error);
    throw error;
  }
};

/**
 * Submits a market order to Alpaca based on a percentage of account equity.
 *
 * @param alpacaSymbol - The symbol of the asset to trade.
 * @param buySideOrder - Whether to buy or sell the asset.
 * @param capitalPercentageToDeploy - The percentage of account equity to deploy.
 * @param accountName - The name of the Alpaca trading account.
 * @param orderType - The type of order to submit.
 * @param timeInForce - The time in force for the order.
 *
 * @returns - Current time in New York and the specified local timezone, formatted as "YYYY-MM-DD HH:mm:ss".
 */
export const alpacaSubmitMarketOrderCustomPercentage = async ({
  alpacaSymbol,
  buySideOrder = true,
  capitalPercentageToDeploy = ALPACA_CAPITAL_TO_DEPLOY_EQUITY_PERCENTAGE,
  accountName = ALPACA_TRADING_ACCOUNT_NAME_LIVE,
  orderType = OrderType.MARKET,
  timeInForce = TimeInForce.DAY,
}: AlpacaSubmitMarketOrderCustomPercentageParams): Promise<void> => {
  const credentials = alpacaGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Alpaca account credentials not found");
  }

  console.log("Alpaca Order Begin - alpacaSubmitMarketOrderCustomPercentage");
  logTimesInNewYorkAndLocalTimezone();

  const accountInfo = await alpacaGetAccountBalance(accountName);
  const accountEquity = accountInfo.accountEquity;
  const accountCash = accountInfo.accountCash;
  const capitalPercentage = new Decimal(capitalPercentageToDeploy);
  let fundsToDeploy: Decimal = accountEquity
    .mul(capitalPercentage)
    .toDecimalPlaces(2, Decimal.ROUND_DOWN);

  if (fundsToDeploy.lte(0)) {
    console.log("Error - Insufficient funds to deploy");
    throw new Error("Error - Insufficient funds to deploy");
  }

  if (fundsToDeploy.gt(accountCash)) {
    fundsToDeploy = accountCash.toDecimalPlaces(2, Decimal.ROUND_DOWN);
  }

  let orderRequest: OrderRequest;
  const orderSide: OrderSide = buySideOrder ? OrderSide.BUY : OrderSide.SELL;
  const fractionable: boolean = await alpacaIsAssetFractionable(
    alpacaSymbol,
    accountName,
  );

  if (fractionable) {
    orderRequest = {
      symbol: alpacaSymbol,
      notional: fundsToDeploy.toNumber(),
      side: orderSide,
      type: orderType,
      time_in_force: timeInForce,
    };
  } else {
    const latestQuote: AlpacaGetLatestQuote = await alpacaGetLatestQuote(
      alpacaSymbol,
      accountName,
    );
    const price: Decimal = latestQuote.bidPrice.eq(0)
      ? latestQuote.askPrice
      : latestQuote.bidPrice;
    const quantity: Decimal = fundsToDeploy
      .mul(0.97)
      .div(price)
      .toDecimalPlaces(0, Decimal.ROUND_DOWN);

    orderRequest = {
      symbol: alpacaSymbol,
      qty: quantity.toNumber(),
      side: orderSide,
      type: orderType,
      time_in_force: timeInForce,
    };
  }

  try {
    const alpaca: Alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

    console.log("orderRequest:", orderRequest);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const orderResponse = await alpaca.createOrder(orderRequest);
    console.log(`Market ${orderSide} order submitted: \n`, orderResponse);
    console.log("Alpaca Order End - alpacaSubmitMarketOrderCustomPercentage");
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error - alpacaSubmitMarketOrderCustomPercentage:", error);
    throw error;
  }
};

/**
 * Sells all holdings of an asset using the Alpaca trading API.
 *
 * @param symbol - The ticker symbol of the asset to sell.
 * @param accountName - The Alpaca account to use for the operation. Defaults to live trading account.
 */
export const alpacaCloseAllHoldingsOfAsset = async (
  symbol: string,
  accountName: string = ALPACA_TRADING_ACCOUNT_NAME_LIVE,
): Promise<void> => {
  const credentials = alpacaGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Alpaca account credentials not found");
  }

  console.log("Alpaca Order Begin - alpacaCloseAllHoldingsOfAsset");
  logTimesInNewYorkAndLocalTimezone();

  try {
    const alpaca: Alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const orderResponse = await alpaca.closePosition(symbol);
    console.log(
      `Submitted request to close all holdings of ${symbol}, order response:`,
      orderResponse,
    );
    console.log("Alpaca Order End - alpacaCloseAllHoldingsOfAsset");
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error - alpacaCloseAllHoldingsOfAsset:", error);
    throw error;
  }
};
