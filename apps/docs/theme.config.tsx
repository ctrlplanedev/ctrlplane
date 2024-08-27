import React from "react";
import { DocsThemeConfig } from "nextra-theme-docs";
import { TbPlane } from "react-icons/tb";

const config: DocsThemeConfig = {
  logo: (
    <div className="flex items-center gap-2 text-xl font-semibold">
      <TbPlane />
      Ctrlplane
    </div>
  ),
  useNextSeoProps() {
    return {
      titleTemplate: "%s – Ctrlplane",
    };
  },
  project: {},
  chat: {},
  sidebar: {
    defaultMenuCollapseLevel: 0,
  },
  editLink: { component: null },
  feedback: { content: null },
  footer: {
    component: () => {
      return (
        <div className="border-t border-neutral-800 bg-neutral-900 p-10">
          <div className="container mx-auto text-sm">
            <div className="mb-2 flex items-center gap-2 text-lg font-semibold">
              <TbPlane />
              Ctrlplane
            </div>
            <div className="text-neutral-400">
              &copy; {new Date().getUTCFullYear()} Ctrlplane. All rights
              reserved.
            </div>
          </div>
        </div>
      );
    },
  },
};

export default config;
