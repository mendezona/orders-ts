import * as Sentry from "@sentry/nextjs";
import type { NextApiRequest, NextApiResponse } from "next";
import { alpacaSubmitPairTradeOrder } from "~/actions/exchanges/alpaca/alpacaOrders.utils";
import { type TradingViewAlert } from "~/actions/exchanges/exchanges.types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  console.log("Endpoint called - alpaca/pairtradebuyalert");

  const validAuthenticationToken = process.env.TRADINGVIEW_AUTH_TOKEN;
  const tradingViewAlert = req.body as TradingViewAlert;
  if (tradingViewAlert.authenticationToken !== validAuthenticationToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    await alpacaSubmitPairTradeOrder({
      tradingviewSymbol: tradingViewAlert.ticker,
      tradingViewPrice: tradingViewAlert.closePrice,
    });
    return res.status(200).json({
      message:
        "Endpoint success - alpaca/pairtradebuyalert - buy order submitted",
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error(
      "Endpoint error - alpaca/pairtradebuyalert, error processing trade order:",
      error,
    );
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
