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
// Order storefront dikirim dalam Extended JSON MongoDB: {"$oid": "..."} dan {"$date": "..."}.
const oid = (v: unknown) => (isObj(v) ? str(v.$oid) : str(v));
const date = (v: unknown) => (isObj(v) ? str(v.$date) : str(v));

// Format resmi: https://developers.orderonline.id/docs/webhooks
// - Checkout form: { type: "order", action: "create", payload: <order> }
// - Storefront:    <order> langsung, tanpa pembungkus (action tidak ada).
// Order baru → order.created; perubahan berikutnya dipetakan dari status.
const STATUS_TO_EVENT: Record<string, string> = {
  processing: "order.paid",
  completed: "order.completed",
  cancelled: "order.cancelled",
  canceled: "order.cancelled",
};

export function mapOrderOnlinePayload(raw: unknown): MappedEvent | null {
  if (!isObj(raw)) return null;
  const wrapped = raw.type === "order" && isObj(raw.payload);
  const order = wrapped ? (raw.payload as Obj) : raw;
  const orderId = str(order.order_id);
  if (!orderId) return null;

  const action = wrapped ? str(raw.action)?.toLowerCase() : undefined;
  const status = str(order.status)?.toLowerCase();
  const created = date(order.created_at);
  const updated = date(order.updated_at) ?? "";
  const isNew = action === "create" || (action === undefined && created !== undefined && created === updated);
  const type = isNew ? "order.created" : (status && STATUS_TO_EVENT[status]) ?? "order.updated";

  const customer = isObj(order.customer_data) ? order.customer_data : {};
  const productData = isObj(order.product_data) ? order.product_data : {};
  const products = Array.isArray(order.products) ? order.products.filter(isObj) : [];
  const payment = isObj(order.payment) ? order.payment : {};
  const shipping = isObj(order.shipping) ? order.shipping : {};

  const productIds = [oid(order.product_id), ...products.map((p) => oid(p.product_id))].filter((v): v is string => Boolean(v));
  const productName = str(productData.name) ?? (products.length ? products.map((p) => str(p.name)).filter(Boolean).join(", ") : undefined);

  const data: Record<string, unknown> = {
    order_id: orderId,
    product_ids: productIds,
    product_name: productName,
    product_price: str(order.product_price),
    shipping_cost: str(shipping.cost),
    total: str(order.total_price),
    payment_status: str(payment.status),
    payment_method: str(payment.method),
    courier: str(shipping.courier),
    tracking_number: str(shipping.receipt_number) ?? str(shipping.tracking_number),
    status,
    customer_name: str(customer.name),
    phone: str(customer.phone),
    address: str(customer.address),
    city: str(customer.city_name) ?? str(customer.city),
    district: str(customer.subdistrict_name) ?? str(customer.district),
  };

  const idempotencyKey = isNew
    ? `oo:order.created:${orderId}`
    : `oo:${type}:${orderId}:${updated || createHash("sha256").update(JSON.stringify(raw)).digest("hex").slice(0, 32)}`;

  return {
    type,
    idempotencyKey,
    contact: { phone: str(customer.phone), name: str(customer.name) },
    data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0))),
  };
}
