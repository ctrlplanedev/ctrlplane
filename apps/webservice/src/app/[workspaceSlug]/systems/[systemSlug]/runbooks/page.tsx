import type { Metadata } from "next";

import { RunbookGettingStarted } from "./RunbookGettingStarted";

export const metadata: Metadata = { title: "Runbooks - Systems" };

export default function Runbooks() {
  return <RunbookGettingStarted />;
}
