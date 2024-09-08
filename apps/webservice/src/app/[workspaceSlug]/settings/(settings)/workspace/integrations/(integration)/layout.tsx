import Link from "next/link";
import { TbArrowLeft } from "react-icons/tb";

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
    <div className="flex justify-center">
      <div className="flex max-w-3xl flex-col gap-4">
        <Link href={`/${workspaceSlug}/settings/workspace/integrations`}>
          <Button variant="ghost" className="flex w-fit items-center gap-2">
            <TbArrowLeft className="h-4 w-4" /> Integrations
          </Button>
        </Link>

        {children}
      </div>
    </div>
  );
}
