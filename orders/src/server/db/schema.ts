// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import {
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

export const sellTrades = createTable("sellTrades", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").unique().notNull(),
  profitOrLossAmount: numeric("profit_amount", {
    precision: 20,
    scale: 10,
  }).notNull(),
  taxableAmount: numeric("profit_amount", { precision: 20, scale: 10 }),
  tradeTime: timestamp("trade_time", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});
