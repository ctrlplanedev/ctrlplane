import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-background to-background/90">
      {/* Background gradients */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-tr from-primary/5 via-transparent to-primary/5 blur-3xl" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_20%,transparent_100%)]" />
      
      {/* Decorative elements */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-[400px] w-[400px] rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-[300px] w-[300px] rounded-full bg-primary/5 blur-3xl" />
      
      {/* Decorative rings */}
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10" />
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/5" />
      
      {/* Logo in background */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 opacity-[0.02]">
        <Image
          src="/android-chrome-512x512.png"
          alt="Ctrlplane Logo Background"
          width={800}
          height={800}
          className="h-auto w-auto"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-screen-xl px-4">
        {children}
      </div>
    </div>
  );
}
