"use client";

import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

export const GithubRedirectButton: React.FC<{
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
  githubUserId: string;
}> = ({ variant, className, githubUserId }) => {
  const router = useRouter();

  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => router.push("../workspace/integrations/github")}
    >
      {githubUserId ? "Disconnect" : "Connect"}
    </Button>
  );
};
