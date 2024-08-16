import React from "react";
import Link from "next/link";
import { SiGithub, SiLinkedin, SiYoutube } from "react-icons/si";
import { TbPlane } from "react-icons/tb";

export const Footer: React.FC = () => {
  return (
    <div className="border-t bg-neutral-900 p-20 ">
      <div className="wx-auto container grid max-w-6xl grid-cols-6">
        <div className="col-span-2 flex h-full flex-col justify-between">
          <div className="flex items-center gap-4">
            <TbPlane className="text-2xl" />
            <div className="text-muted-foreground">
              Ctrlplane - Ship software faster
            </div>
          </div>

          <div className="mt-auto flex items-center gap-6 text-lg text-muted-foreground">
            <SiYoutube />
            <SiGithub />
            <SiLinkedin />
          </div>
        </div>

        <div className="space-y-4 text-sm">
          <p>Product</p>
          <Link className="block text-muted-foreground" href={`/features`}>
            Features
          </Link>
          <Link className="block text-muted-foreground" href={`/integrations`}>
            Integrations
          </Link>
          <Link className="block text-muted-foreground" href={`/pricing`}>
            Pricing
          </Link>
          <Link className="block text-muted-foreground" href={`/changelog`}>
            Changelog
          </Link>
          <Link
            className="block text-muted-foreground"
            href={`https://docs.ctrlplane.dev`}
          >
            Docs
          </Link>
        </div>

        <div className="space-y-4 text-sm">
          <p>Company</p>
          <Link className="block text-muted-foreground" href={`/about-us`}>
            About us
          </Link>
          <Link className="block text-muted-foreground" href={`/blog`}>
            Blog
          </Link>
          <Link className="block text-muted-foreground" href={`/careers`}>
            Careers
          </Link>
          <Link className="block text-muted-foreground" href={`/customers`}>
            Customers
          </Link>
          <Link className="block text-muted-foreground" href={`/brand`}>
            Brand
          </Link>
        </div>

        <div className="space-y-4 text-sm">
          <p>Resources</p>
          <Link className="block text-muted-foreground" href={`/contact`}>
            Contact
          </Link>
          <Link
            className="block text-muted-foreground"
            href={`/privacy-policy`}
          >
            Privacy Policy
          </Link>
          <Link
            className="block text-muted-foreground"
            href={`/terms-of-service`}
          >
            Terms of service
          </Link>
        </div>

        <div className="space-y-4 text-sm">
          <p>Developers</p>
          <Link
            className="block text-muted-foreground"
            href={`https://docs.ctrlplane.dev/api`}
          >
            API
          </Link>
          <Link
            className="block text-muted-foreground"
            href={`https://status.ctrlplane.dev`}
          >
            Status
          </Link>
          <Link
            className="block text-muted-foreground"
            href={`https://github.com/ctrl-plane`}
          >
            GitHub
          </Link>
        </div>
      </div>
    </div>
  );
};
