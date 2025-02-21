import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { api } from "~/trpc/server";
import { CreateReleaseChannelDialog } from "./CreateReleaseChannelDialog";
import { ReleaseChannelsTable } from "./ReleaseChannelsTable";

export default async function ReleaseChannelsPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
}) {
  const params = await props.params;

  const { workspaceSlug, systemSlug, deploymentSlug } = params;

  const deployment = await api.deployment.bySlug({
    workspaceSlug,
    systemSlug,
    deploymentSlug,
  });
  if (!deployment) notFound();

  const releaseChannels =
    await api.deployment.releaseChannel.list.byDeploymentId(deployment.id);

  return (
    <div>
      <PageHeader className="justify-between">
        <div className="flex shrink-0 items-center gap-4">
          <Link
            href={`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments`}
          >
            <IconArrowLeft className="size-5" />
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Channels</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <CreateReleaseChannelDialog deploymentId={deployment.id}>
          <Button variant="outline" size="sm">
            Create Channel
          </Button>
        </CreateReleaseChannelDialog>
      </PageHeader>
      <ReleaseChannelsTable releaseChannels={releaseChannels} />
    </div>
  );
}
