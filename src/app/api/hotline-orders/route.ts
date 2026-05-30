import { NextResponse } from "next/server";
import { createHotlineOrder, deleteHotlineOrder, updateHotlineOrder, updateHotlineStatus } from "@/lib/db";
import type { FollowUpStatus, HotlineOrderInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as HotlineOrderInput;
    const order = await createHotlineOrder(input);
    return NextResponse.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan Hotline Order.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: number; status?: string; follow_up_status?: FollowUpStatus; input?: HotlineOrderInput };
    if (!body.id) {
      return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });
    }
    if (!body.input && !body.status) {
      return NextResponse.json({ error: "Status atau data update wajib diisi." }, { status: 400 });
    }
    const order = body.input ? await updateHotlineOrder(body.id, body.input) : await updateHotlineStatus(body.id, body.status ?? "", body.follow_up_status);
    return NextResponse.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui Hotline Order.";
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
    await deleteHotlineOrder(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menghapus Hotline Order.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
