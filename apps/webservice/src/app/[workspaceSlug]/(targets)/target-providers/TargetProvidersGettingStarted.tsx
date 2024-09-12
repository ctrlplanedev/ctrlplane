"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { TbPlug } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";

export const TargetProvidersGettingStarted: React.FC = () => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  return (
    <div className="h-full w-full p-20">
      <div className="container m-auto max-w-xl space-y-6 p-20">
        <div className="relative -ml-1 text-neutral-500">
          <TbPlug className="h-10 w-10" strokeWidth={0.5} />
        </div>
        <div className="font-semibold">Target Provider</div>
        <div className="prose prose-invert text-sm text-muted-foreground">
          <p>
            Target Providers are automated processes responsible for
            discovering, registering, and updating targets. They continuously
            monitor your infrastructure and external systems, ensuring that
            Ctrlplane has an accurate and up-to-date representation of your
            deployment landscape.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${workspaceSlug}/target-providers/integrations`}
            passHref
          >
            <Button size="sm">View integrations</Button>
          </Link>
          <Button size="sm" variant="secondary">
            Documentation
          </Button>
        </div>
      </div>
    </div>
  );
};
