import { parse } from "cel-js";

export const validResourceSelector = (selector?: string) => {
  if (selector == null) return true;

  try {
    const cel = parse(selector);

    return cel.isSuccess;
  } catch (error) {
    console.error(error);
    return false;
  }
};
