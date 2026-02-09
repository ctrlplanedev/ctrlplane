"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SiGoogle, SiOkta } from "@icons-pack/react-simple-icons";
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

const signInOkta = () => {
  void authClient.signIn.oauth2({ providerId: "okta", callbackURL: "/workspaces" });
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
  const isOktaEnabled = authConfig?.oktaEnabled ?? false;
  const isGoogleEnabled = authConfig?.googleEnabled ?? false;
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
              {isGoogleEnabled && <Button
                onClick={signInGoogle}
                variant="outline"
                className="h-10 w-full gap-2 border-border/50 bg-white text-neutral-900 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
              >
                <SiGoogle />
                <span>Continue with Google</span>
              </Button>}
              {isOktaEnabled && <Button
                onClick={signInOkta}
                variant="outline"
                className="h-10 w-full gap-2 border-border/50 bg-white text-neutral-900 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
              >
                <SiOkta />
                <span>Continue with Okta</span>
              </Button>}
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
