"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/react";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export const SignUpCard: React.FC<{
  isGoogleEnabled: boolean;
  isOidcEnabled: boolean;
}> = () => {
  const router = useRouter();
  const signUp = api.user.auth.signUp.useMutation();
  const form = useForm({
    schema,
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    signUp.mutate(data);
    router.replace("/login");
  });

  return (
    <div className="container mx-auto mt-[150px] max-w-[375px]">
      <h1 className="mb-10 text-center text-3xl font-bold">
        Sign up for Ctrlplane
      </h1>
      <div className="space-y-6">
        <div className="space-y-2">
          <Form {...form}>
            <form onSubmit={onSubmit}>
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};
