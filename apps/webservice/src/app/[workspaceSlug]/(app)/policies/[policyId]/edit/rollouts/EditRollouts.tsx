"use client";

import React from "react";

import { PositionGrowthFactor } from "./_components/PositionGrowthFactor";
import { RolloutPreview } from "./_components/RolloutPreview";
import { RolloutSubmit } from "./_components/RolloutSubmit";
import { RolloutTypeSelector } from "./_components/RolloutTypeSelector";
import { TimeScaleInterval } from "./_components/TimeScaleInterval";

const Header: React.FC = () => (
  <div className="max-w-xl space-y-1">
    <h2 className="text-lg font-semibold">Rollouts</h2>
    <p className="text-sm text-muted-foreground">
      Control the rollout of deployments
    </p>
  </div>
);

export const EditRollouts: React.FC = () => (
  <div className="grid grid-cols-2 gap-4">
    <div className="col-span-1 space-y-6">
      <Header />
      <RolloutTypeSelector />
      <TimeScaleInterval />
      <PositionGrowthFactor />
      <RolloutSubmit />
    </div>
    <div className="col-span-1">
      <RolloutPreview />
    </div>
  </div>
);
