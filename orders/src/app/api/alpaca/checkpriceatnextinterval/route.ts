import * as Sentry from "@sentry/nextjs";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

export const dynamic = "force-dynamic";

export const POST = verifySignatureAppRouter(async (request: Request) => {
  console.log("API called - alpaca/checkpriceatnextinterval");
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await request.json();
    console.log("checkpriceatnextinterval: data", data);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error(
      "Endpoint error - alpaca/checkpriceatnextinterval, error scheduling cron job:",
      error,
    );
    return new Response(JSON.stringify({ success: false }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
});
