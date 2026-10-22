"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { login, register, type AuthState } from "./actions";
import { SubmitButton } from "@/components/ui";
import { useResultToast } from "@/components/toast";
import { isInvitePath, safeNext } from "@/lib/safe-next";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action] = useActionState<AuthState, FormData>(mode === "login" ? login : register, {});
  useResultToast(state);
  const isLogin = mode === "login";
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const viaInvite = isInvitePath(next);
  const other = `${isLogin ? "/register" : "/login"}${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <form action={action} className="card rise flex flex-col gap-5 p-7 sm:p-8" noValidate>
      <div>
        <h1 className="text-2xl font-bold text-navy">{isLogin ? "Masuk" : "Buat akun"}</h1>
        <p className="mt-1 text-sm text-muted">
          {viaInvite
            ? "Lanjutkan untuk menerima undangan tim."
            : isLogin
              ? "Lanjutkan ke dashboard follow-up Anda."
              : "Mulai dengan paket Free. Tanpa kartu kredit."}
        </p>
      </div>

      <input type="hidden" name="next" value={next} />
      {!isLogin && !viaInvite && (
        <div>
          <label htmlFor="business" className="label">Nama bisnis</label>
          <input id="business" name="business" className="field" autoComplete="organization" required />
        </div>
      )}
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" className="field" autoComplete="email" defaultValue={params.get("email") ?? ""} required />
      </div>
      <div>
        <label htmlFor="password" className="label">Kata sandi</label>
        <input id="password" name="password" type="password" className="field" autoComplete={isLogin ? "current-password" : "new-password"} minLength={8} required />
        {!isLogin && <p className="hint">Minimal 8 karakter.</p>}
      </div>

      <SubmitButton className="btn btn-primary btn-lg w-full" pending={isLogin ? "Masuk…" : "Mendaftar…"}>
        {isLogin ? "Masuk" : "Daftar"}
      </SubmitButton>

      <p className="text-center text-sm text-muted">
        {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
        <Link href={other} className="font-semibold text-brand underline-offset-2 hover:underline">
          {isLogin ? "Daftar" : "Masuk"}
        </Link>
      </p>
    </form>
  );
}
