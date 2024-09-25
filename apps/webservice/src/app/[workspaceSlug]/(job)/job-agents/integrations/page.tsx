import React from "react";
import { SiGithub, SiKubernetes } from "@icons-pack/react-simple-icons";
import { IconSettings } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";

const AgentCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Card className="flex h-full flex-col justify-between space-y-4 p-4 text-center">
    {children}
  </Card>
);

const AgentContent: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="space-y-2">{children}</div>;

const AgentActionButton: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Button variant="outline" size="sm" className="block w-full">
    {children}
  </Button>
);

const AgentHeading: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="space-y-1">{children}</div>;

export default function AgentPage() {
  return (
    <div className="p-16">
      <div className="container mx-auto max-w-5xl">
        <h2 className="font-semibold">Managed Agents</h2>
        <p className="text-sm text-muted-foreground">
          Agents built into Ctrlplane that don't require you to run anything.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-6">
          <AgentCard>
            <AgentContent>
              <AgentHeading>
                <SiGithub className="mx-auto text-4xl" />
                <div className="font-semibold">GitHub Bot</div>
              </AgentHeading>
              <p className="text-xs text-muted-foreground">
                Grant our account the correct permissions and we will manage
                running the target provider for you.
              </p>
            </AgentContent>

            <AgentActionButton>Configure</AgentActionButton>
          </AgentCard>
        </div>

        <div className="my-16 border-b" />

        <h2 className="font-semibold">Self-hosted Agents</h2>
        <p className="text-sm text-muted-foreground">
          Agents that you run in your own infrastructure, these target providers
          will automatically register themselves with Ctrlplane.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-6">
          <AgentCard>
            <AgentContent>
              <AgentHeading>
                <IconSettings className="mx-auto text-4xl" />
                <div className="font-semibold">Custom</div>
              </AgentHeading>
              <p className="text-xs text-muted-foreground">
                Create custom target providers to import resources.
              </p>
            </AgentContent>

            <div>
              <Button variant="outline" size="sm" className="w-full">
                Instructions
              </Button>
            </div>
          </AgentCard>

          <AgentCard>
            <AgentContent>
              <AgentHeading>
                <SiKubernetes className="mx-auto text-4xl text-blue-400" />
                <div className="font-semibold">Kubernetes Job</div>
              </AgentHeading>
              <p className="text-xs text-muted-foreground">
                Agent running on a cluster that creates jobs on that cluster.
              </p>
            </AgentContent>

            <div>
              <Button variant="outline" size="sm" className="w-full">
                Instructions
              </Button>
            </div>
          </AgentCard>
        </div>
      </div>
    </div>
  );
}
