"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconBrandGoogle, IconLock } from "@tabler/icons-react";
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
    <div className="container mx-auto mt-[150px] max-w-[375px]">
      <h1 className="mb-10 text-center text-3xl font-bold">
        Login to Ctrlplane
      </h1>
      <div className="space-y-6">
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
              <Button type="submit" className="w-full">
                Login
              </Button>
            </form>
          </Form>
        )}
        <div className="space-y-2">
          {/* <Button
            onClick={() => signIn("github")}
            size="lg"
            className="w-full gap-2 rounded-lg bg-neutral-700 p-6 text-lg tracking-normal text-white hover:bg-neutral-600"
          >
            <IconBrandGithub /> Continue with Github
          </Button>
          <Button
            onClick={() => signIn("gitlab")}
            size="lg"
            className="w-full gap-2 rounded-lg bg-purple-700 p-6 text-lg tracking-normal text-white hover:bg-purple-600"
          >
            <IconBrandGitlab /> Continue with Gitlab
          </Button>
          <Button
            onClick={() => signIn("bitbucket")}
            size="lg"
            className="w-full gap-2 rounded-lg bg-blue-700 p-6 text-lg tracking-normal text-white hover:bg-blue-600"
          >
            <IconBrandBitbucket /> Continue with Bitbucket
          </Button> */}

          {isGoogleEnabled && (
            <Button
              onClick={() => signIn("google")}
              size="lg"
              className="w-full gap-2 rounded-lg bg-red-700 p-6 text-lg tracking-normal text-white hover:bg-red-600"
            >
              <IconBrandGoogle className="h-4 w-4" /> Continue with Google
            </Button>
          )}
          {isOidcEnabled && (
            <Button
              onClick={() => signIn("oidc")}
              size="lg"
              variant="outline"
              className="w-full gap-2 rounded-lg p-6 text-lg tracking-normal"
            >
              <IconLock /> Continue with SSO
            </Button>
          )}
          {/* <Button
            size="lg"
            variant="outline"
            className="w-full gap-2 rounded-lg p-6 text-lg font-semibold tracking-normal"
          >
            <IconKey /> Login with Passkey
          </Button> */}
        </div>
      </div>
    </div>
  );
};
