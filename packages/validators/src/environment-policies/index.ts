import type { ReleaseCondition } from "../releases";

export type RegexCheck = {
  evaluateWith: "regex";
  evaluate: string;
};

export type SemverCheck = {
  evaluateWith: "semver";
  evaluate: string;
};

export type FilterCheck = {
  evaluateWith: "filter";
  evaluate: ReleaseCondition;
};

export type NoneCheck = {
  evaluateWith: "none";
  evaluate: null;
};

export type VersionCheck = {
  evaluateWith: "regex" | "semver" | "filter" | "none";
  evaluate: string | ReleaseCondition | null;
};

export const isRegexCheck = (check: VersionCheck): check is RegexCheck =>
  check.evaluateWith === "regex";

export const isSemverCheck = (check: VersionCheck): check is SemverCheck =>
  check.evaluateWith === "semver";

export const isFilterCheck = (check: VersionCheck): check is FilterCheck =>
  check.evaluateWith === "filter";

export const isNoneCheck = (check: VersionCheck): check is NoneCheck =>
  check.evaluateWith === "none";
