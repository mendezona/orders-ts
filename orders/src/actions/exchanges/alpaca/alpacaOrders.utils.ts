import Alpaca from "@alpacahq/alpaca-trade-api";
import * as Sentry from "@sentry/nextjs";
import Decimal from "decimal.js";
import { VERCEL_MAXIMUM_SERVER_LIMIT } from "~/actions/actions.constants";
import { isAxiosError, wait } from "~/actions/actions.utils";
import {
  deleteAllFractionableTakeProfitOrders,
  getFirstFractionableTakeProfitOrder,
  getLatestFlipAlertForSymbol,
  saveBuyTradeToDatabaseFlipTradeAlertTable,
  saveFractionableTakeProfitOrder,
  saveSellTradeToDatabaseSellTable,
} from "~/server/queries";
import {
  EXCHANGES,
  EXCHANGE_CAPITAL_GAINS_TAX_RATE,
} from "../exchanges.constants";
import { getIsMarketOpen, logTimezonesOfCurrentTime } from "../exchanges.utils";
import {
  ALPACA_CAPITAL_TO_DEPLOY_EQUITY_PERCENTAGE,
  ALPACA_LIVE_TRADING_ACCOUNT_NAME,
  ALPACA_TOLERATED_EXTENDED_HOURS_SLIPPAGE,
  ALPACA_TRADINGVIEW_INVERSE_PAIRS,
  ALPACA_TRADINGVIEW_SYMBOLS,
} from "./alpaca.constants";
import {
  type AlpacaLatestQuote,
  type AlpacaReverseTradeOnFalseSignalParams,
  type AlpacaSubmitLimitOrderCustomPercentageParams,
  type AlpacaSubmitLimitOrderCustomQuantityParams,
  type AlpacaSubmitMarketOrderCustomPercentageParams,
  type AlpacaSubmitPairTradeOrderParams,
} from "./alpaca.types";
import {
  getAlpacaAccountBalance,
  getAlpacaCredentials,
  getAlpacaPositionForAsset,
} from "./alpacaAccount.utils";
import {
  type OrderRequest,
  type OrderSide,
  OrderSideSchema,
  OrderTypeSchema,
  TimeInForceSchema,
} from "./alpacaApi.types";
import {
  alpacaCronJobSchedulePriceCheckAtNextInterval,
  alpacaCronJobScheduleTakeProfitOrderForFractionableAsset,
} from "./alpacaCronJobs";
import {
  getAlpacaCalculateProfitOrLoss,
  getAlpacaGetLatestQuoteForAsset,
  getAlpacaIsAssetFractionable,
  getAlpacaIsPositionOpen,
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
  useExtendedHours = true,
}: AlpacaSubmitPairTradeOrderParams): Promise<void> => {
  try {
    console.log("alpacaSubmitPairTradeOrder - Begin");
    logTimezonesOfCurrentTime();

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
      const errorMessage = `alpacaSubmitPairTradeOrder - Error, ${tradingViewSymbol} not found`;
      console.log(errorMessage);
      throw new Error(errorMessage);
    }

    console.log("alpacaSubmitPairTradeOrder - alpacaSymbol:", alpacaSymbol);
    console.log(
      "alpacaSubmitPairTradeOrder - alpacaInverseSymbol:",
      alpacaInverseSymbol,
    );

    /**
     *  If there is no sell order found for current symbol, sell all holdings and save CGT to database.
     *
     * Assumes there is only one order open at a time for a given symbol
     **/
    const [openPositionOfInverseTrade, marketOpen] = await Promise.all([
      getAlpacaPositionForAsset(alpacaInverseSymbol),
      getIsMarketOpen(),
      alpacaCancelAllOpenOrders(accountName),
      deleteAllFractionableTakeProfitOrders(),
    ]);

    // Sell all holdings
    if (
      openPositionOfInverseTrade.openPositionFound &&
      openPositionOfInverseTrade.qty
    ) {
      console.log(
        "alpacaSubmitPairTradeOrder - create sell order for:",
        alpacaInverseSymbol,
      );

      if (marketOpen) {
        await alpacaCloseAllHoldingsOfAsset(alpacaInverseSymbol, accountName);
      } else {
        const assetBalance: Decimal = openPositionOfInverseTrade.qty;
        await alpacaSubmitLimitOrderCustomQuantity({
          alpacaSymbol: alpacaInverseSymbol,
          quantity: assetBalance,
          buyAlert,
          buySideOrder: false,
          setSlippagePercentage: new Decimal("0.01"),
          submitTakeProfitOrder,
          accountName,
          orderType: OrderTypeSchema.Enum.limit,
          timeInForce: TimeInForceSchema.Enum.day,
        });
      }

      console.log(
        "alpacaSubmitPairTradeOrder - check if position is closed for:",
        alpacaInverseSymbol,
      );
      const timeout = VERCEL_MAXIMUM_SERVER_LIMIT;
      const startTime: number = Date.now();
      while ((Date.now() - startTime) / 1000 < timeout) {
        if (
          !(await getAlpacaIsPositionOpen(alpacaInverseSymbol, accountName))
        ) {
          break;
        }
        await wait(1000);
      }

      // Calculate and save tax to database, if applicable
      console.log(
        "alpacaSubmitPairTradeOrder - calculating and saving tax for:",
        alpacaInverseSymbol,
      );
      if (calculateTax) {
        const profitLossAmount: Decimal = await getAlpacaCalculateProfitOrLoss(
          alpacaInverseSymbol,
          accountName,
        );
        const taxAmount: Decimal = profitLossAmount
          .times(EXCHANGE_CAPITAL_GAINS_TAX_RATE)
          .toDecimalPlaces(2, Decimal.ROUND_UP);
        console.log(
          "alpacaSubmitPairTradeOrder - tax amount:",
          taxAmount.toString(),
        );

        if (taxAmount.gt(0)) {
          await saveSellTradeToDatabaseSellTable({
            exchange: EXCHANGES.ALPACA,
            symbol: alpacaInverseSymbol,
            profitOrLossAmount: profitLossAmount.toString(),
            taxableAmount: taxAmount.toString(),
            buyAlert,
          });
        }
      }
    }

    console.log(
      "alpacaSubmitPairTradeOrder - create buy order for:",
      alpacaSymbol,
    );
    if (marketOpen) {
      await alpacaSubmitMarketOrderCustomPercentage({
        alpacaSymbol,
        capitalPercentageToDeploy,
        accountName,
        tradingViewPrice,
        buyAlert,
        buySideOrder: true,
        orderType: OrderTypeSchema.Enum.market,
        timeInForce: TimeInForceSchema.Enum.day,
        submitTakeProfitOrder,
      });
    } else {
      await alpacaSubmitLimitOrderCustomPercentage({
        alpacaSymbol,
        capitalPercentageToDeploy,
        setSlippagePercentage: ALPACA_TOLERATED_EXTENDED_HOURS_SLIPPAGE,
        accountName,
        buyAlert,
        buySideOrder: true,
        orderType: OrderTypeSchema.Enum.limit,
        timeInForce: TimeInForceSchema.Enum.day,
        submitTakeProfitOrder,
      });
    }

    let executionPrice = "0";

    // TODO: Refactor how this quote is generated, get the last price used in the order instead of the latest quote
    if (!buyAlert) {
      const latestQuote: AlpacaLatestQuote =
        await getAlpacaGetLatestQuoteForAsset(alpacaSymbol, accountName);
      executionPrice =
        latestQuote.bidPrice.toString() ?? latestQuote.askPrice.toString();
    }

    console.log(
      "alpacaSubmitPairTradeOrder - save execution price:",
      executionPrice,
    );
    await saveBuyTradeToDatabaseFlipTradeAlertTable({
      exchange: EXCHANGES.ALPACA,
      symbol: tradingViewSymbol,
      price: buyAlert ? tradingViewPrice : executionPrice,
    });

    if (scheduleCronJob) {
      if (!tradingViewInterval) {
        const errorMessage =
          "alpacaSubmitPairTradeOrder - Error, interval required to set cron job";
        console.log(errorMessage);
        throw new Error(errorMessage);
      }

      console.log(
        "alpacaSubmitPairTradeOrder - schedule cron job for price check at next interval",
      );
      await alpacaCronJobSchedulePriceCheckAtNextInterval({
        tradingViewSymbol,
        tradingViewPrice,
        tradingViewInterval,
        buyAlert,
        useExtendedHours,
      });
    }
  } catch (error) {
    if (isAxiosError(error)) {
      Sentry.captureException(error, {
        extra: {
          errorMessage: error.message,
          responseData: error.response?.data,
          responseStatus: error.response?.status,
          responseHeaders: error.response?.headers,
          requestData: error.config?.data,
          requestMethod: error.config?.method,
          requestURL: error.config?.url,
          requestHeaders: error.config?.headers,
        },
        tags: {
          function: "alpacaSubmitPairTradeOrder",
          statusCode: error.response?.status?.toString(),
        },
      });
    } else {
      Sentry.captureException(error, {
        tags: {
          function: "alpacaSubmitPairTradeOrder",
        },
      });
    }
    throw error;
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
  const credentials = getAlpacaCredentials(accountName);

  console.log("alpacaSubmitLimitOrderCustomQuantity - order begin");
  logTimezonesOfCurrentTime();

  if (!limitPrice) {
    let quotePrice: Decimal;
    const latestQuote: AlpacaLatestQuote =
      await getAlpacaGetLatestQuoteForAsset(alpacaSymbol, accountName);

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
  const fractionable = await getAlpacaIsAssetFractionable(
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

    console.log(
      "alpacaSubmitLimitOrderCustomQuantity - orderRequest:",
      orderRequest,
    );
    // Execute order creation and latest quote fetch concurrently
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [orderResponse, latestQuote] = await Promise.all([
      alpaca.createOrder(orderRequest),
      getAlpacaGetLatestQuoteForAsset(orderRequest.symbol ?? "", accountName),
    ]);
    console.log(
      `alpacaSubmitLimitOrderCustomQuantity - Limit ${orderSide} order submitted: \n`,
      orderResponse,
    );

    if (submitTakeProfitOrder) {
      // TODO: Could send to a queue with delay of 10 seconds instead
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
          alpacaCronJobScheduleTakeProfitOrderForFractionableAsset(),
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
          `alpacaSubmitLimitOrderCustomQuantity - Take Profit Limit ${orderSide} order submitted: \n`,
          orderResponse,
        );
      }

      console.log("alpacaSubmitLimitOrderCustomQuantity - order end success");
    }
  } catch (error) {
    if (isAxiosError(error)) {
      Sentry.captureException(error, {
        extra: {
          errorMessage: error.message,
          responseData: error.response?.data,
          responseStatus: error.response?.status,
          responseHeaders: error.response?.headers,
          requestData: error.config?.data,
          requestMethod: error.config?.method,
          requestURL: error.config?.url,
          requestHeaders: error.config?.headers,
        },
        tags: {
          function: "alpacaSubmitLimitOrderCustomQuantity",
          statusCode: error.response?.status?.toString(),
        },
      });
    } else {
      Sentry.captureException(error, {
        tags: {
          function: "alpacaSubmitLimitOrderCustomQuantity",
        },
      });
    }
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
  buyAlert,
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
  const credentials = getAlpacaCredentials(accountName);

  console.log("alpacaSubmitLimitOrderCustomPercentage - order begin");
  logTimezonesOfCurrentTime();

  const accountInfo = await getAlpacaAccountBalance(accountName);
  const accountEquity = accountInfo.accountEquity;
  const accountCash = accountInfo.accountCash;
  let fundsToDeploy = accountEquity
    .times(capitalPercentageToDeploy)
    .toDecimalPlaces(2, Decimal.ROUND_DOWN);

  if (fundsToDeploy.lte(0)) {
    const errorMessage =
      "alpacaSubmitLimitOrderCustomPercentage - Error, insufficient funds to deploy";
    console.log(errorMessage);
    Sentry.captureMessage(errorMessage);
    throw new Error(errorMessage);
  }

  if (fundsToDeploy.gt(accountCash)) {
    fundsToDeploy = accountCash.toDecimalPlaces(2, Decimal.ROUND_DOWN);
  }

  if (!limitPrice) {
    let quotePrice: Decimal;
    const latestQuote: AlpacaLatestQuote =
      await getAlpacaGetLatestQuoteForAsset(alpacaSymbol, accountName);

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
  const fractionable = await getAlpacaIsAssetFractionable(
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
    const latestQuote: AlpacaLatestQuote =
      await getAlpacaGetLatestQuoteForAsset(alpacaSymbol, accountName);
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
      getAlpacaGetLatestQuoteForAsset(orderRequest.symbol ?? "", accountName),
    ]);
    console.log(
      `alpacaSubmitLimitOrderCustomPercentage - Limit ${orderSide} order submitted: \n`,
      orderResponse,
    );

    if (submitTakeProfitOrder) {
      // TODO: Could send to a queue with delay of 10 seconds instead
      await wait(10000);
      const currentPosition = await getAlpacaPositionForAsset(
        alpacaSymbol,
        accountName,
      );

      if (!currentPosition?.openPositionFound || !currentPosition?.qty) {
        const errorMessage =
          "alpacaSubmitLimitOrderCustomPercentage - Error, no open position found to create take profit order";
        console.log(errorMessage);
        Sentry.captureMessage(errorMessage);
        throw new Error(errorMessage);
      }

      const takeProfitPrice: Decimal = buyAlert
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
          alpacaCronJobScheduleTakeProfitOrderForFractionableAsset(),
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

      console.log("alpacaSubmitLimitOrderCustomPercentage - order end success");
    }
  } catch (error) {
    if (isAxiosError(error)) {
      Sentry.captureException(error, {
        extra: {
          errorMessage: error.message,
          responseData: error.response?.data,
          responseStatus: error.response?.status,
          responseHeaders: error.response?.headers,
          requestData: error.config?.data,
          requestMethod: error.config?.method,
          requestURL: error.config?.url,
          requestHeaders: error.config?.headers,
        },
        tags: {
          function: "alpacaSubmitLimitOrderCustomPercentage",
          statusCode: error.response?.status?.toString(),
        },
      });
    } else {
      Sentry.captureException(error, {
        tags: {
          function: "alpacaSubmitLimitOrderCustomPercentage",
        },
      });
    }
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
  buyAlert,
  buySideOrder = true,
  capitalPercentageToDeploy = ALPACA_CAPITAL_TO_DEPLOY_EQUITY_PERCENTAGE,
  accountName = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
  orderType = OrderTypeSchema.Enum.market,
  timeInForce = TimeInForceSchema.Enum.day,
  submitTakeProfitOrder = true,
  takeProfitPercentage = new Decimal(1.05),
}: AlpacaSubmitMarketOrderCustomPercentageParams): Promise<void> => {
  const credentials = getAlpacaCredentials(accountName);

  console.log("Alpaca Order Begin - alpacaSubmitMarketOrderCustomPercentage");
  logTimezonesOfCurrentTime();

  const accountInfo = await getAlpacaAccountBalance(accountName);
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
  const fractionable = await getAlpacaIsAssetFractionable(
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
    const latestQuote: AlpacaLatestQuote =
      await getAlpacaGetLatestQuoteForAsset(alpacaSymbol, accountName);
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
      getAlpacaGetLatestQuoteForAsset(alpacaSymbol, accountName),
    ]);
    console.log(`Market ${orderSide} order submitted: \n`, orderResponse);

    if (submitTakeProfitOrder) {
      // TODO: Could send to a queue with delay of 10 seconds instead
      await wait(10000);
      const currentPosition = await getAlpacaPositionForAsset(
        alpacaSymbol,
        accountName,
      );

      if (!currentPosition?.openPositionFound || !currentPosition?.qty) {
        const errorMessage =
          "Error - No open position found to create take profit order";
        console.log(errorMessage);
        Sentry.captureMessage(errorMessage);
        throw new Error(errorMessage);
      }

      const principalPrice: Decimal = new Decimal(
        buyAlert
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
          alpacaCronJobScheduleTakeProfitOrderForFractionableAsset(),
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
    if (isAxiosError(error)) {
      Sentry.captureException(error, {
        extra: {
          errorMessage: error.message,
          responseData: error.response?.data,
          responseStatus: error.response?.status,
          responseHeaders: error.response?.headers,
          requestData: error.config?.data,
          requestMethod: error.config?.method,
          requestURL: error.config?.url,
          requestHeaders: error.config?.headers,
        },
        tags: {
          function: "alpacaCloseAllHoldingsOfAsset",
          statusCode: error.response?.status?.toString(),
        },
      });
    } else {
      Sentry.captureException(error, {
        tags: {
          function: "alpacaCloseAllHoldingsOfAsset",
        },
      });
    }
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
) => {
  try {
    const credentials = getAlpacaCredentials(accountName);
    const alpaca: Alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

    await alpaca.closePosition(symbol);
    console.log(
      "alpacaCloseAllHoldingsOfAsset - Successfully closed all holdings of",
      symbol,
    );
  } catch (error) {
    if (isAxiosError(error)) {
      Sentry.captureException(error, {
        extra: {
          errorMessage: error.message,
          responseData: error.response?.data,
          responseStatus: error.response?.status,
          responseHeaders: error.response?.headers,
          requestData: error.config?.data,
          requestMethod: error.config?.method,
          requestURL: error.config?.url,
          requestHeaders: error.config?.headers,
        },
        tags: {
          function: "alpacaCloseAllHoldingsOfAsset",
          statusCode: error.response?.status?.toString(),
        },
      });
    } else {
      Sentry.captureException(error, {
        tags: {
          function: "alpacaCloseAllHoldingsOfAsset",
        },
      });
    }
    console.error(
      "alpacaCloseAllHoldingsOfAsset - Error, failed to close all holdings of asset:",
      error,
    );
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
) => {
  try {
    const credentials = getAlpacaCredentials(accountName);
    const alpaca: Alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

    await alpaca.cancelAllOrders();
    console.log(
      "alpacaCancelAllOpenOrders - Successfully cancelled all open orders",
    );
  } catch (error) {
    if (isAxiosError(error)) {
      Sentry.captureException(error, {
        extra: {
          errorMessage: error.message,
          responseData: error.response?.data,
          responseStatus: error.response?.status,
          responseHeaders: error.response?.headers,
          requestData: error.config?.data,
          requestMethod: error.config?.method,
          requestURL: error.config?.url,
          requestHeaders: error.config?.headers,
        },
        tags: {
          function: "alpacaCancelAllOpenOrders",
          statusCode: error.response?.status?.toString(),
        },
      });
    } else {
      Sentry.captureException(error, {
        tags: {
          function: "alpacaCancelAllOpenOrders",
        },
      });
    }
    console.error(
      "alpacaCancelAllOpenOrders - Error, failed to cancel all open orders:",
      error,
    );
    throw error;
  }
};

/**
 * Submits a take profit order for the first fractionable asset found.
 *
 * @returns The take profit order.
 */
export const alpacaSubmitTakeProfitOrderForFractionableAssets = async () => {
  console.log(
    "alpacaSubmitTakeProfitOrderForFractionableAssets - Submitting take profit order",
  );

  try {
    const order = await getFirstFractionableTakeProfitOrder();

    if (!order) {
      console.log(
        "alpacaSubmitTakeProfitOrderForFractionableAssets - No fractionable take profit orders found",
      );
      return;
    }

    const currentPosition = await getAlpacaPositionForAsset(
      order.symbol,
      ALPACA_LIVE_TRADING_ACCOUNT_NAME,
    );

    if (!currentPosition?.openPositionFound || !currentPosition?.qty) {
      await deleteAllFractionableTakeProfitOrders();

      console.log(
        "alpacaSubmitTakeProfitOrderForFractionableAssets - No open position found to create take profit order",
      );
      return;
    }

    const credentials = getAlpacaCredentials(ALPACA_LIVE_TRADING_ACCOUNT_NAME);
    const alpaca: Alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

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

    await alpaca.createOrder(takeProfitOrderRequest);
    console.log(
      `alpacaSubmitTakeProfitOrderForFractionableAssets - Take Profit Limit ${order.side} order submitted successfully`,
    );
  } catch (error) {
    if (isAxiosError(error)) {
      Sentry.captureException(error, {
        extra: {
          errorMessage: error.message,
          responseData: error.response?.data,
          responseStatus: error.response?.status,
          responseHeaders: error.response?.headers,
          requestData: error.config?.data,
          requestMethod: error.config?.method,
          requestURL: error.config?.url,
          requestHeaders: error.config?.headers,
        },
        tags: {
          function: "alpacaSubmitTakeProfitOrderForFractionableAssets",
          statusCode: error.response?.status?.toString(),
        },
      });
    } else {
      Sentry.captureException(error, {
        tags: {
          function: "alpacaSubmitTakeProfitOrderForFractionableAssets",
        },
      });
    }
    console.error(
      "alpacaSubmitTakeProfitOrderForFractionableAssets - Error, failed to submit fractionable take profit order:",
      error,
    );
    throw error;
  }
};

/**
 * Reverses any false signals for a given symbol by checking the latest flip alert and quote price.
 *
 * @param tradingViewSymbol - The stock or crypto ticker symbol.
 * @param buyAlert - If alert is a buy or a sell alert (intended to flip long to short or vice versa). This should be set to the original alert, eg. if alert was to go long this should be set to true.
 */
export const alpacaSubmitReverseTradeOnFalseSignal = async ({
  tradingViewSymbol,
  buyAlert,
  accountName = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
}: AlpacaReverseTradeOnFalseSignalParams) => {
  try {
    const [latestFlipAlert, getQuote] = await Promise.all([
      getLatestFlipAlertForSymbol(tradingViewSymbol),
      getAlpacaGetLatestQuoteForAsset(tradingViewSymbol),
    ]);

    const lastTradePrice = new Decimal(latestFlipAlert.price);
    const quotePrice = getQuote.askPrice.gt(0)
      ? getQuote.askPrice
      : getQuote.bidPrice;

    console.log(
      `alpacaSubmitReverseTradeOnFalseSignal - ${tradingViewSymbol}, buy alert: ${buyAlert}, last trade price: ${lastTradePrice.toString()}, quote price: ${quotePrice.toString()}`,
    );

    const shouldReverseTrade = buyAlert
      ? lastTradePrice.greaterThan(quotePrice)
      : lastTradePrice.lessThan(quotePrice);

    if (!shouldReverseTrade) {
      console.log(
        "alpacaSubmitReverseTradeOnFalseSignal - No trades initiated, handling graceful exit",
      );
      return;
    }

    console.log(
      "alpacaSubmitReverseTradeOnFalseSignal - Reverse trade initiated",
    );

    const alpacaSymbol: string | undefined = buyAlert
      ? ALPACA_TRADINGVIEW_SYMBOLS[tradingViewSymbol]
      : ALPACA_TRADINGVIEW_INVERSE_PAIRS[tradingViewSymbol];

    if (!alpacaSymbol) {
      throw new Error(
        `alpacaReverseTradeOnFalseSignal - Invalid symbol: ${tradingViewSymbol}`,
      );
    }

    const [openPositionOfInverseTrade, marketOpen] = await Promise.all([
      getAlpacaPositionForAsset(alpacaSymbol),
      getIsMarketOpen(),
      alpacaCancelAllOpenOrders(),
    ]);

    if (marketOpen) {
      await alpacaCloseAllHoldingsOfAsset(alpacaSymbol, accountName);
    } else if (
      openPositionOfInverseTrade?.openPositionFound &&
      openPositionOfInverseTrade?.qty
    ) {
      const assetBalance: Decimal = openPositionOfInverseTrade.qty;
      await alpacaSubmitLimitOrderCustomQuantity({
        alpacaSymbol: alpacaSymbol,
        quantity: assetBalance,
        buyAlert,
        buySideOrder: false,
        setSlippagePercentage: new Decimal("0.01"),
        submitTakeProfitOrder: false,
        accountName,
        orderType: OrderTypeSchema.Enum.limit,
        timeInForce: TimeInForceSchema.Enum.day,
      });
    } else {
      console.log(
        "alpacaSubmitReverseTradeOnFalseSignal - No open position found to reverse trade",
      );
      return;
    }

    console.log(
      `alpacaSubmitReverseTradeOnFalseSignal - Successful for: ${tradingViewSymbol}`,
    );
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        errorDetails: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        tradingViewSymbol,
        buyAlert,
      },
      tags: {
        function: "alpacaSubmitReverseTradeOnFalseSignal",
      },
    });
    console.error(
      "alpacaSubmitReverseTradeOnFalseSignal - Error, failed to execute reverse trade",
      error,
    );
    throw error;
  }
};
