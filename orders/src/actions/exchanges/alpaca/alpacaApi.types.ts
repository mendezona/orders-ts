import { z } from "zod";

export const QueryOrderStatusSchema = z.enum(["open", "closed", "open"]);

export const AccountStatusSchema = z.enum([
  "ACCOUNT_CLOSED",
  "ACCOUNT_UPDATED",
  "ACTION_REQUIRED",
  "ACTIVE",
  "AML_REVIEW",
  "APPROVAL_PENDING",
  "APPROVED",
  "DISABLED",
  "DISABLE_PENDING",
  "EDITED",
  "INACTIVE",
  "KYC_SUBMITTED",
  "LIMITED",
  "ONBOARDING",
  "PAPER_ONLY",
  "REAPPROVAL_PENDING",
  "REJECTED",
  "RESUBMITTED",
  "SIGNED_UP",
  "SUBMISSION_FAILED",
  "SUBMITTED",
]);

export const AssetExchangeSchema = z.enum([
  "AMEX",
  "ARCA",
  "BATS",
  "NYSE",
  "NASDAQ",
  "NYSEARCA",
  "FTXU",
  "CBSE",
  "GNSS",
  "ERSX",
  "OTC",
  "CRYPTO",
  "",
]);

export const AssetClassSchema = z.enum(["us_equity", "us_option", "crypto"]);

export const PositionSideSchema = z.enum(["short", "long"]);

export const OrderSideSchema = z.enum(["buy", "sell"]);
export type OrderSide = z.infer<typeof OrderSideSchema>;

export const OrderClassSchema = z.enum(["simple", "bracket", "oco", "oto"]);

export const OrderTypeSchema = z.enum([
  "market",
  "limit",
  "stop",
  "stop_limit",
  "trailing_stop",
]);
export type OrderType = z.infer<typeof OrderTypeSchema>;

export const TimeInForceSchema = z.enum([
  "day",
  "gtc",
  "opg",
  "cls",
  "ioc",
  "fok",
]);
export type TimeInForce = z.infer<typeof TimeInForceSchema>;

export const OrderStatusSchema = z.enum([
  "new",
  "partially_filled",
  "filled",
  "done_for_day",
  "canceled",
  "expired",
  "replaced",
  "pending_cancel",
  "pending_replace",
  "pending_review",
  "accepted",
  "pending_new",
  "accepted_for_bidding",
  "stopped",
  "rejected",
  "suspended",
  "calculated",
  "held",
]);

export const AssetStatusSchema = z.enum(["active", "inactive"]);

export const USDPositionValuesSchema = z.object({
  avg_entry_price: z.string().optional().nullable(),
  market_value: z.string().optional().nullable(),
  cost_basis: z.string().optional().nullable(),
  unrealized_pl: z.string().optional().nullable(),
  unrealized_plpc: z.string().optional().nullable(),
  unrealized_intraday_pl: z.string().optional().nullable(),
  unrealized_intraday_plpc: z.string().optional().nullable(),
  current_price: z.string().optional().nullable(),
  lastday_price: z.string().optional().nullable(),
  change_today: z.string().optional().nullable(),
});

export const PositionSchema = z.object({
  asset_id: z.string().uuid().optional().nullable(),
  symbol: z.string().optional().nullable(),
  exchange: AssetExchangeSchema.optional().nullable().or(z.literal("")),
  asset_class: AssetClassSchema.optional().nullable().or(z.literal("")),
  asset_marginable: z.boolean().optional().nullable(),
  avg_entry_price: z.string().optional().nullable(),
  qty: z.string(),
  side: PositionSideSchema.optional().nullable().or(z.literal("")),
  market_value: z.string().optional().nullable(),
  cost_basis: z.string().optional().nullable(),
  unrealized_pl: z.string().optional().nullable(),
  unrealized_plpc: z.string().optional().nullable(),
  unrealized_intraday_pl: z.string().optional().nullable(),
  unrealized_intraday_plpc: z.string().optional().nullable(),
  current_price: z.string().optional().nullable(),
  lastday_price: z.string().optional().nullable(),
  change_today: z.string().optional().nullable(),
  swap_rate: z.string().optional().nullable(),
  avg_entry_swap_rate: z.string().optional().nullable(),
  usd: USDPositionValuesSchema.optional().nullable(),
  qty_available: z.string().optional().nullable(),
});
export const AlpacaApiPositionsSchema = z.array(PositionSchema);

