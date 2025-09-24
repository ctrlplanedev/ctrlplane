import type { Workspace } from "@ctrlplane/db/schema";
import type { FullResource } from "@ctrlplane/events";

import { variablesAES256 } from "@ctrlplane/secrets";

type DirectVariable = {
  value: string | number | boolean | object;
  sensitive: boolean;
};
export const resolveDirectVariableValue = (variable: DirectVariable) => {
  const { value, sensitive } = variable;
  const strVal =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return sensitive ? variablesAES256().decrypt(strVal) : value;
};

type ReferenceVariable = {
  reference: string;
  path: string[];
  defaultValue: string | number | boolean | object | null;
};

export class ReferenceVariableResolver {
  constructor(private readonly workspace: Workspace) {}

  async resolve(variable: ReferenceVariable, resource: FullResource) {
    const { reference, path, defaultValue } = variable;
  }
}
