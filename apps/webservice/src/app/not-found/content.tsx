"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { IconHome } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";

export function NotFoundContent() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={`relative z-10 w-full max-w-screen-sm px-4 transition-all duration-700 ${mounted ? "opacity-100" : "opacity-0"}`}
    >
      <div className="mx-auto w-full" style={{ maxWidth: "400px" }}>
        <div className="mb-6 flex items-center justify-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 p-2">
            <Image
              src="/android-chrome-192x192.png"
              alt="Ctrlplane Logo"
              width={48}
              height={48}
              className="transition-all"
            />
            <div className="absolute inset-0 animate-pulse rounded-full border border-primary/20"></div>
          </div>
        </div>

        <Card className="overflow-hidden border-border/30 bg-card/60 shadow-xl backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-2 text-center">
            <CardTitle className="text-6xl font-bold">404</CardTitle>
            <CardTitle className="text-2xl font-semibold">
              Page Not Found
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pb-6 text-center">
            <p className="text-muted-foreground">
              The page you are looking for doesn't exist or has been moved.
            </p>
            <Button asChild size="lg" className="gap-2">
              <Link href="/">
                <IconHome className="h-4 w-4" />
                <span>Return to Home</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
