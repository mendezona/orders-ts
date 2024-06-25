import * as Sentry from "@sentry/nextjs";
import {
  RestClientV5,
  type LinearInverseInstrumentInfoV5,
  type OptionInstrumentInfoV5,
  type SpotInstrumentInfoV5,
} from "bybit-api";
import Decimal from "decimal.js";
import { removeHyphensFromPairSymbol } from "../exchanges.utils";
import { BYBIT_LIVE_TRADING_ACCOUNT_NAME } from "./bybit.constants";
import {
  BybitProductCategory,
  type BybitAccountCredentials,
  type BybitCalculateProfitLossParams,
  type BybitGetSymbolIncrementsParams,
} from "./bybit.types";
import { bybitGetCredentials } from "./bybitAcccount.utils";

/**
 * Retrieves information about required increments for an order.
 *
 * @param bybitPairSymbol - Pair symbol to search for information with hyphens (e.g., "BTC-USDT").
 * @param accountName - The name of the account to use.
 * @param productCategory - The category of the instrument to search for (e.g., spot, linear inverse, or option).
 *
 * @returns The instrument information for the specified pair symbol.
 */
export const bybitGetSymbolIncrements = async ({
  bybitPairSymbol,
  accountName = BYBIT_LIVE_TRADING_ACCOUNT_NAME,
  productCategory = BybitProductCategory.SPOT,
}: BybitGetSymbolIncrementsParams): Promise<
  SpotInstrumentInfoV5 | LinearInverseInstrumentInfoV5 | OptionInstrumentInfoV5
> => {
  console.error(
    `bybitGetSymbolIncrements - Getting symbol increments for ${bybitPairSymbol}`,
  );
  const credentials: BybitAccountCredentials = bybitGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Bybit account credentials not found");
  }

  const parsedBybitPairSymbol = removeHyphensFromPairSymbol(bybitPairSymbol);
  try {
    const client = new RestClientV5({
      key: credentials.key,
      secret: credentials.secret,
      testnet: credentials.testnet,
    });

    const assetInfo = await client.getInstrumentsInfo({
      symbol: parsedBybitPairSymbol,
      category: productCategory,
    });

    if (assetInfo.retCode === 0) {
      for (const tradingPairAssetInfo of assetInfo.result.list) {
        if (tradingPairAssetInfo.symbol === parsedBybitPairSymbol) {
          console.log("Trading pair asset info found:", tradingPairAssetInfo);
          return tradingPairAssetInfo;
        }
      }
    }

    throw new Error(
      `bybitGetSymbolIncrements - Error getting symbol increments for ${parsedBybitPairSymbol}`,
    );
  } catch (error) {
    Sentry.captureException(error);
    console.error(
      `bybitGetSymbolIncrements - Error getting symbol increments for ${parsedBybitPairSymbol}`,
    );
    throw error;
  }
};

/**
 * Retrieves information about required increments for an order.
 *
 * @param bybitPairSymbol - Pair symbol to search for information with hyphens (e.g., "BTC-USDT").
 * @param accountName - The name of the account to use.
 * @param productCategory - The category of the instrument to search for (e.g., spot, linear inverse, or option).
 *
 * @returns A Decimal object representing the profit/loss for the specified order.
 */
