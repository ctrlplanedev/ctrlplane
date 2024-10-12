/* eslint-disable */
import fs from "fs";
import path from "path";
import { visit } from "unist-util-visit";

const validateInternalLinks = () => {
  return function transformer(tree, file) {
    visit(tree, "link", (node) => {
      if (node.url.startsWith("/")) {
        const [basePath, fragment] = node.url.split("#");
        const filePath = path.resolve(
          process.cwd(),
          "pages",
          basePath + ".mdx",
        );
        if (!fs.existsSync(filePath)) {
          file.message(
            new Error(`File not found for ${basePath}`),
            `URL: ${node.url}`,
          );
        } else if (fragment) {
          // Validate the fragment if it exists
          // Here you can add your logic to check if the fragment is valid
          // For example, you might want to check if it matches an existing heading in the file
          file.message(
            new Error(`Fragment ${fragment} may not be valid in ${node.url}`),
            node.url,
          );
        }
      }
    });
  };
};

export default {
  plugins: [
    "remark-preset-lint-recommended",
    "remark-frontmatter",
    "remark-lint",
    "remark-mdx",
    "remark-lint-are-links-valid",
    "remark-lint-no-dead-urls",
    "remark-lint-no-undefined-references",
    validateInternalLinks,
  ],
  settings: {
    atxHeadingWithMarker: false,
    headingStyle: "atx",
  },
};
