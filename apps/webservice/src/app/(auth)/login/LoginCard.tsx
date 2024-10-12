"use client";

import { IconBrandGoogle, IconLock } from "@tabler/icons-react";
import { signIn } from "next-auth/react";

import { Button } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";

export const LoginCard: React.FC<{
  isGoogleEnabled: boolean;
  isOidcEnabled: boolean;
}> = ({ isGoogleEnabled, isOidcEnabled }) => {
  return (
    <div className="container mx-auto mt-[150px] max-w-[375px]">
      <h1 className="mb-10 text-center text-3xl font-bold">
        Log in to Ctrlplane
      </h1>
      <div className="space-y-6">
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
        </div>

        {isOidcEnabled && isGoogleEnabled && <Separator />}

        {isOidcEnabled && (
          <div className="space-y-2">
            <Button
              onClick={() => signIn("oidc")}
              size="lg"
              variant="outline"
              className="w-full gap-2 rounded-lg p-6 text-lg tracking-normal"
            >
              <IconLock /> Continue with SSO
            </Button>
            {/* <Button
            size="lg"
            variant="outline"
            className="w-full gap-2 rounded-lg p-6 text-lg font-semibold tracking-normal"
          >
            <IconKey /> Login with Passkey
          </Button> */}
          </div>
        )}
      </div>
    </div>
  );
};
