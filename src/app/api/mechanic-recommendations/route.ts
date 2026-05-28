import { NextResponse } from "next/server";
import { createRecommendation } from "@/lib/db";
import type { MechanicRecommendationInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as MechanicRecommendationInput;
    const recommendation = await createRecommendation(input);
    return NextResponse.json({ recommendation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan saran mekanik.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
