"use client";

import type { JobAgent } from "@ctrlplane/db/schema";
import Link from "next/link";
import { TbPlus } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

export const JobAgentSelector: React.FC<{
  jobAgents: JobAgent[];
  workspace: { id: string; slug: string };
  value?: string;
  onChange: (v: string) => void;
}> = ({ workspace, value, jobAgents, onChange }) => {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={value}
        onValueChange={onChange}
        disabled={jobAgents.length === 0}
      >
        <SelectTrigger className="max-w-[350px]">
          <SelectValue
            placeholder={jobAgents.length === 0 && "No agents found"}
          />
        </SelectTrigger>
        <SelectContent>
          {jobAgents.map((jobAgent) => (
            <SelectItem key={jobAgent.id} value={jobAgent.id}>
              {jobAgent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Link href={`/${workspace.slug}/job-agents/add`} passHref>
        <Button className="flex items-center" variant="outline" size="icon">
          <TbPlus />
        </Button>
      </Link>
    </div>
  );
};
