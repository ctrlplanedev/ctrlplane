import type { Tx } from "../common.js";
import { db } from "../client.js";
import { QueryBuilder } from "./query/builder.js";

class InitialBuilder {
  constructor(private readonly tx: Tx) {}

  query() {
    return new QueryBuilder(this.tx);
  }
}

export const selector = (tx?: Tx) => new InitialBuilder(tx ?? db);
