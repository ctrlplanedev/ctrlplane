"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconBrandGoogleFilled,
  IconLock,
  IconLockAccess,
  IconMail,
} from "@tabler/icons-react";
import { signIn } from "next-auth/react";
import { useLocalStorage } from "react-use";

import { signIn as betterAuthSignIn } from "@ctrlplane/auth";
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
import { Separator } from "@ctrlplane/ui/separator";
import * as schema from "@ctrlplane/validators/auth";

const signInGoogle = async () =>
  betterAuthSignIn.social({ provider: "google" });

export const LoginCard: React.FC<{
  isCredentialsAuthEnabled: boolean;
  isGoogleEnabled: boolean;
  isOidcEnabled: boolean;
}> = ({ isCredentialsAuthEnabled, isGoogleEnabled, isOidcEnabled }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const form = useForm({
    schema: schema.signInSchema,
    defaultValues: { email: "", password: "" },
  });

  const searchParams = useSearchParams();
  const acceptToken = searchParams.get("acceptToken");

  const [lastEnteredEmail, setLastEnteredEmail] = useLocalStorage(
    "lastEnteredEmail",
    "",
  );

  useEffect(() => {
    if (lastEnteredEmail) form.setValue("email", lastEnteredEmail);
    const subscription = form.watch(({ email }) =>
      setLastEnteredEmail(email ?? ""),
    );
    return () => subscription.unsubscribe();
  }, [form, lastEnteredEmail, setLastEnteredEmail]);

  const onSubmit = form.handleSubmit(async (data, event) => {
    event?.preventDefault();
    setLoading(true);

    try {
      await signIn("credentials", {
        ...data,
        redirect: false,
      }).then((response) => {
        if (response?.error) throw new Error(response.error);
        const redirectUrl = acceptToken ? `/join/${acceptToken}` : "/";
        router.push(redirectUrl);
      });
    } catch {
      form.setError("root", {
        message: "Sign in failed. Please check your credentials and try again.",
      });
    } finally {
      setLoading(false);
    }
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
            Welcome back
          </CardTitle>
          <CardDescription className="text-center">
            Sign in to your Ctrlplane account
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {isCredentialsAuthEnabled && (
            <Form {...form}>
              <form onSubmit={onSubmit} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <IconMail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            className="bg-background/50 pl-10"
                            placeholder="you@example.com"
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
                      <div className="flex items-center justify-between">
                        <FormLabel>Password</FormLabel>
                        <Link
                          href="#"
                          className="text-xs text-primary hover:text-primary/80"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <IconLockAccess className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            className="bg-background/50 pl-10"
                            placeholder="••••••••"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormRootError />
                <Button
                  name="login"
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </Form>
          )}

          {isCredentialsAuthEnabled && (isGoogleEnabled || isOidcEnabled) && (
            <div className="relative flex items-center justify-center">
              <Separator className="absolute w-full" />
              <span className="relative bg-card px-2 text-xs text-muted-foreground">
                OR CONTINUE WITH
              </span>
            </div>
          )}

          <div className="space-y-3">
            {isGoogleEnabled && (
              <Button
                onClick={signInGoogle}
                variant="outline"
                className="h-10 w-full gap-2 border-border/50 bg-white text-neutral-900 hover:bg-neutral-50 hover:text-neutral-900"
              >
                <IconBrandGoogleFilled className="h-4 w-4" />
                <span>Google</span>
              </Button>
            )}

            {isOidcEnabled && (
              <Button
                onClick={() => signIn("oidc")}
                variant="outline"
                className="h-10 w-full gap-2 border-border/50 bg-background/50 text-foreground backdrop-blur-sm hover:bg-background/70 hover:text-foreground"
              >
                <IconLock className="h-4 w-4" />
                <span>Single Sign-On (SSO)</span>
              </Button>
            )}
          </div>
        </CardContent>

        {isCredentialsAuthEnabled && (
          <CardFooter className="flex justify-center border-t border-border/30 bg-muted/20 p-4">
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link
                href={`/sign-up${acceptToken ? `?acceptToken=${acceptToken}` : ""}`}
                className="font-medium text-primary hover:text-primary/80"
                data-testid="sign-up-redirect-link"
              >
                Sign up for free
              </Link>
            </p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};
