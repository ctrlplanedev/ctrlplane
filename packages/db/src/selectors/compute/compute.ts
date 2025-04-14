import type { PgTableWithColumns } from "drizzle-orm/pg-core";
import { resource } from "src/schema/index.js";

import type { Tx } from "../../common.js";

class InsertBuilder<T extends PgTableWithColumns<any>> {
  constructor(
    private readonly tx: Tx,
    private readonly table: T,
    private readonly values: () => Promise<any[]>,
  ) {}

  async insert() {
    const vals = await this.values();
    if (vals.length === 0) return;
    return this.tx.insert(this.table).values(vals);
  }
}

class EnvironmentBuilder {
  constructor(
    private readonly tx: Tx,
    private readonly ids: string[],
  ) {}

  resourceSelector() {
    return new InsertBuilder(this.tx, resource, async () => {
      // return this.tx
      //   .select()
      //   .from(resource)
      //   .where(eq(resource.workspaceId, this.workspaceId));
    });
  }
}

class WorkspaceEnvironmentBuilder {
  constructor(
    private readonly tx: Tx,
    private readonly workspaceId: string,
  ) {}

  resourceSelectors() {
    return new InsertBuilder(this.tx, resource, async () => {
      // return this.tx
      //   .select()
      //   .from(resource)
      //   .where(eq(resource.workspaceId, this.workspaceId));
    });
  }
}

export class ComputeBuilder {
  constructor(private readonly tx: Tx) {}

  allEnvironments(workspaceId: string) {
    return new WorkspaceEnvironmentBuilder(this.tx, workspaceId);
  }

  environments(ids: string[]) {
    return new EnvironmentBuilder(this.tx, ids);
  }
}
