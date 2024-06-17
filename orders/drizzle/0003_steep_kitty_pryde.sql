ALTER TABLE "orders_ts_sellTrades" ALTER COLUMN "profit_amount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders_ts_sellTrades" ADD COLUMN "taxable_amount" numeric(20, 10);