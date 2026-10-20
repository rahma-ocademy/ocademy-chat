import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";

/** Format error tunggal untuk seluruh API: { error: { code, message, details? } }. */
export function apiError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

export const MAX_BODY_BYTES = 256 * 1024;

export async function parseJson<T>(req: Request, schema: ZodType<T>) {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return { ok: false as const, res: apiError(413, "payload_too_large", "Body melebihi 256 KB.") };
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false as const, res: apiError(400, "invalid_json", "Body bukan JSON yang valid.") };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return { ok: false as const, res: apiError(422, "validation_failed", "Data tidak valid.", details) };
  }
  return { ok: true as const, data: parsed.data, raw: json };
}

export type Page = { page: number; perPage: number; from: number; to: number };

export function readPage(url: URL): Page {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("per_page")) || 20));
  return { page, perPage, from: (page - 1) * perPage, to: page * perPage - 1 };
}

export const pageMeta = (p: Page, total: number) => ({
  page: p.page,
  per_page: p.perPage,
  total,
  total_pages: Math.max(1, Math.ceil(total / p.perPage)),
});
