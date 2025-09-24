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
