import { Badge } from "@/components/ui/badge";

/** Property tags. A thin wrapper so every tag in the app is the shared Badge. */
export function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" }) {
  return <Badge variant={tone}>{children}</Badge>;
}
