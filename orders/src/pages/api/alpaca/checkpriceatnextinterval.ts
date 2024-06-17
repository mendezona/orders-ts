import * as Sentry from "@sentry/nextjs";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

const handler = async (request: Request) => {
  console.log("API called - alpaca/checkpriceatnextinterval");
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await request.json();
    console.log("checkpriceatnextinterval: data", data);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error(
      "Endpoint error - alpaca/checkpriceatnextinterval, error scheduling cron job:",
      error,
    );
    return Response.json({ success: false }, { status: 500 });
  }
};

export const POST = verifySignatureAppRouter(handler);
