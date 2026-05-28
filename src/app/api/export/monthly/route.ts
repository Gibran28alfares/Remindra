import { NextResponse } from "next/server";
import { getMonthlyHotlines } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const orders = await getMonthlyHotlines(month);
    const rows = [
      ["No", "No PO Dealer", "Tgl PO", "Nama Konsumen", "No Tlp", "No Part", "Nama Part", "Qty", "Price", "ETA Revisi", "Status Portal", "Status REMINDRA"],
      ...orders.map((order, index) => [
        String(index + 1),
        order.dealer_po_number,
        order.po_date,
        order.customer_name,
        order.phone_number,
        order.part_number,
        order.part_name,
        String(order.order_qty),
        String(order.price),
        order.eta_revision,
        order.portal_status,
        order.status
      ])
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="remindra-rekap-${month}.csv"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat export bulanan.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}

function escapeCsv(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
