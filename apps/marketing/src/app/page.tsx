import type { Metadata } from "next";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  TbBolt,
  TbCheck,
  TbChevronRight,
  TbPlant,
  TbRocket,
  TbShield,
  TbShip,
  TbTerminal,
  TbUser,
} from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";

import { Feature } from "./FeatureCard";
import { Footer } from "./Footer";
import { Globe } from "./Globe";
import { HeroIntegrationIcons } from "./HeroIntegrationIcons";
import { Spotlight } from "./Spotlight";

export const metadata: Metadata = {
  title: "Ctrlplane - Ship software faster",
  description:
    "Empowers your teams to build, test, and deploy software with speed, reliability, and peace of mind.",
};

const OperationsShipFasterCard: React.FC = () => (
  <div className="container mt-36 max-w-6xl">
    <div className="rounded-3xl border-2">
      <div className="relative m-0 grid grid-cols-3 overflow-x-clip">
        <div className="col-span-2 space-y-8 p-20">
          <div className="font-semibold uppercase tracking-wider text-purple-400">
            Operations
          </div>
          <div className="text-4xl font-semibold">
            Deliver Software 10x faster
          </div>
          <div>
            Ctrlplane empowers your team to break down barriers and accelerate
            shipping software.
          </div>

          <div className="space-y-6">
            <div className="flex gap-2">
              <TbCheck className="shrink-0 text-2xl text-purple-300" />
              <span>Release progressively, rollback instantly.</span>
            </div>

            <div className="flex gap-2">
              <TbCheck className="shrink-0 text-2xl text-purple-300" />
              <span>Full visibility into every deployment.</span>
            </div>
            <div className="flex  gap-2">
              <TbCheck className="shrink-0 text-2xl text-purple-300" />
              <span>Connects seamlessly with your existing CI/CD tools</span>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <Link
              href="/features/operations"
              className="inline-block rounded-lg border-2 border-purple-400 p-4 px-5 text-lg font-semibold"
            >
              Get started
            </Link>
            <Link
              href="/features/operations"
              className="flex items-center gap-2 text-purple-400"
            >
              Explore de-risked releases <TbChevronRight />
            </Link>
          </div>
        </div>
        <Globe className="absolute -right-44 -top-2" />
      </div>
    </div>
  </div>
);

const Customers: React.FC = () => (
  <div className="container mx-auto mb-48 mt-20 max-w-4xl text-center text-lg">
    <div className="">
      Powering some of the world's most innovative companies.
    </div>
    <div className="text-muted-foreground">
      From next-gen startups to established enterprises.
    </div>
    <div className="mt-16 grid grid-cols-3 items-center align-middle">
      <Image
        className="mx-auto invert"
        src="/microsoft-logo-white.png"
        alt="Microsoft"
        width={175}
        height={100}
      />
      <Image
        className="mx-auto"
        src="/new-relic-logo-white.png"
        alt="New Relic"
        width={155}
        height={100}
      />
      <Image
        className="mx-auto mb-2 invert"
        src="/okta-logo-white.png"
        alt="Okta"
        width={100}
        height={50}
      />
    </div>
  </div>
);

const TopHeroLanding: React.FC = () => (
  <div className="relative h-[850px] w-full overflow-hidden rounded-md antialiased md:items-center">
    <Spotlight className="-top-40 left-0 md:-top-20 md:left-60 " fill="white" />
    <div className="pointer-events-none absolute left-0 top-0 z-[1]"></div>

    <div className="relative z-10  mx-auto mt-40 w-full max-w-6xl p-4 pt-20 md:pt-0">
      <h1 className="bg-opacity-50 bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-4xl font-semibold text-transparent md:text-7xl">
        Tired of Deployment <br />
        Chaos?
      </h1>
      <p className="mt-8 max-w-2xl text-xl font-normal text-neutral-300">
        Empowers your teams to build, test, and deploy software with speed,
        reliability, and peace of mind.
      </p>
      <div className="mt-8 flex items-center gap-2">
        <Button className="bg-white font-bold" size="lg">
          Deploy
        </Button>
        <Button
          variant="outline"
          className="border-2 border-white/50 bg-transparent font-bold hover:border-white"
          size="lg"
        >
          Request Demo
        </Button>
      </div>
      <HeroIntegrationIcons />
    </div>
  </div>
);

