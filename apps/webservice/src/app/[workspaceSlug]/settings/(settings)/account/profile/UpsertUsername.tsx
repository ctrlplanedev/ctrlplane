"use client";

import type { User } from "@ctrlplane/db/schema";
import type { ChangeEvent } from "react";
import { useState } from "react";

import { Input } from "@ctrlplane/ui/input";
import { toast } from "@ctrlplane/ui/toast";

import { api } from "~/trpc/react";

export function UpsertUsername({
  user,
  className,
}: {
  user: User;
  className?: string;
}) {
  const [username, setUsername] = useState(user.username);
  const [cachedUsername, setCachedUsername] = useState(user.username);
  const updateProfile = api.profile.update.useMutation();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    setCachedUsername(e.target.value);

  const handleBlur = () =>
    cachedUsername !== username &&
    updateProfile
      .mutateAsync({ username: cachedUsername ?? "" })
      .then(() => {
        setUsername(cachedUsername);
        toast.success("Username updated");
      })
      .catch((error) => {
        console.error(error);
        toast.error("Failed to update username");
      });

  return (
    <Input
      value={cachedUsername ?? ""}
      className={className}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
