"use client";

import { useState } from "react";

export type Filter<K extends string, V> = {
  key: K;
  value: V;
};

export const useFilters = <T extends Filter<string, any>>(
  defaultFilters?: T[],
) => {
  const [filters, setFilters] = useState<T[]>(defaultFilters ?? []);
  const addFilters = (newFilters: T[]) =>
    setFilters([...filters, ...newFilters]);
  const removeFilter = (idx: number) =>
    setFilters(filters.filter((_, i) => i !== idx));
  const clearFilters = () => setFilters([]);
  const updateFilter = (idx: number, filter: T) =>
    setFilters(filters.map((f, i) => (i === idx ? filter : f)));
  return { filters, addFilters, removeFilter, clearFilters, updateFilter };
};
