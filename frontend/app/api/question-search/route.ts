import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q) return NextResponse.json({ error: "q parameter required" }, { status: 400 });

  try {
    const response = await fetch(`${BACKEND}/passages/questions?${searchParams.toString()}`);
    if (!response.ok) return NextResponse.json({ error: "Backend error" }, { status: response.status });
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ error: "Failed to retrieve question matches" }, { status: 500 });
  }
}
