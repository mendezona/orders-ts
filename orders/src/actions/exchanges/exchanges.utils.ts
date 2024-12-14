import Alpaca from "@alpacahq/alpaca-trade-api";
import * as Sentry from "@sentry/nextjs";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { ALPACA_LIVE_TRADING_ACCOUNT_NAME } from "./alpaca/alpaca.constants";
import { alpacaGetCredentials } from "./alpaca/alpacaAccount.utils";
import { AlpacaClockSchema } from "./alpaca/alpacaApi.types";
import { LOCAL_TIMEZONE, NEW_YORK_TIMEZONE } from "./exchanges.constants";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Checks if market is open
 *
 * @returns - True if market is open, otherwise false.
 */
export const getIsMarketOpen = async (
  accountName = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
) => {
  try {
    const credentials = alpacaGetCredentials(accountName);
    const alpaca: Alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

    const marketClock = (await alpaca.getClock()) as unknown;
    const parsedMarketClock = AlpacaClockSchema.parse(marketClock);

    return parsedMarketClock.is_open;
  } catch (error) {
    Sentry.captureException(error);
    console.error(error);
    throw error;
  }
};

/**
 * Logs the current time in exchange timezone and another local timezone.
 *
 * @param exchangeTimezone - The exchange timezone for conversion.
 * @param localTimezone - The local timezone for conversion.
 *
 * @returns - Current time in exchange timezone and another local timezone, formatted as "YYYY-MM-DD HH:mm:ss".
 */
export const logTimezonesOfCurrentTime = (
  exchangeTimezone: string = NEW_YORK_TIMEZONE,
  localTimezone: string = LOCAL_TIMEZONE,
) => {
  const nowUTC = dayjs.utc();
  const timeInNewYork = nowUTC
    .tz(exchangeTimezone)
    .format("YYYY-MM-DD HH:mm:ss");
  const timeInLocalTimezone = nowUTC
    .tz(localTimezone)
    .format("YYYY-MM-DD HH:mm:ss");

  console.log(`Current time in New York: ${timeInNewYork}`);
  console.log(`Current time in Local Timezone: ${timeInLocalTimezone}`);
};
