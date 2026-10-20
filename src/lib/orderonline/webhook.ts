import { createHash } from "node:crypto";

export type MappedEvent = {
  type: string;
  idempotencyKey: string;
  contact: { phone?: string; name?: string };
  data: Record<string, unknown>;
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : undefined);

// ASUMSI (belum terverifikasi): format payload webhook `order:*` tidak ada di dokumentasi publik OrderOnline.
// Pemetaan ini toleran dan memakai nama field dari objek submission di dokumentasi (order_id, customer_data,
// product_name, status, payment, shipping). Begitu contoh payload asli tersedia, sesuaikan di sini
// (satu-satunya tempat yang menafsirkan payload webhook) dan perbarui test-nya.
const STATUS_TO_EVENT: Record<string, string> = {
  pending: "order.created",
  processing: "order.paid",
  completed: "order.completed",
  cancelled: "order.cancelled",
  canceled: "order.cancelled",
};

export function mapOrderOnlinePayload(raw: unknown): MappedEvent | null {
  if (!isObj(raw)) return null;
  const body = isObj(raw.data) ? raw.data : raw;
  const customer = isObj(body.customer_data) ? body.customer_data : isObj(body.customer) ? body.customer : {};

  const explicit = str(raw.event) ?? str(raw.type);
  const status = str(body.status)?.toLowerCase();
  const type = explicit ? explicit.toLowerCase() : status ? STATUS_TO_EVENT[status] : undefined;
  if (!type) return null;

  const orderId = str(body.order_id) ?? str(body._id);
  const payment = isObj(body.payment) ? body.payment : {};
  const shipping = isObj(body.shipping) ? body.shipping : {};

  const data: Record<string, unknown> = {
    order_id: orderId,
    product_name: str(body.product_name),
    total: str(body.gross_revenue) ?? str(body.total_price),
    payment_status: str(payment.status) ?? str(body.payment_status),
    payment_method: str(payment.method) ?? str(body.payment_method),
    courier: str(shipping.courier) ?? str(shipping.name),
    tracking_number: str(shipping.receipt_number) ?? str(shipping.tracking_number),
    status,
  };
  const phone = str(customer.phone);
  const name = str(customer.name);
  data.customer_name = name;

  const stamp = str(body.updated_at) ?? str(raw.timestamp) ?? "";
  const idempotencyKey = orderId
    ? `oo:${type}:${orderId}:${stamp}`
    : `oo:${createHash("sha256").update(JSON.stringify(raw)).digest("hex").slice(0, 32)}`;

  return { type, idempotencyKey, contact: { phone, name }, data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) };
}
