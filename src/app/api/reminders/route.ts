import { NextResponse } from "next/server";
import { updateReminderStatus } from "@/lib/db";
import type { ReminderStatus } from "@/lib/types";

export async function PATCH(request: Request) {
  const body = (await request.json()) as { id?: number; status?: ReminderStatus };
  if (!body.id || !body.status) {
    return NextResponse.json({ error: "ID dan status reminder wajib diisi." }, { status: 400 });
  }
  try {
    const reminder = await updateReminderStatus(body.id, body.status);
    return NextResponse.json({ reminder });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui reminder.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
