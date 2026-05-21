import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partId = searchParams.get("part_id");
  const questionN = searchParams.get("question_n");

  if (!partId || !questionN) {
    return NextResponse.json({ error: "part_id and question_n required" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
  const url = `${backendUrl}/articles?part_id=${encodeURIComponent(partId)}&question_n=${encodeURIComponent(questionN)}`;

  const response = await fetch(url);
  if (!response.ok) {
    return NextResponse.json({ error: "Backend error" }, { status: response.status });
  }

  const data = await response.json();
  return NextResponse.json(data);
}
