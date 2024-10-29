"use client";

import dynamic from "next/dynamic";

const SUI = dynamic(
  () =>
    import("swagger-ui-react").then((mod) => mod.default) as Promise<
      React.FC<any>
    >,
  { ssr: false },
);
export const SwaggerUI: React.FC<{ openApiSpec: string }> = ({
  openApiSpec,
}) => {
  return (
    <SUI
      spec={openApiSpec}
      requestInterceptor={(req: any) => {
        const url = new URL(req.url);
        if (!url.pathname.startsWith("/api"))
          url.pathname = `/api${url.pathname}`;
        req.url = url.toString();
        return req;
      }}
    />
  );
};
