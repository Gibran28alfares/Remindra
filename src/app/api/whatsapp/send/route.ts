import { NextResponse } from "next/server";
import { markWhatsappFailed, markWhatsappSending, markWhatsappSent, queueWhatsappReminder } from "@/lib/db";

type WhatsAppSendResponse = {
  messages?: Array<{ id?: string }>;
  error?: { message?: string };
};

export async function POST(request: Request) {
  let reminderId = 0;
  let logId = 0;

  try {
    const body = (await request.json()) as { reminder_id?: number; override?: boolean };
    reminderId = Number(body.reminder_id);
    if (!reminderId) {
      return NextResponse.json({ error: "ID reminder wajib diisi." }, { status: 400 });
    }

    const queued = await queueWhatsappReminder(reminderId, Boolean(body.override));
    logId = queued.log.id;
    await markWhatsappSending(reminderId, logId);

    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";

    if (!token || !phoneNumberId) {
      const failed = await markWhatsappFailed(reminderId, logId, "WhatsApp Cloud API belum dikonfigurasi.");
      return NextResponse.json({ error: "WhatsApp Cloud API belum dikonfigurasi.", ...failed }, { status: 400 });
    }

    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: queued.log.phone_number,
        type: "text",
        text: {
          preview_url: false,
          body: queued.log.message
        }
      })
    });

    const result = (await response.json()) as WhatsAppSendResponse;
    const waMessageId = result.messages?.[0]?.id ?? "";
    if (!response.ok || !waMessageId) {
      const errorMessage = result.error?.message ?? "WhatsApp API gagal mengirim pesan.";
      const failed = await markWhatsappFailed(reminderId, logId, errorMessage);
      return NextResponse.json({ error: errorMessage, ...failed }, { status: 400 });
    }

    const sent = await markWhatsappSent(reminderId, logId, waMessageId);
    return NextResponse.json(sent);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengirim WhatsApp.";
    if (reminderId && logId) {
      await markWhatsappFailed(reminderId, logId, message);
    }
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
