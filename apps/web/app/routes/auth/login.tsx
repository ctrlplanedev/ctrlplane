"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { authClient } from "~/api/auth-client";
import { useAuthConfig } from "~/api/auth-config";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";

const signInGoogle = () => {
  void authClient.signIn.social({ provider: "google" });
};

function LoginSeparator() {
  return (
    <div className="flex items-center gap-3">
      <Separator className="flex-1" />
      <span className="text-sm text-muted-foreground">or</span>
      <Separator className="flex-1" />
    </div>
  );
}

const signInEmailPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function LoginEmailPassword() {
  const form = useForm<z.infer<typeof signInEmailPasswordSchema>>({
    resolver: zodResolver(signInEmailPasswordSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: z.infer<typeof signInEmailPasswordSchema>) => {
    void authClient.signIn.email({
      ...data,
      rememberMe: true,
      callbackURL: "/workspaces",
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-2">
          <Button type="submit" className="w-full">
            Sign in
          </Button>
          <span className="text-xs text-muted-foreground">
            Don't have an account?{" "}
            <a
              href="/sign-up"
              className="cursor-pointer text-primary underline"
            >
              Sign up
            </a>
          </span>
        </div>
      </form>
    </Form>
  );
}

export default function Login() {
  const authConfig = useAuthConfig();
  const isCredentialsEnabled = authConfig?.credentialsEnabled ?? false;

  return (
    <div className="bg-linear-to-br flex min-h-screen items-center justify-center from-background via-background to-muted/20 p-4">
      <div className="mx-auto w-full" style={{ maxWidth: "400px" }}>
        {/* Logo */}
        <div className="mb-6 flex items-center justify-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 p-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-10 w-10 text-primary transition-all"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <div className="absolute inset-0 animate-pulse rounded-full border border-primary/20"></div>
          </div>
        </div>

        <Card className="overflow-hidden border-border/30 bg-card/60 shadow-xl backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-2xl">
              Welcome to Ctrlplane
            </CardTitle>
            <CardDescription className="text-center">
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-6">
            <div className="space-y-3">
              <Button
                onClick={signInGoogle}
                variant="outline"
                className="h-10 w-full gap-2 border-border/50 bg-white text-neutral-900 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </Button>
              {isCredentialsEnabled ? (
                <>
                  <LoginSeparator />
                  <LoginEmailPassword />
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
