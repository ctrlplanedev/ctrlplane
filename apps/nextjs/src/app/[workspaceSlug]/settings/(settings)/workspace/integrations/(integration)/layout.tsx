"use client";

import { useRouter } from "next/navigation";
import { TbArrowLeft } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";

export default function IntegrationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceSlug: string };
}) {
  const router = useRouter();
  const { workspaceSlug } = params;
  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="ghost"
        onClick={() =>
          router.push(`/${workspaceSlug}/settings/workspace/integrations`)
        }
        className="flex w-fit items-center gap-2"
      >
        <TbArrowLeft className="h-4 w-4" /> Integrations
      </Button>
      {children}
    </div>
  );
}
