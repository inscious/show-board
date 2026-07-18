import { Suspense } from "react";
import ShowBoard from "@/components/apprentice/ShowBoard";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ShowBoard />
    </Suspense>
  );
}
