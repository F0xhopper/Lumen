import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  if (!query) return NextResponse.json({ error: "query parameter required" }, { status: 400 });

  let response: Response;
  try {
    response = await fetch(`${BACKEND}/passages/?${searchParams.toString()}`);
  } catch {
    return NextResponse.json({ error: "Cannot reach backend" }, { status: 503 });
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    return NextResponse.json(
      { error: body?.detail ?? "Backend error" },
      { status: response.status },
    );
  }
  return NextResponse.json(await response.json());
}
