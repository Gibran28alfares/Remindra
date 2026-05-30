import type {
  AppData,
  FollowUpStatus,
  HotlineOrder,
  HotlineOrderInput,
  MechanicRecommendation,
  MechanicRecommendationInput,
  MessageTemplate,
  ReminderStatus,
  ReminderTask,
  TemplateType,
  WhatsappDeliveryStatus,
  WhatsappMessageLog
} from "@/lib/types";
import { todayISO } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";

const defaultTemplates: Record<TemplateType, { name: string; body: string }> = {
  hotline_arrived: {
    name: "Hotline Order Tiba",
    body:
      "Halo {{nama_konsumen}}, pesanan part {{nama_part}} ({{no_part}}) dengan PO {{no_po_dealer}} sudah tiba di AHASS Sanprima. Silakan datang ke bengkel agar kami bisa bantu proses pemasangannya. Terima kasih."
  },
  mechanic_follow_up: {
    name: "Saran Mekanik",
    body:
      "Halo {{nama_konsumen}}, kami ingin mengingatkan rekomendasi mekanik untuk {{rekomendasi_mekanik}} pada kendaraan {{vehicle_info}}. Estimasi follow-up: {{tanggal_follow_up}}. Silakan hubungi AHASS Sanprima bila ingin kami bantu jadwalkan."
  }
};

export async function getAppData(): Promise<AppData> {
  const { supabase } = await requireUser();
  await ensureDefaultTemplates();

  const [hotlines, recommendations, reminders, templates, whatsappLogs] = await Promise.all([
    supabase.from("hotline_orders").select("*").order("created_at", { ascending: false }),
    supabase.from("mechanic_recommendations").select("*").order("created_at", { ascending: false }),
    supabase.from("reminder_tasks").select("*").order("due_date", { ascending: true }).order("created_at", { ascending: false }),
    supabase.from("message_templates").select("*").order("type", { ascending: true }),
    supabase.from("whatsapp_message_logs").select("*").order("created_at", { ascending: false }).limit(100)
  ]);

  throwIfError(hotlines.error);
  throwIfError(recommendations.error);
  throwIfError(reminders.error);
  throwIfError(templates.error);
  if (whatsappLogs.error && !isMissingRelationError(whatsappLogs.error)) {
    throwIfError(whatsappLogs.error);
  }

  return {
    hotlines: ((hotlines.data ?? []) as HotlineOrder[]).map(normalizeHotlineRow),
    recommendations: (recommendations.data ?? []) as MechanicRecommendation[],
    reminders: (reminders.data ?? []) as ReminderTask[],
    templates: (templates.data ?? []) as MessageTemplate[],
    whatsapp_logs: whatsappLogs.error ? [] : ((whatsappLogs.data ?? []) as WhatsappMessageLog[]).map(normalizeWhatsappLogRow)
  };
}

export async function createHotlineOrder(input: HotlineOrderInput) {
  const { supabase } = await requireUser();
  const row = normalizeHotlineInput(input);
  const { data, error } = await supabase.from("hotline_orders").insert(row).select("*").single();
  throwIfError(error);

  const order = normalizeHotlineRow(data as HotlineOrder);
  if (order.status === "Arrived") {
    await upsertHotlineReminder(order);
  }
  return order;
}

