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

const useMetadataEquals = (form: RuleForm) => {
  const workspaceId = form.watch("workspaceId");
  const sourceKind = form.watch("sourceKind");
  const sourceVersion = form.watch("sourceVersion");

  const { data } = api.resource.relationshipRules.metadata.equals.useQuery({
    workspaceId,
    kind: sourceKind === "" ? undefined : sourceKind,
    version: sourceVersion === "" ? undefined : sourceVersion,
  });

  return data ?? [];
};

export const SourceMetadataEqualsField: React.FC<{
  form: RuleForm;
  field: FieldArrayWithId;
  index: number;
  onRemove: () => void;
}> = ({ form, field, index, onRemove }) => {
  const [keySearch, setKeySearch] = useState("");
  const [keyPopoverOpen, setKeyPopoverOpen] = useState(false);

  const [valueSearch, setValueSearch] = useState("");
  const [valuePopoverOpen, setValuePopoverOpen] = useState(false);

  const metadataEquals = useMetadataEquals(form);

  const filteredKeys = metadataEquals.filter(({ key }) =>
    key.toLowerCase().includes(keySearch.toLowerCase()),
  );

  const selectedFormKey = form.watch(`sourceMetadataEquals.${index}.key`);
  const valuesForSelectedKey =
    metadataEquals.find(({ key }) => key === selectedFormKey)?.values ?? [];

  const filteredValues = valuesForSelectedKey.filter((value) =>
    value.toLowerCase().includes(valueSearch.toLowerCase()),
  );

  return (
    <FormField
      key={field.id}
      control={form.control}
      name={`sourceMetadataEquals.${index}`}
      render={({ field: { value, onChange } }) => (
        <FormItem>
          <FormControl>
            <div className="flex items-center gap-4 rounded-md border border-neutral-800 px-2 py-1">
              <Popover
                open={keyPopoverOpen}
                onOpenChange={setKeyPopoverOpen}
                modal={false}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex w-40 justify-start"
                  >
                    <span className="truncate text-muted-foreground">
                      {value.key === "" ? "Select key..." : value.key}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-1">
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={keySearch}
                      onValueChange={setKeySearch}
                      placeholder="Search for a key..."
                    />
                    <CommandList className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800">
                      {filteredKeys.map(({ key }) => (
                        <CommandItem
                          key={key}
                          value={key}
                          onSelect={() => {
                            onChange({ ...value, key });
                            setKeyPopoverOpen(false);
                          }}
                        >
                          {key}
                        </CommandItem>
                      ))}
                      {filteredKeys.length === 0 && (
                        <CommandItem
                          key="no-results"
                          value={keySearch}
                          onSelect={() => {
                            onChange({ ...value, key: keySearch });
                            setKeyPopoverOpen(false);
                          }}
                        ></CommandItem>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">equals</span>
              <Popover
                open={valuePopoverOpen}
                onOpenChange={setValuePopoverOpen}
                modal={false}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex w-40 justify-start"
                  >
                    <span className="truncate text-muted-foreground">
                      {value.value === "" ? "Select value..." : value.value}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-1">
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={valueSearch}
                      onValueChange={setValueSearch}
                      placeholder="Search for a value..."
                    />
                    <CommandList className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800">
                      {filteredValues.map((commandValue) => (
                        <CommandItem
                          key={commandValue}
                          value={commandValue}
                          onSelect={() => {
                            onChange({ ...value, value: commandValue });
                            setValuePopoverOpen(false);
                          }}
                        >
                          {commandValue}
                        </CommandItem>
                      ))}
                      {filteredValues.length === 0 && (
                        <CommandItem
                          key="no-results"
                          value={valueSearch}
                          onSelect={() => {
                            onChange({ ...value, value: valueSearch });
                            setValuePopoverOpen(false);
                          }}
                        >
                          {valueSearch}
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
