import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { useState } from "react";
import { IconLoader2, IconSelector } from "@tabler/icons-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";
import {
  defaultCondition,
  isComparisonCondition,
  resourceCondition,
} from "@ctrlplane/validators/resources";

import { ResourceConditionRender } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceConditionRender";
import { ResourceList } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceList";
import { api } from "~/trpc/react";

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
  resourceFilter: resourceCondition.optional(),
});

export const EditFilterForm: React.FC<{
  environment: SCHEMA.Environment;
  workspaceId: string;
}> = ({ environment, workspaceId }) => {
  const update = api.environment.update.useMutation();
  const form = useForm({
    schema: filterForm,
    defaultValues: { resourceFilter: getFilter(environment.resourceSelector) },
  });
  const { resourceFilter } = form.watch();

  const utils = api.useUtils();

  const onSubmit = form.handleSubmit((data) =>
    update
      .mutateAsync({
        id: environment.id,
        data: { ...data, resourceSelector: resourceFilter ?? null },
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
            name="resourceFilter"
            render={({ field: { onChange } }) => (
              <FormItem>
                <FormLabel>Resource Filter</FormLabel>
                <FormControl>
                  <>
                    <ResourceViewsCombobox
                      workspaceId={workspaceId}
                      onChange={onChange}
                    />
                    <ResourceConditionRender
                      condition={resourceFilter ?? defaultCondition}
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
            {resourceFilter != null && (
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  form.setValue("resourceFilter", undefined, {
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

        {resourceFilter != null && <ResourceList filter={resourceFilter} />}
      </form>
    </Form>
  );
};

const getFilter = (
  resourceFilter: ResourceCondition | null,
): ResourceCondition | undefined => {
  if (resourceFilter == null) return undefined;
  if (!isComparisonCondition(resourceFilter))
    return {
      type: ConditionType.Comparison,
      operator: ComparisonOperator.And,
      not: false,
      conditions: [resourceFilter],
    };
  return resourceFilter;
};
