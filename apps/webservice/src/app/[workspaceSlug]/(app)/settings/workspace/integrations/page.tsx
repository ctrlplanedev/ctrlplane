import Link from "next/link";
import {
  SiAmazon,
  SiGithub,
  SiGooglecloud,
} from "@icons-pack/react-simple-icons";

import { Card } from "@ctrlplane/ui/card";

import { urls } from "~/app/urls";
import { api } from "~/trpc/server";

export const metadata = { title: "Integrations - Settings" };

const IntegrationCard: React.FC<{
  href: string;
  children: React.ReactNode;
}> = ({ children, href }) => (
  <Card className="flex h-full cursor-pointer flex-col justify-between space-y-4 rounded-md text-center hover:bg-muted/20">
    <Link href={href} className="p-5">
      {children}
    </Link>
  </Card>
);

const IntegrationContent: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="space-y-3">{children}</div>;

const IntegrationHeading: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="flex items-center gap-2">{children}</div>;

export default async function IntegrationsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const { workspaceSlug } = params;

  const currentAwsAccountId =
    await api.workspace.integrations.aws.currentAwsAccountId();

  const integrationsUrls = urls
    .workspace(workspaceSlug)
    .workspaceSettings()
    .integrations();

  return (
    <div className="container mx-auto max-w-3xl space-y-8 overflow-auto pt-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect your workspace with other services to enhance your experience.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <IntegrationCard href={integrationsUrls.github()}>
          <IntegrationContent>
            <IntegrationHeading>
              <SiGithub className="text-4xl" />
              <span className="font-semibold">GitHub</span>
            </IntegrationHeading>
            <p className="text-left text-sm text-muted-foreground">
              Grant our account the correct permissions and we will manage
              running the resource provider for you.
            </p>
          </IntegrationContent>
        </IntegrationCard>

        {currentAwsAccountId != null && (
          <IntegrationCard href={integrationsUrls.aws()}>
            <IntegrationContent>
              <IntegrationHeading>
                <SiAmazon className="text-4xl text-orange-400" />
                <span className="font-semibold">AWS</span>
              </IntegrationHeading>
              <p className="text-left text-sm text-muted-foreground">
                Sync deployment resources, trigger AWS workflows and more.{" "}
                {currentAwsAccountId}
              </p>
            </IntegrationContent>
          </IntegrationCard>
        )}

        <IntegrationCard href={integrationsUrls.google()}>
          <IntegrationContent>
            <IntegrationHeading>
              <SiGooglecloud className="text-4xl text-red-400" />
              <span className="font-semibold">Google</span>
            </IntegrationHeading>
            <p className="text-left text-sm text-muted-foreground">
              Sync deployment resources, trigger google workflows and more.
            </p>
          </IntegrationContent>
        </IntegrationCard>
      </div>
    </div>
  );
}
