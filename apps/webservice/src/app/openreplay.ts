"use client";

import { useEffect } from "react";
import Tracker from "@openreplay/tracker";

import { env } from "~/env";

let tracker: Tracker | undefined;

if (env.NEXT_PUBLIC_OPENREPLAY_PROJECT_KEY) {
  console.log(
    `Initializing OpenReplay ingestion: ${env.NEXT_PUBLIC_OPENREPLAY_INGEST_POINT}`,
  );
  tracker = new Tracker({
    projectKey: env.NEXT_PUBLIC_OPENREPLAY_PROJECT_KEY,
    ingestPoint: env.NEXT_PUBLIC_OPENREPLAY_INGEST_POINT,
  });
}

const Openreplay: React.FC<{ userId: string | undefined }> = ({ userId }) => {
  useEffect(() => {
    if (typeof window !== "undefined" && tracker != null) {
      tracker.start({ userID: userId, forceNew: true });
    }
  }, [userId]);

  return null;
};

export default Openreplay;
