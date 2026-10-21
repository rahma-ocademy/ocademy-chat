"use client";

import { useTransition } from "react";
import { switchBusiness } from "@/app/(auth)/actions";

export function BusinessSwitcher({ current, options }: { current: string; options: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <div>
      <label htmlFor="biz-switch" className="sr-only">Bisnis aktif</label>
      <select
        id="biz-switch"
        className="field !min-h-9 !py-0 !text-sm"
        value={current}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          start(async () => { await switchBusiness(id); });
        }}
      >
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}
