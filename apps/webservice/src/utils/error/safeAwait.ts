import type { FieldValues, UseFormReturn } from "react-hook-form";

export async function safeAwait<T, E = Error>(
  promise: Promise<T>,
): Promise<[T, null] | [null, E]> {
  try {
    const result = await promise;
    return [result, null];
  } catch (error) {
    return [null, error as E];
  }
}

export async function safeFormAwait<T, F extends FieldValues, E = Error>(
  promise: Promise<T>,
  form: UseFormReturn<F>,
  options: {
    entityName?: string;
    uniqueErrorMessage?: string;
    genericErrorMessage?: string;
    uniqueConstraintCheck?: (error: E) => boolean;
  } = {},
): Promise<[T, null] | [null, E]> {
  const [result, error] = await safeAwait<T, E>(promise);
  if (error != null) {
    const {
      entityName = "entity",
      uniqueErrorMessage = `A ${entityName} with this name already exists.`,
      genericErrorMessage = "An unexpected error occurred. Please try again.",
      uniqueConstraintCheck = (e) =>
        (e as Error).message.includes("violates unique constraint"),
    } = options;

    if (uniqueConstraintCheck(error)) {
      form.setError("root", {
        type: "manual",
        message: uniqueErrorMessage,
      });
    } else {
      form.setError("root", {
        type: "manual",
        message: genericErrorMessage,
      });
    }
    return [null, error];
  }
  return [result!, null];
}