export async function updateHotlineStatus(id: number, status: string, followUpStatus?: FollowUpStatus) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("hotline_orders")
    .update({ status, ...(followUpStatus ? { follow_up_status: followUpStatus } : {}), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  throwIfError(error);

  const order = normalizeHotlineRow(data as HotlineOrder);
  if (order.status === "Arrived") {
    await upsertHotlineReminder(order);
  }
  return order;
}

export async function updateHotlineOrder(id: number, input: HotlineOrderInput) {
  const { supabase } = await requireUser();
  const row = { ...normalizeHotlineInput(input), updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("hotline_orders").update(row).eq("id", id).select("*").single();
  throwIfError(error);

  const order = normalizeHotlineRow(data as HotlineOrder);
  if (order.status === "Arrived") {
    await upsertHotlineReminder(order);
  } else {
    await deleteReminderBySource("hotline", order.id);
  }
  return order;
}

export async function deleteHotlineOrder(id: number) {
  const { supabase } = await requireUser();
  await deleteReminderBySource("hotline", id);
  const { error } = await supabase.from("hotline_orders").delete().eq("id", id);
  throwIfError(error);
}

export async function createRecommendation(input: MechanicRecommendationInput) {
  const { supabase } = await requireUser();
  const row = {
    ...input,
    estimated_value: Number(input.estimated_value) || 0,
    status: input.status || "pending"
  };
  const { data, error } = await supabase.from("mechanic_recommendations").insert(row).select("*").single();
  throwIfError(error);

  const recommendation = data as MechanicRecommendation;
  await upsertMechanicReminder(recommendation);
  return recommendation;
}

export async function updateRecommendation(id: number, input: MechanicRecommendationInput) {
  const { supabase } = await requireUser();
  const row = {
    ...input,
    estimated_value: Number(input.estimated_value) || 0,
    status: input.status || "pending",
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from("mechanic_recommendations").update(row).eq("id", id).select("*").single();
  throwIfError(error);

  const recommendation = data as MechanicRecommendation;
  await upsertMechanicReminder(recommendation);
  return recommendation;
}

export async function deleteRecommendation(id: number) {
  const { supabase } = await requireUser();
  await deleteReminderBySource("mechanic", id);
  const { error } = await supabase.from("mechanic_recommendations").delete().eq("id", id);
  throwIfError(error);
}

export async function updateReminderStatus(id: number, status: ReminderStatus) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("reminder_tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  throwIfError(error);
  return data as ReminderTask;
}

export async function queueWhatsappReminder(id: number, override = false) {
  const { supabase } = await requireUser();
  const reminder = await getReminderById(id);
  await assertReminderCanSend(reminder, override);

  const now = new Date().toISOString();
  const [{ data: updatedReminder, error: reminderError }, { data: log, error: logError }] = await Promise.all([
    supabase.from("reminder_tasks").update({ status: "queued", updated_at: now }).eq("id", id).select("*").single(),
    supabase
      .from("whatsapp_message_logs")
      .insert({
        reminder_id: reminder.id,
        source_type: reminder.source_type,
        source_id: reminder.source_id,
        phone_number: normalizeWhatsappPhone(reminder.phone_number),
        message: reminder.message,
        delivery_status: "queued",
        updated_at: now
      })
      .select("*")
      .single()
  ]);
  throwIfError(reminderError);
  throwIfError(logError);

  return {
    reminder: updatedReminder as ReminderTask,
    log: normalizeWhatsappLogRow(log as WhatsappMessageLog)
  };
}

export async function markWhatsappSending(reminderId: number, logId: number) {
  const { supabase } = await requireUser();
  const now = new Date().toISOString();
  const [reminderResult, logResult] = await Promise.all([
    supabase.from("reminder_tasks").update({ status: "sending", updated_at: now }).eq("id", reminderId).select("*").single(),
    supabase.from("whatsapp_message_logs").update({ delivery_status: "sending", updated_at: now }).eq("id", logId).select("*").single()
  ]);
  throwIfError(reminderResult.error);
  throwIfError(logResult.error);
  return {
    reminder: reminderResult.data as ReminderTask,
    log: normalizeWhatsappLogRow(logResult.data as WhatsappMessageLog)
  };
}

export async function markWhatsappSent(reminderId: number, logId: number, waMessageId: string) {
  const { supabase } = await requireUser();
  const now = new Date().toISOString();
  const reminder = await getReminderById(reminderId);
  const [reminderResult, logResult] = await Promise.all([
    supabase.from("reminder_tasks").update({ status: "sent", updated_at: now }).eq("id", reminderId).select("*").single(),
    supabase
      .from("whatsapp_message_logs")
      .update({ delivery_status: "sent", wa_message_id: waMessageId, sent_at: now, updated_at: now })
      .eq("id", logId)
      .select("*")
      .single()
  ]);
  throwIfError(reminderResult.error);
  throwIfError(logResult.error);
  await markSourceFollowedUp(reminder);
  return {
    reminder: reminderResult.data as ReminderTask,
    log: normalizeWhatsappLogRow(logResult.data as WhatsappMessageLog)
  };
}

export async function markWhatsappFailed(reminderId: number, logId: number, errorMessage: string) {
  const { supabase } = await requireUser();
  const now = new Date().toISOString();
  const [reminderResult, logResult] = await Promise.all([
    supabase.from("reminder_tasks").update({ status: "failed", updated_at: now }).eq("id", reminderId).select("*").single(),
    supabase
      .from("whatsapp_message_logs")
      .update({ delivery_status: "failed", error_message: errorMessage, failed_at: now, updated_at: now })
      .eq("id", logId)
      .select("*")
      .single()
  ]);
  throwIfError(reminderResult.error);
  throwIfError(logResult.error);
  return {
    reminder: reminderResult.data as ReminderTask,
    log: normalizeWhatsappLogRow(logResult.data as WhatsappMessageLog)
  };
}

export async function updateWhatsappDeliveryByMessageId(waMessageId: string, deliveryStatus: WhatsappDeliveryStatus, errorMessage = "") {
  const { supabase } = await requireUser();
  const now = new Date().toISOString();
  const timestampField = deliveryStatus === "delivered" ? { delivered_at: now } : deliveryStatus === "read" ? { read_at: now } : deliveryStatus === "failed" ? { failed_at: now } : {};
  const { data: log, error: logError } = await supabase
    .from("whatsapp_message_logs")
    .update({ delivery_status: deliveryStatus, error_message: errorMessage, updated_at: now, ...timestampField })
    .eq("wa_message_id", waMessageId)
    .select("*")
    .single();
  throwIfError(logError);

  const normalizedLog = normalizeWhatsappLogRow(log as WhatsappMessageLog);
  if (normalizedLog.reminder_id && ["delivered", "read", "failed"].includes(deliveryStatus)) {
    const { error: reminderError } = await supabase.from("reminder_tasks").update({ status: deliveryStatus, updated_at: now }).eq("id", normalizedLog.reminder_id);
    throwIfError(reminderError);
  }
  return normalizedLog;
}

export async function updateTemplate(type: TemplateType, body: string) {
  const { supabase } = await requireUser();
  await ensureDefaultTemplates();
  const { data, error } = await supabase
    .from("message_templates")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("type", type)
    .select("*")
    .single();
  throwIfError(error);
  await refreshReminderMessages();
  return data as MessageTemplate;
}

export async function getMonthlyHotlines(month: string) {
  const { supabase } = await requireUser();
  const start = `${month}-01`;
  const end = nextMonthISO(month);
  const { data, error } = await supabase
    .from("hotline_orders")
    .select("*")
    .gte("po_date", start)
    .lt("po_date", end)
    .order("po_date", { ascending: true })
    .order("id", { ascending: true });
  throwIfError(error);
  return ((data ?? []) as HotlineOrder[]).map(normalizeHotlineRow);
}

function normalizeHotlineInput(input: HotlineOrderInput) {
  return {
    ...input,
    po_date: input.po_date || todayISO(),
    eta_revision: input.eta_revision || null,
    eta_earliest: input.eta_earliest || null,
    eta_latest: input.eta_latest || null,
    portal_status: input.portal_status || "",
    progress_percent: input.progress_percent || "",
    order_qty: Number(input.order_qty) || 0,
    engine_number: input.engine_number || "",
    frame_number: input.frame_number || "",
    plate_number: input.plate_number || "",
    vehicle_type: input.vehicle_type || "",
    price: Number(input.price) || 0,
    follow_up_status: input.follow_up_status || "pending"
  };
}

function normalizeHotlineRow(order: HotlineOrder): HotlineOrder {
  return {
    ...order,
    eta_revision: order.eta_revision ?? "",
    eta_earliest: order.eta_earliest ?? "",
    eta_latest: order.eta_latest ?? "",
    portal_status: order.portal_status ?? "",
    progress_percent: order.progress_percent ?? "",
    engine_number: order.engine_number ?? "",
    frame_number: order.frame_number ?? "",
    plate_number: order.plate_number ?? "",
    vehicle_type: order.vehicle_type ?? ""
  };
}

function normalizeWhatsappLogRow(log: WhatsappMessageLog): WhatsappMessageLog {
  return {
    ...log,
    reminder_id: log.reminder_id ?? null,
    wa_message_id: log.wa_message_id ?? "",
    error_message: log.error_message ?? "",
    sent_at: log.sent_at ?? "",
    delivered_at: log.delivered_at ?? "",
    read_at: log.read_at ?? "",
    failed_at: log.failed_at ?? ""
  };
}

function normalizeWhatsappPhone(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }
  return digits;
}

async function getReminderById(id: number) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("reminder_tasks").select("*").eq("id", id).single();
  throwIfError(error);
  return data as ReminderTask;
}

async function assertReminderCanSend(reminder: ReminderTask, override: boolean) {
  const { supabase } = await requireUser();

  if (reminder.source_type === "hotline") {
    const { data, error } = await supabase.from("hotline_orders").select("status").eq("id", reminder.source_id).single();
    throwIfError(error);
    if ((data as Pick<HotlineOrder, "status">).status !== "Arrived") {
      throw new Error("Pesan Hotline Order hanya bisa dikirim otomatis saat status Arrived.");
    }
    return;
  }

  if (!override && reminder.due_date > todayISO()) {
    throw new Error("Tanggal follow-up WO belum jatuh tempo. Gunakan override manual bila tetap ingin mengirim.");
  }
}

async function markSourceFollowedUp(reminder: ReminderTask) {
  const { supabase } = await requireUser();
  const now = new Date().toISOString();

  if (reminder.source_type === "hotline") {
    const { error } = await supabase.from("hotline_orders").update({ follow_up_status: "sent", updated_at: now }).eq("id", reminder.source_id);
    throwIfError(error);
    return;
  }

  const { error } = await supabase.from("mechanic_recommendations").update({ status: "sent", updated_at: now }).eq("id", reminder.source_id);
  throwIfError(error);
}

async function ensureDefaultTemplates() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("message_templates").select("type");
  throwIfError(error);

  const existing = new Set((data ?? []).map((template) => template.type as TemplateType));
  const missing = Object.entries(defaultTemplates)
    .filter(([type]) => !existing.has(type as TemplateType))
    .map(([type, template]) => ({
      type,
      name: template.name,
      body: template.body
    }));

  if (missing.length) {
    const { error: insertError } = await supabase.from("message_templates").insert(missing);
    throwIfError(insertError);
  }
}

