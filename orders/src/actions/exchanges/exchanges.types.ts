import { z } from "zod";

export const tradingViewAlertSchema = z.object({
  authenticationToken: z.string(),
  ticker: z.string(),
  closePrice: z.string(),
  interval: z.string(),
});
