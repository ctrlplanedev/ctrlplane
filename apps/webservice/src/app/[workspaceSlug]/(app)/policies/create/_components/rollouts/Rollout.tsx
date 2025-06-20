"use client";

import React from "react";

import { PositionGrowthFactor } from "./PositionGrowthFactor";
import { RolloutPreview } from "./RolloutPreview";
import { RolloutTypeSelector } from "./RolloutTypeSelector";
import { TimeScaleInterval } from "./TimeScaleInterval";

const Header: React.FC = () => (
  <div className="max-w-xl space-y-1">
    <h2 className="text-lg font-semibold">Rollouts</h2>
    <p className="text-sm text-muted-foreground">
      Control the rollout of deployments
    </p>
  </div>
);

export const Rollout: React.FC = () => (
  <div className="space-y-6">
    <Header />
    <RolloutTypeSelector />
    <TimeScaleInterval />
    <PositionGrowthFactor />
    <RolloutPreview />
  </div>
);
