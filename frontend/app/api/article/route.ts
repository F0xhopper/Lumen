import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partId   = searchParams.get("part_id");
    const questionN = searchParams.get("question_n");
    const articleN  = searchParams.get("article_n");

    if (!partId || !questionN || !articleN) {
      return NextResponse.json({ error: "part_id, question_n and article_n required" }, { status: 400 });
    }

    const response = await fetch(
      `${BACKEND}/articles/${encodeURIComponent(partId)}/${questionN}/${articleN}`,
    );
    if (!response.ok) return NextResponse.json(null, { status: response.status });
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json(null, { status: 500 });
  }
}