export const AlpacaApiGetPositionSchema = PositionSchema.extend({
  position: z.string(),
}).partial();
export type AlpacaApiGetPosition = z.infer<typeof AlpacaApiGetPositionSchema>;

export const AlpacaApiTradeAccountSchema = z.object({
  id: z.string().uuid().nullable(),
  account_number: z.string().nullable(),
  status: AccountStatusSchema.optional().or(z.literal("")).nullable(),
  crypto_status: AccountStatusSchema.optional().or(z.literal("")).nullable(),
  currency: z.string().optional().nullable(),
  buying_power: z.string().optional().nullable(),
  regt_buying_power: z.string().optional().nullable(),
  daytrading_buying_power: z.string().optional().nullable(),
  non_marginable_buying_power: z.string().optional().nullable(),
  cash: z.string().optional().nullable(),
  accrued_fees: z.string().optional().nullable(),
  pending_transfer_out: z.string().optional().nullable(),
  pending_transfer_in: z.string().optional().nullable(),
  portfolio_value: z.string().optional().nullable(),
  pattern_day_trader: z.boolean().optional().nullable(),
  trading_blocked: z.boolean().optional().nullable(),
  transfers_blocked: z.boolean().optional().nullable(),
  account_blocked: z.boolean().optional().nullable(),
  created_at: z.string().optional().nullable(),
  trade_suspended_by_user: z.boolean().optional().nullable(),
  multiplier: z.string().optional().nullable(),
  shorting_enabled: z.boolean().optional().nullable(),
  equity: z.string().optional().nullable(),
  last_equity: z.string().optional().nullable(),
  long_market_value: z.string().optional().nullable(),
  short_market_value: z.string().optional().nullable(),
  initial_margin: z.string().optional().nullable(),
  maintenance_margin: z.string().optional().nullable(),
  last_maintenance_margin: z.string().optional().nullable(),
  sma: z.string().optional().nullable(),
  daytrade_count: z.number().optional().nullable(),
  options_buying_power: z.string().optional().nullable(),
  options_approved_level: z.number().optional().nullable(),
  options_trading_level: z.number().optional().nullable(),
});
export type AlpacaApiTradeAccountSchema = z.infer<
  typeof AlpacaApiTradeAccountSchema
>;

type Order = {
  id?: string | null;
  client_order_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  submitted_at?: string | null;
  filled_at?: string | null;
  expired_at?: string | null;
  canceled_at?: string | null;
  failed_at?: string | null;
  replaced_at?: string | null;
  replaced_by?: string | null;
  replaces?: string | null;
  asset_id?: string | null;
  symbol?: string | null;
  asset_class?: z.infer<typeof AssetClassSchema> | null | "";
  notional?: string | null;
  qty?: string | number | null;
  filled_qty?: string | number | null;
  filled_avg_price?: string | number | null;
  order_class?: z.infer<typeof OrderClassSchema> | null | "";
  order_type?: z.infer<typeof OrderTypeSchema> | null | "";
  type?: z.infer<typeof OrderTypeSchema> | null | "";
  side?: z.infer<typeof OrderSideSchema> | null | "";
  time_in_force?: z.infer<typeof TimeInForceSchema> | null | "";
  limit_price?: string | number | null;
  stop_price?: string | number | null;
  status?: z.infer<typeof OrderStatusSchema> | null | "";
  extended_hours?: boolean | null;
  legs?: Order[] | null;
  trail_percent?: string | null;
  trail_price?: string | null;
  hwm?: string | null;
};

