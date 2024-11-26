// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import {
  boolean,
  numeric,
  pgTableCreator,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `orders_ts_${name}`);

export const flipAlerts = createTable("flipAlerts", {
  id: serial("id").primaryKey(),
  exchange: text("exchange").notNull(),
  symbol: text("symbol").notNull(),
  price: numeric("price", { precision: 20, scale: 10 }).notNull(),
  tradeTime: timestamp("trade_time", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const sellTrades = createTable("sellTrades", {
  id: serial("id").primaryKey(),
  exchange: text("exchange"),
  symbol: text("symbol").notNull(),
  profitOrLossAmount: numeric("profit_amount", {
    precision: 20,
    scale: 10,
  }).notNull(),
  taxableAmount: numeric("taxable_amount", { precision: 20, scale: 10 }),
  tradeTime: timestamp("trade_time", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  manuallyAdded: boolean("manually_added").default(false),
});

export const fractionableTakeProfitOrders = createTable(
  "fractionableTakeProfitOrders",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    quantity: numeric("quantity", { precision: 20, scale: 10 }).notNull(),
    limitPrice: numeric("limit_price", { precision: 20, scale: 10 }).notNull(),
    side: text("side").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
);
