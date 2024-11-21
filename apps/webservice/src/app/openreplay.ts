"use client";

import { useEffect, useMemo } from "react";
import Tracker from "@openreplay/tracker";

const Openreplay: React.FC<{
  userId: string | undefined;
  projectKey: string | undefined;
  ingestPoint: string | undefined;
}> = ({ userId, projectKey, ingestPoint }) => {
  const tracker = useMemo(() => {
    if (projectKey == null) return null;
    return new Tracker({
      defaultInputMode: 0,
      projectKey,
      ingestPoint,
      respectDoNotTrack: false,
    });
  }, [projectKey, ingestPoint]);

  useEffect(() => {
    if (typeof window !== "undefined" && tracker != null) {
      tracker.start({ userID: userId });
    }
  }, [tracker, userId]);

  return null;
};

export default Openreplay;