async function getTemplate(type: TemplateType) {
  const { supabase } = await requireUser();
  await ensureDefaultTemplates();
  const { data, error } = await supabase.from("message_templates").select("*").eq("type", type).single();
  throwIfError(error);
  return data as MessageTemplate;
}

async function upsertHotlineReminder(order: HotlineOrder) {
  const template = await getTemplate("hotline_arrived");
  const message = renderTemplate(template.body, {
    nama_konsumen: order.customer_name,
    no_po_dealer: order.dealer_po_number,
    nama_part: order.part_name || order.part_number,
    no_part: order.part_number,
    eta: order.eta_revision,
    status: order.status,
    portal_status: order.portal_status
  });
  await upsertReminder("hotline", order.id, order.customer_name, order.phone_number, message, todayISO());
}

async function upsertMechanicReminder(recommendation: MechanicRecommendation) {
  const template = await getTemplate("mechanic_follow_up");
  const message = renderTemplate(template.body, {
    nama_konsumen: recommendation.customer_name,
    rekomendasi_mekanik: recommendation.recommendation,
    tanggal_follow_up: recommendation.follow_up_date,
    vehicle_info: recommendation.vehicle_info,
    component: recommendation.component
  });
  await upsertReminder("mechanic", recommendation.id, recommendation.customer_name, recommendation.phone_number, message, recommendation.follow_up_date);
}

