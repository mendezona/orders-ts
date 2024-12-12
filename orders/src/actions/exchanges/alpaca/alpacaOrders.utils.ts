import Alpaca from "@alpacahq/alpaca-trade-api";
import * as Sentry from "@sentry/nextjs";
import { AxiosError } from "axios";
import Decimal from "decimal.js";
import { VERCEL_MAXIMUM_SERVER_LIMIT } from "~/actions/actions.constants";
import {
  deleteAllFractionableTakeProfitOrders,
  getFirstFractionableTakeProfitOrder,
  saveBuyTradeToDatabaseFlipTradeAlertTable,
  saveFractionableTakeProfitOrder,
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
  ALPACA_LIVE_TRADING_ACCOUNT_NAME,
  ALPACA_TOLERATED_EXTENDED_HOURS_SLIPPAGE,
  ALPACA_TRADINGVIEW_INVERSE_PAIRS,
  ALPACA_TRADINGVIEW_SYMBOLS,
} from "./alpaca.constants";
import {
  type AlpacaGetLatestQuote,
  type AlpacaSubmitLimitOrderCustomPercentageParams,
  type AlpacaSubmitLimitOrderCustomQuantityParams,
  type AlpacaSubmitMarketOrderCustomPercentageParams,
  type AlpacaSubmitPairTradeOrderParams,
} from "./alpaca.types";
import {
  alpacaGetAccountBalance,
  alpacaGetCredentials,
  alpacaGetPositionForAsset,
} from "./alpacaAccount.utils";
import {
  type OrderRequest,
  type OrderSide,
  OrderSideSchema,
  OrderTypeSchema,
  TimeInForceSchema,
} from "./alpacaApi.types";
import { scheduleFractionableTakeProfitOrderCronJob } from "./alpacaCronJob.helpers";
import { alpacaSchedulePriceCheckAtNextIntervalCronJob } from "./alpacaCronJobs";
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
  accountName = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
  scheduleCronJob = true,
  submitTakeProfitOrder = true,
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
    const errorMessage = `Error - alpacaSubmitPairTradeOrder: ${tradingViewSymbol} not found`;
    console.log(errorMessage);
    Sentry.captureMessage(errorMessage);
    throw new Error(errorMessage);
  }

  console.log("alpacaSymbol", alpacaSymbol);
  console.log("alpacaInverseSymbol", alpacaInverseSymbol);

  /**
   *  If there is no sell order found for current symbol, sell all holdings and save CGT to database.
   *
   * Assumes there is only one order open at a time for a given symbol
   **/
  const [openPositionOfInverseTrade] = await Promise.all([
    alpacaGetPositionForAsset(alpacaInverseSymbol),
    alpacaCancelAllOpenOrders(accountName),
    deleteAllFractionableTakeProfitOrders(),
  ]);

  if (
    openPositionOfInverseTrade.openPositionFound &&
    openPositionOfInverseTrade.qty
  ) {
    if (isOutsideNasdaqTradingHours()) {
      const assetBalance: Decimal = openPositionOfInverseTrade.qty;
      await alpacaSubmitLimitOrderCustomQuantity({
        alpacaSymbol: alpacaInverseSymbol,
        quantity: assetBalance,
        buySideOrder: false,
        setSlippagePercentage: new Decimal("0.01"),
        submitTakeProfitOrder: false,
      } as AlpacaSubmitLimitOrderCustomQuantityParams);
    } else {
      await alpacaCloseAllHoldingsOfAsset(alpacaInverseSymbol, accountName);
    }

    const timeout = VERCEL_MAXIMUM_SERVER_LIMIT;
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
      console.log("tax_amount", taxAmount.toString(), "\n");

      if (taxAmount.gt(0)) {
        await saveSellTradeToDatabaseSellTable({
          exchange: EXCHANGES.ALPACA,
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
      alpacaSymbol,
      capitalPercentageToDeploy,
      setSlippagePercentage: ALPACA_TOLERATED_EXTENDED_HOURS_SLIPPAGE,
      accountName,
      submitTakeProfitOrder,
    } as AlpacaSubmitLimitOrderCustomPercentageParams);
  } else {
    await alpacaSubmitMarketOrderCustomPercentage({
      alpacaSymbol,
      capitalPercentageToDeploy,
      accountName,
      tradingViewPrice,
      submitTakeProfitOrder,
    } as AlpacaSubmitMarketOrderCustomPercentageParams);
  }

  let executionPrice = "0";
  if (!buyAlert) {
    const latestQuote: AlpacaGetLatestQuote = await alpacaGetLatestQuote(
      alpacaSymbol,
      accountName,
    );
    executionPrice =
      latestQuote.bidPrice.toString() ?? latestQuote.askPrice.toString();
  }

  await saveBuyTradeToDatabaseFlipTradeAlertTable({
    exchange: EXCHANGES.ALPACA,
    symbol: tradingViewSymbol,
    price: buyAlert ? tradingViewPrice : executionPrice,
  } as SaveBuyTradeToDatabaseFlipTradeAlertTableProps);

  if (submitTakeProfitOrder) {
    await alpacaSubmitTakeProfitOrderForFractionableAssets();
  }

  if (scheduleCronJob) {
    if (!tradingViewInterval) {
      const errorMessage = "Error - Interval required to set cron job";
      console.log(errorMessage);
      Sentry.captureMessage(errorMessage);
      throw new Error(errorMessage);
    }

    await alpacaSchedulePriceCheckAtNextIntervalCronJob({
      tradingViewSymbol,
      tradingViewPrice,
      tradingViewInterval,
      buyAlert,
    });
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
  accountName = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
  orderType = OrderTypeSchema.Enum.limit,
  timeInForce = TimeInForceSchema.Enum.day,
  setSlippagePercentage = new Decimal(0),
  submitTakeProfitOrder = true,
  takeProfitPercentage = new Decimal(1.05),
}: AlpacaSubmitLimitOrderCustomQuantityParams): Promise<void> => {
  const credentials = alpacaGetCredentials(accountName);

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
        .add(quotePrice.times(setSlippagePercentage))
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

  const orderSide: OrderSide = buySideOrder
    ? OrderSideSchema.enum.buy
    : OrderSideSchema.Enum.sell;
  let orderRequest: OrderRequest;
  const fractionable: boolean = await alpacaIsAssetFractionable(
    alpacaSymbol,
    accountName,
  );

  if (fractionable) {
    orderRequest = {
      symbol: alpacaSymbol,
      qty: new Decimal(quantity).toNumber(),
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
    // Execute order creation and latest quote fetch concurrently
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [orderResponse, latestQuote] = await Promise.all([
      alpaca.createOrder(orderRequest),
      alpacaGetLatestQuote(orderRequest.symbol ?? "", accountName),
    ] as const);
    console.log(`Limit ${orderSide} order submitted: \n`, orderResponse);

    if (submitTakeProfitOrder) {
      await wait(10000);
      const takeProfitPrice: Decimal = buySideOrder
        ? limitPrice
            .times(takeProfitPercentage)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        : new Decimal(latestQuote.bidPrice ?? latestQuote.askPrice)
            .times(takeProfitPercentage)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const reverseOrderSide: OrderSide = !buySideOrder
        ? OrderSideSchema.enum.buy
        : OrderSideSchema.Enum.sell;

      if (fractionable) {
        // Save to database for processing at 3 AM next trading day
        await Promise.all([
          saveFractionableTakeProfitOrder({
            symbol: alpacaSymbol,
            quantity: quantity.toString(),
            limitPrice: takeProfitPrice.toString(),
            side: reverseOrderSide,
          }),
          scheduleFractionableTakeProfitOrderCronJob(),
        ]);
      } else {
        const takeProfitOrderRequest: OrderRequest = {
          symbol: alpacaSymbol,
          qty: new Decimal(quantity)
            .toDecimalPlaces(0, Decimal.ROUND_DOWN)
            .toNumber(),
          side: reverseOrderSide,
          type: OrderTypeSchema.Enum.limit,
          time_in_force: TimeInForceSchema.Enum.gtc,
          limit_price: takeProfitPrice.toNumber(),
          extended_hours: false,
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const [orderResponse] = await Promise.all([
          alpaca.createOrder(takeProfitOrderRequest),
          deleteAllFractionableTakeProfitOrders(),
        ]);
        console.log(
          `Take Profit Limit ${orderSide} order submitted: \n`,
          orderResponse,
        );
      }

      console.log("Alpaca Order End - alpacaSubmitLimitOrderCustomQuantity");
    }
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        context: "alpacaSubmitLimitOrderCustomQuantity - Promise.all",
        orderRequest: JSON.stringify(orderRequest),
        orderSide,
        accountName,
        symbol: orderRequest.symbol,
        errorDetails:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
      },
      tags: {
        function: "alpacaSubmitLimitOrderCustomQuantity",
        operation: "createOrder_and_getLatestQuote",
      },
    });
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
  accountName = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
  orderType = OrderTypeSchema.Enum.limit,
  timeInForce = TimeInForceSchema.Enum.day,
  limitPrice,
  setSlippagePercentage = new Decimal(0),
  submitTakeProfitOrder = true,
  takeProfitPercentage = new Decimal(1.05),
}: AlpacaSubmitLimitOrderCustomPercentageParams): Promise<void> => {
  const credentials = alpacaGetCredentials(accountName);

  console.log("Alpaca Order Begin - alpacaSubmitLimitOrderCustomPercentage");
  logTimesInNewYorkAndLocalTimezone();

  const accountInfo = await alpacaGetAccountBalance(accountName);
  const accountEquity = accountInfo.accountEquity;
  const accountCash = accountInfo.accountCash;
  let fundsToDeploy = accountEquity
    .times(capitalPercentageToDeploy)
    .toDecimalPlaces(2, Decimal.ROUND_DOWN);

  if (fundsToDeploy.lte(0)) {
    const errorMessage = "Error - Insufficient funds to deploy";
    console.log(errorMessage);
    Sentry.captureMessage(errorMessage);
    throw new Error(errorMessage);
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
        .minus(quotePrice.times(setSlippagePercentage))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
  }

  const orderSide: OrderSide = buySideOrder
    ? OrderSideSchema.Enum.buy
    : OrderSideSchema.Enum.sell;
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
    // Execute order creation and latest quote fetch concurrently
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [orderResponse, latestQuote] = await Promise.all([
      alpaca.createOrder(orderRequest),
      alpacaGetLatestQuote(orderRequest.symbol ?? "", accountName),
    ] as const);
    console.log(`Limit ${orderSide} order submitted: \n`, orderResponse);

    if (submitTakeProfitOrder) {
      await wait(10000);
      const currentPosition = await alpacaGetPositionForAsset(
        alpacaSymbol,
        accountName,
        5,
      );

      if (!currentPosition?.openPositionFound || !currentPosition?.qty) {
        const errorMessage =
          "Error - No open position found to create take profit order";
        console.log(errorMessage);
        Sentry.captureMessage(errorMessage);
        throw new Error(errorMessage);
      }

      const takeProfitPrice: Decimal = buySideOrder
        ? limitPrice
            .times(takeProfitPercentage)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        : new Decimal(latestQuote.bidPrice ?? latestQuote.askPrice)
            .times(takeProfitPercentage)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const reverseOrderSide: OrderSide = !buySideOrder
        ? OrderSideSchema.enum.buy
        : OrderSideSchema.Enum.sell;

      if (fractionable) {
        // Save to database for processing at 3 AM next trading day
        await Promise.all([
          saveFractionableTakeProfitOrder({
            symbol: alpacaSymbol,
            quantity: currentPosition.qty.toString(),
            limitPrice: takeProfitPrice.toString(),
            side: reverseOrderSide,
          }),
          scheduleFractionableTakeProfitOrderCronJob(),
        ]);
      } else {
        const takeProfitOrderRequest: OrderRequest = {
          symbol: alpacaSymbol,
          qty: new Decimal(currentPosition.qty).toNumber(),
          side: reverseOrderSide,
          type: OrderTypeSchema.Enum.limit,
          time_in_force: TimeInForceSchema.Enum.gtc,
          limit_price: takeProfitPrice.toNumber(),
          extended_hours: false,
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const [orderResponse] = await Promise.all([
          alpaca.createOrder(takeProfitOrderRequest),
          deleteAllFractionableTakeProfitOrders(),
        ]);
        console.log(
          `Take Profit Limit ${orderSide} order submitted: \n`,
          orderResponse,
        );
      }

      console.log("Alpaca Order End - alpacaSubmitLimitOrderCustomQuantity");
    }
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        context: "alpacaSubmitLimitOrderCustomPercentage - Promise.all",
        orderRequest: JSON.stringify(orderRequest),
        orderSide,
        accountName,
        symbol: orderRequest.symbol,
        capitalPercentageToDeploy: capitalPercentageToDeploy.toString(),
        errorDetails:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
      },
      tags: {
        function: "alpacaSubmitLimitOrderCustomPercentage",
        operation: "createOrder_and_getLatestQuote",
      },
    });
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
  tradingViewPrice,
  buySideOrder = true,
  capitalPercentageToDeploy = ALPACA_CAPITAL_TO_DEPLOY_EQUITY_PERCENTAGE,
  accountName = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
  orderType = OrderTypeSchema.Enum.market,
  timeInForce = TimeInForceSchema.Enum.day,
  submitTakeProfitOrder = true,
  takeProfitPercentage = new Decimal(1.05),
}: AlpacaSubmitMarketOrderCustomPercentageParams): Promise<void> => {
  const credentials = alpacaGetCredentials(accountName);

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
    const errorMessage = "Error - Insufficient funds to deploy";
    console.log(errorMessage);
    Sentry.captureMessage(errorMessage);
    throw new Error(errorMessage);
  }

  if (fundsToDeploy.gt(accountCash)) {
    fundsToDeploy = accountCash.toDecimalPlaces(2, Decimal.ROUND_DOWN);
  }

  let orderRequest: OrderRequest;
  const orderSide: OrderSide = buySideOrder
    ? OrderSideSchema.Enum.buy
    : OrderSideSchema.Enum.sell;
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
    // Execute order creation and latest quote fetch concurrently
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [orderResponse, takeProfitQuote] = await Promise.all([
      alpaca.createOrder(orderRequest),
      alpacaGetLatestQuote(alpacaSymbol, accountName),
    ] as const);
    console.log(`Market ${orderSide} order submitted: \n`, orderResponse);

    if (submitTakeProfitOrder) {
      await wait(10000);
      const currentPosition = await alpacaGetPositionForAsset(
        alpacaSymbol,
        accountName,
        5,
      );

      if (!currentPosition?.openPositionFound || !currentPosition?.qty) {
        const errorMessage =
          "Error - No open position found to create take profit order";
        console.log(errorMessage);
        Sentry.captureMessage(errorMessage);
        throw new Error(errorMessage);
      }

      const principalPrice: Decimal = new Decimal(
        buySideOrder
          ? tradingViewPrice
          : (takeProfitQuote.bidPrice ?? takeProfitQuote.askPrice),
      );
      const takeProfitPrice: Decimal = principalPrice
        .times(takeProfitPercentage)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const reverseOrderSide: OrderSide = !buySideOrder
        ? OrderSideSchema.enum.buy
        : OrderSideSchema.Enum.sell;

      if (fractionable) {
        // Save to database for processing at 3 AM next trading day
        await Promise.all([
          saveFractionableTakeProfitOrder({
            symbol: alpacaSymbol,
            quantity: currentPosition.qty.toString(),
            limitPrice: takeProfitPrice.toString(),
            side: reverseOrderSide,
          }),
          scheduleFractionableTakeProfitOrderCronJob(),
        ]);
      } else {
        const takeProfitOrderRequest: OrderRequest = {
          symbol: alpacaSymbol,
          qty: new Decimal(currentPosition.qty).toNumber(),
          side: reverseOrderSide,
          type: OrderTypeSchema.Enum.limit,
          time_in_force: TimeInForceSchema.Enum.gtc,
          limit_price: takeProfitPrice.toNumber(),
          extended_hours: false,
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const [orderResponse] = await Promise.all([
          alpaca.createOrder(takeProfitOrderRequest),
          deleteAllFractionableTakeProfitOrders(),
        ]);
        console.log(
          `Take Profit Limit ${orderSide} order submitted: \n`,
          orderResponse,
        );
      }
    }

    console.log("Alpaca Order End - alpacaSubmitMarketOrderCustomPercentage");
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        context: "alpacaSubmitMarketOrderCustomPercentage - Promise.all",
        orderRequest: JSON.stringify(orderRequest),
        orderSide,
        accountName,
        symbol: alpacaSymbol,
        capitalPercentageToDeploy: capitalPercentageToDeploy.toString(),
        errorDetails:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
      },
      tags: {
        function: "alpacaSubmitMarketOrderCustomPercentage",
        operation: "createOrder_and_getLatestQuote",
      },
    });
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
  accountName: string = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
): Promise<void> => {
  const credentials = alpacaGetCredentials(accountName);

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

/**
 * Cancels all open orders for the specified Alpaca account.
 *
 * @param accountName - The Alpaca account to use for the operation. Defaults to live trading account.
 * @returns Promise that resolves when all orders are cancelled
 */
export const alpacaCancelAllOpenOrders = async (
  accountName: string = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
): Promise<void> => {
  const credentials = alpacaGetCredentials(accountName);
  console.log("Alpaca Order Begin - alpacaCancelAllOpenOrders");

  try {
    const alpaca: Alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

    await alpaca.cancelAllOrders();
    console.log("Successfully cancelled all open orders");
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        errorDetails: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        accountName,
      },
    });
    console.error("Failed to cancel all open orders:", error);
    throw error;
  }
};

