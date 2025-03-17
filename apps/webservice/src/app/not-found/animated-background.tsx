"use client";

export function AnimatedBackground() {
  return (
    <>
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 -z-10 animate-[pulse_15s_ease-in-out_infinite] bg-gradient-to-tr from-primary/5 via-transparent to-primary/5 blur-3xl" />
      
      {/* Animated Grid */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] animate-[float_60s_linear_infinite] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_20%,transparent_100%)]" />
      
      {/* Floating particles */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div 
            key={`particle-${i}`}
            className="absolute rounded-full bg-primary/10"
            style={{
              width: `${Math.random() * 8 + 2}px`,
              height: `${Math.random() * 8 + 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5 + 0.1,
              animation: `float ${Math.random() * 20 + 10}s linear infinite`,
              animationDelay: `${Math.random() * 5}s`,
              transform: `translateY(${Math.random() * 100}vh)`
            }}
          />
        ))}
      </div>

      {/* Animated Decorative elements */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-[400px] w-[400px] animate-[pulse_20s_ease-in-out_infinite] rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-[300px] w-[300px] animate-[pulse_25s_ease-in-out_infinite] rounded-full bg-primary/5 blur-3xl" />

      {/* Rotating Decorative rings */}
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 animate-[spin_120s_linear_infinite] rounded-full border border-primary/10" />
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 animate-[spin_180s_linear_infinite_reverse] rounded-full border border-primary/5" />
      
      {/* Pulsing glow spots */}
      <div className="pointer-events-none absolute left-1/4 top-1/4 h-32 w-32 animate-[pulse_8s_ease-in-out_infinite] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute right-1/3 bottom-1/3 h-24 w-24 animate-[pulse_12s_ease-in-out_infinite] rounded-full bg-primary/10 blur-3xl" />
      
      {/* Global animation styles */}
      <style jsx global>{`
        @keyframes float {
          from { transform: translateY(100vh); }
          to { transform: translateY(-100vh); }
        }
      `}</style>
    </>
  );
}