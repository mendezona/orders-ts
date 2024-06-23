import * as Sentry from "@sentry/nextjs";
import { RestClientV5, type SpotInstrumentInfoV5 } from "bybit-api";
import Decimal from "decimal.js";
import { saveBuyTradeToDatabaseFlipTradeAlertTable } from "~/server/queries";
import { type SaveBuyTradeToDatabaseFlipTradeAlertTableProps } from "~/server/queries.types";
import {
  EXCHANGES,
  EXCHANGE_CAPITAL_GAINS_TAX_RATE,
} from "../exchanges.contants";
import {
  getBaseAndQuoteAssets,
  removeHyphensFromPairSymbol,
} from "../exchanges.utils";
import {
  BYBIT_LIVE_TRADING_ACCOUNT_NAME,
  BYBIT_PREFERRED_STABLECOIN,
  BYBIT_TAX_PAIR,
  tradingviewBybitInverseSymbols,
  tradingviewBybitSymbols,
} from "./bybit.constants";
import {
  BybitProductCategory,
  type BybitAccountCredentials,
  type BybitSubmitMarketOrderCustomAmountParams,
  type BybitSubmitMarketOrderCustomPercentageParams,
  type BybitSubmitPairTradeOrderParams,
} from "./bybit.types";
import {
  bybitGetCoinBalance,
  bybitGetCredentials,
} from "./bybitAcccount.utils";
import { bybitSchedulePriceCheckAtNextIntervalCronJob } from "./bybitCronJobs";
import { bybitGetMostRecentInverseFillToStablecoin } from "./bybitOrderHistory.utils";
import {
  bybitCalculateProfitLoss,
  bybitGetSymbolIncrements,
} from "./bybitOrders.helpers";

/**
 * Submits a pair trade order, intended to flip from long to short position or vice versa.
 *
 * @param tradingViewSymbol - The ticker symbol of the asset to trade.
 * @param tradingViewPrice - The price of the asset to trade.
 * @param capitalPercentageToDeploy - The percentage of equity to deploy.
 * @param buyAlert - If alert is a buy or a sell alert (intended to flip long to short or vice versa).
 * @param calculateTax - Calculate and save taxable amount.
 * @param accountName - The Alpaca account to use for the operation. Defaults to live trading account.
 * @param scheduleCronJob - Whether to schedule a cron job to check the price at the next defined interval.
 */
export const bybitSubmitPairTradeOrder = async ({
  tradingViewSymbol,
  tradingViewPrice,
  tradingViewInterval,
  capitalPercentageToDeploy = new Decimal(1),
  buyAlert = true,
  calculateTax = true,
  accountName = BYBIT_LIVE_TRADING_ACCOUNT_NAME,
  scheduleCronJob = true,
}: BybitSubmitPairTradeOrderParams): Promise<void> => {
  console.log("bybitSubmitPairTradeOrder - order beginning to execute");
  const credentials: BybitAccountCredentials = bybitGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Bybit account credentials not found");
  }

  const pairSymbol = buyAlert
    ? tradingviewBybitSymbols[tradingViewSymbol]
    : tradingviewBybitInverseSymbols[tradingViewSymbol];

  const pairInverseSymbol = buyAlert
    ? tradingviewBybitInverseSymbols[tradingViewSymbol]
    : tradingviewBybitSymbols[tradingViewSymbol];

  const inverseFillToStablecoin =
    await bybitGetMostRecentInverseFillToStablecoin({
      bybitPairSymbol: pairInverseSymbol ?? "",
      accountName,
    });
  if (!inverseFillToStablecoin) {
    const { baseAsset, quoteAsset } = getBaseAndQuoteAssets(
      pairInverseSymbol ?? "",
    );
    if (
      baseAsset !== BYBIT_PREFERRED_STABLECOIN &&
      quoteAsset !== BYBIT_PREFERRED_STABLECOIN
    ) {
      throw new Error(
        "Error - Base stablecoin currency for calculating profit/loss not found",
      );
    }
    if (baseAsset === BYBIT_PREFERRED_STABLECOIN) {
      console.log("No stablecoin conversion found - submit buy order");
      await bybitSubmitMarketOrderCustomPercentage({
        bybitPairSymbol: pairInverseSymbol ?? "",
        accountName,
      });
    } else if (quoteAsset === BYBIT_PREFERRED_STABLECOIN) {
      console.log("No stablecoin conversion found - submit sell order");
      await bybitSubmitMarketOrderCustomPercentage({
        bybitPairSymbol: pairInverseSymbol ?? "",
        buySideOrder: false,
        accountName,
      });
    }

    if (calculateTax) {
      const profitLossAmount = await bybitCalculateProfitLoss({
        bybitPairSymbol: pairInverseSymbol ?? "",
        accountName,
      });
      const taxAmount = new Decimal(profitLossAmount).times(
        new Decimal(EXCHANGE_CAPITAL_GAINS_TAX_RATE),
      );
      console.log("Tax amount:", taxAmount.toString());

      if (taxAmount.greaterThan(0)) {
        await bybitSubmitMarketOrderCustomAmount({
          bybitPairSymbol: BYBIT_TAX_PAIR,
          dollarAmount: taxAmount,
          buySideOrder: true,
          accountName,
        });
      }
    }
  }

  await bybitSubmitMarketOrderCustomPercentage({
    bybitPairSymbol: pairSymbol ?? "",
    assetPercentageToDeploy: capitalPercentageToDeploy,
    buySideOrder: buyAlert,
    accountName,
  });

  await saveBuyTradeToDatabaseFlipTradeAlertTable({
    exchange: EXCHANGES.BYBIT,
    symbol: tradingViewSymbol,
    price: tradingViewPrice,
  } as SaveBuyTradeToDatabaseFlipTradeAlertTableProps);

  if (scheduleCronJob) {
    if (!tradingViewInterval) {
      throw new Error("Error - Interval required to set cron job");
    }
    await bybitSchedulePriceCheckAtNextIntervalCronJob({
      tradingViewSymbol,
      tradingViewPrice,
      tradingViewInterval,
      buyAlert,
    });
  }
};

