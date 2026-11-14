/**
 * UserPersona and AnalysisRequest.
 * Producer: Developer 3 (forms). Consumer: Developer 1 (agent).
 * OWNER of this contract file: Developer 1.
 */
import { z } from "zod";
import { Market } from "./common";

export const UserPersona = z.enum(["owner", "investor", "entrepreneur"]);
export type UserPersona = z.infer<typeof UserPersona>;

export const OwnerInput = z.object({
  persona: z.literal("owner"),
  propertyId: z.number().int(),
  /** Optional: analyze one advertised space (forLeaseSummary.spaces[].id) */
  spaceId: z.number().int().optional(),
  priorities: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
});

export const InvestorInput = z.object({
  persona: z.literal("investor"),
  capitalUsd: z.number().positive(),
  riskTolerance: z.enum(["low", "medium", "high"]),
  markets: z.array(Market).min(1),
  horizonYears: z.number().int().min(1).max(30),
  /** Leasing and acquisition are always analyzed separately */
  strategy: z.enum(["lease", "acquire", "either"]),
  /** Optional user target, e.g. 0.08 = 8% — a user assumption, not a promise */
  targetAnnualReturn: z.number().min(0).max(1).optional(),
  goals: z.array(z.string()).default([]),
});

export const EntrepreneurInput = z.object({
  persona: z.literal("entrepreneur"),
  businessConcept: z.string().min(3),
  sfMin: z.number().positive(),
  sfMax: z.number().positive(),
  /** Normalized $/SF/year budget (UI converts from monthly if the user enters monthly) */
  maxRentPsfYear: z.number().positive().optional(),
  markets: z.array(Market).min(1),
  mustHaves: z.array(z.string()).default([]),
});

export const PersonaInput = z.discriminatedUnion("persona", [OwnerInput, InvestorInput, EntrepreneurInput]);
export type PersonaInput = z.infer<typeof PersonaInput>;

export const AnalysisRequest = z.object({
  input: PersonaInput,
  options: z
    .object({
      includeInteriorVision: z.boolean().default(true),
      includeAerialVision: z.boolean().default(true),
      maxAgentSteps: z.number().int().min(1).max(25).default(12),
      maxCandidates: z.number().int().min(1).max(10).default(5),
    })
    .default({ includeInteriorVision: true, includeAerialVision: true, maxAgentSteps: 12, maxCandidates: 5 }),
});
export type AnalysisRequest = z.infer<typeof AnalysisRequest>;
