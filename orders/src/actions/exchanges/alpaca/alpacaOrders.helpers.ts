import Alpaca from "@alpacahq/alpaca-trade-api";
import {
  type AlpacaBar,
  type AlpacaQuote,
} from "@alpacahq/alpaca-trade-api/dist/resources/datav2/entityv2";
import * as Sentry from "@sentry/nextjs";
import Decimal from "decimal.js";
import { ZodError } from "zod";
import { ALPACA_LIVE_TRADING_ACCOUNT_NAME } from "./alpaca.constants";
import { type AlpacaLatestQuote } from "./alpaca.types";
import { getAlpacaCredentials } from "./alpacaAccount.utils";
import {
  AlpacaApiPositionsSchema,
  AssetSchema,
  OrderSideSchema,
  OrdersSchema,
  QueryOrderStatusSchema,
} from "./alpacaApi.types";

/**
 * Checks if asset is fractionable, or if only whole orders can be submitted
 *
 * @param symbol - Symbol to check if asset is fractionable
 * @param account - Account to use to check if asset is fractionable
 *
 * @returns - A Boolean, true if the asset is fractionable (e.g., 0.10 quantity is accepted)
 */
export const getAlpacaIsAssetFractionable = async (
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

    const alpacaAsset: unknown = await alpaca.getAsset(symbol);
    const asset = AssetSchema.parse(alpacaAsset);

    if (asset.fractionable) {
      console.log(`${symbol} is fractionable`);
    } else {
      console.log(`${symbol} is not fractionable`);
    }

    return asset.fractionable;
  } catch (error) {
    Sentry.captureException(error);
    if (error instanceof ZodError) {
      console.error(
        "getAlpacaIsAssetFractionable - Error, validation failed with ZodError:",
        error.errors,
      );
    } else {
      console.error(
        `getAlpacaIsAssetFractionable - Error, unable to determine if ${symbol} is fractionable:`,
        error,
      );
    }
    throw new Error(`Error - Unable to determine if ${symbol} is fractionable`);
  }
};

/**
 * Calculate the profit/loss amount on an asset's last trade. Looks at last open and close of an asset
 *
 * @param symbol - Symbol to check if asset is fractionable
 * @param accountName - Account to use to check if asset is fractionable
 *
 * @returns - A Decimal, a negative or positive number based on profit or loss calculation
 */
export const getAlpacaCalculateProfitOrLoss = async (
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

    const alpacaRecentOrders: unknown = await alpaca.getOrders({
      symbols: symbol,
      status: QueryOrderStatusSchema.Enum.closed,
      limit: 20,
      until: null,
      after: null,
      direction: null,
      nested: null,
    });
    const orders = OrdersSchema.parse(alpacaRecentOrders);

    // Find accumulated sale amount (could be split in multiple orders)
    let accumulatedSellQuantity = new Decimal(0);
    let totalSellValue = new Decimal(0);
    let firstBuyOrderFound = false;

    for (const order of [...orders]) {
      if (order.side === OrderSideSchema.Enum.buy) {
        firstBuyOrderFound = true;
        break;
      }

      if (!firstBuyOrderFound && order.side === OrderSideSchema.Enum.sell) {
        const filledQty = new Decimal(order.filled_qty ?? 0);
        const filledAvgPrice = new Decimal(order.filled_avg_price ?? 0);
        const sellValue = !!order.notional
          ? new Decimal(order.notional)
          : filledQty.times(filledAvgPrice);
        totalSellValue = totalSellValue.plus(sellValue);
        accumulatedSellQuantity = accumulatedSellQuantity.plus(filledQty);
      }
    }

    console.log(
      `getAlpacaCalculateProfitOrLoss - Sell price: ${totalSellValue.toString()}, and sell quantity: ${accumulatedSellQuantity.toString()}`,
    );

    const sellQuantityNeeded = accumulatedSellQuantity;
    let accumulatedBuyQuantity = new Decimal(0);
    let totalBuyCost = new Decimal(0);

    for (const order of [...orders]) {
      if (order.side === OrderSideSchema.enum.buy) {
        if (!!order.filled_qty && !!order.filled_avg_price) {
          const buyQuantity = new Decimal(order.filled_qty);
          const buyPrice = new Decimal(order.filled_avg_price);

          // Determine how much of this order to use
          const quantityToUse = Decimal.min(
            buyQuantity,
            sellQuantityNeeded.minus(accumulatedBuyQuantity),
          );
          totalBuyCost = !!order.notional
            ? new Decimal(order.notional)
            : totalBuyCost.plus(quantityToUse.times(buyPrice));
          accumulatedBuyQuantity = accumulatedBuyQuantity.plus(quantityToUse);

          if (accumulatedBuyQuantity.greaterThanOrEqualTo(sellQuantityNeeded)) {
            break;
          }
        }
      }
    }

    if (accumulatedBuyQuantity.lessThan(sellQuantityNeeded)) {
      const errorMessage =
        "getAlpacaCalculateProfitOrLoss - Not enough buy orders to match the sell quantity.";
      console.log(errorMessage);
      throw new Error(errorMessage);
    }

    console.log(
      "getAlpacaCalculateProfitOrLoss - Buy price:",
      totalBuyCost.toString(),
    );
    console.log(
      "getAlpacaCalculateProfitOrLoss - Sell price:",
      totalSellValue.toString(),
    );

    // Calculate profit or loss
    const profitLoss = totalSellValue.minus(totalBuyCost);
    console.log(
      "getAlpacaCalculateProfitOrLoss - Total Profit Loss:",
      profitLoss.toString(),
    );
    return profitLoss;
  } catch (error) {
    Sentry.captureException(error);
    if (error instanceof ZodError) {
      console.error(
        "getAlpacaCalculateProfitOrLoss - Error, validation failed with ZodError:",
        error.errors,
      );
    } else {
      console.error(
        `getAlpacaCalculateProfitOrLoss - Error, unable to determine profit or loss:`,
        error,
      );
    }
    throw new Error(
      `getAlpacaCalculateProfitOrLoss - Error, unable to determine profit or loss`,
    );
  }
};