/**
 * Submit a market order for a custom dollarised amount.
 *
 * @param bybitPairSymbol - Pair symbol to search for information with hyphens (e.g., "BTC-USDT").
 * @param dollarAmount - The dollarised amount to deploy.
 * @param buySideOrder - Whether to buy or sell the order.
 * @param accountName - The name of the account to use.
 * @param productCategory - The category of the instrument to search for (e.g., spot, linear inverse, or option).
 */
export const bybitSubmitMarketOrderCustomPercentage = async ({
  bybitPairSymbol,
  assetPercentageToDeploy = new Decimal(1),
  buySideOrder = true,
  accountName = BYBIT_LIVE_TRADING_ACCOUNT_NAME,
  productCategory = BybitProductCategory.SPOT,
}: BybitSubmitMarketOrderCustomPercentageParams): Promise<void> => {
  console.log(
    "bybitSubmitMarketOrderCustomPercentage - order beginning to execute",
  );
  const credentials: BybitAccountCredentials = bybitGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Bybit account credentials not found");
  }

  try {
    const { baseAsset, quoteAsset } = getBaseAndQuoteAssets(bybitPairSymbol);
    const balance = buySideOrder
      ? await bybitGetCoinBalance(quoteAsset, accountName)
      : await bybitGetCoinBalance(baseAsset, accountName);
    const parsedBalance = new Decimal(balance);

    if (parsedBalance.lessThanOrEqualTo(assetPercentageToDeploy)) {
      console.log(
        "bybitSubmitMarketOrderCustomPercentage - Error, insufficient funds to execute order",
      );
      throw new Error(
        "bybitSubmitMarketOrderCustomPercentage - Error, insufficient funds to execute order",
      );
    }

    const incrementsObject = (await bybitGetSymbolIncrements({
      bybitPairSymbol: removeHyphensFromPairSymbol(bybitPairSymbol),
      accountName,
    })) as SpotInstrumentInfoV5;
    const basePrecision = new Decimal(
      incrementsObject.lotSizeFilter.basePrecision || "1",
    );
    const quotePrecision = new Decimal(
      incrementsObject.lotSizeFilter.quotePrecision || "1",
    );
    const symbolMinimumIncrement = buySideOrder
      ? quotePrecision
      : basePrecision;

    const fundsToDeploy = parsedBalance.times(assetPercentageToDeploy);
    const quantityToDeploy = fundsToDeploy
      .div(symbolMinimumIncrement)
      .floor()
      .times(symbolMinimumIncrement);
    const orderType = buySideOrder ? "Buy" : "Sell";

    console.log("Order side: ", orderType);
    console.log("Capital to deploy (%): ", assetPercentageToDeploy.toString());
    console.log("Funds to deploy", fundsToDeploy.toString(), "\n");

    if (fundsToDeploy.greaterThan(0)) {
      const client = new RestClientV5({
        key: credentials.key,
        secret: credentials.secret,
        testnet: credentials.testnet,
      });

      const symbol = removeHyphensFromPairSymbol(bybitPairSymbol);
      const orderResponse = await client.submitOrder({
        category: productCategory,
        symbol: symbol,
        side: orderType,
        orderType: "Market",
        qty: quantityToDeploy.toString(),
      });

      console.log(
        "bybitSubmitMarketOrderCustomPercentage - Bybit market order submitted: \n",
        orderResponse,
        "\n",
      );
    } else {
      throw new Error(
        "bybitSubmitMarketOrderCustomPercentage - Error, no funds to deploy",
      );
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error(
      `bybitSubmitMarketOrderCustomPercentage - Error placing order for ${bybitPairSymbol}`,
    );
    throw error;
  }
};

