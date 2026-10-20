export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="flex items-baseline justify-center gap-1.5">
        <span className="text-[26px] font-bold text-navy">ocademy</span>
        <span className="text-base font-medium text-brand">chat</span>
      </div>
      {children}
    </main>
  );
}
