import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const topK = searchParams.get("top_k") || "5";

    if (!query) {
      return NextResponse.json({ error: "query parameter required" }, { status: 400 });
    }

    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const url = `${backendUrl}/passages?query=${encodeURIComponent(query)}&top_k=${topK}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in passages API route:", error);
    return NextResponse.json({ error: "Failed to retrieve passages" }, { status: 500 });
  }
}
