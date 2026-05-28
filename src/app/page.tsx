"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Clipboard,
  Cloud,
  Database,
  FileDown,
  Gauge,
  LogOut,
  MessageSquareText,
  RefreshCw,
  Save,
  Settings,
  Wrench
} from "lucide-react";
import type {
  AppData,
  FollowUpStatus,
  HotlineOrder,
  HotlineOrderInput,
  HotlineStatus,
  MechanicRecommendationInput,
  ParsedHotlineOrder,
  ReminderStatus,
  ReminderTask,
  TemplateType
} from "@/lib/types";
import { formatCurrency, parseMoney, todayISO } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const hotlineStatuses: HotlineStatus[] = ["Booked", "Arrived", "Followed Up", "Converted", "Cancelled"];
const reminderStatuses: ReminderStatus[] = ["pending", "copied", "followed_up", "converted", "cancelled"];

const emptyHotline: HotlineOrderInput = {
  dealer_po_number: "",
  po_date: todayISO(),
  customer_name: "",
  phone_number: "",
  part_number: "",
  part_name: "",
  eta_revision: todayISO(),
  eta_earliest: "",
  eta_latest: "",
  portal_status: "",
  progress_percent: "",
  order_qty: 0,
  engine_number: "",
  frame_number: "",
  plate_number: "",
  vehicle_type: "",
  price: 0,
  status: "Booked",
  follow_up_status: "pending"
};

type ParsedHotlineRow = ParsedHotlineOrder & { selected: boolean };

const emptyParsedHotline = (): ParsedHotlineRow => ({
  parse_id: `manual-${Date.now()}`,
  selected: true,
  ...emptyHotline
});