async function upsertReminder(sourceType: string, sourceId: number, customerName: string, phoneNumber: string, message: string, dueDate: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("reminder_tasks").upsert(
    {
      source_type: sourceType,
      source_id: sourceId,
      customer_name: customerName,
      phone_number: phoneNumber,
      message,
      due_date: dueDate,
      status: "pending",
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,source_type,source_id" }
  );
  throwIfError(error);
}

async function deleteReminderBySource(sourceType: string, sourceId: number) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("reminder_tasks").delete().eq("source_type", sourceType).eq("source_id", sourceId);
  throwIfError(error);
}

async function refreshReminderMessages() {
  const { supabase } = await requireUser();
  const [{ data: hotlines, error: hotlineError }, { data: recommendations, error: recommendationError }] = await Promise.all([
    supabase.from("hotline_orders").select("*").eq("status", "Arrived"),
    supabase.from("mechanic_recommendations").select("*")
  ]);
  throwIfError(hotlineError);
  throwIfError(recommendationError);

  for (const order of (hotlines ?? []) as HotlineOrder[]) {
    await upsertHotlineReminder(order);
  }
  for (const recommendation of (recommendations ?? []) as MechanicRecommendation[]) {
    await upsertMechanicReminder(recommendation);
  }
}

function renderTemplate(body: string, values: Record<string, string>) {
  return body.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_, key: string) => values[key] ?? "");
}

function throwIfError(error: { message?: string } | null) {
  if (error) {
    throw new Error(error.message ?? "Supabase request failed.");
  }
}

function isMissingRelationError(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("does not exist") || error?.message?.includes("Could not find the table"));
}

function nextMonthISO(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 1));
  return date.toISOString().slice(0, 10);
}
