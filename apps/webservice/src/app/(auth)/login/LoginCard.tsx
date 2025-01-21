"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { IconBrandGoogleFilled, IconLock } from "@tabler/icons-react";
import { signIn } from "next-auth/react";
import { useLocalStorage } from "react-use";

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
import { Separator } from "@ctrlplane/ui/separator";
import * as schema from "@ctrlplane/validators/auth";

export const LoginCard: React.FC<{
  isCredentialsAuthEnabled: boolean;
  isGoogleEnabled: boolean;
  isOidcEnabled: boolean;
}> = ({ isCredentialsAuthEnabled, isGoogleEnabled, isOidcEnabled }) => {
  const router = useRouter();
  const form = useForm({
    schema: schema.signInSchema,
    defaultValues: { email: "", password: "" },
  });

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
    await signIn("credentials", { ...data })
      .then(() => router.push("/"))
      .catch(() => {
        form.setError("root", {
          message: "Sign in failed. Please try again.",
        });
      });
  });

  return (
    <div className="container mx-auto max-w-[350px]">
      <h1 className="mb-10 flex items-center justify-center gap-4 text-center text-3xl font-bold">
        <Image
          src="/android-chrome-192x192.png"
          alt="Ctrlplane Logo"
          width={32}
          height={32}
        />{" "}
        Ctrlplane
      </h1>
      <div className="space-y-8">
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
                      <Input {...field} className="bg-neutral-950" />
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
                      <Input
                        {...field}
                        type="password"
                        className="bg-neutral-950"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormRootError />
              <Button type="submit" className="w-full">
                Login
              </Button>
            </form>
          </Form>
        )}

        {isCredentialsAuthEnabled && (isGoogleEnabled || isOidcEnabled) && (
          <Separator />
        )}

        <div className="space-y-2">
          {isGoogleEnabled && (
            <Button
              onClick={() => signIn("google")}
              className="h-12 w-full gap-4 rounded-lg bg-white tracking-normal hover:bg-neutral-200"
            >
              <IconBrandGoogleFilled className="h-5 w-5" /> Continue with Google
            </Button>
          )}

          {isOidcEnabled && (
            <Button
              onClick={() => signIn("oidc")}
              variant="outline"
              className="w-full gap-4 rounded-lg tracking-normal"
            >
              <IconLock /> Continue with SSO
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
