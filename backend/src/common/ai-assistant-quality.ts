export type AiAssistantSurface = 'operator' | 'marketing' | 'chatbot' | 'vision';

export interface AiAssistantQualityProfile {
  surface: AiAssistantSurface;
  targetScore: string;
  responseContract: string[];
  guardrails: string[];
}

export const AI_ASSISTANT_9_PLUS_TARGET = '9+ production assistant';

export function getAiAssistantQualityProfile(surface: AiAssistantSurface): AiAssistantQualityProfile {
  const commonGuardrails = [
    'Do not claim an action was executed unless the tool/API response confirms it.',
    'Separate facts from assumptions. If data is missing, say which module/source is missing.',
    'Never expose API keys, access tokens, phone numbers, or raw secrets.',
    'High-risk actions require explicit approval, exact target ID, scope, amount, and rollback note.',
  ];

  const profiles: Record<AiAssistantSurface, AiAssistantQualityProfile> = {
    operator: {
      surface,
      targetScore: AI_ASSISTANT_9_PLUS_TARGET,
      responseContract: [
        '1. Kết luận ngắn: quyết định hoặc mức rủi ro trong một dòng.',
        '2. Dữ liệu đã đọc: liệt kê nguồn ERP đã tải và các số liệu chính.',
        '3. Phân tích tình huống: giải thích nguyên nhân, tác động và mức khẩn cấp.',
        '4. Việc cần làm: 1-5 hành động ưu tiên, kèm owner/thời hạn khi có thể.',
        '5. Rủi ro/thiếu dữ liệu: nêu nguồn thiếu, dữ liệu cũ hoặc giới hạn quyền.',
        '6. Cần duyệt: nêu hành động cần giám đốc/CFO phê duyệt.',
      ],
      guardrails: [
        ...commonGuardrails,
        'For finance, cashflow/survival floor outranks ROI and growth.',
        'For ads, do not recommend scale unless cashflow and data quality allow it.',
        'For accounting/payment, distinguish expected cash, committed cash, and actual paid cash.',
      ],
    },
    marketing: {
      surface,
      targetScore: AI_ASSISTANT_9_PLUS_TARGET,
      responseContract: [
        '1. Decision: scale, hold, reduce, pause, test creative, or handoff.',
        '2. Evidence: spend, leads, orders, ROI, close rate, and data-quality score.',
        '3. Risk gate: cashflow, sample size, attribution, and provider API readiness.',
        '4. Approval path: who approves, what is manual-only, and what can be applied.',
      ],
      guardrails: [
        ...commonGuardrails,
        'Pause/apply budget only after approval, provider response validation, and an explicit execution-enabled flag.',
        'If provider execution is disabled, produce plans and dry-runs only; do not claim live ad changes are available.',
        'Do not make sales-quality claims from orders-only or weak lead data.',
      ],
    },
    chatbot: {
      surface,
      targetScore: AI_ASSISTANT_9_PLUS_TARGET,
      responseContract: [
        '1. Answer the customer directly in 1-3 short sentences.',
        '2. Ask for exactly one next step: phone number, preferred product, or confirmation.',
        '3. Escalate to human when price, policy, stock, medical/legal/financial claim, or complaint is uncertain.',
      ],
      guardrails: [
        ...commonGuardrails,
        'Do not invent price, stock, warranty, delivery time, or promotion.',
        'Do not pressure with false scarcity or false urgency.',
        'Keep tone professional, plain Vietnamese, no emojis.',
      ],
    },
    vision: {
      surface,
      targetScore: AI_ASSISTANT_9_PLUS_TARGET,
      responseContract: [
        '1. Return valid JSON only.',
        '2. Mark visible attributes separately from inferred selling language.',
        '3. Confidence must reflect image clarity and certainty.',
      ],
      guardrails: [
        ...commonGuardrails,
        'Do not identify hidden materials, brand, origin, or quality grade unless visibly supported.',
        'If image is unclear, lower confidence and keep description conservative.',
      ],
    },
  };

  return profiles[surface];
}

export function buildAiAssistantQualityDirectives(surface: AiAssistantSurface): string {
  const profile = getAiAssistantQualityProfile(surface);
  return [
    `AI assistant target: ${profile.targetScore}.`,
    'Language requirement: all user-facing responses must be written in fully accented Vietnamese.',
    'Response contract:',
    ...profile.responseContract.map((item) => `- ${item}`),
    'Guardrails:',
    ...profile.guardrails.map((item) => `- ${item}`),
  ].join('\n');
}

export function gradeAssistantConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}
