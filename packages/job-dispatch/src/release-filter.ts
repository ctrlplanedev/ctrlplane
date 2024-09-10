/**
 * Release filter is a class that takes a list of releases
 * and filters them based on release filter functions passed to it.
 */

import { isPresent } from "ts-is-present";

import { Tx } from "@ctrlplane/db";
import {
  Deployment,
  Environment,
  EnvironmentPolicy,
  EnvironmentPolicyApproval,
  Release as ReleaseSchema,
} from "@ctrlplane/db/schema";

import { isSuccessCriteriaPassing } from "./policy-checker";

type Release = ReleaseSchema & {
  rank?: number;
  deployment?: Deployment;
  environment?: Environment;
  environmentPolicy?: EnvironmentPolicy;
  environmentPolicyApproval?: EnvironmentPolicyApproval;
};

export type ReleaseFilterFunc = (
  tx: Tx,
  releases: Release[],
) => Promise<Release[]>;

export class ReleaseFilter {
  private _releases: Release[];
  private _filters: ReleaseFilterFunc[];
  constructor(private db: Tx) {
    this._releases = [];
    this._filters = [];
  }

  releases(releases: Release[]) {
    this._releases = releases;
    return this;
  }

  filter(func: (release: Release) => boolean) {
    this._releases = this._releases.filter(func);
    return this;
  }

  async execute() {
    let r = this._releases;
    for (const func of this._filters) r = await func(this.db, r);
    return r;
  }
}

export const releaseFilter = (db: Tx) => new ReleaseFilter(db);

export const isPassingSuccessCriteriaPolicy = async (
  db: Tx,
  releases: Release[],
) =>
  Promise.all(
    releases.map(async (r) =>
      r.environmentPolicy == null ||
      (await isSuccessCriteriaPassing(db, r.environmentPolicy, r))
        ? r
        : null,
    ),
  ).then((results) => results.filter(isPresent));

export const isPassingApprovalPolicy = async (releases: Release[]) => {
  return releases.filter((r) => {
    r.environmentPolicyApproval == null ||
      r.environmentPolicyApproval.status === "approved";
  });
};
