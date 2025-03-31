"use client";

import { useState } from "react";

import { api } from "~/trpc/react";

const PAGE_SIZE = 9;

export const EnvironmentPageContent: React.FC<{
  systemId: string;
}> = ({ systemId }) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const allEnvironmentsQ = api.environment.bySystemIdWithSearch.useQuery({
    systemId,
  });
};
