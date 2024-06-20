import * as Sentry from "@sentry/nextjs";
import { alpacaGetLatestQuote } from "~/actions/exchanges/alpaca/alpacaOrders.helpers";

export const dynamic = "force-dynamic";

export async function POST(_request: Request) {
  console.log("API called - alpaca/testendpoint");

  try {
    await alpacaGetLatestQuote("AAPL");
    return new Response(JSON.stringify({ message: "Success" }), {
      status: 200,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error(error);
    return new Response(JSON.stringify({ error: "There was an error" }), {
      status: 500,
    });
  }
}
