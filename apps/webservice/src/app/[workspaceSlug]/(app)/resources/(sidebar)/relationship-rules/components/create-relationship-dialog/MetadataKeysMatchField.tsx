import type { FieldArrayWithId } from "react-hook-form";
import { useState } from "react";
import { IconX } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { FormControl, FormField, FormItem } from "@ctrlplane/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import type { RuleForm } from "./formSchema";
import { api } from "~/trpc/react";

const useMetadataKeys = (workspaceId: string, form: RuleForm) => {
  const sourceKind = form.watch("sourceKind");
  const targetKind = form.watch("targetKind");
  const sourceVersion = form.watch("sourceVersion");
  const targetVersion = form.watch("targetVersion");

  const source =
    sourceKind !== "" && sourceVersion !== ""
      ? { kind: sourceKind, version: sourceVersion }
      : undefined;

  const target =
    targetKind == null && targetVersion == null
      ? undefined
      : { kind: targetKind, version: targetVersion };

  const { data } =
    api.resource.relationshipRules.metadata.matchingKeys.useQuery({
      workspaceId,
      source,
      target,
    });

  return data ?? [];
};

export const MetadatakeysMatchField: React.FC<{
  form: RuleForm;
  field: FieldArrayWithId;
  index: number;
  onRemove: () => void;
}> = ({ form, field, index, onRemove }) => {
  const [sourceKeySearch, setSourceKeySearch] = useState("");
  const [sourceKeyPopoverOpen, setSourceKeyPopoverOpen] = useState(false);

  const [targetKeySearch, setTargetKeySearch] = useState("");
  const [targetKeyPopoverOpen, setTargetKeyPopoverOpen] = useState(false);

  const metadataKeys = useMetadataKeys(form.getValues("workspaceId"), form);

  const filteredSourceKeys = metadataKeys.filter(({ key }) =>
    key.toLowerCase().includes(sourceKeySearch.toLowerCase()),
  );

  const selectedSourceKey = form.watch(
    `metadataKeysMatches.${index}.sourceKey`,
  );
  const selectedTargetKeys =
    metadataKeys.find(({ key }) => key === selectedSourceKey)
      ?.targetMetaWithMatchingValue ?? [];

  const filteredTargetKeys = selectedTargetKeys.filter((key) =>
    key.toLowerCase().includes(targetKeySearch.toLowerCase()),
  );

  return (
    <FormField
      key={field.id}
      control={form.control}
      name={`metadataKeysMatches.${index}`}
      render={({ field: { onChange, value } }) => (
        <FormItem>
          <FormControl>
            <div className="flex w-full items-center gap-1 rounded-md border border-neutral-800 px-2 py-1">
              <Popover
                open={sourceKeyPopoverOpen}
                onOpenChange={setSourceKeyPopoverOpen}
                modal={false}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex w-44 justify-start"
                    size="sm"
                  >
                    <span className="truncate text-muted-foreground">
                      {value.sourceKey !== ""
                        ? value.sourceKey
                        : "Select source key..."}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-1">
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={sourceKeySearch}
                      onValueChange={setSourceKeySearch}
                      placeholder="Search for a key..."
                    />
                    <CommandList className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800">
                      {filteredSourceKeys.map(({ key }) => (
                        <CommandItem
                          key={key}
                          value={key}
                          onSelect={() => {
                            onChange({ ...value, sourceKey: key });
                            setSourceKeyPopoverOpen(false);
                          }}
                        >
                          {key}
                        </CommandItem>
                      ))}
                      {filteredSourceKeys.length === 0 && (
                        <CommandItem
                          key="no-results"
                          value={sourceKeySearch}
                          onSelect={() => {
                            onChange({ ...value, sourceKey: sourceKeySearch });
                            setSourceKeyPopoverOpen(false);
                          }}
                        >
                          {sourceKeySearch}
                        </CommandItem>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <span className="text-sm text-muted-foreground">matches</span>

              <Popover
                open={targetKeyPopoverOpen}
                onOpenChange={setTargetKeyPopoverOpen}
                modal={false}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex w-44 justify-start"
                    size="sm"
                  >
                    <span className="truncate text-muted-foreground">
                      {value.targetKey !== ""
                        ? value.targetKey
                        : "Select target key..."}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-1">
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={targetKeySearch}
                      onValueChange={setTargetKeySearch}
                      placeholder="Search for a key..."
                    />
                    <CommandList className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800">
                      {filteredTargetKeys.map((key) => (
                        <CommandItem
                          key={key}
                          value={key}
                          onSelect={() => {
                            onChange({ ...value, targetKey: key });
                            setTargetKeyPopoverOpen(false);
                          }}
                        >
                          {key}
                        </CommandItem>
                      ))}
                      {filteredTargetKeys.length === 0 && (
                        <CommandItem
                          key="no-results"
                          value={targetKeySearch}
                          onSelect={() => {
                            onChange({ ...value, targetKey: targetKeySearch });
                            setTargetKeyPopoverOpen(false);
                          }}
                        >
                          {targetKeySearch}
                        </CommandItem>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="h-5 w-5"
              >
                <IconX className="h-3 w-3" />
              </Button>
            </div>
          </FormControl>
        </FormItem>
      )}
    />
  );
};
