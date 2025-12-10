import { Link } from "react-router";

import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { ResourceIcon } from "../../../components/ui/resource-icon";
import { LinksSection } from "./_components/LinksSection";
import { MetadataSection } from "./_components/MetadataSection";
import { RelationsSection } from "./_components/RelationsSection";
import { ReleaseTargets } from "./_components/ReleaseTargets";
import { ResourceActions } from "./_components/ResourceActions";
import { ResourceBasicInfo } from "./_components/ResourceBasicInfo";
import { useResource } from "./_components/ResourceProvider";
import { ResourceVariables } from "./_components/Variables";

export function meta() {
  return [
    { title: "Resource Details - Ctrlplane" },
    { name: "description", content: "View resource details" },
  ];
}

export function PageHeader() {
  const { resource } = useResource();
  const { workspace } = useWorkspace();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b pr-4">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <Link to={`/${workspace.slug}/resources`}>Resources</Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbPage>{resource.name}</BreadcrumbPage>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}

export function ResourceHeader() {
  const { resource } = useResource();
  return (
    <div className="flex items-start gap-4">
      <ResourceIcon
        kind={resource.kind}
        version={resource.version}
        className="h-12 w-12"
      />
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{resource.name}</h1>
          <ResourceActions />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono">{resource.identifier}</span>
          <span>•</span>
          <span>
            {resource.kind} v{resource.version}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ResourceDetail() {
  const { resource } = useResource();
  const displayMetadata = Object.fromEntries(
    Object.entries(resource.metadata).filter(
      ([key]) => !Object.values(ReservedMetadataKey).includes(key as any),
    ),
  );

  return (
    <>
      <PageHeader />

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="space-y-4">
            <ResourceHeader />
            <LinksSection />
          </div>

          <ResourceBasicInfo />
          <RelationsSection />

          {Object.keys(displayMetadata).length > 0 && (
            <MetadataSection title="Metadata" data={displayMetadata} />
          )}

          {Object.keys(resource.config).length > 0 && (
            <MetadataSection
              title="Configuration"
              data={resource.config}
              isOpen={false}
            />
          )}

          <ResourceVariables />
          <ReleaseTargets />
        </div>
      </div>
    </>
  );
}
