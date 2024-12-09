import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconExternalLink,
  IconLoader2,
  IconSelector,
} from "@tabler/icons-react";
import * as LZString from "lz-string";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "@ctrlplane/ui/form";
import { Label } from "@ctrlplane/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import {
  defaultCondition,
  isComparisonCondition,
  resourceCondition,
} from "@ctrlplane/validators/resources";

import { api } from "~/trpc/react";
import { ResourceConditionRender } from "../resource-condition/ResourceConditionRender";
import { TargetIcon } from "../TargetIcon";

const TargetViewsCombobox: React.FC<{
  workspaceId: string;
  onChange: (targetCondition: ResourceCondition) => void;
}> = ({ workspaceId, onChange }) => {
  const targetViewsQ = api.resource.view.list.useQuery(workspaceId, {
    enabled: workspaceId !== "",
  });
  const targetViews = targetViewsQ.data ?? [];
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex items-center gap-2"
        >
          <IconSelector className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">From target view...</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[462px] p-0">
        <Command>
          <CommandInput placeholder="Search target views..." />
          <CommandGroup>
            <CommandList className="scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-700">
              {targetViewsQ.isLoading && (
                <CommandItem disabled>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading target views...
                </CommandItem>
              )}
              {targetViews.map((targetView) => (
                <CommandItem
                  key={targetView.id}
                  onSelect={() => {
                    onChange(targetView.filter);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  {targetView.name} ({targetView.total} targets)
                </CommandItem>
              ))}
            </CommandList>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const filterForm = z.object({
  targetFilter: resourceCondition.optional(),
});

const getFilter = (
  targetFilter: ResourceCondition | null,
): ResourceCondition | undefined => {
  if (targetFilter == null) return undefined;
  if (!isComparisonCondition(targetFilter))
    return {
      type: FilterType.Comparison,
      operator: ComparisonOperator.And,
      not: false,
      conditions: [targetFilter],
    };
  return targetFilter;
};

export const EditFilterForm: React.FC<{
  environment: SCHEMA.Environment;
  workspaceId: string;
}> = ({ environment, workspaceId }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const update = api.environment.update.useMutation();
  const form = useForm({
    schema: filterForm,
    defaultValues: { targetFilter: getFilter(environment.resourceFilter) },
  });

  const { targetFilter } = form.watch();

  const filter = targetFilter ?? undefined;
  const targets = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId, filter, limit: 10 },
    { enabled: workspaceId !== "" },
  );

  const utils = api.useUtils();

  const onSubmit = form.handleSubmit((data) =>
    update
      .mutateAsync({
        id: environment.id,
        data: { ...data, resourceFilter: targetFilter ?? null },
      })
      .then(() => form.reset(data))
      .then(() => utils.environment.bySystemId.invalidate(environment.systemId))
      .then(() => utils.environment.byId.invalidate(environment.id)),
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="m-6 space-y-8">
        <div className="space-y-2">
          <FormField
            control={form.control}
            name="targetFilter"
            render={({ field: { onChange } }) => (
              <FormItem>
                <FormLabel>Target Filter</FormLabel>
                <FormControl>
                  <>
                    <TargetViewsCombobox
                      workspaceId={workspaceId}
                      onChange={onChange}
                    />
                    <ResourceConditionRender
                      condition={targetFilter ?? defaultCondition}
                      onChange={onChange}
                    />
                  </>
                </FormControl>
                <FormMessage />
                {form.formState.isDirty && (
                  <span className="text-xs text-muted-foreground">
                    Save to apply
                  </span>
                )}
              </FormItem>
            )}
          />

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={update.isPending || !form.formState.isDirty}
            >
              Save
            </Button>
            {targetFilter != null && (
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  form.setValue("targetFilter", undefined, {
                    shouldValidate: true,
                    shouldDirty: true,
                    shouldTouch: true,
                  })
                }
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {targetFilter != null &&
          targets.data != null &&
          targets.data.total > 0 && (
            <div className="space-y-4">
              <Label>Targets ({targets.data.total})</Label>
              <div className="space-y-2">
                {targets.data.items.map((target) => (
                  <div className="flex items-center gap-2" key={target.id}>
                    <TargetIcon version={target.version} kind={target.kind} />
                    <div className="flex flex-col">
                      <span className="overflow-hidden text-nowrap text-sm">
                        {target.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {target.version}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm">
                <Link
                  href={`/${workspaceSlug}/targets?${new URLSearchParams({
                    filter: LZString.compressToEncodedURIComponent(
                      JSON.stringify(form.getValues("targetFilter")),
                    ),
                  })}`}
                  className="flex items-center gap-1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconExternalLink className="h-4 w-4" />
                  View Targets
                </Link>
              </Button>
            </div>
          )}
      </form>
    </Form>
  );
};
