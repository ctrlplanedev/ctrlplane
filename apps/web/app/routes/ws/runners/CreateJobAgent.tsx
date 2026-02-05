import { SiArgo } from "@icons-pack/react-simple-icons";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ArgoCDDialog } from "./ArgoCD";
import { ArgoWorkflowsDialog } from "./ArgoWorkflows";

export function CreateJobAgent() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>Create Agent</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <ArgoCDDialog>
          <DropdownMenuItem
            className="flex items-center gap-2"
            onSelect={(e) => e.preventDefault()}
          >
            <SiArgo className="size-4 text-orange-400" />
            Argo CD
          </DropdownMenuItem>
        </ArgoCDDialog>
        <ArgoWorkflowsDialog>
          <DropdownMenuItem
            className="flex items-center gap-2"
            onSelect={(e) => e.preventDefault()}
          >
            <SiArgo className="size-4 text-orange-400" />
            Argo Workflows
          </DropdownMenuItem>
        </ArgoWorkflowsDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
