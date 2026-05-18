import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const url = `${backendUrl}/article?${searchParams.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json(null, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json(null, { status: 500 });
  }
}
