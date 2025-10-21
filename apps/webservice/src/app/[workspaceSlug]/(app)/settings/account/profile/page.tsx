import React from "react";
import { headers } from "next/headers";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { SiGithub } from "@icons-pack/react-simple-icons";

import { auth } from "@ctrlplane/auth";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";

import { api } from "~/trpc/server";
import { GithubRedirectButton } from "./GithubRedirectButton";

const defaultAvatar = "/apple-touch-icon.png";

export default async function AccountSettingProfilePage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const { workspaceSlug } = params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (session == null) redirect("/login");
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();

  const user = await api.user.viewer();
  const { image, name, email } = user;
  const githubUser = await api.github.user.byUserId(session.user.id);
  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 overflow-auto">
      <div className="container mx-auto max-w-2xl space-y-8 py-8">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your Ctrlplane profile
          </p>
        </div>
        <ul>
          <section className="space-y-6 rounded-t-lg bg-neutral-800/70 p-6 shadow-lg">
            <li>
              <div className="relative flex items-center justify-center">
                <Label className="absolute left-0 top-0 text-sm">
                  Profile picture
                </Label>
                <Image
                  src={image ?? defaultAvatar}
                  alt="Profile picture"
                  quality={100}
                  width={100}
                  height={100}
                  className="rounded-full"
                  priority={true}
                  draggable={false}
                />
              </div>
            </li>
          </section>
          <section className="space-y-6 rounded-b-lg border border-neutral-800/70 bg-background px-6 shadow-lg">
            <li className="border-b py-6 lg:mt-0">
              <div className="flex flex-row items-center justify-between">
                <Label>Email</Label>
                <Input readOnly value={email} className="w-64" />
              </div>
            </li>
            <li className="pb-6">
              <div className="flex flex-col justify-between lg:flex-row lg:items-center lg:space-x-8">
                <Label>Full name</Label>
                <Input readOnly value={name ?? ""} className="w-64" />
              </div>
            </li>
          </section>
        </ul>
        <ul>
          <section className="space-y-6 rounded-t-lg bg-neutral-800/70 p-6 shadow-lg">
            <Label className="text-sm font-semibold">
              Personal Integrations
            </Label>
          </section>
          <section className="space-y-6 rounded-b-lg border border-neutral-800/70 bg-background px-6 shadow-lg">
            <li className="py-6">
              <div className="flex flex-col justify-between lg:flex-row lg:items-center">
                <SiGithub className="mr-2 h-4 w-4" />
                <span className="w-96">
                  <Label>GitHub</Label>
                  <p className="w-full text-sm text-gray-400">
                    Connect your GitHub account.
                  </p>
                </span>
                <GithubRedirectButton
                  variant="secondary"
                  className="w-32"
                  githubUserId={githubUser?.userId ?? ""}
                  workspace={workspace}
                />
              </div>
            </li>
          </section>
        </ul>
      </div>
    </div>
  );
}