export const bybitCalculateProfitLoss = async ({
  bybitPairSymbol,
  accountName = BYBIT_LIVE_TRADING_ACCOUNT_NAME,
  productCategory = BybitProductCategory.SPOT,
}: BybitCalculateProfitLossParams): Promise<Decimal> => {
  console.error(
    `bybitCalculateProfitLoss - Calculating profit/loss for ${bybitPairSymbol}`,
  );
  const credentials: BybitAccountCredentials = bybitGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Bybit account credentials not found");
  }

  const parsedBybitPairSymbol = removeHyphensFromPairSymbol(bybitPairSymbol);
  try {
    const client = new RestClientV5({
      key: credentials.key,
      secret: credentials.secret,
      testnet: credentials.testnet,
    });

    const response = await client.getExecutionList({
      symbol: parsedBybitPairSymbol,
      category: productCategory,
      limit: 10,
    });

    if (response.retCode === 0) {
      const executedOrders = response.result;

      if (!executedOrders?.list || executedOrders.list.length === 0) {
        console.log(
          "bybitCalculateProfitLoss - Error, no executed order data found for",
          parsedBybitPairSymbol,
        );
        return new Decimal(0);
      }

      const orders = executedOrders.list.filter(
        (order) => order.symbol === parsedBybitPairSymbol,
      );
      orders.reverse();

      const lastOrder = orders[0];
      const lastOrderSide = lastOrder?.side;
      const oppositeSide = lastOrderSide === "Buy" ? "Sell" : "Buy";

      const lastOrderQty = new Decimal(lastOrder?.execQty ?? 0);
      const lastOrderExecValue = new Decimal(lastOrder?.execValue ?? 0);

      let totalOppositeQty = new Decimal(0);
      let totalOppositeExecValue = new Decimal(0);

      for (const order of orders.slice(1)) {
        if (order.side === oppositeSide) {
          const oppositeQty = new Decimal(order.execQty);
          if (
            totalOppositeQty.plus(oppositeQty).lessThanOrEqualTo(lastOrderQty)
          ) {
            totalOppositeQty = totalOppositeQty.plus(oppositeQty);
            totalOppositeExecValue = totalOppositeExecValue.plus(
              new Decimal(order.execValue),
            );
          } else {
            const portionNeeded = lastOrderQty.minus(totalOppositeQty);
            totalOppositeQty = totalOppositeQty.plus(portionNeeded);
            const valuePortion = portionNeeded
              .dividedBy(oppositeQty)
              .times(new Decimal(order.execValue));
            totalOppositeExecValue = totalOppositeExecValue.plus(valuePortion);
          }

          if (totalOppositeQty.greaterThanOrEqualTo(lastOrderQty)) {
            break;
          }
        }
      }

      if (!totalOppositeQty.equals(lastOrderQty)) {
        console.log(
          "bybitCalculateProfitLoss - Error, could not match the last order quantity with opposite side orders for",
          parsedBybitPairSymbol,
        );
        return new Decimal(0);
      }

      const profitOrLoss =
        lastOrderSide === "Sell"
          ? lastOrderExecValue.minus(totalOppositeExecValue)
          : totalOppositeExecValue.minus(lastOrderExecValue);

      console.log(
        `bybitCalculateProfitLoss - Profit/loss for ${parsedBybitPairSymbol}:`,
        profitOrLoss,
      );
      return profitOrLoss;
    }
    return new Decimal(0);
  } catch (error) {
    Sentry.captureException(error);
    console.error(
      `bybitCalculateProfitLoss - Error occured while calculating profit/loss for ${parsedBybitPairSymbol}`,
    );
    throw error;
  }
};

/**
 * Retrieves information about required increments for an order.
 *
 * @param bybitPairSymbol - Pair symbol to search for information with hyphens (e.g., "BTC-USDT").
 * @param accountName - The name of the account to use.
 *
 * @returns A Decimal object for the last traded price for the specified pair symbol.
 */
export const bybitGetLatestTradedPrice = async (
  bybitPairSymbol: string,
  accountName: string = BYBIT_LIVE_TRADING_ACCOUNT_NAME,
): Promise<Decimal> => {
  console.error(
    `bybitGetLatestTradedPrice - Getting latest traded price for ${bybitPairSymbol}`,
  );
  const credentials: BybitAccountCredentials = bybitGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Bybit account credentials not found");
  }

  const parsedBybitPairSymbol = removeHyphensFromPairSymbol(bybitPairSymbol);
  try {
    const client = new RestClientV5({
      key: credentials.key,
      secret: credentials.secret,
      testnet: credentials.testnet,
    });

    // TODO: Check that this is a reliable endpoint from Bybit
    console.log("parsedBybitPairSymbol", parsedBybitPairSymbol);
    const lastTradedPrice = await client.getTickers({
      category: "spot",
      symbol: "BTCUSDT",
    });
    if (lastTradedPrice.result.list[0]?.lastPrice) {
      return new Decimal(lastTradedPrice.result.list[0]?.lastPrice);
    }

    throw new Error(
      `bybitGetLatestTradedPrice - Error getting latest traded price for ${parsedBybitPairSymbol}`,
    );
  } catch (error) {
    Sentry.captureException(error);
    console.error(
      `bybitCalculateProfitLoss - Error occured while calculating profit/loss for ${parsedBybitPairSymbol}`,
    );
    throw error;
  }
};
