import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partId    = searchParams.get("part_id");
  const questionN = searchParams.get("question_n");

  if (!partId || !questionN) {
    return NextResponse.json({ error: "part_id and question_n required" }, { status: 400 });
  }

  const response = await fetch(
    `${BACKEND}/articles/?part_id=${encodeURIComponent(partId)}&question_n=${encodeURIComponent(questionN)}`,
  );
  if (!response.ok) return NextResponse.json({ error: "Backend error" }, { status: response.status });
  return NextResponse.json(await response.json());
}