/**
 * Submits a take profit order for the first fractionable asset found.
 *
 * @returns The take profit order.
 */
export const alpacaSubmitTakeProfitOrderForFractionableAssets =
  async (): Promise<Response> => {
    try {
      const order = await getFirstFractionableTakeProfitOrder();

      if (!order) {
        console.log("No fractionable take profit orders found");
        return new Response(JSON.stringify({ message: "No orders found" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const currentPosition = await alpacaGetPositionForAsset(
        order.symbol,
        ALPACA_LIVE_TRADING_ACCOUNT_NAME,
        5,
      );

      if (!currentPosition?.openPositionFound || !currentPosition?.qty) {
        await deleteAllFractionableTakeProfitOrders();

        console.log("No open position found to create take profit order");
        return new Response(
          JSON.stringify({ message: "No open position found" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const takeProfitOrderRequest = {
        symbol: order.symbol,
        qty: new Decimal(order.quantity).toNumber(),
        side: order.side,
        type: OrderTypeSchema.Enum.limit,
        time_in_force: TimeInForceSchema.Enum.day,
        limit_price: new Decimal(order.limitPrice)
          .toDecimalPlaces(2, Decimal.ROUND_DOWN)
          .toNumber(),
        extended_hours: true,
      };

      const credentials = alpacaGetCredentials(
        ALPACA_LIVE_TRADING_ACCOUNT_NAME,
      );
      const alpaca: Alpaca = new Alpaca({
        keyId: credentials.key,
        secretKey: credentials.secret,
        paper: credentials.paper,
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const orderResponse = await alpaca.createOrder(takeProfitOrderRequest);
      await scheduleFractionableTakeProfitOrderCronJob();

      console.log(
        `Take Profit Limit ${order.side} order submitted: \n`,
        orderResponse,
      );

      return new Response(
        JSON.stringify({
          message: `Successfully submitted take profit order for ${order.symbol}`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      if (error instanceof AxiosError) {
        Sentry.captureException(error, {
          extra: {
            errorMessage: error.message,
            errorStack: error.stack,
            errorDetails: JSON.stringify(
              error,
              Object.getOwnPropertyNames(error),
            ),
            context: "alpacaSubmitTakeProfitOrderForFractionableAssets",
            responseData: error.response?.data,
            responseStatus: error.response?.status,
            responseHeaders: error.response?.headers,
            requestData: error.config?.data,
            requestMethod: error.config?.method,
            requestURL: error.config?.url,
            requestHeaders: error.config?.headers,
          },
          tags: {
            errorType: "alpacaSubmitTakeProfitOrderForFractionableAssets",
            statusCode: error.response?.status?.toString(),
          },
        });
      } else {
        Sentry.captureException(error);
      }

      console.error("Failed to submit fractionable take profit order:", error);
      throw error;
    }
  };
