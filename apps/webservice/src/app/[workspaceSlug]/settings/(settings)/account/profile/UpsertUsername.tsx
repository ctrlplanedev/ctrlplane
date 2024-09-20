"use client";

import type { User } from "@ctrlplane/db/schema";
import type { ChangeEvent } from "react";
import { useState } from "react";

import { Input } from "@ctrlplane/ui/input";
import { toast } from "@ctrlplane/ui/toast";

import { api } from "~/trpc/react";

export default function UpsertUsername({
  user,
  className,
}: {
  user: User;
  className?: string;
}) {
  const [username, setUsername] = useState(user.username);
  const [cachedUsername, setCachedUsername] = useState(user.username);
  const updateProfile = api.profile.updateUsername.useMutation();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCachedUsername(e.target.value);
  };

  const handleBlur = async () => {
    if (cachedUsername === username) return;
    if (cachedUsername !== username) {
      await updateProfile
        .mutateAsync({
          username: cachedUsername ?? "",
        })
        .then(() => {
          toast.success("Username updated");
          setUsername(cachedUsername);
        })
        .catch((error) => {
          console.error(error);
          toast.error("Failed to update username");
        });
    }
  };

  return (
    <Input
      value={cachedUsername ?? ""}
      className={className}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