const OrderSchema: z.ZodType<Order> = z.lazy(() =>
  z.object({
    id: z.string().uuid().optional().nullable(),
    client_order_id: z.string().optional().nullable(),
    created_at: z.string().optional().nullable(),
    updated_at: z.string().optional().nullable(),
    submitted_at: z.string().optional().nullable(),
    filled_at: z.string().optional().nullable(),
    expired_at: z.string().optional().nullable(),
    canceled_at: z.string().optional().nullable(),
    failed_at: z.string().optional().nullable(),
    replaced_at: z.string().optional().nullable(),
    replaced_by: z.string().uuid().optional().nullable(),
    replaces: z.string().uuid().optional().nullable(),
    asset_id: z.string().uuid().optional().nullable(),
    symbol: z.string().optional().nullable(),
    asset_class: AssetClassSchema.optional().nullable().or(z.literal("")),
    notional: z.string().optional().nullable(),
    qty: z.union([z.string(), z.number()]).optional().nullable(),
    filled_qty: z.union([z.string(), z.number()]).optional().nullable(),
    filled_avg_price: z.union([z.string(), z.number()]).optional().nullable(),
    order_class: OrderClassSchema.optional().nullable().or(z.literal("")),
    order_type: OrderTypeSchema.optional().nullable().or(z.literal("")),
    type: OrderTypeSchema.optional().nullable().or(z.literal("")),
    side: OrderSideSchema.optional().nullable().or(z.literal("")),
    time_in_force: TimeInForceSchema.optional().nullable().or(z.literal("")),
    limit_price: z.union([z.string(), z.number()]).optional().nullable(),
    stop_price: z.union([z.string(), z.number()]).optional().nullable(),
    status: OrderStatusSchema.optional().nullable().or(z.literal("")),
    extended_hours: z.boolean().optional().nullable(),
    legs: z
      .array(z.lazy(() => OrderSchema))
      .optional()
      .nullable(),
    trail_percent: z.string().optional().nullable(),
    trail_price: z.string().optional().nullable(),
    hwm: z.string().optional().nullable(),
  }),
);

export { OrderSchema };
export const OrdersSchema = z.array(OrderSchema);

export const OrderRequestSchema = z.object({
  symbol: z.string().nullable(),
  qty: z.number().optional().nullable(),
  notional: z.number().optional().nullable(),
  side: OrderSideSchema.optional().or(z.literal("")).nullable(),
  type: OrderTypeSchema.optional().or(z.literal("")).nullable(),
  time_in_force: TimeInForceSchema.optional().or(z.literal("")).nullable(),
  limit_price: z.number().optional().nullable(),
  stop_price: z.number().optional().nullable(),
  client_order_id: z.string().optional().nullable(),
  extended_hours: z.boolean().optional().nullable(),
  order_class: z.string().optional().nullable(),
  take_profit: z.record(z.unknown()).optional().nullable(),
  stop_loss: z.record(z.unknown()).optional().nullable(),
  trail_price: z.string().optional().nullable(),
  trail_percent: z.string().optional().nullable(),
});
export type OrderRequest = z.infer<typeof OrderRequestSchema>;

export const AssetSchema = z.object({
  id: z.string().uuid().nullable(),
  asset_class: AssetClassSchema.optional().or(z.literal("")).nullable(),
  exchange: AssetExchangeSchema.optional().or(z.literal("")).nullable(),
  symbol: z.string().nullable(),
  name: z.string().optional().nullable(),
  status: AssetStatusSchema.optional().nullable(),
  tradable: z.boolean().nullable(),
  marginable: z.boolean().nullable(),
  shortable: z.boolean().nullable(),
  easy_to_borrow: z.boolean().nullable(),
  fractionable: z.boolean(),
  min_order_size: z.number().optional().nullable(),
  min_trade_increment: z.number().optional().nullable(),
  price_increment: z.number().optional().nullable(),
  maintenance_margin_requirement: z.number().optional().nullable(),
  attributes: z.array(z.string()).optional().nullable(),
});

const AlpacaDateSchema = z.object({
  date: z.string(),
  open: z.string(),
  close: z.string(),
  session_open: z.string(),
  session_close: z.string(),
  settlement_date: z.string().optional().nullable(),
});
export type AlpacaDate = z.infer<typeof AlpacaDateSchema>;
export const AlpacaCalendarSchema = z.array(AlpacaDateSchema);

export const AlpacaClockSchema = z.object({
  timestamp: z.string(),
  is_open: z.boolean(),
  next_open: z.string(),
  next_close: z.string(),
});
export type AlpacaClock = z.infer<typeof AlpacaClockSchema>;
