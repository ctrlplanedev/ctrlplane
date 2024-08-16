import React from "react";
import Link from "next/link";
import { TbPlane } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";

import { NavbarMenu } from "./NavbarMenu";

export const Navbar: React.FC = () => {
  return (
    <div className="fixed left-0 top-0 z-30 w-full bg-transparent">
      <div className="container mx-auto mt-2 flex max-w-6xl items-center justify-between rounded-xl border p-2 backdrop-blur-xl">
        <Link
          href="/"
          className="flex items-center gap-2 pl-2 pr-10 font-semibold"
        >
          <TbPlane className="text-2xl" /> Ctrlplane
        </Link>

        <NavbarMenu />

        <div className="flex gap-2 pl-10">
          <Button variant="secondary">Log in</Button>
          <Button className="bg-white">Sign up</Button>
        </div>
      </div>
    </div>
  );
};
