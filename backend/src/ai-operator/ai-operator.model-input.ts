import {
  AiOperatorIntent,
  AiOperatorRecommendation,
  AiOperatorScenarioContext,
  AiOperatorTokenPolicy,
} from "./ai-operator.interfaces";
import { responseContractForV2Intent } from "./ai-operator.v2-registry";

export function buildAiModelInput(
  message: string,
  scenarioContext: AiOperatorScenarioContext,
  recommendations: AiOperatorRecommendation[],
  knowledge: any,
  role: string | undefined,
  tokenPolicy: AiOperatorTokenPolicy,
) {
  const responseContract = responseContractForIntent(
    scenarioContext.route.intent,
  );
  const modelInput: any = {
    question: message,
    role: role || scenarioContext.role || null,
    route: {
      intent: scenarioContext.route.intent,
      workflow: scenarioContext.route.scenarioId || null,
      responseContract,
    },
    authorization: {
      allowed: !scenarioContext.route.blocked,
      missingPermissions: scenarioContext.route.deniedSources || [],
    },
    data: applyTokenPolicyToContext(scenarioContext.context, tokenPolicy),
    instructions: {
      mustUseResponseContract: true,
      doNotListLoadedSourcesUnlessAsked: !tokenPolicy.includeLoadedSourcesList,
      doNotMentionApprovalUnlessActionRequested: true,
      mustRespectDataQuality: true,
      badDataQualityRule:
        "If dataQuality.status is bad, do not make a firm conclusion. Ask to fix missing/sync/attribution data first.",
      actionSafetyRule:
        "Real actions must go through draft action, approval request, executor and audit log. Never say an action was executed unless executor success is present.",
      maxOutputTokens: tokenPolicy.maxOutputTokens,
    },
  };

  if (knowledge?.questionPlaybook?.length) {
    modelInput.questionPlaybook = knowledge.questionPlaybook
      .slice(0, 3)
      .map((item: any) => ({
        groupId: item.groupId,
        title: item.title,
        analysisSteps: limitArrayRows(item.analysisSteps || [], 4),
        responseRules: limitArrayRows(item.responseRules || [], 4),
        guardrails: limitArrayRows(item.guardrails || [], 3),
        dataGaps: limitArrayRows(item.dataGaps || [], 3),
      }));
  }

  if (tokenPolicy.includeTaskSummary) {
    modelInput.taskSummary = buildTaskSummaryForModel(
      message,
      scenarioContext,
      responseContract,
    );
  }

  if (tokenPolicy.includeApiCatalog) {
    modelInput.apiCatalog = limitArrayRows(knowledge?.apiCatalog || [], 20);
  }

  if (
    tokenPolicy.includeAssistantQuality &&
    scenarioContext.context?.assistantQuality
  ) {
    modelInput.dataQuality = compactQualityForModel(
      scenarioContext.context.assistantQuality,
      tokenPolicy,
    );
  }

  if (scenarioContext.context?.dataQuality) {
    modelInput.dataQualityV2 = limitArrayRows(
      scenarioContext.context.dataQuality,
      8,
    );
  }

  if (scenarioContext.context?.decisionSupport) {
    modelInput.decisionSupport = limitArrayRows(
      scenarioContext.context.decisionSupport,
      5,
    );
  }

  if (tokenPolicy.includeDataGaps && scenarioContext.dataGaps?.length) {
    modelInput.dataQuality = {
      ...(modelInput.dataQuality || {}),
      dataGaps: scenarioContext.dataGaps.slice(0, 10),
    };
  }

  if (recommendations?.length && tokenPolicy.mode !== "small_ai") {
    modelInput.recommendations = recommendations.slice(0, 5).map((item) => ({
      type: item.type,
      priority: item.priority,
      title: item.title,
      reason: item.reason,
      requiresApproval: item.requiresApproval,
    }));
  }

  return enforceTokenBudget(modelInput, tokenPolicy);
}

export function applyTokenPolicyToContext(
  context: any,
  tokenPolicy: AiOperatorTokenPolicy,
) {
  const compact = limitArrayRows(
    cloneJson(context || {}),
    tokenPolicy.includeRawRowsLimit,
  );

  if (!tokenPolicy.includeApiCatalog) {
    delete compact.apiCatalog;
  }
  if (!tokenPolicy.includeAssistantQuality) {
    delete compact.assistantQuality;
  } else if (!tokenPolicy.includeLoadedSourcesList) {
    delete compact.assistantQuality?.loadedSources;
  }
  if (!tokenPolicy.includeDataGaps) {
    delete compact.dataGaps;
  }
  if (!tokenPolicy.includeLoadedSourcesList) {
    delete compact.apiCoverage?.loadedSources;
    delete compact.apiCoverage?.endpointCoverage;
  }
  if (!tokenPolicy.includeDebugTrace) {
    delete compact.agentTrace;
  }

  return compact;
}

export function compactQualityForModel(
  quality: any,
  tokenPolicy: AiOperatorTokenPolicy,
) {
  const compact = cloneJson(quality || {});
  if (!tokenPolicy.includeLoadedSourcesList) {
    delete compact.loadedSources;
  }
  delete compact.responseContract;
  return limitArrayRows(compact, 8);
}

