import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { glob } from "glob";
import { isErrorResult, merge } from "openapi-merge";

/**
 * Scans the project for TypeScript files containing OpenAPI specifications,
 * merges them into a single OpenAPI document, and writes the result to disk.
 *
 * This function:
 * 1. Recursively finds all TypeScript files in the apps/webservice/src/app/api
 *    directory
 * 2. Identifies files that export an OpenAPI specification
 * 3. Loads and validates the OpenAPI objects from those files
 * 4. Merges all valid specifications into a single OpenAPI document
 * 5. Writes the merged specification to openapi.v1.json in the project root
 *
 * @throws Will exit process with status code 1 if there are any errors during
 * scanning, merging, or writing the output file
 */
async function findOpenAPIFiles() {
  try {
    console.log("Finding OpenAPI files...");

    let files = await glob("../../apps/webservice/src/app/api/**/*.ts", {
      ignore: ["**/node_modules/**", "**/dist/**", "**/build/**"],
    });
    files = files.sort();

    const specs = await Promise.all(
      files.map(async (file) => {
        const content = readFileSync(file, "utf-8");

        const hasOpenAPIExport =
          content.includes("export const openapi") ||
          (content.includes("export default") && content.includes("openapi:"));

        if (!hasOpenAPIExport) return null;

        try {
          const modulePath = path.resolve(file);

          const module = await import(modulePath);
          const openapiSpec = module.openapi;

          if (openapiSpec) return openapiSpec;
        } catch (err) {
          console.error("Could not extract OpenAPI object:", err);
        }

        return null;
      }),
    ).then((specs) => specs.filter(Boolean));

    console.log("Found", specs.length, "OpenAPI specs");

    const mergeResult = merge(specs.map((s) => ({ oas: s })));
    if (isErrorResult(mergeResult)) {
      console.error(`${mergeResult.message} (${mergeResult.type})`);
      process.exit(1);
    }

    console.log(`Merge successful!`);
    const outputPath = path.join(process.cwd(), "../..", "openapi.v1.json");
    writeFileSync(outputPath, JSON.stringify(mergeResult.output, null, 2));
    console.log(`OpenAPI spec written to: ${outputPath}`);

    process.exit(0);
  } catch (error) {
    console.error("Error scanning files:", error);
    process.exit(1);
  }
}

findOpenAPIFiles();
