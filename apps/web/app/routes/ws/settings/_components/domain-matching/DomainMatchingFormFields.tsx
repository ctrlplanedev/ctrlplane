import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import type { domainMatchingSchema } from "./domainMatchingSchema";

type FormData = z.infer<typeof domainMatchingSchema>;
type Role = { id: string; name: string };

export function DomainField({ form }: { form: UseFormReturn<FormData> }) {
  return (
    <FormField
      control={form.control}
      name="domain"
      render={({ field }) => (
        <FormItem className="flex-1">
          <FormLabel>Domain</FormLabel>
          <FormControl>
            <Input placeholder="example.com" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function RoleField({
  form,
  roles,
}: {
  form: UseFormReturn<FormData>;
  roles: Role[] | undefined;
}) {
  return (
    <FormField
      control={form.control}
      name="roleId"
      render={({ field }) => (
        <FormItem className="flex-1">
          <FormLabel>Role</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {roles?.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function VerificationEmailField({
  form,
}: {
  form: UseFormReturn<FormData>;
}) {
  return (
    <FormField
      control={form.control}
      name="verificationEmail"
      render={({ field }) => (
        <FormItem className="flex-1">
          <FormLabel>Verification Email</FormLabel>
          <FormControl>
            <Input type="email" placeholder="admin@example.com" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
