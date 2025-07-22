import type { UseFormReturn } from "react-hook-form";
import { useState } from "react";
import { useParams } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@ctrlplane/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import type { PolicyVersionSelectorConfig } from "./types";
import { api } from "~/trpc/react";
import { policyVersionSelectorConfig } from "./types";

const useGetPolicies = () => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspaceQ = api.workspace.bySlug.useQuery(workspaceSlug);

  const policiesQ = api.policy.list.useQuery(
    { workspaceId: workspaceQ.data?.id ?? "" },
    { enabled: workspaceQ.isSuccess && workspaceQ.data != null },
  );

  const isLoading = workspaceQ.isLoading || policiesQ.isLoading;

  return { policies: policiesQ.data ?? [], isLoading };
};

const PolicySelect: React.FC<{
  form: UseFormReturn<PolicyVersionSelectorConfig>;
}> = ({ form }) => {
  const [open, setOpen] = useState(false);

  const { policies, isLoading } = useGetPolicies();
  const [policySearch, setPolicySearch] = useState("");

  const filteredPolicies = policies.filter((policy) =>
    policy.name.toLowerCase().includes(policySearch.toLowerCase()),
  );

  const policyId = form.watch("policyId");

  const selectedPolicy = policies.find((policy) => policy.id === policyId);

  return (
    <FormField
      control={form.control}
      name="policyId"
      render={({ field: { onChange } }) => (
        <FormItem className="flex flex-col gap-2">
          <FormLabel>Policy</FormLabel>
          <FormControl>
            <Popover open={open} onOpenChange={setOpen} modal={false}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="justify-start px-2"
                >
                  {selectedPolicy != null
                    ? selectedPolicy.name
                    : "Select policy..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[462px] p-0">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search policy..."
                    value={policySearch}
                    onValueChange={setPolicySearch}
                  />
                  <CommandList>
                    {isLoading && (
                      <CommandItem className="flex items-center gap-2 text-muted-foreground">
                        <IconLoader2 className="h-3 w-3 animate-spin" />
                        Loading policies...
                      </CommandItem>
                    )}
                    {filteredPolicies.map((policy) => (
                      <CommandItem
                        key={policy.id}
                        value={policy.id}
                        onSelect={() => {
                          onChange(policy.id);
                          setOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        {policy.name}
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </FormControl>
        </FormItem>
      )}
    />
  );
};

const NameInput: React.FC<{
  form: UseFormReturn<PolicyVersionSelectorConfig>;
}> = ({ form }) => (
  <FormField
    control={form.control}
    name="name"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Name (optional)</FormLabel>
        <FormControl>
          <Input {...field} />
        </FormControl>
      </FormItem>
    )}
  />
);

const CTAInput: React.FC<{
  form: UseFormReturn<PolicyVersionSelectorConfig>;
}> = ({ form }) => (
  <FormField
    control={form.control}
    name="ctaText"
    render={({ field }) => (
      <FormItem>
        <FormLabel>CTA Text (optional)</FormLabel>
        <FormControl>
          <Input {...field} />
        </FormControl>
      </FormItem>
    )}
  />
);

export const Edit: React.FC<{
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  updateConfig: (config: PolicyVersionSelectorConfig) => Promise<void>;
  config?: PolicyVersionSelectorConfig;
}> = ({ config, isEditing, setIsEditing, updateConfig }) => {
  const form = useForm({
    schema: policyVersionSelectorConfig,
    defaultValues: {
      policyId: config?.policyId ?? "",
      name: config?.name ?? "",
      ctaText: config?.ctaText ?? "",
    },
  });

  const onSubmit = form.handleSubmit((data) =>
    updateConfig(data).then(() => setIsEditing(false)),
  );

  return (
    <Dialog open={isEditing} onOpenChange={setIsEditing}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Widget</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <PolicySelect form={form} />

            <NameInput form={form} />
            <CTAInput form={form} />

            <div className="flex justify-end">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