export function enforceTokenBudget(
  modelInput: any,
  tokenPolicy: AiOperatorTokenPolicy,
) {
  if (!tokenPolicy.maxInputTokens || tokenPolicy.maxInputTokens <= 0) {
    return modelInput;
  }
  if (
    estimateTokenCount(JSON.stringify(modelInput)) <= tokenPolicy.maxInputTokens
  ) {
    return modelInput;
  }

  const compact = cloneJson(modelInput);
  compact.data = limitArrayRows(
    compact.data,
    Math.min(3, Math.max(1, tokenPolicy.includeRawRowsLimit)),
  );
  if (compact.recommendations) {
    compact.recommendations = compact.recommendations.slice(0, 3);
  }
  delete compact.apiCoverage;
  delete compact.guardrails;

  if (
    estimateTokenCount(JSON.stringify(compact)) <= tokenPolicy.maxInputTokens
  ) {
    return compact;
  }

  return {
    question: modelInput.question,
    role: modelInput.role,
    route: modelInput.route,
    authorization: modelInput.authorization,
    data: {
      ads: compact.data?.ads || null,
      finance: compact.data?.finance || null,
      tokenManagement: compact.data?.tokenManagement || null,
    },
    dataQuality: compact.dataQuality || null,
    taskSummary: compact.taskSummary || null,
    instructions: modelInput.instructions,
  };
}

export function buildTaskSummaryForModel(
  message: string,
  scenarioContext: AiOperatorScenarioContext,
  responseContract: string,
): string {
  return [
    `Câu hỏi hiện tại: ${message}`,
    `Intent: ${scenarioContext.route.intent}.`,
    `Response contract: ${responseContract}.`,
    `Khoảng dữ liệu: ${scenarioContext.windowDays} ngày.`,
  ].join(" ");
}

export function responseContractForIntent(intent: AiOperatorIntent): string {
  if (BUSINESS_FACT_INTENTS.includes(intent)) return "businessFacts";
  if (intent === "ad_group_profit_classification") return "adGroupProfitTable";
  if (intent === "ads_diagnostic_checklist") return "adsDiagnosticChecklist";
  if (intent === "api") return "apiExplanation";
  const v2Contract = responseContractForV2Intent(intent);
  if (v2Contract?.intentGroups?.includes(intent)) return v2Contract.id;
  if (intent === "ads") return "decisionProposal";
  if (intent === "overview" || intent === "finance" || intent === "receivables")
    return "executiveSummary";
  return "normalSummary";
}

export function limitArrayRows(value: any, limit: number): any {
  if (Array.isArray(value)) {
    const primitiveArray = value.every(
      (item) =>
        item === null || ["string", "number", "boolean"].includes(typeof item),
    );
    if (primitiveArray) return value;
    return (limit > 0 ? value.slice(0, limit) : []).map((item) =>
      limitArrayRows(item, limit),
    );
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      limitArrayRows(item, limit),
    ]),
  );
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null));
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(String(text || "").length / 4);
}

export function buildNoAiTokenUsage(
  scenarioContext: AiOperatorScenarioContext,
  tokenPolicy: AiOperatorTokenPolicy,
) {
  return {
    intent: scenarioContext.route.intent,
    workflow: scenarioContext.route.scenarioId || null,
    responseContract: responseContractForIntent(scenarioContext.route.intent),
    model: null,
    mode: tokenPolicy.mode,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    usedFallback: true,
    createdAt: new Date().toISOString(),
  };
}

export function buildOpenAiTokenUsage(
  scenarioContext: AiOperatorScenarioContext,
  tokenPolicy: AiOperatorTokenPolicy,
  model: string,
  usage: any,
  estimatedInputTokens: number,
) {
  const inputTokens = Number(
    usage?.input_tokens ?? usage?.prompt_tokens ?? estimatedInputTokens ?? 0,
  );
  const outputTokens = Number(
    usage?.output_tokens ?? usage?.completion_tokens ?? 0,
  );
  return {
    intent: scenarioContext.route.intent,
    workflow: scenarioContext.route.scenarioId || null,
    responseContract: responseContractForIntent(scenarioContext.route.intent),
    model,
    mode: tokenPolicy.mode,
    inputTokens,
    outputTokens,
    totalTokens: Number(usage?.total_tokens ?? inputTokens + outputTokens),
    usedFallback: false,
    createdAt: new Date().toISOString(),
  };
}

export function supportsReasoningEffort(model: string): boolean {
  const normalized = String(model || "").toLowerCase();
  return normalized.startsWith("gpt-5") || /^o\d/.test(normalized);
}

export function normalizeReasoningEffort(
  value?: string,
): "none" | "low" | "medium" | "high" | "xhigh" {
  return ["none", "low", "medium", "high", "xhigh"].includes(String(value))
    ? (value as "none" | "low" | "medium" | "high" | "xhigh")
    : "medium";
}
import { BUSINESS_FACT_INTENTS } from "./ai-operator.intent";
