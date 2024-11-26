import Link from "next/link";
import {
  SiAmazon,
  SiGithub,
  SiGooglecloud,
} from "@icons-pack/react-simple-icons";
import {
  IconBook,
  IconCategory,
  IconChevronRight,
  IconTarget,
  IconTextCaption,
} from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

export const metadata = { title: "Overview - Workspace" };

export default function OverviewPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 container mx-auto h-[calc(100vh-40px)] max-w-7xl space-y-8 overflow-auto">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Workspace</h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspace settings.
        </p>
      </div>
      <div className="border-b" />

      <div className="space-y-4">
        <h4 className="text-lg">Explore features</h4>

        <div className="grid grid-cols-3 gap-6 text-sm">
          <div className="space-y-2 rounded-md border bg-neutral-900/50 p-4 shadow-lg">
            <div className="flex flex-grow gap-3">
              <IconTarget className="h-5 w-5 text-purple-400" />
              <div>
                <div>Sync targets</div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Targets representing any entity where you might want to run a
              workflow against
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/${workspaceSlug}/target-providers`}>
                <Button size="sm" variant="secondary">
                  Sync targets
                </Button>
              </Link>
              <Link href="https://docs.ctrlplane.dev/targets">
                <Button size="sm" variant="ghost" className="bg-transparent">
                  Learn more{" "}
                  <IconChevronRight className="ml-0.5 h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="space-y-2 rounded-md border bg-neutral-900/50 p-4 shadow-lg">
            <div className="flex flex-grow gap-3">
              <IconCategory className="h-5 w-5 text-green-400" />
              <div>
                <div>Create systems</div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              System encompasses a set of related deployments that share common
              characteristics.
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/${workspaceSlug}/systems`}>
                <Button size="sm" variant="secondary">
                  Create systems
                </Button>
              </Link>
              <Link href="https://docs.ctrlplane.dev/systems">
                <Button size="sm" variant="ghost" className="bg-transparent">
                  Learn more{" "}
                  <IconChevronRight className="ml-0.5 h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="space-y-2 rounded-md border bg-neutral-900/50 p-4 shadow-lg">
            <div className="flex flex-grow gap-3">
              <IconCategory className="h-5 w-5 text-blue-400" />
              <div>
                <div>Configure environments</div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Environment serves as a logical grouping of targets.
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/${workspaceSlug}/environments`}>
                <Button size="sm" variant="secondary">
                  Configure environments
                </Button>
              </Link>
              <Link href="https://docs.ctrlplane.dev/systems">
                <Button size="sm" variant="ghost" className="bg-transparent">
                  Learn more{" "}
                  <IconChevronRight className="ml-0.5 h-4 w-4 text-muted-foreground" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b" />

      <div className="space-y-4">
        <h4 className="text-lg">Integrations</h4>

        <div className="grid grid-cols-3 gap-6 text-sm">
          <div className="space-y-2 border-b pb-2">
            <div className="flex flex-grow gap-3">
              <SiGithub className="h-5 w-5 text-neutral-400" />
              <div className="space-y-2">
                <div>GitHub</div>
                <div className="text-xs text-muted-foreground">
                  Trigger actions, sync releases and create deployments from
                  repos.
                </div>
                <div>
                  <Link
                    href={`/${workspaceSlug}/settings/workspace/integrations/github`}
                  >
                    <Button variant="secondary" size="sm">
                      Open
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2 border-b pb-2">
            <div className="flex flex-grow gap-3 pb-8">
              <SiGooglecloud className="h-5 w-5 text-red-400" />
              <div className="space-y-2">
                <div>Google Cloud</div>
                <div className="text-xs text-muted-foreground">
                  Sync deployment resource, trigger google workflows and more.
                </div>
                <div>
                  <Link
                    href={`/${workspaceSlug}/settings/workspace/integrations/google`}
                  >
                    <Button variant="secondary" size="sm">
                      Open
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2 border-b pb-2">
            <div className="flex flex-grow gap-3">
              <SiAmazon className="h-5 w-5 text-orange-400" />
              <div className="space-y-2">
                <div>AWS</div>
                <div className="text-xs text-muted-foreground">
                  Sync deployment resources, trigger AWS workflows and more.
                </div>
                <div>
                  <Link
                    href={`/${workspaceSlug}/settings/workspace/integrations/aws`}
                  >
                    <Button variant="secondary" size="sm">
                      Open
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-lg">Go further</h4>
        <div className="grid grid-cols-4 gap-6 text-sm">
          <Link
            href="https://docs.ctrlplane.dev"
            className="flex items-center gap-3 rounded-md border p-4 hover:border-neutral-600"
          >
            <div className="flex flex-grow gap-3">
              <IconBook className="h-5 w-5 text-purple-400" />
              <div>
                <div>Start guide</div>
                <div className="text-xs text-muted-foreground">
                  Quick tips for beginners
                </div>
              </div>
            </div>
            <IconChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
          <Link
            href="https://docs.ctrlplane.dev/glossary"
            className="flex items-center gap-3 rounded-md border p-4 hover:border-neutral-600"
          >
            <div className="flex flex-grow gap-3">
              <IconTextCaption className="h-5 w-5 text-purple-400" />
              <div>
                <div>Glossary</div>
                <div className="text-xs text-muted-foreground">
                  Learn what each term means.
                </div>
              </div>
            </div>
            <IconChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </div>
  );
}
