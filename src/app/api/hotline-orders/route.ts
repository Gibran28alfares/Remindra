import { NextResponse } from "next/server";
import { createHotlineOrder, updateHotlineStatus } from "@/lib/db";
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
    const body = (await request.json()) as { id?: number; status?: string; follow_up_status?: FollowUpStatus };
    if (!body.id || !body.status) {
      return NextResponse.json({ error: "ID dan status wajib diisi." }, { status: 400 });
    }
    const order = await updateHotlineStatus(body.id, body.status, body.follow_up_status);
    return NextResponse.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui Hotline Order.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
