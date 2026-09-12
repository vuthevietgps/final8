import { AiOperatorTokenPolicy } from './ai-operator.interfaces';
import { applyTokenPolicyToContext, enforceTokenBudget } from './ai-operator.model-input';

describe('Operator model input isolation', () => {
  const policy: AiOperatorTokenPolicy = {
    mode: 'small_ai',
    maxInputTokens: 1,
    maxOutputTokens: 100,
    includeApiCatalog: false,
    includeLoadedSourcesList: false,
    includeAssistantQuality: true,
    includeDataGaps: true,
    includeChatHistoryTurns: 0,
    includeTaskSummary: true,
    includeRawRowsLimit: 1,
    includeDebugTrace: false,
  };

  it('removes debug metadata and limits rows without mutating the shared context', () => {
    const context = {
      rows: [{ id: 1 }, { id: 2 }],
      apiCatalog: ['internal endpoint'],
      agentTrace: { traceId: 'local' },
      assistantQuality: { score: 80, loadedSources: ['orders'] },
      apiCoverage: { loadedSources: ['orders'], endpointCoverage: ['orders'] },
      dataGaps: ['missing spend'],
    };
    const original = JSON.parse(JSON.stringify(context));

    const compact = applyTokenPolicyToContext(context, policy);

    expect(compact.rows).toEqual([{ id: 1 }]);
    expect(compact.apiCatalog).toBeUndefined();
    expect(compact.agentTrace).toBeUndefined();
    expect(compact.assistantQuality).toEqual({ score: 80 });
    expect(compact.apiCoverage).toEqual({});
    expect(compact.dataGaps).toEqual(['missing spend']);
    expect(context).toEqual(original);
  });

  it('preserves authorization and safety instructions when compacting oversized input', () => {
    const input = {
      question: 'Review budget',
      role: 'employee',
      route: { intent: 'finance' },
      authorization: { allowed: false, missingPermissions: ['finance'] },
      instructions: { actionSafetyRule: 'Approval and executor success required' },
      data: { orders: Array.from({ length: 10 }, (_, id) => ({ id })) },
    };
    const original = JSON.parse(JSON.stringify(input));

    const compact = enforceTokenBudget(input, policy);

    expect(compact.authorization).toEqual(input.authorization);
    expect(compact.instructions).toEqual(input.instructions);
    expect(compact.route).toEqual(input.route);
    expect(input).toEqual(original);
  });
});
