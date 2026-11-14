/**
 * Financial scenarios (AI-06). OWNER: Developer 1.
 * One entry point that dispatches on `mode`. Lease and acquisition stay separate scenarios.
 */
import type { FinancialScenario, FinancialScenarioInput } from "@/lib/contracts";
import { acquisitionScenario } from "./acquisition";
import { leaseScenario } from "./lease";

export { acquisitionScenario, annualDebtService, ACQUISITION_FORMULAS } from "./acquisition";
export { leaseScenario, LEASE_FORMULAS } from "./lease";
export { defaultAssumption, DEFAULT_RATIONALE, type DefaultKey } from "./defaults";
export { DISCLAIMER } from "./shared";

export function runScenario(input: FinancialScenarioInput, meta: { id: string; name: string }): FinancialScenario {
  return input.mode === "lease" ? leaseScenario(input, meta) : acquisitionScenario(input, meta);
}
