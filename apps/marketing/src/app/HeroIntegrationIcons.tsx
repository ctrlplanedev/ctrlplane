"use client";

import React, { useEffect, useState } from "react";
import {
  SiAmazonaws,
  SiArgo,
  SiAzuredevops,
  SiBitbucket,
  SiCircleci,
  SiCloudbees,
  SiDigitalocean,
  SiGithub,
  SiGitlab,
  SiGooglecloud,
  SiHelm,
  SiKubernetes,
  SiMicrosoftazure,
  SiNomad,
  SiTeamcity,
  SiTerraform,
} from "react-icons/si";
import { TbPlane } from "react-icons/tb";

import { cn } from "@ctrlplane/ui";

import { BackgroundGradient } from "./GradientBorder";

function useRandomNumber(max: number) {
  const [number, setNumber] = useState(-1);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNumber(Math.floor(Math.random() * max));
    }, 3000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [max]);

  return number;
}

const IconCard: React.FC<{
  className?: string;
  onEnter?: () => void;
  onLeave?: () => void;
  children?: React.ReactNode;
}> = ({ className, children, onEnter, onLeave }) => {
  return (
    <div>
      <div
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        className={cn(
          "inline-block rounded-xl border-2 p-4 text-4xl shadow-lg drop-shadow-2xl transition-colors duration-1000",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
};

export const HeroIntegrationIcons: React.FC = () => {
  const randomNumLeft = useRandomNumber(8);
  const [leftHover, setLeftHover] = useState(false);
  const leftNum = leftHover ? -1 : randomNumLeft;

  const randomNumRight = useRandomNumber(8);
  const [rightHover, setRightHover] = useState(false);
  const rightNum = rightHover ? -1 : randomNumRight;

  return (
    <div className="mt-28">
      <div className="flex items-center justify-between">
        <div className="grid w-[400px] grid-cols-4 justify-between gap-4">
          <IconCard
            onEnter={() => setLeftHover(true)}
            onLeave={() => setLeftHover(false)}
            className={cn(
              leftNum === 0 && "border-white",
              "hover:border-white",
            )}
          >
            <SiGithub />
          </IconCard>
          <IconCard
            onEnter={() => setLeftHover(true)}
            onLeave={() => setLeftHover(false)}
            className={cn(
              leftNum === 1 && "border-green-400 text-green-400",
              "hover:border-green-400 hover:text-green-400",
            )}
          >
            <SiCircleci />
          </IconCard>
          <IconCard
            onEnter={() => setLeftHover(true)}
            onLeave={() => setLeftHover(false)}
            className={cn(
              leftNum === 2 && "border-orange-400 text-orange-400",
              "hover:border-orange-400 hover:text-orange-400",
            )}
          >
            <SiGitlab />
          </IconCard>
          <IconCard
            onEnter={() => setLeftHover(true)}
            onLeave={() => setLeftHover(false)}
            className={cn(
              leftNum === 3 && "border-blue-400 text-blue-400",
              "hover:border-blue-400 hover:text-blue-400",
            )}
          >
            <SiBitbucket />
          </IconCard>
          <IconCard
            onEnter={() => setLeftHover(true)}
            onLeave={() => setLeftHover(false)}
            className={cn(
              leftNum === 4 && "border-pink-400 text-pink-400",
              "hover:border-pink-400 hover:text-pink-400",
            )}
          >
            <SiTeamcity />
          </IconCard>
          <IconCard
            onEnter={() => setLeftHover(true)}
            onLeave={() => setLeftHover(false)}
            className={cn(
              leftNum === 5 && "border-cyan-400 text-cyan-400",
              "hover:border-cyan-400 hover:text-cyan-400",
            )}
          >
            <SiCloudbees />
          </IconCard>
          <IconCard
            onEnter={() => setLeftHover(true)}
            onLeave={() => setLeftHover(false)}
            className={cn(
              leftNum === 6 && "border-blue-400 text-blue-400",
              "hover:border-blue-400 hover:text-blue-400",
            )}
          >
            <SiAzuredevops />
          </IconCard>
          <IconCard
            onEnter={() => setLeftHover(true)}
            onLeave={() => setLeftHover(false)}
            className={cn(
              leftNum === 7 && "border-orange-400 text-orange-400",
              "hover:border-orange-400 hover:text-orange-400",
            )}
          >
            <SiArgo />
          </IconCard>
        </div>

        <div>
          <BackgroundGradient className="w-10" />
        </div>

        <div>
          <BackgroundGradient className="rounded-3xl bg-white p-4 text-5xl dark:bg-neutral-900 ">
            <TbPlane />
          </BackgroundGradient>
        </div>

        <div>
          <BackgroundGradient className="h-[0.5] w-10" />
        </div>

        <div className="grid w-[400px] grid-cols-4 justify-between gap-4">
          <IconCard
            onEnter={() => setRightHover(true)}
            onLeave={() => setRightHover(false)}
            className={cn(
              rightNum === 0 && "border-red-400 text-red-400",
              "hover:border-red-400 hover:text-red-400",
            )}
          >
            <SiGooglecloud />
          </IconCard>

          <IconCard
            onEnter={() => setRightHover(true)}
            onLeave={() => setRightHover(false)}
            className={cn(
              rightNum === 1 && "border-orange-400 text-orange-400",
              "hover:border-orange-400 hover:text-orange-400",
            )}
          >
            <SiAmazonaws />
          </IconCard>

          <IconCard
            onEnter={() => setRightHover(true)}
            onLeave={() => setRightHover(false)}
            className={cn(
              rightNum === 2 && "border-blue-400 text-blue-400",
              "hover:border-blue-400 hover:text-blue-400",
            )}
          >
            <SiMicrosoftazure />
          </IconCard>

          <IconCard
            onEnter={() => setRightHover(true)}
            onLeave={() => setRightHover(false)}
            className={cn(
              rightNum === 3 && "border-purple-400 text-purple-400",
              "hover:border-purple-400 hover:text-purple-400",
            )}
          >
            <SiTerraform />
          </IconCard>

          <IconCard
            onEnter={() => setRightHover(true)}
            onLeave={() => setRightHover(false)}
            className={cn(
              rightNum === 4 && "border-blue-400 text-blue-400",
              "hover:border-blue-400 hover:text-blue-400",
            )}
          >
            <SiDigitalocean />
          </IconCard>

          <IconCard
            onEnter={() => setRightHover(true)}
            onLeave={() => setRightHover(false)}
            className={cn(
              rightNum === 5 && "border-blue-400 text-blue-400",
              "hover:border-blue-400 hover:text-blue-400",
            )}
          >
            <SiKubernetes />
          </IconCard>
          <IconCard
            onEnter={() => setRightHover(true)}
            onLeave={() => setRightHover(false)}
            className={cn(
              rightNum === 6 && "border-blue-400 text-blue-400",
              "hover:border-blue-400 hover:text-blue-400",
            )}
          >
            <SiHelm />
          </IconCard>

          <IconCard
            onEnter={() => setRightHover(true)}
            onLeave={() => setRightHover(false)}
            className={cn(
              rightNum === 7 && "border-green-400 text-green-400",
              "hover:border-green-400 hover:text-green-400",
            )}
          >
            <SiNomad />
          </IconCard>
        </div>
      </div>
    </div>
  );
};
