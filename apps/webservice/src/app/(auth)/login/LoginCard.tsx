"use client";

import { signIn } from "next-auth/react";
import { TbBrandGoogle } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";

export const LoginCard: React.FC = () => {
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
            <TbBrandGithub /> Continue with Github
          </Button>
          <Button
            onClick={() => signIn("gitlab")}
            size="lg"
            className="w-full gap-2 rounded-lg bg-purple-700 p-6 text-lg tracking-normal text-white hover:bg-purple-600"
          >
            <TbBrandGitlab /> Continue with Gitlab
          </Button>
          <Button
            onClick={() => signIn("bitbucket")}
            size="lg"
            className="w-full gap-2 rounded-lg bg-blue-700 p-6 text-lg tracking-normal text-white hover:bg-blue-600"
          >
            <TbBrandBitbucket /> Continue with Bitbucket
          </Button> */}
          <Button
            onClick={() => signIn("google")}
            size="lg"
            className="w-full gap-2 rounded-lg bg-red-700 p-6 text-lg tracking-normal text-white hover:bg-red-600"
          >
            <TbBrandGoogle /> Continue with Google
          </Button>
        </div>
        {/* <Separator />
        <div className="space-y-2">
          <Button
            size="lg"
            variant="outline"
            className="w-full gap-2 rounded-lg p-6 text-lg tracking-normal"
          >
            <TbLock /> Continue with SSO
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full gap-2 rounded-lg p-6 text-lg font-semibold tracking-normal"
          >
            <TbKey /> Login with Passkey
          </Button>
        </div> */}
      </div>
    </div>
  );
};
