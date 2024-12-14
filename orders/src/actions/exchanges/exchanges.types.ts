export interface TradingViewAlert {
  authenticationToken: string;
  exchange: string;
  alertType: string;
  ticker: string;
  closePrice: string;
  time: string;
  interval: string;
}
