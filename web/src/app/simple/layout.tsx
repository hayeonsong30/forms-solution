import type { ReactNode } from "react";
import { SimpleShell } from "@/components/simple/SimpleShell";

export default function SimpleLayout({ children }: { children: ReactNode }) {
  return <SimpleShell>{children}</SimpleShell>;
}
