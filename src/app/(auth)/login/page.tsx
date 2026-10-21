import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Masuk" };

// AuthForm membaca ?next= & ?email= (useSearchParams) → dibungkus Suspense agar kerangka tetap diprerender.
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" aria-hidden="true" />}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
