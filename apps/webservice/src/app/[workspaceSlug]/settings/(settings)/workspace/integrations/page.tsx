import Link from "next/link";
import { SiGithub, SiGooglecloud } from "react-icons/si";

import { Card } from "@ctrlplane/ui/card";

export const metadata = { title: "Integrations - Settings" };

const IntegrationCard: React.FC<{
  integration: string;
  workspaceSlug: string;
  children: React.ReactNode;
}> = ({ children, integration, workspaceSlug }) => (
  <Card className="flex h-full cursor-pointer flex-col justify-between space-y-4 rounded-md text-center hover:bg-muted/20">
    <Link
      href={`/${workspaceSlug}/settings/workspace/integrations/${integration}`}
      className="p-5"
    >
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

export default function IntegrationsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;

  return (
    <div className="container mx-auto max-w-3xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect your workspace with other services to enhance your experience.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <IntegrationCard integration="github" workspaceSlug={workspaceSlug}>
          <IntegrationContent>
            <IntegrationHeading>
              <SiGithub className="text-4xl" />
              <span className="font-semibold">GitHub</span>
            </IntegrationHeading>
            <p className="text-left text-sm text-muted-foreground">
              Grant our account the correct permissions and we will manage
              running the target provider for you.
            </p>
          </IntegrationContent>
        </IntegrationCard>

        <IntegrationCard integration="google" workspaceSlug={workspaceSlug}>
          <IntegrationContent>
            <IntegrationHeading>
              <SiGooglecloud className="text-4xl text-red-400" />
              <span className="font-semibold">Google</span>
            </IntegrationHeading>
            <p className="text-left text-sm text-muted-foreground">
              Sync deployment targets, trigger google workflows and more.
            </p>
          </IntegrationContent>
        </IntegrationCard>
      </div>
    </div>
  );
}
