import fs from "fs";
import path from "path";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

const validateInternalLinks = () => {
  return async function transformer(tree, file) {
    const fileDir = path.dirname(file.path);

    const resolveFilePath = (basePath) =>
      basePath.startsWith("/")
        ? path.resolve(process.cwd(), "pages", `${basePath.slice(1)}.mdx`)
        : path.resolve(fileDir, `${basePath}.mdx`);

    const hasValidFragment = (ast, fragment) => {
      const isHeadingNode = (node) => node.type === "heading";
      const isTextNode = (child) => child.type === "text";
      const normalizeText = (text) =>
        text.trim().replace(/\s+/g, "-").toLowerCase();

      return ast.children?.some((node) => {
        if (isHeadingNode(node))
          return node.children?.some(
            (child) =>
              isTextNode(child) && normalizeText(child.value) === fragment,
          );
        return false;
      });
    };

    const validateLink = async (url) => {
      if (url.startsWith("http://") || url.startsWith("https://")) return;

      const [basePath, fragment] = url.split("#");
      const resolvedPath = resolveFilePath(basePath);

      if (!fs.existsSync(resolvedPath))
        throw new Error(`File not found for ${basePath}. URL: ${url}`);

      if (!fragment) return;

      const fileContent = fs.readFileSync(resolvedPath, "utf-8");
      const ast = await unified()
        .use(remarkParse)
        .use(remarkMdx)
        .parse(fileContent);

      if (!hasValidFragment(ast, fragment))
        throw new Error(`Fragment "${fragment}" not found in ${url}`);
    };

    visit(tree, "link", (node) => validateLink(node.url));

    visit(tree, "mdxJsxFlowElement", (node) => {
      const hrefAttr = node.attributes?.find((attr) => attr.name === "href");
      if (hrefAttr?.value) validateLink(hrefAttr.value);
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
