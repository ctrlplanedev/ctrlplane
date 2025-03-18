import fs from "fs";
import path from "path";
import type { Metadata } from "next";

import "swagger-ui-react/swagger-ui.css";

import { SwaggerUI } from "./SwagerUI";

export const metadata: Metadata = {
  title: "API Documentation | Ctrlplane",
  description: "Interactive documentation for the Ctrlplane API",
};

export default function OpenApiPage() {
  const openApiPath = path.join(process.cwd(), "../../openapi.v1.json");
  const openApiSpec = fs.readFileSync(openApiPath, "utf8");

  return (
    <div className="bg-white p-8">
      <div className="bg-white">
        <SwaggerUI openApiSpec={openApiSpec} />
      </div>
    </div>
  );
}
