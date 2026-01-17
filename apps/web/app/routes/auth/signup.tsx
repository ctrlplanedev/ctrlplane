import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { authClient } from "~/api/auth-client";
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

const signUpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function SignupForm() {
  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof signUpSchema>) => {
    const { error } = await authClient.signUp.email({ ...data });
    if (!error) window.location.href = "/workspaces";
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-2">
          <Button type="submit" className="w-full">
            Sign up
          </Button>
          <span className="text-xs text-muted-foreground">
            Already have an account?{" "}
            <a href="/login" className="cursor-pointer text-primary underline">
              Sign in
            </a>
          </span>
        </div>
      </form>
    </Form>
  );
}

export default function Signup() {
  return (
    <div className="bg-linear-to-br flex min-h-screen items-center justify-center from-background via-background to-muted/20 p-4">
      <div className="mx-auto w-full" style={{ maxWidth: "400px" }}>
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
              Create an account to continue
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-6">
            <SignupForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
