"use client";

import React from "react";
import Link from "next/link";
import {
  TbBookFilled,
  TbMessage,
  TbPlane,
  TbShip,
  TbTextWrap,
  TbTool,
  TbUser,
  TbUserPlus,
  TbUsers,
  TbUsersGroup,
  TbUserShield,
} from "react-icons/tb";

import { Card } from "@ctrlplane/ui/card";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@ctrlplane/ui/navigation-menu";

const ProductContent: React.FC = () => {
  return (
    <div className="grid w-[900px] grid-cols-3 gap-8 p-5">
      <div>
        <p className="mb-1 font-semibold">Features</p>
        <div>
          <Link
            href="/features/operations"
            className="flex gap-4 rounded-md p-2 transition-all hover:bg-neutral-700/50"
          >
            <div className="mt-1">
              <TbShip />
            </div>
            <div className="flex-grow">
              <p>Deployments</p>
              <p className="text-sm text-muted-foreground">
                Ship software faster.
              </p>
            </div>
          </Link>

          <Link
            href="/features/operations"
            className="flex gap-4 rounded-md p-2 transition-all hover:bg-neutral-700/50"
          >
            <div className="mt-1">
              <TbUsers />
            </div>
            <div className="flex-grow">
              <p>Tenants</p>
              <p className="text-sm text-muted-foreground">
                Deploy to many customers.
              </p>
            </div>
          </Link>

          <Link
            href="/features/operations"
            className="flex gap-4 rounded-md p-2 transition-all hover:bg-neutral-700/50"
          >
            <div className="mt-1">
              <TbTool />
            </div>
            <div className="flex-grow">
              <p>Runbooks</p>
              <p className="text-sm text-muted-foreground">
                Automate operations and incident response.
              </p>
            </div>
          </Link>

          <Link
            href="/features"
            className="flex gap-4 rounded-md p-2 transition-all hover:bg-neutral-700/50"
          >
            <div className="mt-1">
              <TbPlane />
            </div>
            <div className="flex-grow">
              <p>All features</p>
              <p className="text-sm text-muted-foreground">
                See all capabilities
              </p>
            </div>
          </Link>
        </div>
      </div>

      <Card className="flex h-full flex-col justify-center gap-4 rounded-xl border border-[rgba(255,255,255,0.10)] bg-[rgba(40,40,40,0.20)] p-6 shadow-[2px_4px_16px_0px_rgba(248,248,248,0.06)_inset]">
        <TbUsersGroup className="text-3xl" />
        <div>Tenants</div>
        <p className="text-sm text-muted-foreground">
          Manage fleets of deployments at any scale, across mutiple clouds,
          across mutiple continents.
        </p>

        <div>
          <Link href="/tenants" className="text-sm hover:text-blue-300">
            Learn more
          </Link>
        </div>
      </Card>

      <Card className="flex h-full flex-col justify-center gap-4 rounded-xl border border-[rgba(255,255,255,0.10)] bg-[rgba(40,40,40,0.20)] p-6 shadow-[2px_4px_16px_0px_rgba(248,248,248,0.06)_inset]">
        <TbUserShield className="text-3xl" />
        <div>Developer Centric</div>
        <p className="text-sm text-muted-foreground">
          Isolate services and application deployment ownership to teams across
          the fleet.
        </p>

        <div>
          <Link href="/tenants" className="text-sm hover:text-blue-300">
            Learn more
          </Link>
        </div>
      </Card>
    </div>
  );
};

export const NavbarMenu: React.FC = () => {
  return (
    <NavigationMenu>
      <NavigationMenuList className="w-[550px]">
        <NavigationMenuItem>
          <NavigationMenuTrigger>Product</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ProductContent />
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="w-[550px]">
              <div className="flex gap-4 p-5">
                <div className="mt-1 text-blue-300">
                  <TbBookFilled />
                </div>
                <div className="flex-grow">
                  <Link
                    href="https://docs.ctrlplane.dev"
                    className="font-semibold hover:text-blue-300"
                  >
                    Documentation
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    Start integrating Ctrlplane's products and tools
                  </p>
                  <div className="mt-8 grid w-full grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                        Getting started
                      </p>
                      <Link
                        className="block"
                        href="https://docs.ctrlplane.dev/getting-started/kubernetes"
                      >
                        Deploy to Kubernetes
                      </Link>
                      <Link
                        className="block"
                        href="https://docs.ctrlplane.dev/getting-started/runbook"
                      >
                        Create a Runbook
                      </Link>
                      <Link
                        className="block"
                        href="https://docs.ctrlplane.dev/glossary"
                      >
                        Glossary
                      </Link>
                    </div>
                    <div>
                      <div className="space-y-2">
                        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                          Key Concepts
                        </p>
                        <Link
                          className="block"
                          href="https://docs.ctrlplane.dev/deployments"
                        >
                          Deployments
                        </Link>
                        <Link
                          className="block"
                          href="https://docs.ctrlplane.dev/targets/introduction"
                        >
                          Targets
                        </Link>
                        <Link
                          className="block"
                          href="https://docs.ctrlplane.dev/environments"
                        >
                          Environments
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger>Company</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[550px] grid-cols-2 gap-5 p-5">
              <div className="flex h-full items-center">
                <div className="space-y-2 p-5">
                  <div className="flex items-center gap-4">
                    <TbPlane />
                    <p>Brand</p>
                  </div>

                  <div className="flex items-center gap-4">
                    <TbUser />
                    <p>Contact us</p>
                  </div>

                  <div className="flex items-center gap-4">
                    <TbTextWrap />
                    <p>Media &amp; News</p>
                  </div>

                  <div className="flex items-center gap-4">
                    <TbUserPlus />
                    <p>Careers</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <TbUsers />
                    <p>Our partners</p>
                  </div>
                </div>
              </div>
              <Card className="flex h-full flex-col justify-center gap-4 rounded-xl border border-[rgba(255,255,255,0.10)] bg-[rgba(40,40,40,0.20)] p-6 shadow-[2px_4px_16px_0px_rgba(248,248,248,0.06)_inset]">
                <TbMessage className="text-3xl" />

                <div>About us</div>
                <p className="text-sm text-muted-foreground">
                  Meet the team behind Ctrlplane.
                </p>

                <div>
                  <Link href="/tenants" className="text-sm hover:text-blue-300">
                    Learn more
                  </Link>
                </div>
              </Card>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <Link href="/contact" legacyBehavior passHref>
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              Contact
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
};
