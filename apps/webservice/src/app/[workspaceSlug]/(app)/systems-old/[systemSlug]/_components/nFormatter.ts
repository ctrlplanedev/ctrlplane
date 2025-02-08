export const nFormatter = (num: number, digits: number) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: digits,
  }).format(num);
