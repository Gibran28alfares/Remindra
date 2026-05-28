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
  TemplateType
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

  const [hotlines, recommendations, reminders, templates] = await Promise.all([
    supabase.from("hotline_orders").select("*").order("created_at", { ascending: false }),
    supabase.from("mechanic_recommendations").select("*").order("created_at", { ascending: false }),
    supabase.from("reminder_tasks").select("*").order("due_date", { ascending: true }).order("created_at", { ascending: false }),
    supabase.from("message_templates").select("*").order("type", { ascending: true })
  ]);

  throwIfError(hotlines.error);
  throwIfError(recommendations.error);
  throwIfError(reminders.error);
  throwIfError(templates.error);

  return {
    hotlines: ((hotlines.data ?? []) as HotlineOrder[]).map(normalizeHotlineRow),
    recommendations: (recommendations.data ?? []) as MechanicRecommendation[],
    reminders: (reminders.data ?? []) as ReminderTask[],
    templates: (templates.data ?? []) as MessageTemplate[]
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

function nextMonthISO(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 1));
  return date.toISOString().slice(0, 10);
}
