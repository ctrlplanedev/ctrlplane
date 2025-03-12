"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { useState } from "react";
import { IconLoader2, IconSelector } from "@tabler/icons-react";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
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
  FormMessage,
  useForm,
} from "@ctrlplane/ui/form";
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

import { ResourceConditionRender } from "~/app/[workspaceSlug]/(appv2)/_components/resources/condition/ResourceConditionRender";
import { api } from "~/trpc/react";
import { EnvironmentResourceTable } from "./EnvironmentResourcesTable";

const ResourceViewsCombobox: React.FC<{
  workspaceId: string;
  onChange: (resourceCondition: ResourceCondition) => void;
}> = ({ workspaceId, onChange }) => {
  const resourceViewsQ = api.resource.view.list.useQuery(workspaceId, {
    enabled: workspaceId !== "",
  });
  const resourceViews = resourceViewsQ.data ?? [];
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
          <span className="text-muted-foreground">From resource view...</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[462px] p-0">
        <Command>
          <CommandInput placeholder="Search resource views..." />
          <CommandGroup>
            <CommandList className="scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-700">
              {resourceViewsQ.isLoading && (
                <CommandItem disabled>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading resource views...
                </CommandItem>
              )}
              {resourceViews.map((resourceView) => (
                <CommandItem
                  key={resourceView.id}
                  onSelect={() => {
                    onChange(resourceView.filter);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  {resourceView.name} ({resourceView.total} resources)
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
  resourceSelector: resourceCondition.optional(),
});

const getFilter = (
  resourceSelector: ResourceCondition | null,
): ResourceCondition | undefined => {
  if (resourceSelector == null) return undefined;
  if (!isComparisonCondition(resourceSelector))
    return {
      type: FilterType.Comparison,
      operator: ComparisonOperator.And,
      not: false,
      conditions: [resourceSelector],
    };
  return resourceSelector;
};

export const EditFilterForm: React.FC<{
  environment: SCHEMA.Environment;
  workspaceId: string;
}> = ({ environment, workspaceId }) => {
  const update = api.environment.update.useMutation();
  const form = useForm({
    schema: filterForm,
    defaultValues: {
      resourceSelector: getFilter(environment.resourceSelector),
    },
  });

  const { resourceSelector } = form.watch();

  const filter = resourceSelector ?? undefined;
  const resources = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId, filter },
    { enabled: workspaceId !== "" },
  );

  const utils = api.useUtils();

  const onSubmit = form.handleSubmit((data) =>
    update
      .mutateAsync({
        id: environment.id,
        data: { ...data, resourceSelector: resourceSelector ?? null },
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
            name="resourceSelector"
            render={({ field: { onChange } }) => (
              <FormItem>
                <FormControl>
                  <>
                    <ResourceViewsCombobox
                      workspaceId={workspaceId}
                      onChange={onChange}
                    />
                    <ResourceConditionRender
                      condition={resourceSelector ?? defaultCondition}
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
            {resourceSelector != null && (
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  form.setValue("resourceSelector", undefined, {
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

        {resourceSelector != null &&
          resources.data != null &&
          resources.data.total > 0 && (
            <Card className="rounded-md p-0">
              <EnvironmentResourceTable
                resources={resources.data.items}
                systemId={environment.systemId}
                environmentId={environment.id}
              />
            </Card>
          )}
      </form>
    </Form>
  );
};