/**
 * Submit a market order for a custom dollarised amount.
 *
 * @param bybitPairSymbol - Pair symbol to search for information with hyphens (e.g., "BTC-USDT").
 * @param dollarAmount - The dollarised amount to deploy.
 * @param buySideOrder - Whether to buy or sell the order.
 * @param accountName - The name of the account to use.
 * @param productCategory - The category of the instrument to search for (e.g., spot, linear inverse, or option).
 */
export const bybitSubmitMarketOrderCustomAmount = async ({
  bybitPairSymbol,
  dollarAmount,
  buySideOrder = true,
  accountName = BYBIT_LIVE_TRADING_ACCOUNT_NAME,
  productCategory = BybitProductCategory.SPOT,
}: BybitSubmitMarketOrderCustomAmountParams): Promise<void> => {
  console.log(
    "bybitSubmitMarketOrderCustomAmount - order beginning to execute",
  );
  const credentials: BybitAccountCredentials = bybitGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Bybit account credentials not found");
  }

  try {
    const { baseAsset, quoteAsset } = getBaseAndQuoteAssets(bybitPairSymbol);
    const balance = buySideOrder
      ? await bybitGetCoinBalance(quoteAsset, accountName)
      : await bybitGetCoinBalance(baseAsset, accountName);
    const parsedBalance = new Decimal(balance);

    if (parsedBalance.lessThanOrEqualTo(dollarAmount)) {
      console.log(
        "bybitSubmitMarketOrderCustomAmount - Error, insufficient funds to execute order",
      );
      throw new Error(
        "bybitSubmitMarketOrderCustomAmount - Error, insufficient funds to execute order",
      );
    }

    const incrementsObject = (await bybitGetSymbolIncrements({
      bybitPairSymbol,
      accountName,
    })) as SpotInstrumentInfoV5;
    const basePrecision = new Decimal(
      incrementsObject.lotSizeFilter.basePrecision || "1",
    );
    const quotePrecision = new Decimal(
      incrementsObject.lotSizeFilter.quotePrecision || "1",
    );
    const symbolMinimumIncrement = buySideOrder
      ? basePrecision
      : quotePrecision;

    const fundsToDeploy = new Decimal(dollarAmount);
    const quantityToDeploy = fundsToDeploy
      .div(symbolMinimumIncrement)
      .floor()
      .mul(symbolMinimumIncrement);
    const orderType = buySideOrder ? "Buy" : "Sell";

    console.log("Order side: ", orderType);
    console.log("Capital to deploy ($): ", dollarAmount.toString());
    console.log("Funds to deploy", fundsToDeploy.toString(), "\n");

    if (fundsToDeploy.greaterThan(0)) {
      const client = new RestClientV5({
        key: credentials.key,
        secret: credentials.secret,
        testnet: credentials.testnet,
      });

      const symbol = removeHyphensFromPairSymbol(bybitPairSymbol);
      const orderResponse = await client.submitOrder({
        category: productCategory,
        symbol,
        side: orderType,
        orderType: "Market",
        qty: quantityToDeploy.toString(),
      });

      console.log(
        "bybitSubmitMarketOrderCustomAmount - Bybit market order submitted successfully: \n",
        orderResponse,
        "\n",
      );
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error(
      `bybitSubmitMarketOrderCustomAmount - Error placing order for ${bybitPairSymbol}`,
    );
    throw error;
  }
};
