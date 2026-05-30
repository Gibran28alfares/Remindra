import { NextResponse } from "next/server";
import { createRecommendation, deleteRecommendation, updateRecommendation } from "@/lib/db";
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

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: number; input?: MechanicRecommendationInput };
    if (!body.id || !body.input) {
      return NextResponse.json({ error: "ID dan data update wajib diisi." }, { status: 400 });
    }
    const recommendation = await updateRecommendation(body.id, body.input);
    return NextResponse.json({ recommendation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui saran mekanik.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });
    }
    await deleteRecommendation(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menghapus saran mekanik.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
