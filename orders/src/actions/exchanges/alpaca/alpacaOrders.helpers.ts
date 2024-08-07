import Alpaca from "@alpacahq/alpaca-trade-api";
import {
  type AlpacaBar,
  type AlpacaQuote,
} from "@alpacahq/alpaca-trade-api/dist/resources/datav2/entityv2";
import * as Sentry from "@sentry/nextjs";
import Decimal from "decimal.js";
import { ZodError } from "zod";
import { ALPACA_LIVE_TRADING_ACCOUNT_NAME } from "./alpaca.constants";
import { type AlpacaGetLatestQuote } from "./alpaca.types";
import { alpacaGetCredentials } from "./alpacaAccount.utils";
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
export const alpacaIsAssetFractionable = async (
  symbol: string,
  accountName: string = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
): Promise<boolean> => {
  console.log(
    `alpacaIsAssetFractionable - checking if ${symbol} is fractionable`,
  );
  const credentials = alpacaGetCredentials(accountName);

  const alpaca: Alpaca = new Alpaca({
    keyId: credentials.key,
    secretKey: credentials.secret,
    paper: credentials.paper,
  });

  try {
    const alpacaAsset: unknown = await alpaca.getAsset(symbol);
    const asset = AssetSchema.parse(alpacaAsset);
    console.log(`${symbol} fractionable:`, asset.fractionable);
    return asset.fractionable;
  } catch (error) {
    Sentry.captureException(error);
    if (error instanceof ZodError) {
      console.error(
        "alpacaIsAssetFractionable - validation failed with ZodError:",
        error.errors,
      );
    } else {
      console.error(
        `alpacaIsAssetFractionable - Error - Unable to determine if asset is fractionable:`,
        error,
      );
    }
    throw new Error(`Error - Unable to determine if asset is fractionable`);
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
export const alpacaCalculateProfitLoss = async (
  symbol: string,
  accountName: string = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
): Promise<Decimal> => {
  console.log(
    "alpacaCalculateProfitLoss - start calculating profit/loss for",
    symbol,
  );
  const credentials = alpacaGetCredentials(accountName);

  const alpaca: Alpaca = new Alpaca({
    keyId: credentials.key,
    secretKey: credentials.secret,
    paper: credentials.paper,
  });

  try {
    // Fetch the most recent orders, considering a reasonable limit
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
    let accumulatedSellQuantity: Decimal = new Decimal(0);
    let totalSellValue: Decimal = new Decimal(0);
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
      `Sell price: ${totalSellValue.toString()}, and sell quantity: ${accumulatedSellQuantity.toString()}`,
    );

    const sellQuantityNeeded: Decimal = accumulatedSellQuantity;
    let accumulatedBuyQuantity: Decimal = new Decimal(0);
    let totalBuyCost: Decimal = new Decimal(0);

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
      const errorMessage = "Not enough buy orders to match the sell quantity.";
      console.log(errorMessage);
      Sentry.captureMessage(errorMessage);
      throw new Error(errorMessage);
    }

    console.log("Buy price:", totalBuyCost.toString());
    console.log("Sell price:", totalSellValue.toString());

    // Calculate profit or loss
    const profitLoss: Decimal = totalSellValue.minus(totalBuyCost);
    console.log(
      "alpacaCalculateProfitLoss - Total Profit Loss:",
      profitLoss.toString(),
    );
    return profitLoss;
  } catch (error) {
    Sentry.captureException(error);
    if (error instanceof ZodError) {
      console.error(
        "alpacaCalculateProfitLoss - validation failed with ZodError:",
        error.errors,
      );
    } else {
      console.error(
        `alpacaCalculateProfitLoss - Error - Unable to determine profit or loss:`,
        error,
      );
    }
    throw new Error(`Error - Unable to determine profit or loss`);
  }
};

/**
 * Get the latest quote data for an asset, with two additional backup methods
 *
 * @param symbol - Symbol to check if asset is fractionable
 * @param accountName - Account to use to check if asset is fractionable
 *
 * @returns - A AlpacaGetLatestQuote object or an error object
 */
export const alpacaGetLatestQuote = async (
  symbol: string,
  accountName: string = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
): Promise<AlpacaGetLatestQuote> => {
  const credentials = alpacaGetCredentials(accountName);

  const alpaca: Alpaca = new Alpaca({
    keyId: credentials.key,
    secretKey: credentials.secret,
    paper: credentials.paper,
  });

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      // Primary method: getLatestQuote
      const getLatestQuoteData: AlpacaQuote =
        await alpaca.getLatestQuote(symbol);
      if (!!getLatestQuoteData.BidPrice || !!getLatestQuoteData.AskPrice) {
        const convertedQuoteData: AlpacaGetLatestQuote = {
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
        const convertedBarData: AlpacaGetLatestQuote = {
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
        `alpacaGetLatestQuote - Attempt ${attempts} failed:`,
        error,
      );
      if (attempts === maxAttempts) {
        Sentry.captureException(error);
        console.error(
          `alpacaGetLatestQuote - An error occurred while fetching quote data for ${symbol}:`,
          error,
        );
        throw error;
      }
    }
  }

  const errorMessage = `alpacaGetLatestQuote - An error occurred while fetching quote data for ${symbol}`;
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
 * @returns - A boolean indicating if the holdings for the specified symbol are closed.
 */
export const alpacaAreHoldingsClosed = async (
  symbol: string,
  accountName: string = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
): Promise<boolean> => {
  console.log(
    `alpacaAreHoldingsClosed - Checking if holdings for ${symbol} are closed`,
  );
  const credentials = alpacaGetCredentials(accountName);

  const alpaca: Alpaca = new Alpaca({
    keyId: credentials.key,
    secretKey: credentials.secret,
    paper: credentials.paper,
  });

  try {
    const alpacaOpenPositions: unknown = await alpaca.getPositions();
    const openPositions = AlpacaApiPositionsSchema.parse(alpacaOpenPositions);
    for (const position of openPositions) {
      if (position.symbol === symbol && parseFloat(position.qty) > 0) {
        console.log(`Open position for ${symbol} found`);
        return false;
      }
    }

    console.log(
      `alpacaAreHoldingsClosed - All positions for ${symbol} have been closed`,
    );
    return true;
  } catch (error) {
    Sentry.captureException(error);
    if (error instanceof ZodError) {
      console.error(
        "alpacaCalculateProfitLoss - validation failed with ZodError:",
        error.errors,
      );
    } else {
      console.error(
        `alpacaAreHoldingsClosed - Error, position data for ${symbol}:`,
        error,
      );
    }
    throw new Error(
      `alpacaAreHoldingsClosed - Error, position data for ${symbol}:`,
    );
  }
};
