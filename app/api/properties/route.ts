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

  try {
    const { items, total } = await searchProperties(parsed.data);
    return Response.json({ items, total });
  } catch (error) {
    // A teammate who has not run the import yet should be told that, not handed a 500.
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("npm run db:build")) {
      return apiError(503, "upstream_error", message);
    }
    throw error;
  }
}
