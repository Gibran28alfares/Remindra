import type { HotlineOrderInput, HotlineStatus, ParseHotlineResult, ParsedHotlineOrder } from "@/lib/types";
import { normalizePhone, parseMoney, todayISO } from "@/lib/format";

interface HeaderData {
  dealer_po_number: string;
  po_date: string;
  customer_name: string;
  phone_number: string;
  engine_number: string;
  frame_number: string;
  plate_number: string;
  vehicle_type: string;
  dealer_status: string;
}

interface ItemOrderRow {
  part_number: string;
  part_name: string;
  order_qty: number;
  subtotal: number;
}

interface ItemDetailRow {
  part_number: string;
  eta_earliest: string;
  eta_latest: string;
  eta_revision: string;
  progress_percent: string;
  portal_status: string;
}

const knownLabels = [
  "Kode AHASS",
  "No Po Dealer",
  "Kode Dealer Md",
  "Tgl Po Dealer",
  "Nama AHASS",
  "Tgl Verifikasi Dealer",
  "Booking ID",
  "Nomor Mesin",
  "Nama Konsumen",
  "Warehouse",
  "Alamat Konsumen",
  "Kota",
  "Status",
  "Kode Pos",
  "Aktif",
  "No Tlp Konsumen",
  "Pengajuan",
  "Tipe Motor",
  "Kode Motor",
  "Flag Numbering",
  "Thn Rakit",
  "Claim C2",
  "No Claim:",
  "Email",
  "VOR (Vehicle of The Road)",
  "Nama Type",
  "Warna Motor",
  "Source",
  "Kecamatan",
  "Kelurahan",
  "Nomor Polisi",
  "Deskripsi Unit",
  "Kode Warna",
  "Nomor Rangka",
  "Keterangan Tambahan",
  "Down Payment"
];

const labelSet = new Set(knownLabels.map(normalizeKey));

