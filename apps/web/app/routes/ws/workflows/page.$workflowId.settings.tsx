import type { RouterOutputs } from "@ctrlplane/trpc";
import { useOutletContext } from "react-router";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

type Workflow = NonNullable<RouterOutputs["workflows"]["get"]>;
type WorkflowInput = { key: string; type: string; default?: unknown };
type WorkflowJobAgent = {
  name: string;
  ref: string;
  config: Record<string, unknown>;
  selector: string;
};

function InputsSection({ inputs }: { inputs: unknown }) {
  const items = (inputs as WorkflowInput[] | null) ?? [];
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">No inputs defined.</p>;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Default</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((input) => (
            <TableRow key={input.key}>
              <TableCell className="font-mono text-xs">{input.key}</TableCell>
              <TableCell className="text-muted-foreground">
                {input.type}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {input.default != null ? JSON.stringify(input.default) : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function JobAgentsSection({ jobAgents }: { jobAgents: WorkflowJobAgent[] }) {
  if (jobAgents.length === 0)
    return (
      <p className="text-sm text-muted-foreground">No job agents defined.</p>
    );

  return (
    <div className="space-y-3">
      {jobAgents.map((agent) => (
        <div key={agent.ref} className="rounded-md border p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">{agent.name}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {agent.ref.slice(0, 8)}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Selector: </span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {agent.selector}
              </code>
            </div>
            <div>
              <span className="font-medium text-foreground">Config: </span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {JSON.stringify(agent.config)}
              </code>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WorkflowSettingsPage() {
  const workflow = useOutletContext<Workflow>();

  return (
    <main className="flex-1 space-y-8 overflow-auto p-6">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">General</h2>
        <div className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
          <span className="text-muted-foreground">Name</span>
          <span>{workflow.name}</span>
          <span className="text-muted-foreground">ID</span>
          <span className="font-mono text-xs">{workflow.id}</span>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Inputs</h2>
        <InputsSection inputs={workflow.inputs} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Job Agents</h2>
        <JobAgentsSection
          jobAgents={workflow.jobAgents as WorkflowJobAgent[]}
        />
      </section>
    </main>
  );
}
