import type { Metadata } from "next";

import { AnimatedBackground } from "./not-found/animated-background";
import { NotFoundContent } from "./not-found/content";

export const metadata: Metadata = {
  title: "404 - Page Not Found | Ctrlplane",
  description: "The page you are looking for doesn't exist or has been moved.",
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-background to-background/90">
      <AnimatedBackground />
      <NotFoundContent />
    </div>
  );
}