/**
 * Get the latest quote data for an asset, with two additional backup methods
 *
 * @param symbol - Symbol to check if asset is fractionable
 * @param accountName - Account to use to check if asset is fractionable
 *
 * @returns - A AlpacaLatestQuote object or an error object
 */
export const getAlpacaGetLatestQuoteForAsset = async (
  symbol: string,
  accountName: string = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
) => {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    const credentials = getAlpacaCredentials(accountName);
    const alpaca: Alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

    try {
      // Primary method: getLatestQuote
      const getLatestQuoteData: AlpacaQuote =
        await alpaca.getLatestQuote(symbol);
      if (!!getLatestQuoteData.BidPrice || !!getLatestQuoteData.AskPrice) {
        const convertedQuoteData: AlpacaLatestQuote = {
          askPrice: new Decimal(getLatestQuoteData.AskPrice),
          bidPrice: new Decimal(getLatestQuoteData.BidPrice),
          askSize: new Decimal(getLatestQuoteData.AskSize),
          bidSize: new Decimal(getLatestQuoteData.BidSize),
        };

        console.log(
          "Quote Method 1 - Latest quote data found:",
          getLatestQuoteData,
        );
        return convertedQuoteData;
      }

      // Backup method: getLatestBar
      const latestBar: AlpacaBar = await alpaca.getLatestBar(symbol);
      if (!!latestBar.HighPrice || !!latestBar.LowPrice) {
        const convertedBarData: AlpacaLatestQuote = {
          askPrice: new Decimal(latestBar.HighPrice),
          bidPrice: new Decimal(latestBar.LowPrice),
          askSize: new Decimal(0),
          bidSize: new Decimal(0),
        };

        console.log(
          "Quote Method 2 - Latest bar data found:",
          convertedBarData,
        );
        return convertedBarData;
      }
    } catch (error) {
      attempts++;
      console.error(
        `getAlpacaGetLatestQuoteForAsset - Attempt ${attempts} failed:`,
        error,
      );
      if (attempts === maxAttempts) {
        Sentry.captureException(error);
        console.error(
          `getAlpacaGetLatestQuoteForAsset - An error occurred while fetching quote data for ${symbol}:`,
          error,
        );
        throw error;
      }
    }
  }

  const errorMessage = `getAlpacaGetLatestQuoteForAsset - An error occurred while fetching quote data for ${symbol}`;
  console.error(errorMessage);
  Sentry.captureMessage(errorMessage);
  throw new Error(errorMessage);
};

/**
 * Checks if there are any open positions for a given symbol.
 *
 * @param symbol - The symbol to check for open positions.
 * @param accountName - The account to use for checking holdings.
 *
 * @returns - A boolean, true if there are open positions, false if there are no open positions
 */
export const getAlpacaIsPositionOpen = async (
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

    const alpacaOpenPositions: unknown = await alpaca.getPositions();
    const openPositions = AlpacaApiPositionsSchema.parse(alpacaOpenPositions);

    for (const position of openPositions) {
      if (position.symbol === symbol && parseFloat(position.qty) > 0) {
        console.log(
          `getAlpacaIsPositionOpen - Open position found for ${symbol}`,
        );
        return true;
      }
    }

    console.log(`getAlpacaIsPositionOpen - All positions closed for ${symbol}`);
    return false;
  } catch (error) {
    Sentry.captureException(error);
    if (error instanceof ZodError) {
      console.error(
        "getAlpacaIsPositionOpen - Error, validation failed with ZodError:",
        error.errors,
      );
    } else {
      console.error(
        `getAlpacaIsPositionOpen - Error, unable to determine if position is open for ${symbol}:`,
        error,
      );
    }
    throw new Error(
      `getAlpacaIsPositionOpen - Error, unable to determine if position is open for ${symbol}`,
    );
  }
};
