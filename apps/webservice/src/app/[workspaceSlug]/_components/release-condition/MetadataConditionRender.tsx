import type { MetadataCondition } from "@ctrlplane/validators/releases";
import { useState } from "react";
import { useParams } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { Input } from "@ctrlplane/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { ReleaseOperator } from "@ctrlplane/validators/releases";

import type { ReleaseConditionRenderProps } from "./release-condition-props";
import { api } from "~/trpc/react";
import { useMatchSorter } from "~/utils/useMatchSorter";

export const MetadataConditionRender: React.FC<
  ReleaseConditionRenderProps<MetadataCondition>
> = ({ condition, onChange, className }) => {
  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug?: string;
  }>();

  const workspaceQ = api.workspace.bySlug.useQuery(workspaceSlug);
  const workspace = workspaceQ.data;
  const systemQ = api.system.bySlug.useQuery(
    { workspaceSlug, systemSlug: systemSlug ?? "" },
    { enabled: systemSlug != null },
  );
  const system = systemQ.data;

  const workspaceMetadataKeys = api.release.metadataKeys.byWorkspace.useQuery(
    workspace?.id ?? "",
    { enabled: workspace != null && system == null },
  );
  const systemMetadataKeys = api.release.metadataKeys.bySystem.useQuery(
    system?.id ?? "",
    { enabled: system != null },
  );

  const metadataKeys =
    systemMetadataKeys.data ?? workspaceMetadataKeys.data ?? [];

  const setKey = (key: string) => onChange({ ...condition, key });

  const setValue = (value: string) =>
    condition.operator !== ReleaseOperator.Null &&
    onChange({ ...condition, value });

  const setOperator = (
    operator:
      | ReleaseOperator.Equals
      | ReleaseOperator.Like
      | ReleaseOperator.Regex
      | ReleaseOperator.Null,
  ) =>
    operator === ReleaseOperator.Null
      ? onChange({ ...condition, operator, value: undefined })
      : onChange({ ...condition, operator, value: condition.value ?? "" });

  const [open, setOpen] = useState(false);
  const filteredMetadataKeys = useMatchSorter(metadataKeys, condition.key);

  const loadingMetadataKeys =
    workspaceQ.isLoading ||
    systemQ.isLoading ||
    workspaceMetadataKeys.isLoading ||
    systemMetadataKeys.isLoading;

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="grid w-full grid-cols-12">
        <div className="col-span-5">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger className="w-full rounded-r-none hover:rounded-l-sm hover:bg-neutral-800/50">
              <Input
                placeholder="Key"
                value={condition.key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full cursor-pointer rounded-l-sm rounded-r-none"
              />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="scrollbar-thin scrollbar-track-neutral-950 scrollbar-thumb-neutral-800 max-h-[300px] overflow-y-auto p-0 text-sm"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {!loadingMetadataKeys &&
                filteredMetadataKeys.map((k) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    key={k}
                    className="w-full rounded-none text-left"
                    onClick={() => {
                      setKey(k);
                      setOpen(false);
                    }}
                  >
                    <div className="w-full">{k}</div>
                  </Button>
                ))}
              {loadingMetadataKeys && (
                <div className="flex h-8 items-center gap-1 pl-2 text-xs text-muted-foreground">
                  <IconLoader2 className="h-3 w-3 animate-spin" /> Loading
                  keys...
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
        <div className="col-span-3">
          <Select
            value={condition.operator}
            onValueChange={(
              v:
                | ReleaseOperator.Equals
                | ReleaseOperator.Like
                | ReleaseOperator.Regex
                | ReleaseOperator.Null,
            ) => setOperator(v)}
          >
            <SelectTrigger className="rounded-none text-muted-foreground hover:bg-neutral-800/50">
              <SelectValue
                placeholder="Operator"
                className="text-muted-foreground"
              />
            </SelectTrigger>
            <SelectContent className="text-muted-foreground">
              <SelectItem value={ReleaseOperator.Equals}>Equals</SelectItem>
              <SelectItem value={ReleaseOperator.Regex}>Regex</SelectItem>
              <SelectItem value={ReleaseOperator.Like}>Like</SelectItem>
              <SelectItem value={ReleaseOperator.Null}>Is Null</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {condition.operator !== ReleaseOperator.Null ? (
          <div className="col-span-4">
            <Input
              placeholder={
                condition.operator === ReleaseOperator.Regex
                  ? "^[a-zA-Z]+$"
                  : condition.operator === ReleaseOperator.Like
                    ? "%value%"
                    : "Value"
              }
              value={condition.value}
              onChange={(e) => setValue(e.target.value)}
              className="rounded-l-none rounded-r-sm hover:bg-neutral-800/50"
            />
          </div>
        ) : (
          <div className="col-span-4 h-9 cursor-not-allowed rounded-r-md bg-neutral-900 bg-opacity-50" />
        )}
      </div>
    </div>
  );
};
