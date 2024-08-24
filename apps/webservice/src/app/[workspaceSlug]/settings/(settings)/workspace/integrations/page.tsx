"use client";

import { useRouter } from "next/navigation";
import { SiGithub } from "react-icons/si";

import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";

const IntegrationCard: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <Card className="flex h-full flex-col justify-between space-y-4 p-4 text-center">
    {children}
  </Card>
);

const IntegrationContent: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="space-y-2">{children}</div>;

const IntegrationActionButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ children, onClick }) => (
  <Button
    variant="outline"
    size="sm"
    className="block w-full"
    onClick={onClick}
  >
    {children}
  </Button>
);

const IntegrationHeading: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="space-y-1">{children}</div>;

export default function IntegrationsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const router = useRouter();
  const { workspaceSlug } = params;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect your workspace with other services to enhance your experience.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <IntegrationCard>
          <IntegrationContent>
            <IntegrationHeading>
              <SiGithub className="mx-auto text-4xl" />
              <div className="font-semibold">GitHub Bot</div>
            </IntegrationHeading>
            <p className="text-xs text-muted-foreground">
              Grant our account the correct permissions and we will manage
              running the target provider for you.
            </p>
          </IntegrationContent>

          <IntegrationActionButton
            onClick={() =>
              router.push(
                `/${workspaceSlug}/settings/workspace/integrations/github`,
              )
            }
          >
            Configure
          </IntegrationActionButton>
        </IntegrationCard>
      </div>
    </div>
  );
}
