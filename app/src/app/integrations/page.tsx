import type { Metadata } from "next";
import { Suspense } from "react";
import { IntegrationsScreen } from "@/components/workspace/integrations";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationsScreen />
    </Suspense>
  );
}
