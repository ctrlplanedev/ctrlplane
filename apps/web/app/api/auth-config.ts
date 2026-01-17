import { trpc } from "./trpc";

export const useAuthConfig = () => {
  const { data } = trpc.auth.config.useQuery(undefined, {
    staleTime: 60_000,
  });

  return data ?? null;
};
