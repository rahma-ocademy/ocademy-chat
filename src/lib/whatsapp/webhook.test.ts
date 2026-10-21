import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { messageText, parseWebhook, verifySignature, waTime } from "./webhook";

const wrap = (field: string, value: unknown) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA1", changes: [{ field, value }] }],
});
const meta = { display_phone_number: "6281100000000", phone_number_id: "PN1" };

describe("verifySignature", () => {
  it("menerima HMAC yang benar dan menolak yang lain", () => {
    const body = '{"a":1}';
    const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(verifySignature(body, sig, "s3cret")).toBe(true);
    expect(verifySignature(body + " ", sig, "s3cret")).toBe(false);
    expect(verifySignature(body, null, "s3cret")).toBe(false);
    expect(verifySignature(body, "sha256=abc", "s3cret")).toBe(false);
  });
});

describe("parseWebhook", () => {
  it("pesan masuk teks dengan nama profil", () => {
    const ev = parseWebhook(
      wrap("messages", {
        messaging_product: "whatsapp",
        metadata: meta,
        contacts: [{ profile: { name: "Rani" }, wa_id: "6281234" }],
        messages: [{ from: "6281234", id: "wamid.1", timestamp: "1760000000", type: "text", text: { body: "Halo kak" } }],
      }),
    );
    expect(ev).toEqual([{ kind: "message", phoneNumberId: "PN1", waId: "6281234", profileName: "Rani", id: "wamid.1", timestamp: "1760000000", body: "Halo kak" }]);
  });

  it("status kirim, termasuk gagal dengan alasan", () => {
    const ev = parseWebhook(
      wrap("messages", {
        metadata: meta,
        statuses: [
          { id: "wamid.2", status: "read", recipient_id: "6281234" },
          { id: "wamid.3", status: "failed", errors: [{ code: 131047, title: "Re-engagement message", error_data: { details: "lebih dari 24 jam" } }] },
          { id: "wamid.4", status: "weird" },
        ],
      }),
    );
    expect(ev).toEqual([
      { kind: "status", phoneNumberId: "PN1", id: "wamid.2", status: "read", error: null },
      { kind: "status", phoneNumberId: "PN1", id: "wamid.3", status: "failed", error: "131047 · Re-engagement message · lebih dari 24 jam" },
    ]);
  });

  it("echo Coexistence (dibalas dari HP)", () => {
    const ev = parseWebhook(
      wrap("smb_message_echoes", {
        metadata: meta,
        message_echoes: [{ from: "6281100000000", to: "6281234", id: "wamid.5", timestamp: "1760000100", type: "text", text: { body: "Siap kak" } }],
      }),
    );
    expect(ev).toEqual([{ kind: "echo", phoneNumberId: "PN1", to: "6281234", id: "wamid.5", timestamp: "1760000100", body: "Siap kak" }]);
  });

  it("field lain dikembalikan mentah; payload asing diabaikan", () => {
    const ev = parseWebhook(wrap("history", { metadata: meta, history: [] }));
    expect(ev).toEqual([{ kind: "other", phoneNumberId: "PN1", wabaId: "WABA1", field: "history", value: { metadata: meta, history: [] } }]);
    expect(parseWebhook({ object: "page", entry: [] })).toEqual([]);
    expect(parseWebhook("x")).toEqual([]);
  });
});

describe("messageText", () => {
  it("jenis non-teks menjadi label yang terbaca", () => {
    expect(messageText({ type: "image", image: { caption: "bukti transfer" } })).toBe("[Gambar] bukti transfer");
    expect(messageText({ type: "audio", audio: {} })).toBe("[Pesan suara]");
    expect(messageText({ type: "interactive", interactive: { button_reply: { title: "Ya" } } })).toBe("Ya");
    expect(messageText({ type: "location", location: { name: "Toko", address: "Jl. A" } })).toBe("[Lokasi] Toko, Jl. A");
    expect(messageText({ type: "xyz" })).toBe("[Pesan tidak didukung]");
    expect(messageText({ type: "text", text: { body: "a".repeat(5000) } })).toHaveLength(4096);
  });
});

it("waTime", () => {
  expect(waTime("1760000000")).toBe("2025-10-09T08:53:20.000Z");
  const now = new Date("2026-01-01T00:00:00Z");
  expect(waTime("", now)).toBe(now.toISOString());
});
