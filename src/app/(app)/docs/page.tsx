"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function DocsPage() {
  return (
    <main className="swagger-wrapper">
      <SwaggerUI url="/api/docs" />
      <style>{`
        .swagger-wrapper .swagger-ui { max-width: 960px; margin: 0 auto; padding: 1rem; }
        .swagger-wrapper .swagger-ui .info { margin-bottom: 1rem; }
      `}</style>
    </main>
  );
}
