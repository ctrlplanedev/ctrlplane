// @ts-ignore
import nextra from "nextra";


/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
};

const withNextra = nextra({
  theme: "nextra-theme-docs",
  themeConfig: "./theme.config.tsx",
});

export default withNextra(nextConfig);
