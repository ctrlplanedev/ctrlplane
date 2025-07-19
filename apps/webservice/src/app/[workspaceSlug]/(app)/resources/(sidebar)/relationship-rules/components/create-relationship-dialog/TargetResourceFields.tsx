import { useState } from "react";

import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ctrlplane/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import type { RuleForm } from "./formSchema";
import { api } from "~/trpc/react";

export const TargetResourceFields: React.FC<{
  form: RuleForm;
  workspaceId: string;
}> = ({ form, workspaceId }) => {
  const selectedKind = form.watch("targetKind");

  const [kindCommandInput, setKindCommandInput] = useState("");
  const [kindPopoverOpen, setKindPopoverOpen] = useState(false);
  const [versionCommandInput, setVersionCommandInput] = useState("");
  const [versionPopoverOpen, setVersionPopoverOpen] = useState(false);

  const { data: kinds } = api.resource.byWorkspaceId.kinds.useQuery({
    workspaceId,
  });

  const { data: versions } = api.resource.byWorkspaceId.versions.useQuery({
    workspaceId,
    kind:
      selectedKind !== "" && selectedKind != null ? selectedKind : undefined,
  });

  const filteredKinds = kinds?.filter((kind) =>
    kind.toLowerCase().includes(kindCommandInput.toLowerCase()),
  );
  const filteredVersions = versions?.filter((version) =>
    version.toLowerCase().includes(versionCommandInput.toLowerCase()),
  );

  return (
    <div className="space-y-2 pt-4">
      <h4 className="text-sm font-medium leading-none">Target Resource</h4>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="targetKind"
          render={({ field: { value, onChange } }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-xs text-muted-foreground">
                Kind (optional)
              </FormLabel>
              <FormControl>
                <Popover
                  open={kindPopoverOpen}
                  onOpenChange={setKindPopoverOpen}
                  modal={false}
                >
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex justify-start">
                      <span className="truncate text-muted-foreground">
                        {value === "" || value == null
                          ? "Select kind..."
                          : value}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-1">
                    <Command shouldFilter={false}>
                      <CommandInput
                        value={kindCommandInput}
                        onValueChange={setKindCommandInput}
                      />
                      <CommandList className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800">
                        {filteredKinds?.map((kind) => (
                          <CommandItem
                            key={kind}
                            value={kind}
                            onSelect={() => {
                              onChange(kind);
                              setKindCommandInput("");
                              setKindPopoverOpen(false);
                            }}
                          >
                            {kind}
                          </CommandItem>
                        ))}
                        {filteredKinds?.length === 0 && (
                          <CommandItem
                            key="no-results"
                            value={kindCommandInput}
                            onSelect={() => {
                              onChange(kindCommandInput);
                              setKindPopoverOpen(false);
                            }}
                          >
                            {kindCommandInput}
                          </CommandItem>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="targetVersion"
          render={({ field: { value, onChange } }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-xs text-muted-foreground">
                Version (optional)
              </FormLabel>
              <FormControl>
                <Popover
                  open={versionPopoverOpen}
                  onOpenChange={setVersionPopoverOpen}
                  modal={false}
                >
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex justify-start">
                      <span className="truncate text-muted-foreground">
                        {value === "" || value == null
                          ? "Select version..."
                          : value}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-1">
                    <Command shouldFilter={false}>
                      <CommandInput
                        value={versionCommandInput}
                        onValueChange={setVersionCommandInput}
                      />
                      <CommandList className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800">
                        {filteredVersions?.map((version) => (
                          <CommandItem
                            key={version}
                            value={version}
                            onSelect={() => {
                              onChange(version);
                              setVersionCommandInput("");
                              setVersionPopoverOpen(false);
                            }}
                          >
                            {version}
                          </CommandItem>
                        ))}
                        {filteredVersions?.length === 0 && (
                          <CommandItem
                            key="no-results"
                            value={versionCommandInput}
                            onSelect={() => {
                              onChange(versionCommandInput);
                              setVersionPopoverOpen(false);
                            }}
                          >
                            {versionCommandInput}
                          </CommandItem>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};
