import { afterEach, describe, expect, it, vi } from "vitest";
import { travisProperty, travisSpaces, travisSuite100Model } from "@/lib/contracts/examples/travis";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

// The loader calls connection() so Next renders it per request; outside a request it would throw.
vi.mock("next/server", () => ({ connection: async () => {} }));

const { getPropertyPage, searchProperties } = await import("@/app/properties/property-data");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const detail = { property: travisProperty, matterportModels: [travisSuite100Model], aerial: [], currentTenants: [] };
const spaces = {
  propertyId: travisProperty.id,
  items: travisSpaces,
  availabilityNote: "Advertised availability from CoStar listings — not confirmed physical vacancy.",
};

/** Answers each route path with the given response. */
function routes(map: Record<string, () => Response | Promise<Response>>) {
  const fetchMock = vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    const handler = map[path];
    if (!handler) throw new Error(`unexpected fetch ${path}`);
    return handler();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("property page data (INT-01)", () => {
  it("returns live search results and passes the query through", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = routes({ "/api/properties": () => json({ items: [], total: 0 }) });
    await expect(searchProperties({ q: "travis", market: "houston" })).resolves.toEqual({ ok: true, data: { items: [], total: 0 } });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/properties\?q=travis&market=houston$/);
  });

  it("returns the live property page when both routes answer", async () => {
    routes({ [`/api/properties/${travisProperty.id}`]: () => json(detail), [`/api/properties/${travisProperty.id}/spaces`]: () => json(spaces) });
    const result = await getPropertyPage(travisProperty.id);
    expect(result.ok && result.data.detail.property.id).toBe(travisProperty.id);
    expect(result.ok && result.data.spaces.items).toHaveLength(travisSpaces.length);
  });

  it("never falls back to sample data when a route fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    routes({ "/api/properties": () => json({ error: { message: "No DuckDB database. Run `npm run db:build`." } }, 503) });
    await expect(searchProperties({})).resolves.toEqual({ ok: false, reason: "not_set_up" });

    routes({ [`/api/properties/${travisProperty.id}`]: () => new Response("", { status: 500 }), [`/api/properties/${travisProperty.id}/spaces`]: () => json(spaces) });
    await expect(getPropertyPage(travisProperty.id)).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("treats an unreachable server or a wrong response shape as unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    routes({ "/api/properties": () => Promise.reject(new TypeError("fetch failed")) });
    await expect(searchProperties({})).resolves.toEqual({ ok: false, reason: "unavailable" });

    routes({ "/api/properties": () => json({ items: "not a list" }) });
    await expect(searchProperties({})).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("shows the not-found page for an unknown property", async () => {
    routes({ "/api/properties/999": () => json({ error: { message: "No property 999" } }, 404), "/api/properties/999/spaces": () => json({}, 404) });
    await expect(getPropertyPage(999)).rejects.toThrow("NOT_FOUND");
  });
});
