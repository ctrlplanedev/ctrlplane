"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconLockAccess, IconMail, IconUser } from "@tabler/icons-react";
import { useLocalStorage } from "react-use";

import { signIn } from "@ctrlplane/auth";
import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
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
  const searchParams = useSearchParams();
  const acceptToken = searchParams.get("acceptToken");
  const [loading, setLoading] = useState(false);
  const signUp = api.user.auth.signUp.useMutation();
  const form = useForm({
    schema: schema.signUpSchema,
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const [lastEnteredEmail, setLastEnteredEmail] = useLocalStorage(
    "lastEnteredEmail",
    "",
  );

  useEffect(() => {
    if (lastEnteredEmail) form.setValue("email", lastEnteredEmail);

    const subscription = form.watch(
      (value, { name }) =>
        name === "email" && setLastEnteredEmail(value.email ?? ""),
    );
    return () => subscription.unsubscribe();
  }, [form, lastEnteredEmail, setLastEnteredEmail]);

  const onSubmit = form.handleSubmit((data) => {
    setLoading(true);

    signUp
      .mutateAsync(data)
      .then(async () => {
        await signIn.email({
          email: data.email,
          password: data.password,
          callbackURL: acceptToken ? `/join/${acceptToken}` : "/",
        });
        if (acceptToken) {
          router.push(`/join/${acceptToken}`);
          return;
        }
        router.refresh();
      })
      .catch((error) => {
        console.error("Sign up error:", error);
        form.setError("root", {
          message:
            error.message === "Email already exists"
              ? "This email is already registered. Please sign in instead."
              : "Sign up failed. Please try again.",
        });
      })
      .finally(() => {
        setLoading(false);
      });
  });

  return (
    <div className="mx-auto w-full" style={{ maxWidth: "350px" }}>
      <div className="mb-6 flex items-center justify-center">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 p-2">
          <Image
            src="/android-chrome-192x192.png"
            alt="Ctrlplane Logo"
            width={36}
            height={36}
            className="transition-all"
          />
          <div className="absolute inset-0 animate-pulse rounded-full border border-primary/20"></div>
        </div>
      </div>

      <Card className="overflow-hidden border-border/30 bg-card/60 shadow-xl backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-center text-2xl font-bold">
            Create an account
          </CardTitle>
          <CardDescription className="text-center">
            Get started with Ctrlplane for free
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <IconUser className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          data-testid="name"
                          className="bg-background/50 pl-10"
                          placeholder="John Doe"
                        />
                      </div>
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
                    <FormLabel>Work email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <IconMail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          data-testid="email"
                          className="bg-background/50 pl-10"
                          placeholder="you@company.com"
                        />
                      </div>
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
                      <div className="relative">
                        <IconLockAccess className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="password"
                          data-testid="password"
                          className="bg-background/50 pl-10"
                          placeholder="Create a secure password"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormRootError />

              <div className="mt-2 space-y-4">
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={loading || signUp.isPending}
                  data-testid="submit"
                >
                  {loading || signUp.isPending
                    ? "Creating account..."
                    : "Create account"}
                </Button>

                <p className="px-6 text-center text-xs text-muted-foreground">
                  By clicking "Create account", you agree to our
                  <Link href="#" className="mx-1 text-primary hover:underline">
                    Terms of Service
                  </Link>
                  and acknowledge our
                  <Link href="#" className="mx-1 text-primary hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="flex justify-center border-t border-border/30 bg-muted/20 p-4">
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:text-primary/80"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};
