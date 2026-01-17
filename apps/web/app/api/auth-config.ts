import { useEffect, useState } from "react";

export type AuthConfig = {
  credentialsEnabled: boolean;
  googleEnabled: boolean;
  oidcEnabled: boolean;
};

const AUTH_CONFIG_ENDPOINT = "/api/auth/config";

export const useAuthConfig = () => {
  const [config, setConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    let isActive = true;

    const fetchConfig = async () => {
      try {
        const response = await fetch(AUTH_CONFIG_ENDPOINT);
        if (!response.ok) return;
        const data = (await response.json()) as AuthConfig;
        if (isActive) setConfig(data);
      } catch {
        // Ignore fetch failures and keep default state.
      }
    };

    void fetchConfig();

    return () => {
      isActive = false;
    };
  }, []);

  return config;
};
