export const getBorderColor = (version: string, kind?: string): string => {
  if (version.includes("kubernetes")) return "#3b82f6";
  if (version.includes("terraform")) return "#8b5cf6";
  if (kind?.toLowerCase().includes("sharedcluster")) return "#3b82f6";
  return "#a3a3a3";
};
