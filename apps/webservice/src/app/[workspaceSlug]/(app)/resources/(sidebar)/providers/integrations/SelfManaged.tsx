import type { Workspace } from "@ctrlplane/db/schema";
import type React from "react";
import { SiTailscale, SiTerraform } from "@icons-pack/react-simple-icons";

type SelfManagedAgent = (workspace: Workspace) => {
  name: string;
  description: string;
  icon: React.ReactNode;
  instructions: React.ReactNode;
};
export const selfManagedAgents: SelfManagedAgent[] = [
  (workspace) => ({
    name: "Tailscale",
    description:
      "Track devices in your Tailscale network, allowing secure access to internal resources.",
    icon: <SiTailscale className="mx-auto text-3xl" />,
    instructions: (
      <div className="max-w-none space-y-2">
        <p>To sync in all Tailscale devices:</p>

        <div className="rounded-md border bg-black p-2">
          <pre className="text-xs">
            <code>
              <span className="text-red-300">ctrlc</span> sync{" "}
              <span className="text-white">tailscale</span> \
              <br />
              <span className="ml-8">
                <span className="text-blue-300">--workspace</span>{" "}
                <span className="text-white">{workspace.id}</span>
              </span>{" "}
              \
              <br />
              <span className="ml-8">
                <span className="text-blue-300">--tailnet</span>{" "}
                <span className="italic text-muted-foreground">TAILNET</span> \
              </span>
              <br />
              <span className="ml-8">
                <span className="text-blue-300">--tailscale-key</span>{" "}
                <span className="italic text-muted-foreground">
                  TAILSCALE_API_KEY
                </span>
              </span>
            </code>
          </pre>
        </div>

        <p>
          This will register itself as a resource provider. This command only
          runs the sync once. You should run this in a cron job to define
          frequency.
        </p>
      </div>
    ),
  }),
  (workspace) => ({
    name: "Terraform Cloud",
    description: "Track Terraform Cloud workspaces.",
    icon: <SiTerraform className="mx-auto text-3xl text-purple-400" />,
    instructions: (
      <div className="max-w-none space-y-2">
        <p>To sync in all Terraform Cloud workspaces:</p>

        <div className="rounded-md border bg-black p-2">
          <pre className="text-xs">
            <code>
              <span className="text-red-300">ctrlc</span> sync{" "}
              <span className="text-white">tfe</span> \
              <br />
              <span className="ml-8">
                <span className="text-blue-300">--workspace</span>{" "}
                <span className="text-white">{workspace.id}</span>
              </span>{" "}
              \
              <br />
              <span className="ml-8">
                <span className="text-blue-300">--organization</span>{" "}
                <span className="italic text-muted-foreground">
                  TERRAFORM_ORG
                </span>
              </span>
              \
              <br />
              <span className="ml-8">
                <span className="text-blue-300">--token</span>{" "}
                <span className="italic text-muted-foreground">
                  TERRAFORM_TOKEN
                </span>
              </span>
            </code>
          </pre>
        </div>

        <p>
          This will register itself as a resource provider. This command only
          runs the sync once. You should run this in a cron job to define
          frequency.
        </p>
      </div>
    ),
  }),
];
