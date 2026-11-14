// OWNER: Developer 2 — DATA-02. Contract: PropertySearchQuery → PropertySearchResponse (lib/contracts/api.ts)
import { z } from "zod";
import { PropertySearchQuery } from "@/lib/contracts";
import { searchProperties } from "@/lib/data/properties";
import { apiError } from "@/lib/http";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = PropertySearchQuery.safeParse(params);
  if (!parsed.success) {
    return apiError(400, "bad_request", "Invalid property search query.", {
      details: z.treeifyError(parsed.error),
    });
  }

  const { items, total } = await searchProperties(parsed.data);
  return Response.json({ items, total });
}
