"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import * as schema from "@ctrlplane/validators/auth";

import { api } from "~/trpc/react";

export const SignUpCard: React.FC = () => {
  const router = useRouter();
  const signUp = api.user.auth.signUp.useMutation();
  const form = useForm({
    schema: schema.signUpSchema,
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    const lastEnteredEmail = localStorage.getItem("lastEnteredEmail");
    if (lastEnteredEmail) form.setValue("email", lastEnteredEmail);

    const subscription = form.watch(
      (value, { name }) =>
        name === "email" &&
        localStorage.setItem("lastEnteredEmail", value.email ?? ""),
    );
    return () => subscription.unsubscribe();
  }, [form]);

  const onSubmit = form.handleSubmit((data) => {
    signUp
      .mutateAsync(data)
      .then(() => {
        signIn("credentials", data).then(() => router.push("/"));
      })
      .catch(() => {
        form.setError("root", {
          message: "Sign up failed. Please try again.",
        });
      });
  });

  return (
    <div className="container mx-auto mt-[150px] max-w-[375px]">
      <h1 className="mb-10 text-center text-3xl font-bold">
        Sign up for Ctrlplane
      </h1>
      <div className="space-y-6">
        <div className="space-y-2">
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
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
              <FormRootError />
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={signUp.isPending}
              >
                Continue
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};
