import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

export default function IntegrationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 h-[calc(100vh-110px)] overflow-auto">
      <div className="flex justify-center">
        <div className="flex max-w-3xl flex-col gap-4">
          <Link href={`/${workspaceSlug}/settings/workspace/integrations`}>
            <Button variant="ghost" className="flex w-fit items-center gap-2">
              <IconArrowLeft className="h-4 w-4" /> Integrations
            </Button>
          </Link>

          {children}
        </div>
      </div>
    </div>
  );
}
