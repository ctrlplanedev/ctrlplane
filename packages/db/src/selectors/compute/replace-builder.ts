import type { InferInsertModel } from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

import type { Tx } from "../../common.js";

export class ReplaceBuilder<T extends PgTableWithColumns<any>> {
  constructor(
    private readonly tx: Tx,
    private readonly table: T,
    private readonly deletePrevious: (tx: Tx) => Promise<void>,
    private readonly values: (tx: Tx) => Promise<InferInsertModel<T>[]>,
  ) {}

  async replace() {
    return this.tx.transaction(async (tx) => {
      try {
        console.log("replace builder insert", this.table.name);
        await this.deletePrevious(tx);
        console.log("replace builder delete finished");
        const vals = await this.values(tx);
        console.log("replace builder values finished", vals);
        if (vals.length === 0) return;
        console.log("replace builder insert", this.table.name);
        return tx
          .insert(this.table)
          .values(vals)
          .onConflictDoNothing()
          .returning();
      } catch (e) {
        console.error(e, `Error replacing ${this.table.name}, ${String(e)}`);
        throw e;
      }
    });
  }
}
