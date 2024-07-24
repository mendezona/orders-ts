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
  avg_entry_price: z.string(),
  market_value: z.string(),
  cost_basis: z.string(),
  unrealized_pl: z.string(),
  unrealized_plpc: z.string(),
  unrealized_intraday_pl: z.string(),
  unrealized_intraday_plpc: z.string(),
  current_price: z.string(),
  lastday_price: z.string(),
  change_today: z.string(),
});

export const PositionSchema = z.object({
  asset_id: z.string().uuid(),
  symbol: z.string(),
  exchange: AssetExchangeSchema,
  asset_class: AssetClassSchema,
  asset_marginable: z.boolean().optional(),
  avg_entry_price: z.string(),
  qty: z.string(),
  side: PositionSideSchema,
  market_value: z.string().optional(),
  cost_basis: z.string(),
  unrealized_pl: z.string().optional(),
  unrealized_plpc: z.string().optional(),
  unrealized_intraday_pl: z.string().optional(),
  unrealized_intraday_plpc: z.string().optional(),
  current_price: z.string().optional(),
  lastday_price: z.string().optional(),
  change_today: z.string().optional(),
  swap_rate: z.string().optional(),
  avg_entry_swap_rate: z.string().optional(),
  usd: USDPositionValuesSchema.optional(),
  qty_available: z.string().optional(),
});
export const AlpacaApiPositionsSchema = z.array(PositionSchema);

export const AlpacaApiGetPositionSchema = PositionSchema.extend({
  position: z.string(),
}).partial();

export type AlpacaApiGetPosition = z.infer<typeof AlpacaApiGetPositionSchema>;

export const AlpacaApiTradeAccountSchema = z.object({
  id: z.string().uuid(),
  account_number: z.string(),
  status: AccountStatusSchema,
  crypto_status: AccountStatusSchema.optional(),
  currency: z.string().optional(),
  buying_power: z.string().optional(),
  regt_buying_power: z.string().optional(),
  daytrading_buying_power: z.string().optional(),
  non_marginable_buying_power: z.string().optional(),
  cash: z.string().optional(),
  accrued_fees: z.string().optional(),
  pending_transfer_out: z.string().optional(),
  pending_transfer_in: z.string().optional(),
  portfolio_value: z.string().optional(),
  pattern_day_trader: z.boolean().optional(),
  trading_blocked: z.boolean().optional(),
  transfers_blocked: z.boolean().optional(),
  account_blocked: z.boolean().optional(),
  created_at: z.date().optional(),
  trade_suspended_by_user: z.boolean().optional(),
  multiplier: z.string().optional(),
  shorting_enabled: z.boolean().optional(),
  equity: z.string().optional(),
  last_equity: z.string().optional(),
  long_market_value: z.string().optional(),
  short_market_value: z.string().optional(),
  initial_margin: z.string().optional(),
  maintenance_margin: z.string().optional(),
  last_maintenance_margin: z.string().optional(),
  sma: z.string().optional(),
  daytrade_count: z.number().optional(),
  options_buying_power: z.string().optional(),
  options_approved_level: z.number().optional(),
  options_trading_level: z.number().optional(),
});

export type AlpacaApiTradeAccountSchema = z.infer<
  typeof AlpacaApiTradeAccountSchema
>;

type Order = {
  id: string;
  client_order_id: string;
  created_at: Date;
  updated_at: Date;
  submitted_at: Date;
  filled_at?: Date;
  expired_at?: Date;
  canceled_at?: Date;
  failed_at?: Date;
  replaced_at?: Date;
  replaced_by?: string;
  replaces?: string;
  asset_id: string;
  symbol: string;
  asset_class: z.infer<typeof AssetClassSchema>;
  notional?: string;
  qty?: string | number;
  filled_qty?: string | number;
  filled_avg_price?: string | number;
  order_class: z.infer<typeof OrderClassSchema>;
  order_type: z.infer<typeof OrderTypeSchema>;
  type: z.infer<typeof OrderTypeSchema>;
  side: z.infer<typeof OrderSideSchema>;
  time_in_force: z.infer<typeof TimeInForceSchema>;
  limit_price?: string | number;
  stop_price?: string | number;
  status: z.infer<typeof OrderStatusSchema>;
  extended_hours: boolean;
  legs?: Order[];
  trail_percent?: string;
  trail_price?: string;
  hwm?: string;
};

const OrderSchema: z.ZodType<Order> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    client_order_id: z.string(),
    created_at: z.date(),
    updated_at: z.date(),
    submitted_at: z.date(),
    filled_at: z.date().optional(),
    expired_at: z.date().optional(),
    canceled_at: z.date().optional(),
    failed_at: z.date().optional(),
    replaced_at: z.date().optional(),
    replaced_by: z.string().uuid().optional(),
    replaces: z.string().uuid().optional(),
    asset_id: z.string().uuid(),
    symbol: z.string(),
    asset_class: AssetClassSchema,
    notional: z.string().optional(),
    qty: z.union([z.string(), z.number()]).optional(),
    filled_qty: z.union([z.string(), z.number()]).optional(),
    filled_avg_price: z.union([z.string(), z.number()]).optional(),
    order_class: OrderClassSchema,
    order_type: OrderTypeSchema,
    type: OrderTypeSchema,
    side: OrderSideSchema,
    time_in_force: TimeInForceSchema,
    limit_price: z.union([z.string(), z.number()]).optional(),
    stop_price: z.union([z.string(), z.number()]).optional(),
    status: OrderStatusSchema,
    extended_hours: z.boolean(),
    legs: z.array(z.lazy(() => OrderSchema)).optional(),
    trail_percent: z.string().optional(),
    trail_price: z.string().optional(),
    hwm: z.string().optional(),
  }),
);
export { OrderSchema };
export const OrdersSchema = z.array(OrderSchema);

export const OrderRequestSchema = z.object({
  symbol: z.string(),
  qty: z.number().optional(),
  notional: z.number().optional(),
  side: OrderSideSchema,
  type: OrderTypeSchema,
  time_in_force: TimeInForceSchema,
  limit_price: z.number().optional(),
  stop_price: z.number().optional(),
  client_order_id: z.string().optional(),
  extended_hours: z.boolean().optional(),
  order_class: z.string().optional(),
  take_profit: z.record(z.unknown()).optional(),
  stop_loss: z.record(z.unknown()).optional(),
  trail_price: z.string().optional(),
  trail_percent: z.string().optional(),
});
export type OrderRequest = z.infer<typeof OrderRequestSchema>;

export const AssetSchema = z.object({
  id: z.string().uuid(),
  asset_class: AssetClassSchema,
  exchange: AssetExchangeSchema,
  symbol: z.string(),
  name: z.string().optional(),
  status: AssetStatusSchema,
  tradable: z.boolean(),
  marginable: z.boolean(),
  shortable: z.boolean(),
  easy_to_borrow: z.boolean(),
  fractionable: z.boolean(),
  min_order_size: z.number().optional(),
  min_trade_increment: z.number().optional(),
  price_increment: z.number().optional(),
  maintenance_margin_requirement: z.number().optional(),
  attributes: z.array(z.string()).optional(),
});

export const AlpacaCalendarSchema = z.object({
  date: z.string(),
  open: z.string(),
  close: z.string(),
  session_open: z.string(),
  session_close: z.string(),
  settlement_date: z.string(),
});

export type AlpacaCalendar = z.infer<typeof AlpacaCalendarSchema>;

export const RawDataSchema = z.record(z.unknown());
