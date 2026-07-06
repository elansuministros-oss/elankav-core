import { runElanAiSalesOrchestrator } from "./orchestrator.js";

export async function processSalesConversation({ normalized = {}, now = new Date() } = {}) {
  return runElanAiSalesOrchestrator({ normalized, now });
}
