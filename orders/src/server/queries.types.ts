import {
  type flipAlerts,
  type fractionableTakeProfitOrders,
  type sellTrades,
} from "./db/schema";

export type FlipAlert = typeof flipAlerts.$inferSelect;

export type SellTrade = typeof sellTrades.$inferSelect;

export type FractionableTakeProfitOrder =
  typeof fractionableTakeProfitOrders.$inferSelect;

export type SaveBuyTradeToDatabaseFlipTradeAlertTableProps = Omit<
  FlipAlert,
  "id" | "tradeTime"
>;

export interface SaveSellTradeToDatabaseSellTableProps
  extends Omit<SellTrade, "id" | "tradeTime" | "manuallyAdded"> {
  buyAlert: boolean;
}

export type FlipAlertItem = Omit<FlipAlert, "id">;

export type SaveFractionableTakeProfitOrderProps = Omit<
  FractionableTakeProfitOrder,
  "id" | "createdAt"
>;
