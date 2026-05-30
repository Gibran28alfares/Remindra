import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { WhatsappDeliveryStatus, WhatsappMessageLog } from "@/lib/types";

type WhatsappStatusPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: Array<{
          id?: string;
          status?: string;
          errors?: Array<{ message?: string; title?: string }>;
        }>;
      };
    }>;
  }>;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Webhook verification failed." }, { status: 403 });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as WhatsappStatusPayload;
    const statuses = extractStatuses(payload);
    if (!statuses.length) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createAdminClient();
    for (const status of statuses) {
      const deliveryStatus = mapWhatsappStatus(status.status);
      if (!status.id || !deliveryStatus) {
        continue;
      }

      const errorMessage = status.errors?.[0]?.message ?? status.errors?.[0]?.title ?? "";
      const now = new Date().toISOString();
      const timestampField =
        deliveryStatus === "delivered" ? { delivered_at: now } : deliveryStatus === "read" ? { read_at: now } : deliveryStatus === "failed" ? { failed_at: now } : {};

      const { data: log, error: logError } = await supabase
        .from("whatsapp_message_logs")
        .update({ delivery_status: deliveryStatus, error_message: errorMessage, updated_at: now, ...timestampField })
        .eq("wa_message_id", status.id)
        .select("*")
        .single();

      if (logError || !log) {
        continue;
      }

      const reminderStatus = deliveryStatus === "failed" ? "failed" : deliveryStatus;
      const reminderId = (log as WhatsappMessageLog).reminder_id;
      if (reminderId && ["delivered", "read", "failed"].includes(reminderStatus)) {
        await supabase.from("reminder_tasks").update({ status: reminderStatus, updated_at: now }).eq("id", reminderId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memproses webhook WhatsApp.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function extractStatuses(payload: WhatsappStatusPayload) {
  return (payload.entry ?? []).flatMap((entry) => (entry.changes ?? []).flatMap((change) => change.value?.statuses ?? []));
}

function mapWhatsappStatus(status?: string): WhatsappDeliveryStatus | null {
  if (status === "sent" || status === "delivered" || status === "read" || status === "failed") {
    return status;
  }
  return null;
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY wajib dipasang untuk WhatsApp webhook.");
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}
