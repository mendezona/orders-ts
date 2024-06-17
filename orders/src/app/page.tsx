"use client";
import { useState } from "react";
import { startBackgroundJob } from "~/actions/upstashActions";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleClick() {
    setLoading(true);
    const messageId = await startBackgroundJob();
    if (messageId) {
      setMsg(`Started job with ID ${messageId}`);
    } else {
      setMsg("Failed to start background job");
    }
    setLoading(false);
  }

  return (
    <main className="flex h-lvh flex-col items-center justify-center">
      <button
        onClick={handleClick}
        disabled={loading}
        className="btn btn-primary h-56 w-1/2 rounded-lg bg-green-500 text-xl hover:bg-green-600 disabled:bg-gray-500 sm:text-3xl"
      >
        Start Background Job
      </button>

      {loading && <div className="mt-8 text-2xl">Loading...</div>}
      {msg && <p className="text-center text-lg">{msg}</p>}
    </main>
  );
}
