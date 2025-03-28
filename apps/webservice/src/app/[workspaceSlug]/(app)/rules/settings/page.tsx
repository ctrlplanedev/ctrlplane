"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { IconMenu2, IconSettings } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";
import { Switch } from "@ctrlplane/ui/switch";

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { PageHeader } from "../../_components/PageHeader";

export default function RuleSettingsPage() {
  const params = useParams<{ workspaceSlug: string }>();
  
  return (
    <div className="flex h-full flex-col">
      <PageHeader className="z-10">
        <SidebarTrigger name={Sidebars.Rules}>
          <IconMenu2 className="h-4 w-4" />
        </SidebarTrigger>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/${params.workspaceSlug}/rules`}>Rules</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Settings</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>
      
      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <IconSettings className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold">Rule Settings</h1>
            <p className="text-sm text-muted-foreground">
              Configure global settings for rule behavior
            </p>
          </div>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Default Rule Behavior</CardTitle>
            <CardDescription>
              Configure how rules behave by default when created
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Rules Enabled by Default</p>
                <p className="text-sm text-muted-foreground">
                  When enabled, new rules will be active upon creation
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Default Priority</p>
                <p className="text-sm text-muted-foreground">
                  The default priority assigned to new rules
                </p>
              </div>
              <div className="text-sm font-medium">100</div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm">Save Changes</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rule Notifications</CardTitle>
            <CardDescription>
              Configure how rule events are reported
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Send email notifications for rule violations
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Slack Integration</p>
                <p className="text-sm text-muted-foreground">
                  Send rule events to Slack channels
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm">Configure Notifications</Button>
          </CardFooter>
        </Card>
        </div>
      </div>
    </div>
  );
}