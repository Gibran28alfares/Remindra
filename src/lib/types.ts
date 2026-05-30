export type HotlineStatus = "Booked" | "Arrived" | "Followed Up" | "Converted" | "Cancelled";
export type FollowUpStatus = "pending" | "copied" | "queued" | "sending" | "sent" | "delivered" | "read" | "failed" | "followed_up" | "converted" | "cancelled";
export type RecommendationStatus = "pending" | "copied" | "queued" | "sending" | "sent" | "delivered" | "read" | "failed" | "followed_up" | "converted" | "cancelled";
export type ReminderStatus = "pending" | "copied" | "queued" | "sending" | "sent" | "delivered" | "read" | "failed" | "followed_up" | "converted" | "cancelled";
export type ReminderSourceType = "hotline" | "mechanic";
export type TemplateType = "hotline_arrived" | "mechanic_follow_up";
export type WhatsappDeliveryStatus = "draft" | "queued" | "sending" | "sent" | "delivered" | "read" | "failed";

export interface HotlineOrder {
  id: number;
  dealer_po_number: string;
  po_date: string;
  customer_name: string;
  phone_number: string;
  part_number: string;
  part_name: string;
  eta_revision: string;
  eta_earliest: string;
  eta_latest: string;
  portal_status: string;
  progress_percent: string;
  order_qty: number;
  engine_number: string;
  frame_number: string;
  plate_number: string;
  vehicle_type: string;
  price: number;
  status: HotlineStatus;
  follow_up_status: FollowUpStatus;
  created_at: string;
  updated_at: string;
}

export type HotlineOrderInput = Omit<HotlineOrder, "id" | "created_at" | "updated_at">;

export interface ParsedHotlineOrder extends HotlineOrderInput {
  parse_id: string;
}

export interface ParseHotlineResult {
  parsedOrders: ParsedHotlineOrder[];
  warnings: string[];
}

export interface MechanicRecommendation {
  id: number;
  customer_name: string;
  phone_number: string;
  vehicle_info: string;
  component: string;
  recommendation: string;
  follow_up_date: string;
  estimated_value: number;
  status: RecommendationStatus;
  created_at: string;
  updated_at: string;
}

export type MechanicRecommendationInput = Omit<MechanicRecommendation, "id" | "created_at" | "updated_at">;

export interface ReminderTask {
  id: number;
  source_type: ReminderSourceType;
  source_id: number;
  customer_name: string;
  phone_number: string;
  message: string;
  due_date: string;
  status: ReminderStatus;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: number;
  type: TemplateType;
  name: string;
  body: string;
  updated_at: string;
}

export interface WhatsappMessageLog {
  id: number;
  reminder_id: number | null;
  source_type: ReminderSourceType;
  source_id: number;
  phone_number: string;
  message: string;
  wa_message_id: string;
  delivery_status: WhatsappDeliveryStatus;
  error_message: string;
  sent_at: string;
  delivered_at: string;
  read_at: string;
  failed_at: string;
  created_at: string;
  updated_at: string;
}

export interface AppData {
  hotlines: HotlineOrder[];
  recommendations: MechanicRecommendation[];
  reminders: ReminderTask[];
  templates: MessageTemplate[];
  whatsapp_logs: WhatsappMessageLog[];
}
