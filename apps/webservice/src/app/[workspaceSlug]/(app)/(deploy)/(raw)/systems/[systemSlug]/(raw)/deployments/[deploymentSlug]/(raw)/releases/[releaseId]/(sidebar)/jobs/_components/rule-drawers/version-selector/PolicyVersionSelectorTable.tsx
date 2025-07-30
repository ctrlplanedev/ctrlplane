"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import type { Policy } from "./types";
import { DeploymentVersionConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionBadge";
import { urls } from "~/app/urls";

const PolicyVersionSelectorRow: React.FC<{ policy: Policy }> = ({ policy }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const policyUrl = urls
    .workspace(workspaceSlug)
    .policies()
    .edit(policy.id)
    .deploymentFlow();

  return (
    <TableRow>
      <TableCell>
        <Link href={policyUrl} target="_blank" rel="noreferrer noopener">
          {policy.name}
        </Link>
      </TableCell>
      <TableCell>
        <DeploymentVersionConditionBadge
          condition={policy.deploymentVersionSelector}
        />
      </TableCell>
    </TableRow>
  );
};

const PolicyVersionSelectorTableHeader: React.FC = () => (
  <TableHeader>
    <TableRow>
      <TableHead>Policy</TableHead>
      <TableHead>Version selector</TableHead>
    </TableRow>
  </TableHeader>
);

export const PolicyVersionSelectorTable: React.FC<{ policies: Policy[] }> = ({
  policies,
}) => (
  <div className="space-y-4">
    <span className="text-medium">Policies</span>
    <div className="rounded-md border">
      <Table>
        <PolicyVersionSelectorTableHeader />
        <TableBody>
          {policies.map((p) => (
            <PolicyVersionSelectorRow key={p.id} policy={p} />
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
);
