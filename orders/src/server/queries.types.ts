import { type sellTrades } from "./db/schema";

export type SellTrade = typeof sellTrades.$inferSelect;
