"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { Control } from "react-hook-form";
import { useState } from "react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useFieldArray } from "react-hook-form";

import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
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
import { Input } from "@ctrlplane/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import { Switch } from "@ctrlplane/ui/switch";

import { api } from "~/trpc/react";
import { usePolicyFormContext } from "../_components/PolicyFormContext";

const UserInput: React.FC<{
  workspaceId: string;
  id: string;
  setId: (id: string) => void;
}> = ({ workspaceId, id, setId }) => {
  const members = api.workspace.members.list.useQuery(workspaceId);
  const [open, setOpen] = useState(false);

  const selectedUser = members.data?.find((user) => user.user.id === id);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[350px] justify-between"
        >
          {selectedUser?.user.name ?? "Select user..."}
          <IconPlus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0">
        <Command>
          <CommandInput placeholder="Search users..." />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {members.data?.map((member) => (
                <CommandItem
                  key={member.user.id}
                  value={member.user.id}
                  onSelect={() => {
                    setId(member.user.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.user.image ?? undefined} />
                      <AvatarFallback>
                        {member.user.name?.[0] ?? "A"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span>{member.user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {member.user.email}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

interface UserSectionProps {
  control: Control<SCHEMA.UpdatePolicy>;
  fields: Record<"id", string>[];
  onRemove: (index: number) => void;
  workspaceId: string;
}

const UserSection: React.FC<UserSectionProps> = ({
  control,
  fields,
  onRemove,
  workspaceId,
}) => {
  if (fields.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="font-medium">Specific User Approvals</h4>
        <p className="text-sm text-muted-foreground">
          Approvals required from specific team members
        </p>
      </div>
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="flex items-start gap-4 rounded-lg border p-4"
        >
          <div className="flex-1 space-y-4">
            <FormField
              control={control}
              name={`versionUserApprovals.${index}.userId`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User</FormLabel>
                  <FormControl>
                    <div className="w-full">
                      <UserInput
                        id={field.value}
                        setId={field.onChange}
                        workspaceId={workspaceId}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-8"
            onClick={() => onRemove(index)}
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
};

interface RoleSectionProps {
  control: Control<SCHEMA.UpdatePolicy>;
  fields: Record<"id", string>[];
  onRemove: (index: number) => void;
}

const RoleSection: React.FC<RoleSectionProps> = ({
  control,
  fields,
  onRemove,
}) => {
  if (fields.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="font-medium">Role-based Approvals</h4>
        <p className="text-sm text-muted-foreground">
          Approvals required from specific roles or groups
        </p>
      </div>
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="flex items-start gap-4 rounded-lg border p-4"
        >
          <div className="flex-1 space-y-4">
            <FormField
              control={control}
              name={`versionRoleApprovals.${index}.roleId`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., security-team" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`versionRoleApprovals.${index}.requiredApprovalsCount`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Required Approvals</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="1"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-8"
            onClick={() => onRemove(index)}
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
};

export const EditQualitySecurity: React.FC<{ workspaceId: string }> = ({
  workspaceId,
}) => {
  const { form } = usePolicyFormContext();

  const {
    fields: userFields,
    append: appendUser,
    remove: removeUser,
  } = useFieldArray({
    control: form.control,
    name: "versionUserApprovals",
  });

  const { fields: roleFields, remove: removeRole } = useFieldArray({
    control: form.control,
    name: "versionRoleApprovals",
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Quality & Security Rules</h2>
        <p className="text-sm text-muted-foreground">
          Configure approval requirements and security checks
        </p>
      </div>

      <div className="max-w-xl space-y-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-md font-medium">Approval Requirements</h3>
              <p className="text-sm text-muted-foreground">
                Define who needs to approve and how many approvals are needed
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="font-medium">General Approval</h4>
                <p className="text-sm text-muted-foreground">
                  Enable if any team member can approve
                </p>
              </div>
              <div className="flex items-center gap-4 rounded-lg border p-4">
                <div className="flex-1 space-y-4">
                  <FormField
                    control={form.control}
                    name="versionAnyApprovals"
                    render={({ field }) => (
                      <FormItem className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <FormLabel>Require General Approval</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value !== null}
                              onCheckedChange={(checked) =>
                                field.onChange(
                                  checked
                                    ? { requiredApprovalsCount: 1 }
                                    : null,
                                )
                              }
                            />
                          </FormControl>
                        </div>
                        {field.value !== null && (
                          <FormField
                            control={form.control}
                            name="versionAnyApprovals.requiredApprovalsCount"
                            render={({ field: countField }) => (
                              <FormItem>
                                <FormLabel>Required Approvals</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={1}
                                    placeholder="1"
                                    {...countField}
                                    onChange={(e) =>
                                      countField.onChange(
                                        parseInt(e.target.value),
                                      )
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <UserSection
              workspaceId={workspaceId}
              control={form.control}
              fields={userFields}
              onRemove={removeUser}
            />
            <RoleSection
              control={form.control}
              fields={roleFields}
              onRemove={removeRole}
            />

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => appendUser({ userId: "" })}
              >
                <IconPlus className="mr-2 h-4 w-4" />
                Add User Approval
              </Button>
              {/* <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    appendRole({
                      roleId: "",
                      requiredApprovalsCount: 1,
                    })
                  }
                >
                  <IconPlus className="mr-2 h-4 w-4" />
                  Add Role Approval
                </Button> */}
            </div>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        disabled={form.formState.isSubmitting || !form.formState.isDirty}
      >
        Save
      </Button>
    </div>
  );
};
