import { NextResponse } from "next/server";
import { getAppData } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getAppData());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load data.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
