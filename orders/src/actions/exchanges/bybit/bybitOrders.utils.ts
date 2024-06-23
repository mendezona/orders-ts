import * as Sentry from "@sentry/nextjs";
import { RestClientV5, type SpotInstrumentInfoV5 } from "bybit-api";
import Decimal from "decimal.js";
import {
  getBaseAndQuoteAssets,
  removeHyphensFromPairSymbol,
} from "../exchanges.utils";
import { BYBIT_LIVE_TRADING_ACCOUNT_NAME } from "./bybit.constants";
import {
  BybitProductCategory,
  type BybitAccountCredentials,
  type BybitSubmitMarketOrderCustomAmountParams,
  type BybitSubmitMarketOrderCustomPercentageParams,
} from "./bybit.types";
import {
  bybitGetCoinBalance,
  bybitGetCredentials,
} from "./bybitAcccount.utils";
import { bybitGetSymbolIncrements } from "./bybitOrders.helpers";

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
