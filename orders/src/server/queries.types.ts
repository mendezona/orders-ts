import { type flipAlerts, type sellTrades } from "./db/schema";

export type FlipAlert = typeof flipAlerts.$inferSelect;

export type SellTrade = typeof sellTrades.$inferSelect;

export type SaveBuyTradeToDatabaseFlipTradeAlertTableProps = Omit<
  FlipAlert,
  "id" | "tradeTime"
>;

export interface SaveSellTradeToDatabaseSellTableProps
  extends Omit<SellTrade, "id" | "tradeTime"> {
  buyAlert: boolean;
}

export type FlipAlertItem = Omit<FlipAlert, "id">;
