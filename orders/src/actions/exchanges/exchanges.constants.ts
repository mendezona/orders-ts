import Decimal from "decimal.js";

export const LOCAL_TIMEZONE = "Europe/Berlin";

export const NEW_YORK_TIMEZONE = "America/New_York";

export const EXCHANGE_CAPITAL_GAINS_TAX_RATE = new Decimal(0.26375);

export enum EXCHANGES {
  ALPACA = "ALPACA",
  BYBIT = "BYBIT",
}
