export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 -z-10 bg-gradient-to-tr from-white/10 via-transparent to-white/10 blur-3xl" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.0)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_10%,transparent_100%)]" />

      {children}
    </div>
  );
}
