import { NextResponse } from "next/server";
import { parseHotlineOrders } from "@/lib/parser";

export async function POST(request: Request) {
  const body = (await request.json()) as { text?: string | string[] };
  const text = Array.isArray(body.text) ? body.text.join("\n").trim() : typeof body.text === "string" ? body.text.trim() : "";

  if (!text) {
    return NextResponse.json({ error: "Teks Portal HO masih kosong." }, { status: 400 });
  }

  return NextResponse.json(parseHotlineOrders(text));
}
