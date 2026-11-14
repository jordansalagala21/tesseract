import { afterEach, describe, expect, it, vi } from "vitest";
import { agentEnv, matterportEnv, vexcelEnv } from "@/lib/config/env";

describe("narrow env accessors", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("matterportEnv works without a Vexcel key", () => {
    vi.stubEnv("MATTERPORT_API_KEY", "k");
    vi.stubEnv("MATTERPORT_API_TOKEN", "t");
    vi.stubEnv("VEXCEL_API_KEY", "");
    expect(matterportEnv()).toEqual({ MATTERPORT_API_KEY: "k", MATTERPORT_API_TOKEN: "t" });
  });

  it("each accessor names only its own missing variables", () => {
    vi.stubEnv("MATTERPORT_API_KEY", "");
    vi.stubEnv("VEXCEL_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(() => matterportEnv()).toThrow(/MATTERPORT_API_KEY/);
    expect(() => vexcelEnv()).toThrow(/VEXCEL_API_KEY/);
    expect(() => agentEnv()).toThrow(/ANTHROPIC_API_KEY/);
  });
});
