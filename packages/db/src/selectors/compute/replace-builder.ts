import type { InferInsertModel } from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

import type { Tx } from "../../common.js";

export class ReplaceBuilder<T extends PgTableWithColumns<any>> {
  constructor(
    private readonly tx: Tx,
    private readonly table: T,
    private readonly preHook: (tx: Tx) => Promise<void>,
    private readonly deletePrevious: (tx: Tx) => Promise<void>,
    private readonly values: (tx: Tx) => Promise<InferInsertModel<T>[]>,
    private readonly postHook: (tx: Tx) => Promise<void>,
  ) {}

  async replace() {
    return this.tx.transaction(async (tx) => {
      await this.preHook(tx);
      await this.deletePrevious(tx);
      const vals = await this.values(tx);
      if (vals.length === 0) return [];
      const results = await tx
        .insert(this.table)
        .values(vals)
        .onConflictDoNothing()
        .returning();
      await this.postHook(tx);
      return results;
    });
  }
}
