import type { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";

import type { WorkspaceInfoFormData } from "./workspaceInfoSchema";

export function WorkspaceNameField({
  form,
}: {
  form: UseFormReturn<WorkspaceInfoFormData>;
}) {
  return (
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Workspace Name</FormLabel>
          <FormControl>
            <Input placeholder="My Workspace" {...field} />
          </FormControl>
          <FormDescription>
            The display name for your workspace
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function WorkspaceSlugField({
  form,
}: {
  form: UseFormReturn<WorkspaceInfoFormData>;
}) {
  return (
    <FormField
      control={form.control}
      name="slug"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Workspace Slug</FormLabel>
          <FormControl>
            <Input
              placeholder="my-workspace"
              {...field}
              onChange={(e) => field.onChange(e.target.value.toLowerCase())}
            />
          </FormControl>
          <FormDescription>
            The URL-friendly identifier for your workspace. Used in URLs like
            /{field.value}/...
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