const FeaturesSection: React.FC = () => {
  const features = [
    {
      title: "Unify Existing CD/CI",
      description:
        "Unleash the full potential of CI/CD pipelines. Build pipelines once, reuse them everywhere.",
      icon: <TbBolt className="h-8 w-8 text-fuchsia-400" />,
      color: "fuchsia" as const,
    },
    {
      title: "Streamline Environments",
      description:
        "Say goodbye to the headache of maintaining multiple environments.",
      icon: <TbPlant className="h-8 w-8 text-violet-400" />,
      color: "violet" as const,
    },
    {
      title: "For Application Developers",
      description: "Let easily owner there systems across fleets of servers.",
      icon: <TbUser className="h-8 w-8 text-blue-400" />,
      color: "blue" as const,
    },
    {
      title: "Multi-tenant Architecture",
      description: "You can simply share passwords instead of buying new seats",
      icon: <TbTerminal className="h-8 w-8 text-cyan-400" />,
      color: "cyan" as const,
    },
    {
      title: "Strategic Rollout",
      description:
        "Critical changes, and roll out with a robust release management tools.",
      icon: <TbShip className="h-8 w-8 text-emerald-400" />,
      color: "emerald" as const,
    },
    {
      title: "Scale with Confidence",
      description: "Scale to 1,000+ of deployments with ease.",
      icon: <TbRocket className="h-8 w-8 text-lime-400" />,
      color: "lime" as const,
    },
    {
      title: "Policy-Driven Governance",
      description: "I just ran out of copy ideas. Accept my sincere apologies",
      icon: <TbShield className="h-8 w-8 text-amber-400" />,
      color: "amber" as const,
    },
    {
      title: "Built for developers",
      description:
        "Built for engineers, developers, dreamers, thinkers and doers.",
      icon: <TbUser className="h-8 w-8 text-red-400" />,
      color: "red" as const,
    },
  ];
  return (
    <div className="relative z-10 mx-auto grid  max-w-7xl grid-cols-1 py-10 md:grid-cols-2 lg:grid-cols-4">
      {features.map((feature, index) => (
        <Feature key={feature.title} {...feature} index={index} />
      ))}
    </div>
  );
};

const DeployRiskFreeSection: React.FC = () => (
  <div className="container mx-auto mt-36 max-w-6xl space-y-24 text-lg">
    <div className="mb-12 grid grid-cols-2 items-center gap-12">
      <h2 className="text-5xl font-semibold">
        Reliable and risk-free deployments
      </h2>
      <div className="mt-auto px-8 text-muted-foreground">
        The platform that gives high-velocity engineering teams the edge they
        need to move faster at every stage of the development lifecycle.
      </div>
    </div>

    <FeaturesSection />
  </div>
);

const CallToAction: React.FC = () => (
  <div className="mt-36 border-t bg-gradient-to-t  from-neutral-900/50">
    <div className="container mx-auto flex max-w-6xl items-end justify-between gap-10 py-32">
      <div className="max-w-[650px] text-5xl font-semibold leading-snug">
        Manage your deployments <span>with</span>{" "}
        <span className="inline-block bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text font-bold text-transparent">
          Ctrlplane
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="lg" className="h-12 px-4 text-lg font-bold">
          Get started
        </Button>
        <Button size="lg" variant="secondary" className="h-12 px-4 text-lg">
          Talk to sales
        </Button>
      </div>
    </div>
  </div>
);

export default function HomePage() {
  return (
    <>
      <TopHeroLanding />
      <Customers />
      <OperationsShipFasterCard />
      <DeployRiskFreeSection />
      <CallToAction />
      <Footer />
    </>
  );
}
