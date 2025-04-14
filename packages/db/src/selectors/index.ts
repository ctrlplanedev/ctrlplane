import type { Tx } from "../common.js";
import { db } from "../client.js";
import { ComputeBuilder } from "./compute/compute.js";
import { QueryBuilder } from "./query/builder.js";

class InitialBuilder {
  constructor(private readonly tx: Tx) {}

  compute() {
    return new ComputeBuilder(this.tx);
  }

  query() {
    return new QueryBuilder(this.tx);
  }
}

export const selector = (tx?: Tx) => new InitialBuilder(tx ?? db);
