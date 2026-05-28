import { NextResponse } from "next/server";
import { updateTemplate } from "@/lib/db";
import type { TemplateType } from "@/lib/types";

export async function PUT(request: Request) {
  const body = (await request.json()) as { type?: TemplateType; body?: string };
  if (!body.type || !body.body?.trim()) {
    return NextResponse.json({ error: "Tipe dan isi template wajib diisi." }, { status: 400 });
  }
  try {
    const template = await updateTemplate(body.type, body.body);
    return NextResponse.json({ template });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan template.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
