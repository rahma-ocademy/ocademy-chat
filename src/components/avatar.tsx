const TONES = ["tone-brand", "tone-violet", "tone-amber", "tone-sky", "tone-rose", "tone-ok", "tone-navy"];

/** Warna stabil dari nama: kontak yang sama selalu berwarna sama di daftar, thread, dan detail. */
export function avatarTone(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

const SIZES = { sm: "size-9 text-sm", md: "size-11 text-base", lg: "size-16 text-2xl" };

export function Avatar({ name, size = "md", className = "" }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full font-bold ${SIZES[size]} ${avatarTone(name)} ${className}`}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
