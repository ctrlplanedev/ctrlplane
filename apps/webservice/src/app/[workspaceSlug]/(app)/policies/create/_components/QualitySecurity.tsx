"use client";

import type { CreatePolicy } from "@ctrlplane/db/schema";
import type { Control } from "react-hook-form";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useFieldArray } from "react-hook-form";

import { Button } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Switch } from "@ctrlplane/ui/switch";

import { usePolicyContext } from "./PolicyContext";

interface UserSectionProps {
  control: Control<CreatePolicy>;
  fields: Record<"id", string>[];
  onRemove: (index: number) => void;
}

const UserSection: React.FC<UserSectionProps> = ({
  control,
  fields,
  onRemove,
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
                  <FormLabel>User Email</FormLabel>
                  <FormControl>
                    <Input placeholder="user@example.com" {...field} />
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
  control: Control<CreatePolicy>;
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

export const QualitySecurity: React.FC = () => {
  const { form } = usePolicyContext();

  const {
    fields: userFields,
    append: appendUser,
    remove: removeUser,
  } = useFieldArray({
    control: form.control,
    name: "versionUserApprovals",
  });

  const {
    fields: roleFields,
    append: appendRole,
    remove: removeRole,
  } = useFieldArray({
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

      <Form {...form}>
        <form className="max-w-xl space-y-8">
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
                  onClick={() =>
                    appendUser({
                      userId: "",
                    })
                  }
                >
                  <IconPlus className="mr-2 h-4 w-4" />
                  Add User Approval
                </Button>
                <Button
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
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};