export function normalizeRawPortalText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[“”]/g, '"')
    .split("\n")
    .map((line) => line.replace(/[^\S\t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseHotlineOrders(raw: string): ParseHotlineResult {
  const warnings: string[] = [];
  const normalized = normalizeRawPortalText(raw);
  const lines = normalized.split("\n").map((line) => line.trimEnd());
  const itemOrderIndex = findLineIndex(lines, /^Item Order\s*$/i);
  const detailIndex = findLineIndex(lines, /^Item Order Detail\s*$/i);
  const headerLines = lines.slice(0, itemOrderIndex >= 0 ? itemOrderIndex : lines.length);
  const header = extractHeaderData(headerLines);

  addMissingHeaderWarnings(header, warnings);

  const itemRows = itemOrderIndex >= 0 ? parseItemOrderSection(lines.slice(itemOrderIndex + 1, detailIndex >= 0 ? detailIndex : lines.length), warnings) : [];
  const detailRows = detailIndex >= 0 ? parseItemDetailSection(lines.slice(detailIndex + 1), warnings) : [];
  const detailByPart = new Map(detailRows.map((detail) => [detail.part_number, detail]));

  if (!itemRows.length) {
    warnings.push("Item Order tidak ditemukan atau tidak memiliki baris part yang valid.");
  }

  const parsedOrders = itemRows.map((item, index): ParsedHotlineOrder => {
    const detail = detailByPart.get(item.part_number);
    if (!detail) {
      warnings.push(`Item ${item.part_number} tidak memiliki pasangan di Item Order Detail.`);
    }

    const portalStatus = detail?.portal_status ?? "";
    return {
      parse_id: `${item.part_number}-${index}`,
      dealer_po_number: header.dealer_po_number,
      po_date: header.po_date || todayISO(),
      customer_name: header.customer_name,
      phone_number: header.phone_number,
      part_number: item.part_number,
      part_name: item.part_name,
      eta_revision: detail?.eta_revision || detail?.eta_latest || detail?.eta_earliest || "",
      eta_earliest: detail?.eta_earliest ?? "",
      eta_latest: detail?.eta_latest ?? "",
      portal_status: portalStatus,
      progress_percent: detail?.progress_percent ?? "",
      order_qty: item.order_qty,
      engine_number: header.engine_number,
      frame_number: header.frame_number,
      plate_number: header.plate_number,
      vehicle_type: header.vehicle_type,
      price: item.subtotal,
      status: mapPortalStatus(portalStatus),
      follow_up_status: "pending"
    };
  });

  if (!parsedOrders.length) {
    const fallback = parseLooseHotlineOrder(normalized);
    if (fallback.part_number || fallback.dealer_po_number || fallback.customer_name) {
      warnings.push("Parser tabel tidak menemukan item valid; sistem memakai fallback regex longgar.");
      parsedOrders.push({ parse_id: "fallback-0", ...fallback });
    }
  }

  return { parsedOrders, warnings: [...new Set(warnings)] };
}

export function parseHotlineOrder(raw: string): Partial<HotlineOrderInput> {
  return parseHotlineOrders(raw).parsedOrders[0] ?? {};
}

function extractHeaderData(lines: string[]): HeaderData {
  const pairs = extractLabelValuePairs(lines);
  const phone = pairs.get("No Tlp Konsumen") ?? "";
  return {
    dealer_po_number: pairs.get("No Po Dealer") ?? "",
    po_date: toISODate(pairs.get("Tgl Po Dealer") ?? ""),
    customer_name: pairs.get("Nama Konsumen") ?? "",
    phone_number: phone ? normalizePhone(phone) : "",
    engine_number: pairs.get("Nomor Mesin") ?? "",
    frame_number: pairs.get("Nomor Rangka") ?? "",
    plate_number: pairs.get("Nomor Polisi") ?? "",
    vehicle_type: pairs.get("Tipe Motor") || pairs.get("Nama Type") || pairs.get("Deskripsi Unit") || "",
    dealer_status: pairs.get("Status") ?? ""
  };
}

function extractLabelValuePairs(lines: string[]) {
  const pairs = new Map<string, string>();

  lines.forEach((line, lineIndex) => {
    const cells = splitCells(line);
    cells.forEach((cell, index) => {
      const label = findKnownLabel(cell);
      if (!label) {
        return;
      }

      const value = cells.slice(index + 1).find((candidate) => !findKnownLabel(candidate)) ?? findNextLineValue(lines, lineIndex);
      if (value) {
        pairs.set(label, value.trim());
      }
    });
  });

  return pairs;
}

function parseItemOrderSection(lines: string[], warnings: string[]) {
  const records = collectRecords(lines, (cells) => isPartNumber(cells[0]));
  const rows: ItemOrderRow[] = [];

  records.forEach((record) => {
    const cells = splitRecord(record);
    const partIndex = cells.findIndex(isPartNumber);
    if (partIndex < 0) {
      return;
    }

    const numericCells = cells.map((cell, index) => ({ cell, index })).filter(({ cell }) => /^\d+$/.test(cell));
    const subtotal = numericCells.length ? Number(numericCells[numericCells.length - 1].cell) : 0;
    const qty = numericCells.find(({ index }) => index > partIndex + 1)?.cell ?? "0";
    const partNameCells = cells.slice(partIndex + 1, numericCells.find(({ index }) => index > partIndex)?.index ?? partIndex + 2);
    const partName = partNameCells.join(" ").trim();

    rows.push({
      part_number: cells[partIndex],
      part_name: partName,
      order_qty: Number(qty) || 0,
      subtotal
    });
  });

  if (!rows.length && records.length) {
    warnings.push("Item Order ditemukan, tetapi baris part tidak bisa dipetakan.");
  }

  return rows;
}

function parseItemDetailSection(lines: string[], warnings: string[]) {
  const records = collectRecords(lines, (cells) => normalizeCell(cells[0]).toLowerCase() === "edit" && cells.some(isPartNumber));
  const rows: ItemDetailRow[] = [];

  records.forEach((record) => {
    const cells = splitRecord(record);
    const partIndex = cells.findIndex(isPartNumber);
    const dates = cells.map(toISODate).filter(Boolean);
    const progress = cells.find((cell) => /^\d+%$/.test(cell)) ?? "";
    const progressIndex = progress ? cells.indexOf(progress) : -1;
    const portalStatus = progressIndex >= 0 ? cells[progressIndex + 1] ?? "" : cells[cells.length - 1] ?? "";

    if (partIndex < 0) {
      return;
    }

    rows.push({
      part_number: cells[partIndex],
      eta_earliest: dates[0] ?? "",
      eta_latest: dates[1] ?? "",
      eta_revision: dates[2] ?? dates[1] ?? dates[0] ?? "",
      progress_percent: progress,
      portal_status: portalStatus
    });
  });

  if (!rows.length && records.length) {
    warnings.push("Item Order Detail ditemukan, tetapi detail ETA/status tidak bisa dipetakan.");
  }

  return rows;
}

function collectRecords(lines: string[], startsRecord: (cells: string[]) => boolean) {
  const records: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || isIgnoredTableLine(trimmed)) {
      continue;
    }

    const cells = splitCells(trimmed);
    const starts = startsRecord(cells);
    if (starts) {
      if (current.length) {
        records.push(current);
      }
      current = [trimmed];
      continue;
    }

    if (current.length && !isSubtotalOnly(cells)) {
      current.push(trimmed);
    }
  }

  if (current.length) {
    records.push(current);
  }

  return records;
}

function parseLooseHotlineOrder(text: string): HotlineOrderInput {
  const compact = text.replace(/\n/g, " ");
  const phone = pick(compact, [/\b((?:\+?62|0)8\d{8,13})\b/]);
  const dates = [...compact.matchAll(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}-[A-Z]{3}-\d{2,4})\b/gi)].map((match) => toISODate(match[1]));
  const partNumber = pick(compact, [/\b([0-9]{3,6}[A-Z][A-Z0-9]{4,12})\b/]);
  const portalStatus = pick(compact, [/\b(Picked|Approved|Back Order|Arrived|Booked)\b/i]);

  return {
    dealer_po_number: pick(compact, [/\bNo\s*Po\s*Dealer\s+([A-Z0-9/-]+)/i, /\b(PO[-/\s]?\d{4,6}[-/\s]?\d{4}[-/\s]?\d{2,6})\b/i]),
    po_date: dates[0] ?? todayISO(),
    customer_name: pick(compact, [/\bNama\s*Konsumen\s+(.+?)(?:\s+Warehouse|\s+No\s*Tlp|\s+(?:0|62)8)/i]),
    phone_number: phone ? normalizePhone(phone) : "",
    part_number: partNumber,
    part_name: "",
    eta_revision: dates[dates.length - 1] ?? "",
    eta_earliest: dates[1] ?? "",
    eta_latest: dates[2] ?? "",
    portal_status: portalStatus,
    progress_percent: pick(compact, [/\b(\d+%)\b/]),
    order_qty: 0,
    engine_number: pick(compact, [/\bNomor\s*Mesin\s+([A-Z0-9]+)/i]),
    frame_number: pick(compact, [/\bNomor\s*Rangka\s+([A-Z0-9]+)/i]),
    plate_number: pick(compact, [/\bNomor\s*Polisi\s+([A-Z0-9\s]+)/i]),
    vehicle_type: pick(compact, [/\bTipe\s*Motor\s+([A-Z0-9/*-]+)/i]),
    price: parseMoney(pick(compact, [/\bRp\.?\s*([\d.]+)\b/i])),
    status: mapPortalStatus(portalStatus),
    follow_up_status: "pending"
  };
}

function addMissingHeaderWarnings(header: HeaderData, warnings: string[]) {
  if (!header.dealer_po_number) warnings.push("No Po Dealer tidak ditemukan.");
  if (!header.po_date) warnings.push("Tgl Po Dealer tidak ditemukan.");
  if (!header.customer_name) warnings.push("Nama Konsumen tidak ditemukan.");
  if (!header.phone_number) warnings.push("No Tlp Konsumen tidak ditemukan.");
}

function splitRecord(record: string[]) {
  return record.flatMap(splitCells).filter((cell) => cell && cell !== "-");
}

function splitCells(line: string) {
  return line
    .split(/\t+/)
    .map(normalizeCell)
    .filter(Boolean);
}

function normalizeCell(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeKey(value: string) {
  return normalizeCell(value).toLowerCase();
}

function findKnownLabel(cell: string) {
  const key = normalizeKey(cell);
  return knownLabels.find((label) => normalizeKey(label) === key || key.startsWith(`${normalizeKey(label)} `));
}

function findNextLineValue(lines: string[], currentIndex: number) {
  for (let index = currentIndex + 1; index < lines.length; index += 1) {
    const cells = splitCells(lines[index]);
    const value = cells.find((cell) => !labelSet.has(normalizeKey(cell)) && !cell.startsWith("("));
    if (value) {
      return value;
    }
  }
  return "";
}

function findLineIndex(lines: string[], pattern: RegExp) {
  return lines.findIndex((line) => pattern.test(line.trim()));
}

function isIgnoredTableLine(line: string) {
  return /^(Item Number|Description|Order Qty|Qty Max HO|Import \/|Local|Current \/ Non Current|Status|Alasan|Ongkir|Rank Part|Kelompok Barang|Subtotal|Edit|No Invoice|ETA Tercepat|ETA Terlama|ETA Revisi|% Progress)$/i.test(
    line.trim()
  );
}

function isSubtotalOnly(cells: string[]) {
  return cells.length === 1 && /^\d+$/.test(cells[0]);
}

function isPartNumber(value = "") {
  return /^[0-9]{3,6}[A-Z][A-Z0-9]{4,12}$/.test(value.trim());
}

function mapPortalStatus(value: string): HotlineStatus {
  const status = value.toLowerCase();
  if (/(arrived|ready|received|tiba|invoiced|invoice|sj)/i.test(status)) {
    return "Arrived";
  }
  if (/(cancel|reject|batal)/i.test(status)) {
    return "Cancelled";
  }
  return "Booked";
}

function pick(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return "";
}

function toISODate(value: string) {
  const normalized = value.trim().toUpperCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  let match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    return `${match[3].padStart(4, "0")}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }

  match = normalized.match(/^(\d{1,2})-([A-Z]{3})-(\d{2,4})$/);
  if (match) {
    const month = monthNumber(match[2]);
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    if (month) {
      return `${year}-${month}-${match[1].padStart(2, "0")}`;
    }
  }

  return "";
}

function monthNumber(month: string) {
  const months: Record<string, string> = {
    JAN: "01",
    FEB: "02",
    MAR: "03",
    APR: "04",
    MAY: "05",
    JUN: "06",
    JUL: "07",
    AUG: "08",
    SEP: "09",
    OCT: "10",
    NOV: "11",
    DEC: "12"
  };
  return months[month];
}