const emptyRecommendation: MechanicRecommendationInput = {
  customer_name: "",
  phone_number: "",
  vehicle_info: "",
  component: "V-Belt",
  recommendation: "",
  follow_up_date: todayISO(),
  estimated_value: 0,
  status: "pending"
};

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<AppData>({ hotlines: [], recommendations: [], reminders: [], templates: [] });
  const [loading, setLoading] = useState(true);
  const [rawPortalText, setRawPortalText] = useState("");
  const [parserLoading, setParserLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [parsedHotlines, setParsedHotlines] = useState<ParsedHotlineRow[]>([emptyParsedHotline()]);
  const [parserWarnings, setParserWarnings] = useState<string[]>([]);
  const [recommendationForm, setRecommendationForm] = useState<MechanicRecommendationInput>(emptyRecommendation);
  const [month, setMonth] = useState(todayISO().slice(0, 7));

  const metrics = useMemo(() => {
    const activeHotlines = data.hotlines.filter((order) => !["Converted", "Cancelled"].includes(order.status)).length;
    const pendingReminders = data.reminders.filter((reminder) => reminder.status === "pending").length;
    const followedUp = data.reminders.filter((reminder) => ["copied", "followed_up", "converted"].includes(reminder.status)).length;
    const converted = data.reminders.filter((reminder) => reminder.status === "converted").length;
    const totalReminder = data.reminders.length || 1;
    const hoValue = data.hotlines.reduce((total, order) => total + order.price, 0);
    const woValue = data.recommendations.reduce((total, item) => total + item.estimated_value, 0);
    return {
      activeHotlines,
      pendingReminders,
      followedUp,
      conversionRate: Math.round((converted / totalReminder) * 100),
      savedRevenue: hoValue + woValue
    };
  }, [data]);

  const monthlyOrders = useMemo(() => data.hotlines.filter((order) => order.po_date.startsWith(month)), [data.hotlines, month]);
  const monthlyTotal = monthlyOrders.reduce((total, order) => total + order.price, 0);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const response = await fetch("/api/data", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) {
      setFeedback(result.error ?? "Gagal memuat data cloud.");
      setLoading(false);
      return;
    }
    setData(result);
    setLoading(false);
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function parseHotline() {
    setParserLoading(true);
    setFeedback("");
    const response = await fetch("/api/parse-hotline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rawPortalText })
    });
    const result = await response.json();
    setParserLoading(false);

    if (!response.ok) {
      setFeedback(result.error ?? "Parser gagal. Gunakan input manual.");
      return;
    }

    const rows = ((result.parsedOrders ?? []) as ParsedHotlineOrder[]).map((order) => ({ ...order, selected: true }));
    setParsedHotlines(rows.length ? rows : [emptyParsedHotline()]);
    setParserWarnings(result.warnings ?? []);
    setFeedback(`Parser V2 selesai: ${rows.length} item part ditemukan. Periksa sebelum simpan.`);
  }

  function updateParsedHotline(parseId: string, patch: Partial<ParsedHotlineRow>) {
    setParsedHotlines((current) => current.map((order) => (order.parse_id === parseId ? { ...order, ...patch } : order)));
  }

  async function saveParsedHotlines() {
    const selectedRows = parsedHotlines.filter((order) => order.selected);
    if (!selectedRows.length) {
      setFeedback("Pilih minimal satu item part untuk disimpan.");
      return;
    }

    for (const row of selectedRows) {
      const { parse_id, selected, ...input } = row;
      const response = await fetch("/api/hotline-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const result = await response.json();
      if (!response.ok) {
        setFeedback(result.error ?? `Gagal menyimpan ${row.part_number || row.dealer_po_number}.`);
        return;
      }
    }

    setFeedback(`${selectedRows.length} item Hotline Order tersimpan.`);
    setParsedHotlines([emptyParsedHotline()]);
    setParserWarnings([]);
    setRawPortalText("");
    await loadData();
  }

  async function updateHotline(order: HotlineOrder, status: HotlineStatus, followUpStatus?: FollowUpStatus) {
    await fetch("/api/hotline-orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id, status, follow_up_status: followUpStatus })
    });
    await loadData();
  }

  async function saveRecommendation() {
    const response = await fetch("/api/mechanic-recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recommendationForm)
    });
    const result = await response.json();
    if (!response.ok) {
      setFeedback(result.error ?? "Gagal menyimpan saran mekanik.");
      return;
    }
    setFeedback("Saran mekanik masuk antrean reminder.");
    setRecommendationForm(emptyRecommendation);
    await loadData();
  }

  async function copyReminder(reminder: ReminderTask) {
    await navigator.clipboard.writeText(reminder.message);
    await updateReminder(reminder.id, "copied");
    setFeedback(`Pesan untuk ${reminder.customer_name} disalin.`);
  }

  async function updateReminder(id: number, status: ReminderStatus) {
    await fetch("/api/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    });
    await loadData();
  }

  async function saveTemplate(type: TemplateType, body: string) {
    await fetch("/api/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, body })
    });
    setFeedback("Template disimpan dan reminder diperbarui.");
    await loadData();
  }

  return (
    <main className="min-h-screen bg-slate-100 text-ink">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
              <Activity size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-normal text-ink md:text-2xl">REMINDRA</h1>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Cloud v1</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">Retensi konsumen, Hotline Order, WO checklist, dan reminder AHASS.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill icon={<Cloud size={14} />} label="Supabase" value="Online" />
            <button className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" onClick={loadData}>
              <RefreshCw size={16} />
              Refresh
            </button>
            <button className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" onClick={signOut}>
              <LogOut size={16} />
              Keluar
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-5 px-4 py-5 lg:px-6">
        {feedback ? (
          <div className="rounded-md border border-brand/20 bg-white px-4 py-3 text-sm font-medium text-ink shadow-sm">
            <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-brand" />
            {feedback}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-5">
          <Metric icon={<Database size={18} />} label="HO aktif" value={String(metrics.activeHotlines)} tone="brand" />
          <Metric icon={<Bell size={18} />} label="Reminder pending" value={String(metrics.pendingReminders)} tone="amber" />
          <Metric icon={<Clipboard size={18} />} label="Follow-up/copy" value={String(metrics.followedUp)} tone="slate" />
          <Metric icon={<Gauge size={18} />} label="Konversi" value={`${metrics.conversionRate}%`} tone="blue" />
          <Metric icon={<FileDown size={18} />} label="Estimasi omzet" value={formatCurrency(metrics.savedRevenue)} tone="green" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <Panel title="Parser Hotline Order" icon={<Clipboard size={18} />}>
            <div className="grid gap-3">
              <textarea
                className="focus-ring min-h-40 rounded-md border border-line bg-slate-50 p-3 text-sm leading-6 shadow-inner placeholder:text-slate-400"
                placeholder="Paste teks Portal HO di sini..."
                value={rawPortalText}
                onChange={(event) => setRawPortalText(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60" onClick={parseHotline} disabled={parserLoading}>
                  <Clipboard size={16} />
                  {parserLoading ? "Memproses..." : "Proses Data"}
                </button>
                <button className="focus-ring min-h-10 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" onClick={() => setParsedHotlines([emptyParsedHotline()])}>
                  Input Manual
                </button>
              </div>
              {parserWarnings.length ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  <p className="font-semibold">Catatan parser</p>
                  <ul className="mt-1 list-disc pl-5">
                    {parserWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <ParsedHotlineList rows={parsedHotlines} onChange={updateParsedHotline} onSave={saveParsedHotlines} />
            </div>
          </Panel>

          <Panel title="Quick WO Checklist" icon={<Wrench size={18} />}>
            <div className="grid gap-3">
              <TextInput label="Nama konsumen" value={recommendationForm.customer_name} onChange={(customer_name) => setRecommendationForm({ ...recommendationForm, customer_name })} />
              <TextInput label="No telepon" value={recommendationForm.phone_number} onChange={(phone_number) => setRecommendationForm({ ...recommendationForm, phone_number })} />
              <TextInput label="Kendaraan" value={recommendationForm.vehicle_info} onChange={(vehicle_info) => setRecommendationForm({ ...recommendationForm, vehicle_info })} placeholder="Beat / Vario / rangka / nopol" />
              <SelectInput label="Komponen" value={recommendationForm.component} options={["V-Belt", "Ban", "Kampas Rem", "Oli", "Aki", "Lainnya"]} onChange={(component) => setRecommendationForm({ ...recommendationForm, component })} />
              <TextInput label="Rekomendasi mekanik" value={recommendationForm.recommendation} onChange={(recommendation) => setRecommendationForm({ ...recommendationForm, recommendation })} placeholder="Contoh: V-Belt mulai retak, sarankan ganti" />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput type="date" label="Tanggal follow-up" value={recommendationForm.follow_up_date} onChange={(follow_up_date) => setRecommendationForm({ ...recommendationForm, follow_up_date })} />
                <TextInput label="Estimasi nilai" value={String(recommendationForm.estimated_value || "")} onChange={(value) => setRecommendationForm({ ...recommendationForm, estimated_value: parseMoney(value) })} placeholder="Rp250.000" />
              </div>
              <button className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800" onClick={saveRecommendation}>
                <Save size={16} />
                Simpan Saran Mekanik
              </button>
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <Panel title="Monitor Hotline Order" icon={<Database size={18} />}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="py-2 pr-3">PO</th>
                    <th className="py-2 pr-3">Konsumen</th>
                    <th className="py-2 pr-3">Part</th>
                    <th className="py-2 pr-3">ETA / Portal</th>
                    <th className="py-2 pr-3">Harga</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hotlines.map((order) => (
                    <tr key={order.id} className="border-b border-line/70 hover:bg-slate-50">
                      <td className="py-2 pr-3 font-semibold">{order.dealer_po_number || "-"}</td>
                      <td className="py-2 pr-3">
                        <div className="font-medium">{order.customer_name}</div>
                        <div className="text-xs text-slate-500">{order.phone_number}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <div>{order.part_number}</div>
                        <div className="text-xs text-slate-500">
                          {order.part_name} {order.order_qty ? `x${order.order_qty}` : ""}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div>{order.eta_revision || "-"}</div>
                        <div className="text-xs text-slate-500">
                          {order.portal_status || "-"} {order.progress_percent ? ` / ${order.progress_percent}` : ""}
                        </div>
                      </td>
                      <td className="py-2 pr-3">{formatCurrency(order.price)}</td>
                      <td className="py-2 pr-3">
                        <select className="focus-ring rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold shadow-sm" value={order.status} onChange={(event) => updateHotline(order, event.target.value as HotlineStatus)}>
                          {hotlineStatuses.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.hotlines.length ? <EmptyState text="Belum ada Hotline Order." /> : null}
            </div>
          </Panel>

          <Panel title="Reminder WhatsApp" icon={<MessageSquareText size={18} />}>
            <div className="grid gap-3">
              {data.reminders.map((reminder) => (
                <article key={reminder.id} className="rounded-md border border-line bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{reminder.customer_name}</p>
                      <p className="text-xs text-slate-500">
                        {reminder.source_type} / jatuh tempo {reminder.due_date}
                      </p>
                    </div>
                    <Badge>{reminder.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6">{reminder.message}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="focus-ring min-h-9 rounded-md bg-brand px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-800" onClick={() => copyReminder(reminder)}>
                      Copy Pesan
                    </button>
                    <select className="focus-ring rounded-md border border-line bg-white px-2 py-1 text-xs shadow-sm" value={reminder.status} onChange={(event) => updateReminder(reminder.id, event.target.value as ReminderStatus)}>
                      {reminderStatuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
              {!data.reminders.length ? <EmptyState text="Belum ada reminder." /> : null}
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Panel title="Rekap Bulanan" icon={<FileDown size={18} />}>
            <div className="flex flex-wrap items-end gap-3">
              <TextInput type="month" label="Periode" value={month} onChange={setMonth} />
              <a className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800" href={`/api/export/monthly?month=${month}`}>
                <FileDown size={16} />
                Export CSV
              </a>
            </div>
            <p className="mt-3 text-sm font-semibold">Total periode: {formatCurrency(monthlyTotal)}</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3">No</th>
                    <th className="py-2 pr-3">PO</th>
                    <th className="py-2 pr-3">Tanggal</th>
                    <th className="py-2 pr-3">Konsumen</th>
                    <th className="py-2 pr-3">No Tlp</th>
                    <th className="py-2 pr-3">Part</th>
                    <th className="py-2 pr-3">Harga</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyOrders.map((order, index) => (
                    <tr key={order.id} className="border-b border-line/70 hover:bg-slate-50">
                      <td className="py-2 pr-3">{index + 1}</td>
                      <td className="py-2 pr-3">{order.dealer_po_number}</td>
                      <td className="py-2 pr-3">{order.po_date}</td>
                      <td className="py-2 pr-3">{order.customer_name}</td>
                      <td className="py-2 pr-3">{order.phone_number}</td>
                      <td className="py-2 pr-3">{order.part_number}</td>
                      <td className="py-2 pr-3">{formatCurrency(order.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!monthlyOrders.length ? <EmptyState text="Belum ada data di periode ini." /> : null}
            </div>
          </Panel>

          <Panel title="Settings Template" icon={<Settings size={18} />}>
            <div className="grid gap-3">
              {data.templates.map((template) => (
                <TemplateEditor key={template.id} name={template.name} body={template.body} onSave={(body) => saveTemplate(template.type, body)} />
              ))}
            </div>
          </Panel>
        </section>

        <p className="pb-3 text-center text-xs text-slate-500">{loading ? "Memuat data cloud..." : "REMINDRA cloud-ready. Parser Portal HO aktif, WhatsApp tetap mode copy pesan."}</p>
      </div>
    </main>
  );
}

function ParsedHotlineList({
  rows,
  onChange,
  onSave
}: {
  rows: ParsedHotlineRow[];
  onChange: (parseId: string, patch: Partial<ParsedHotlineRow>) => void;
  onSave: () => void;
}) {
  return (
    <div className="grid gap-3">
      {rows.map((value, index) => (
        <div key={value.parse_id} className="rounded-md border border-line bg-slate-50 p-3">
          <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              className="h-4 w-4 rounded border-line text-brand"
              type="checkbox"
              checked={value.selected}
              onChange={(event) => onChange(value.parse_id, { selected: event.target.checked })}
            />
            Item part #{index + 1}
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput label="No PO Dealer" value={value.dealer_po_number} onChange={(dealer_po_number) => onChange(value.parse_id, { dealer_po_number })} />
            <TextInput type="date" label="Tanggal PO" value={value.po_date} onChange={(po_date) => onChange(value.parse_id, { po_date })} />
            <TextInput label="Nama konsumen" value={value.customer_name} onChange={(customer_name) => onChange(value.parse_id, { customer_name })} />
            <TextInput label="No telepon" value={value.phone_number} onChange={(phone_number) => onChange(value.parse_id, { phone_number })} />
            <TextInput label="No part" value={value.part_number} onChange={(part_number) => onChange(value.parse_id, { part_number })} />
            <TextInput label="Nama part" value={value.part_name} onChange={(part_name) => onChange(value.parse_id, { part_name })} />
            <TextInput label="Qty order" value={String(value.order_qty || "")} onChange={(orderQty) => onChange(value.parse_id, { order_qty: Number(orderQty) || 0 })} />
            <TextInput label="Subtotal" value={String(value.price || "")} onChange={(price) => onChange(value.parse_id, { price: parseMoney(price) })} placeholder="Rp350.000" />
            <TextInput type="date" label="ETA tercepat" value={value.eta_earliest} onChange={(eta_earliest) => onChange(value.parse_id, { eta_earliest })} />
            <TextInput type="date" label="ETA terlama" value={value.eta_latest} onChange={(eta_latest) => onChange(value.parse_id, { eta_latest })} />
            <TextInput type="date" label="ETA revisi" value={value.eta_revision} onChange={(eta_revision) => onChange(value.parse_id, { eta_revision })} />
            <TextInput label="Progress portal" value={value.progress_percent} onChange={(progress_percent) => onChange(value.parse_id, { progress_percent })} />
            <TextInput label="Status portal" value={value.portal_status} onChange={(portal_status) => onChange(value.parse_id, { portal_status })} />
            <SelectInput label="Status REMINDRA" value={value.status} options={hotlineStatuses} onChange={(status) => onChange(value.parse_id, { status: status as HotlineStatus })} />
            <TextInput label="Nomor mesin" value={value.engine_number} onChange={(engine_number) => onChange(value.parse_id, { engine_number })} />
            <TextInput label="Nomor rangka" value={value.frame_number} onChange={(frame_number) => onChange(value.parse_id, { frame_number })} />
            <TextInput label="Nomor polisi" value={value.plate_number} onChange={(plate_number) => onChange(value.parse_id, { plate_number })} />
            <TextInput label="Tipe motor" value={value.vehicle_type} onChange={(vehicle_type) => onChange(value.parse_id, { vehicle_type })} />
          </div>
        </div>
      ))}
      <button className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-800" onClick={onSave}>
        <Save size={16} />
        Simpan Item Terpilih ke Database
      </button>
    </div>
  );
}

function TemplateEditor({ name, body, onSave }: { name: string; body: string; onSave: (body: string) => void }) {
  const [draft, setDraft] = useState(body);
  useEffect(() => setDraft(body), [body]);
  return (
    <div className="rounded-md border border-line bg-slate-50 p-3">
      <p className="mb-2 text-sm font-semibold">{name}</p>
      <textarea className="focus-ring min-h-24 w-full rounded-md border border-line bg-white p-3 text-sm leading-6 shadow-inner" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button className="focus-ring mt-2 min-h-9 rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50" onClick={() => onSave(draft)}>
        Simpan Template
      </button>
    </div>
  );
}

function Metric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: "brand" | "amber" | "slate" | "blue" | "green" }) {
  const toneClass = {
    brand: "bg-teal-50 text-teal-700 border-teal-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-sky-50 text-sky-700 border-sky-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100"
  }[tone];

  return (
    <div className="rounded-md border border-line bg-white p-4 shadow-sm">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-md border ${toneClass}`}>{icon}</div>
      <p className="mt-3 text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink">{value}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="text-brand">{icon}</span>
        <h2 className="text-base font-bold text-ink">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function TextInput({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-ink">
      {label}
      <input className="focus-ring min-h-10 rounded-md border border-line bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-ink">
      {label}
      <select className="focus-ring min-h-10 rounded-md border border-line bg-white px-3 py-2 text-sm shadow-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">{children}</span>;
}

function StatusPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
      <span className="text-brand">{icon}</span>
      <span>{label}</span>
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-line bg-slate-50 p-4 text-center text-sm text-slate-500">{text}</div>;
}
