"use server";
import { Client } from "@upstash/qstash";

const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export async function startBackgroundJob() {
  try {
    const response = await qstashClient.publishJSON({
      url: "https://orders-ts.vercel.app/api/long-task",
      body: {
        hello: "world",
      },
    });
    return response.messageId;
  } catch (error) {
    console.error(error);
    return null;
  }
}
