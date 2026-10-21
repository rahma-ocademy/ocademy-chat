import { z } from "zod";

// Izin global anggota (pola Cekat: Users Management → Global Permission). Cermin public.user_perm().
export const PERMISSION_KEYS = ["user_management", "billing", "security"] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const LEVELS = ["none", "view", "manage"] as const;
export type Level = (typeof LEVELS)[number];

export type Permissions = Record<PermissionKey, Level>;
export type Role = "owner" | "admin" | "agent";

export const PERMISSION_LABEL: Record<PermissionKey, { title: string; text: string }> = {
  user_management: { title: "Pengguna", text: "Mengundang, mengubah izin, dan menonaktifkan anggota tim." },
  billing: { title: "Usage & paket", text: "Melihat pemakaian kuota dan paket." },
  security: { title: "Keamanan", text: "API key dan integrasi." },
};
export const LEVEL_LABEL: Record<Level, string> = { none: "Tanpa akses", view: "Bisa lihat", manage: "Bisa kelola" };
export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", agent: "Agen" };

export const NO_PERMISSIONS: Permissions = { user_management: "none", billing: "none", security: "none" };

const level = z.enum(LEVELS).catch("none");

/** Parse kolom jsonb `permissions` sekali di batas data; nilai asing/hilang = 'none'. */
export function parsePermissions(raw: unknown): Permissions {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    user_management: level.parse(obj.user_management),
    billing: level.parse(obj.billing),
    security: level.parse(obj.security),
  };
}

/** Level efektif: owner selalu 'manage'. */
export const levelOf = (role: Role, perms: Permissions, key: PermissionKey): Level => (role === "owner" ? "manage" : perms[key]);

export const atLeast = (have: Level, need: Level) => LEVELS.indexOf(have) >= LEVELS.indexOf(need);

/** Owner/admin mengelola platform, AI agent, dan pengaturan inbox. Agen hanya membalas chat. */
export const isAdminRole = (role: Role) => role === "owner" || role === "admin";
