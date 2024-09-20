import React from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { SiGithub, SiGooglecalendar, SiSlack } from "react-icons/si";

import { auth } from "@ctrlplane/auth";
import { Button } from "@ctrlplane/ui/button";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";

import { api } from "~/trpc/server";
import UpsertUsername from "./UpsertUsername";

const defaultAvatar = "/apple-touch-icon.png";

export default async function AccountSettingProfilePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = await api.user.viewer();
  const { image, name, email } = user;

  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 h-[calc(100vh-120px)] overflow-auto">
      <div className="container mx-auto max-w-2xl space-y-8 py-8">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your Ctrlplane profile
          </p>
        </div>

        {/* Profile Section */}
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
            {/* Email */}
            <li className="border-b py-6 lg:mt-0">
              <div className="flex flex-row items-center justify-between">
                <Label>Email</Label>
                <Input readOnly value={email} className="w-64" />
              </div>
            </li>
            {/* Full Name */}
            <li className="border-b pb-6">
              <div className="flex flex-col justify-between lg:flex-row lg:items-center lg:space-x-8">
                <Label>Full name</Label>
                <Input readOnly value={name ?? ""} className="w-64" />
              </div>
            </li>
            {/* Username */}
            <li className="pb-6">
              <div className="flex flex-col justify-between lg:flex-row lg:items-center lg:space-x-8">
                <span>
                  <Label>Username</Label>
                  <p className="text-sm text-gray-400 md:w-64">
                    Nickname or first name, however you want to be called in
                    Ctrlplane
                  </p>
                </span>
                <UpsertUsername user={user} className="w-64" />
              </div>
            </li>
          </section>
        </ul>

        {/* Personal Integrations Section */}
        <ul>
          <section className="space-y-6 rounded-t-lg bg-neutral-800/70 p-6 shadow-lg">
            <Label className="text-sm font-semibold">
              Personal Integrations
            </Label>
          </section>
          <section className="space-y-6 rounded-b-lg border border-neutral-800/70 bg-background px-6 shadow-lg">
            {/* Slack */}
            <li className="border-b py-6 lg:mt-0">
              <div className="flex flex-col justify-between lg:flex-row lg:items-center">
                <SiSlack className="mr-2 h-4 w-4" />
                <span className="w-96">
                  <Label>Slack Account</Label>
                  <p className="w-full text-sm text-gray-400">
                    Link your Slack account to receive personal notifications.
                  </p>
                </span>
                <Button variant="outline" className="w-32">
                  Connect
                </Button>
              </div>
            </li>
            {/* GitHub */}
            <li className="border-b pb-6">
              <div className="flex flex-col justify-between lg:flex-row lg:items-center">
                <SiGithub className="mr-2 h-4 w-4" />
                <span className="w-96">
                  <Label>GitHub</Label>
                  <p className="w-full text-sm text-gray-400">
                    Link Pull Requests with your account.
                  </p>
                </span>
                <Button variant="outline" className="w-32">
                  Connect
                </Button>
              </div>
            </li>
            {/* Google Calendar */}
            <li className="pb-6">
              <div className="flex flex-col justify-between lg:flex-row lg:items-center">
                <SiGooglecalendar className="mr-2 h-4 w-4" />
                <span className="w-96">
                  <Label>Google Calendar</Label>
                  <p className="text-sm text-gray-400">
                    Display your out-of-office status in Ctrlplane.
                  </p>
                </span>
                <Button variant="outline" className="w-32">
                  Connect
                </Button>
              </div>
            </li>
          </section>
        </ul>
      </div>
    </div>
  );
}
