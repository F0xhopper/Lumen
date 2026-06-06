import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/query/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return new Response(JSON.stringify({ error: "Cannot reach backend" }), { status: 503 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(
      JSON.stringify({ error: "Backend error" }),
      { status: upstream.status || 500 },
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
