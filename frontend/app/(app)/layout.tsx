import { Suspense } from "react";
import SummaShell from "@/components/SummaShell";

export default function AppLayout() {
  return (
    <Suspense>
      <SummaShell />
    </Suspense>
  );
}
