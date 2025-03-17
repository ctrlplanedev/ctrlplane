import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Workspace | Ctrlplane",
  description:
    "Create a new workspace to organize your systems and deployments in Ctrlplane.",
};

export default function WorkspaceCreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
