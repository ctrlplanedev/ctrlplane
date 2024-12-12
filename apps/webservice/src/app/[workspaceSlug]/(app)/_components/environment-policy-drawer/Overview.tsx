import React from "react";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";

import type { PolicyFormSchema } from "./PolicyFormSchema";

export const Overview: React.FC<{
  form: PolicyFormSchema;
}> = ({ form }) => (
  <div className="w-full space-y-6 p-2">
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Name</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={form.control}
      name="description"
      render={({ field: { value, onChange } }) => (
        <FormItem>
          <FormLabel>Description</FormLabel>
          <FormControl>
            <Textarea
              placeholder="Add a description..."
              value={value ?? ""}
              onChange={onChange}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>
);
