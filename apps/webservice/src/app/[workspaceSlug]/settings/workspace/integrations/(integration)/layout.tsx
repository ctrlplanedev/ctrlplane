import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

export default async function IntegrationLayout(props: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;

  const { children } = props;

  const { workspaceSlug } = params;
  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-110px)] overflow-auto">
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
