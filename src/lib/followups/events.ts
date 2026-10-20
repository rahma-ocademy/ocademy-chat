/** Katalog event yang dikenal (dipakai wizard & dokumentasi). Event lain tetap diterima API; hanya tidak ada di pilihan wizard. */
export type EventDef = { type: string; label: string; variables: string[] };

export const EVENTS: EventDef[] = [
  { type: "order.created", label: "Order dibuat (belum dibayar)", variables: ["customer_name", "order_id", "total", "payment_link", "product_name"] },
  { type: "order.paid", label: "Pembayaran diterima", variables: ["customer_name", "order_id", "total", "product_name"] },
  { type: "order.cancelled", label: "Order dibatalkan", variables: ["customer_name", "order_id", "product_name"] },
  { type: "order.completed", label: "Order selesai", variables: ["customer_name", "order_id", "product_name"] },
  { type: "shipping.manifested", label: "Resi dibuat / diserahkan ke kurir", variables: ["customer_name", "courier", "tracking_number", "tracking_link"] },
  { type: "shipping.problem", label: "Kendala pengiriman", variables: ["customer_name", "courier", "tracking_number", "shipping_problem"] },
  { type: "shipping.inbound", label: "Paket masuk kota tujuan", variables: ["customer_name", "courier", "tracking_number"] },
  { type: "shipping.delivered", label: "Paket diantar", variables: ["customer_name", "courier", "tracking_number", "total"] },
  { type: "cart.abandoned", label: "Keranjang ditinggal", variables: ["customer_name", "product_name", "checkout_link"] },
  { type: "course.enrolled", label: "Terdaftar di kelas", variables: ["customer_name", "course_name", "course_link", "first_session_at"] },
];

export const eventLabel = (type: string) => EVENTS.find((e) => e.type === type)?.label ?? type;

export function formatDelay(step: { delay_minutes: number; at_hour?: number }): string {
  const { delay_minutes: m, at_hour } = step;
  if (at_hour !== undefined) {
    const days = Math.round(m / 1440);
    return `${days === 0 ? "Hari ini" : `H+${days}`} · ${String(at_hour).padStart(2, "0")}.00`;
  }
  if (m === 0) return "Langsung";
  if (m % 1440 === 0) return `${m / 1440} hari`;
  if (m % 60 === 0) return `${m / 60} jam`;
  return `${m} menit`;
}
