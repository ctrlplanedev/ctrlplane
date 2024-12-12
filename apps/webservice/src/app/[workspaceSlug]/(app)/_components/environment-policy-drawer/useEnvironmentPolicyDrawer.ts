"use client";

import { useRouter, useSearchParams } from "next/navigation";

import type { EnvironmentPolicyDrawerTab } from "./EnvironmentPolicyDrawer";

const tabParam = "tab";
const useEnvironmentPolicyDrawerTab = () => {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get(tabParam) as EnvironmentPolicyDrawerTab | null;

  const setTab = (tab: EnvironmentPolicyDrawerTab | null) => {
    const url = new URL(window.location.href);
    if (tab === null) {
      url.searchParams.delete(tabParam);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
      return;
    }
    url.searchParams.set(tabParam, tab);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  return { tab, setTab };
};

const param = "environment_policy_id";
export const useEnvironmentPolicyDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const environmentPolicyId = params.get(param);
  const { tab, setTab } = useEnvironmentPolicyDrawerTab();

  const setEnvironmentPolicyId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id === null) {
      url.searchParams.delete(param);
      url.searchParams.delete(tabParam);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`);
      return;
    }
    url.searchParams.set(param, id);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const removeEnvironmentPolicyId = () => setEnvironmentPolicyId(null);

  return {
    environmentPolicyId,
    setEnvironmentPolicyId,
    removeEnvironmentPolicyId,
    tab,
    setTab,
  };
};
