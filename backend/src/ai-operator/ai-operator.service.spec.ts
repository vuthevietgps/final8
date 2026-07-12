import { AiOperatorService } from './ai-operator.service';
import { buildAiOperatorKnowledge, SCENARIO_WORKFLOWS } from './ai-operator.knowledge';

describe('AiOperatorService agent trace', () => {
  const createService = () => {
    const deps = Array.from({ length: 29 }, () => ({}));
    return new (AiOperatorService as any)(...deps) as AiOperatorService;
  };

  it('builds a deterministic multi-agent trace for read-only chat responses', () => {
    const service = createService() as any;

    const trace = service.buildAgentTrace({
      generatedAt: '2026-06-10T00:00:00.000Z',
      route: {
        intent: 'operations',
        scenarioId: 'OPS-001',
        executionMode: 'manual_handoff',
        approvalRequired: true,
        reason: 'Matched ops workflow',
      },
      sources: {
        operations: { ok: true, data: { totalCount: 2 } },
        receivables: { ok: false, error: 'timeout' },
      },
      recommendations: [
        {
          id: 'rec-1',
          type: 'ops.supplier_overdue',
          priority: 'high',
          title: 'Supplier overdue',
          reason: 'Overdue payable',
          proposedAction: 'Review supplier payable',
          requiresApproval: true,
          riskLevel: 'medium',
        },
      ],
      dataGaps: ['Missing cashflow snapshot'],
      usedOpenAI: false,
    });

    expect(trace).toEqual(expect.objectContaining({
      mode: 'read_only',
      traceId: 'operations:OPS-001:1781049600000',
      steps: expect.arrayContaining([
        expect.objectContaining({
          agent: 'router',
          status: 'ok',
          outputs: expect.arrayContaining(['intent=operations', 'scenario=OPS-001', 'execution=manual_handoff']),
        }),
        expect.objectContaining({
          agent: 'data_readiness',
          status: 'warn',
          guardrails: expect.arrayContaining(['receivables', 'Missing cashflow snapshot']),
        }),
        expect.objectContaining({
          agent: 'approval_planner',
          status: 'warn',
          outputs: expect.arrayContaining(['approvalRequired=true', 'liveApplyEnabled=false']),
          guardrails: ['approval_only_no_live_apply'],
        }),
        expect.objectContaining({
          agent: 'rule_based_responder',
          status: 'ok',
        }),
      ]),
    }));
  });

  it('maps manager workflow endpoints to concrete AI sources', () => {
    const service = createService() as any;

    expect(service.sourceKeysForEndpoint('GET /api/employee-ads-kpi/meta/alerts')).toEqual(['employee-ads-kpi']);
    expect(service.sourceKeysForEndpoint('GET /api/api-tokens/settings')).toEqual(['api-tokens']);
    expect(service.sourceKeysForEndpoint('GET /api/advertising-cost/sync/health')).toEqual(['advertising-cost.sync-health']);
    expect(service.sourceKeysForEndpoint('GET /api/ad-report/cost-per-order')).toEqual(['ad-report.cost-per-order']);
    expect(service.sourceKeysForEndpoint('GET /api/ads/ad-groups/profit-classification?days=7')).toEqual(['ads.ad-group-profit-classification']);
    expect(service.sourceKeysForEndpoint('GET /api/ai-marketing/creatives/performance')).toEqual(['ai-marketing.decision']);
    expect(service.sourceKeysForEndpoint('GET /api/products/:id/media')).toEqual(['sales-products', 'media-assets']);
  });

  it('routes ad group profit count questions to the classification intent', () => {
    const service = createService() as any;

    const route = service.resolveContextRoute('Có bao nhiêu nhóm quảng cáo? Nhóm nào lãi, lỗ hoặc chưa đủ dữ liệu?', 'director');

    expect(route.intent).toBe('ad_group_profit_classification');
    expect(route.reason).toBe('keyword_ad_group_profit_classification');
    expect(route.tokenPolicy.mode).toBe('no_ai');
  });

  it('routes CFO ads budget questions to the cashflow gate intent', () => {
    const service = createService() as any;

    const route = service.resolveContextRoute('Co du tien tang ads them 1 trieu moi ngay khong?', 'director');

    expect(route.intent).toBe('ads_budget_cashflow_gate');
    expect(route.reason).toBe('keyword_ads_budget_cashflow_gate');
    expect(route.tokenPolicy.mode).toBe('small_ai');
    expect(service.responseContractForIntent(route.intent)).toBe('cfoDecision');
  });

  it('routes marketing funnel, creative fatigue and task creation requests to V2 intents', () => {
    const service = createService() as any;

    expect(service.resolveContextRoute('Lead tang nhung don khong tang la do dau?', 'director').intent).toBe('marketing_funnel_health');
    expect(service.resolveContextRoute('Mau quang cao nao dang bi met?', 'ads').intent).toBe('creative_fatigue_review');
    expect(service.resolveContextRoute('Tao task cho sale xu ly cac lead qua han', 'manager').intent).toBe('sales_sla_task_creation');
  });

  it('routes priority executive questions to specific management intents', () => {
    const service = createService() as any;
    const cases = [
      ['Hôm nay công ty có vấn đề gì lớn?', 'business_risk_ranking'],
      ['Có việc gì cần tôi xử lý hôm nay?', 'director_daily_overview'],
      ['Hôm qua doanh thu/lợi nhuận bao nhiêu?', 'company_kpi_scorecard'],
      ['Tháng này doanh thu đạt bao nhiêu phần trăm mục tiêu?', 'target_gap_analysis'],
      ['Có đủ tiền chi 7 ngày tới không?', 'cashflow_forecast'],
      ['Camp nào đang đốt tiền?', 'ads_kill_or_pause_recommendation'],
      ['Có nên tăng ngân sách nhóm nào không?', 'ads_scale_readiness'],
      ['Lead nào chưa xử lý?', 'lead_followup_health'],
      ['Sale nào phản hồi chậm?', 'sales_sla_violation'],
      ['Nguồn lead nào chất lượng nhất?', 'lead_quality_by_source'],
      ['Có bao nhiêu đơn đang trễ?', 'late_order_diagnostic'],
      ['Đơn trễ vì lý do gì?', 'late_order_diagnostic'],
      ['Công nợ nào cần thu ngay?', 'receivables_collection_priority'],
      ['Facebook hay Google hiệu quả hơn?', 'channel_mix_review'],
      ['Có việc gì đang chờ tôi duyệt?', 'decision_waiting_approval'],
      ['Sản phẩm nào bán chạy nhất?', 'product_profit_leaderboard'],
      ['Nhân viên nào đang tồn việc nhiều?', 'operations'],
      ['Khách hàng nào mua nhiều nhất?', 'sales'],
      ['Token Facebook có lỗi không?', 'token_health_check'],
      ['Fanpage nào mất kết nối?', 'fanpage_permission_check'],
      ['Sync quảng cáo có lỗi không?', 'platform_sync_health'],
      ['Webhook có lỗi không?', 'webhook_failure_diagnostic'],
      ['OpenAI API có hoạt động bình thường không?', 'openai_config_health'],
    ];

    for (const [message, intent] of cases) {
      expect(service.resolveContextRoute(message, 'director').intent).toBe(intent);
    }
  });

  it('routes additional executive analysis questions to the new playbook intents', () => {
    const service = createService() as any;
    const cases = [
      ['Vi sao doanh thu tang nhung loi nhuan khong tang?', 'root_cause_analysis'],
      ['Vi sao lead tang nhung don khong tang?', 'root_cause_analysis'],
      ['Hom nay co gi bat thuong khong?', 'anomaly_detection_daily'],
      ['Neu chi xu ly 3 viec hom nay thi la viec gi?', 'priority_ranking'],
      ['Viec nao anh huong tien nhieu nhat?', 'priority_ranking'],
      ['Ai dang xu ly viec cham nhat?', 'owner_accountability_review'],
      ['Bo phan nao dang keo lui ket qua?', 'owner_accountability_review'],
      ['Kenh nao mang lai loi nhuan tot nhat?', 'channel_profitability_review'],
      ['San pham nao ban nhieu nhung lai thap?', 'product_decision_review'],
      ['San pham nao nen day manh?', 'product_decision_review'],
      ['San pham nao nen dung?', 'product_decision_review'],
      ['Khach hang nao co gia tri cao nhat?', 'customer_value_analysis'],
      ['Khach nao can cham soc lai?', 'customer_value_analysis'],
      ['Tien dang ket o dau?', 'advanced_cashflow_scenario'],
      ['Neu tang ads them 1 trieu/ngay thi dong tien co chiu duoc khong?', 'ads_budget_cashflow_gate'],
      ['Thang nay co dat muc tieu khong?', 'target_gap_analysis'],
      ['Can bao nhieu don/ngay de dat muc tieu?', 'target_gap_analysis'],
      ['Tuan nay so voi tuan truoc tot len hay xau di?', 'period_comparison'],
      ['Sau khi chinh ads hom qua ket qua the nao?', 'ai_recommendation_review'],
      ['Hom qua AI de xuat gi va da lam duoc gi?', 'ai_recommendation_review'],
    ];

    for (const [message, intent] of cases) {
      expect(service.resolveContextRoute(message, 'director').intent).toBe(intent);
    }
  });

  it('exposes the executive question playbook through AI operator knowledge', () => {
    const knowledge = buildAiOperatorKnowledge('director') as any;

    expect(knowledge.questionPlaybook).toEqual(expect.arrayContaining([
      expect.objectContaining({ groupId: 'daily_overview' }),
      expect.objectContaining({ groupId: 'ads_marketing' }),
      expect.objectContaining({ groupId: 'approval' }),
      expect.objectContaining({ groupId: 'root_cause_analysis' }),
      expect.objectContaining({ groupId: 'target_gap' }),
      expect.objectContaining({ groupId: 'ai_recommendation_review' }),
    ]));
  });

  it('routes business fact questions to deterministic no-ai intents', () => {
    const service = createService() as any;

    const cases = [
      ['Hien tai co bao nhieu san pham?', 'product_count'],
      ['Co nhung san pham gi?', 'product_list'],
      ['Tuan vua roi san pham nao lai nhat? Thang vua roi san pham nao lai nhat?', 'product_profit_leaderboard'],
      ['Co bao nhieu fanpage? Fanpage nao hoat dong tot?', 'fanpage_performance_lookup'],
      ['chatbot cho fanpage nao hoat dong tot?', 'chatbot_fanpage_performance_lookup'],
      ['Hien tai dai ly nao co doanh thu cao nhat?', 'agent_revenue_leaderboard'],
      ['Dai ly nao co loi nhuan cao nhat?', 'agent_profit_leaderboard'],
      ['Quang cao ve san pham nao co loi nhuan cao nhat?', 'ads_product_profit_leaderboard'],
      ['Chi phi ads chiem bao nhieu % doanh thu doi voi san pham San pham A?', 'product_ads_revenue_ratio'],
    ];

    for (const [message, intent] of cases) {
      const route = service.resolveContextRoute(message, 'director');
      expect(route.intent).toBe(intent);
      expect(route.tokenPolicy.mode).toBe('no_ai');
    }
  });

  it('evaluates V2 decision rules deterministically without OpenAI', () => {
    const service = createService() as any;

    const result = service.evaluateV2Decision({
      decisionType: 'scale_ads',
      metrics: {
        net_profit_after_ads: 200000,
        orders: 4,
        cash_available_for_ads: -1,
        lead_to_order_rate: 10,
        attribution_quality_score: 90,
      },
      dataQuality: {
        score: 90,
        status: 'good',
        missingFields: [],
        staleSources: [],
        syncIssues: [],
        attributionIssues: [],
        permissionIssues: [],
        warningMessages: [],
      },
    });

    expect(result.evaluation.status).toBe('blocked');
    expect(result.evaluation.allowed).toBe(false);
    expect(result.evaluation.ruleId).toBe('ads_scale_readiness_rule');
    expect(result.evaluation.failedConditions[0].metric).toBe('cash_available_for_ads');
  });

  it('exposes V2 API catalog, management situations and regression test cases', () => {
    const service = createService() as any;

    const registries = service.getV2Registries();

    expect(registries.apiCatalog).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'ads_ad_group_profit_ranking',
        method: 'GET',
        readOrWrite: 'read',
        approvalRequired: false,
        riskLevel: 'read_only',
      }),
      expect.objectContaining({
        id: 'ai_actions_draft',
        method: 'POST',
        readOrWrite: 'write',
        approvalRequired: true,
        riskLevel: 'approval_required',
      }),
    ]));
    expect(registries.managementSituations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'daily_priority_ranking',
        intent: 'daily_priority_ranking',
        responseContract: 'solutionPlan',
        tokenPolicy: 'analysis_ai',
      }),
      expect.objectContaining({
        id: 'product_profit_ranking',
        responseContract: 'tableReport',
        tokenPolicy: 'no_ai',
      }),
    ]));
    expect(registries.regressionTestCases).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'PROD-Q001',
        expectedIntent: 'product_profit_ranking',
        expectedTokenMode: 'no_ai',
        shouldCallOpenAI: false,
      }),
      expect.objectContaining({
        id: 'ACT-Q001',
        expectedResponseContract: 'actionApproval',
        approvalExpected: true,
      }),
    ]));
  });

  it('attaches V2 data quality and decision support to compact scenario context', () => {
    const service = createService() as any;
    const route = {
      intent: 'ads_budget_cashflow_gate',
      scenarioId: 'CFO-002',
      reason: 'test',
      approvalRequired: true,
      apiSufficiency: 'sufficient',
    };

    const context = service.compactScenarioContext(
      route,
      {
        'financial-control.dashboard': { ok: true, data: { freeCash: -100000, availableAfterSurvival: -100000 } },
        'financial-control.forecast': { ok: true, data: { lowPoint: -200000, lowPointDay: 2 } },
        'budget-allocation.preview': { ok: true, data: { systemLocked: true, globalStatus: 'blocked' } },
        'advertising-cost.sync-health': { ok: false, error: 'sync failed' },
      },
      [],
      { userId: null, role: 'director', permissions: ['finance', 'ads-budget'], requestedRole: 'director' },
      [],
    );

    expect(context.dataQuality.status).toBe('weak');
    expect(context.decisionSupport.metrics.free_cash).toBe(-100000);
    expect(context.decisionSupport.evaluations[0].decisionType).toBe('scale_ads');
    expect(context.decisionSupport.evaluations[0].status).toBe('blocked');
    expect(context.workflowResult.approval.required).toBe(true);
  });

  it('does not call OpenAI for no_ai ad group profit classification chat', async () => {
    const service = createService() as any;
    const tokenPolicy = service.getTokenPolicyForIntent('ad_group_profit_classification');
    const route = {
      intent: 'ad_group_profit_classification',
      reason: 'test',
      tokenPolicy,
    };
    const report = {
      periodDays: 7,
      total: 1,
      summary: { profitable: 1, loss: 0, breakEven: 0, insufficientData: 0 },
      groups: [
        {
          adGroupId: 'ag-1',
          name: 'NhÃ³m A',
          platform: 'facebook',
          spend: 100000,
          leads: 5,
          orders: 2,
          revenue: 500000,
          netProfitAfterAds: 200000,
          status: 'profitable',
          reason: 'Lá»£i nhuáº­n sau ads dÆ°Æ¡ng.',
        },
      ],
      dataQuality: { notes: [] },
    };

    jest.spyOn(service, 'getScenarioContext').mockResolvedValue({
      success: true,
      generatedAt: '2026-06-10T00:00:00.000Z',
      windowDays: 7,
      role: 'director',
      auth: { userId: null, role: 'director', requestedRole: 'director', permissions: ['ads-budget'] },
      route,
      context: {
        route,
        tokenPolicy,
        ads: { profitClassification: report },
        apiCatalog: [],
        assistantQuality: { score: 100, loadedSources: ['ads.ad-group-profit-classification'] },
        dataGaps: [],
      },
      sources: {
        'ads.ad-group-profit-classification': { ok: true, data: report },
      },
      recommendations: [],
      dataGaps: [],
      tokenPolicy,
    });
    const openAiSpy = jest.spyOn(service, 'tryAskOpenAI');

    const response = await service.chat(
      'CÃ³ bao nhiÃªu nhÃ³m quáº£ng cÃ¡o? NhÃ³m nÃ o lÃ£i?',
      7,
      'director',
    );

    expect(openAiSpy).not.toHaveBeenCalled();
    expect(response.modelUsed).toBeNull();
    expect(response.tokenUsage.mode).toBe('no_ai');
    expect(response.answer).toContain('Tổng số nhóm quảng cáo đọc được: 1 nhóm');
  });

  it('does not call OpenAI for product count business fact chat', async () => {
    const service = createService() as any;
    const tokenPolicy = service.getTokenPolicyForIntent('product_count');
    const route = {
      intent: 'product_count',
      reason: 'test',
      tokenPolicy,
    };
    const facts = {
      products: {
        total: 2,
        active: 1,
        byStatus: [
          { status: 'active', count: 1 },
          { status: 'draft', count: 1 },
        ],
        missingMedia: 1,
        missingSupplierPrice: 0,
        list: [
          { productId: 'p1', name: 'San pham A', sku: 'A', status: 'active' },
          { productId: 'p2', name: 'San pham B', sku: 'B', status: 'draft' },
        ],
      },
      productProfit: { current: { products: [] }, week: { products: [] }, month: { products: [] } },
      fanpages: { total: 0, active: 0, aiEnabled: 0, webhookSubscribed: 0, topFanpages: [], topChatbotFanpages: [] },
      agents: { current: { agents: [] } },
      adsProducts: { current: { products: [] } },
    };

    jest.spyOn(service, 'getScenarioContext').mockResolvedValue({
      success: true,
      generatedAt: '2026-06-10T00:00:00.000Z',
      windowDays: 7,
      role: 'director',
      auth: { userId: null, role: 'director', requestedRole: 'director', permissions: ['products'] },
      route,
      context: {
        route,
        tokenPolicy,
        businessFacts: facts,
        apiCatalog: [],
        assistantQuality: { score: 100, loadedSources: ['business-facts'] },
        dataGaps: [],
      },
      sources: {
        'business-facts': { ok: true, data: facts },
      },
      recommendations: [],
      dataGaps: [],
      tokenPolicy,
    });
    const openAiSpy = jest.spyOn(service, 'tryAskOpenAI');

    const response = await service.chat('Hien tai co bao nhieu san pham?', 7, 'director');

    expect(openAiSpy).not.toHaveBeenCalled();
    expect(response.modelUsed).toBeNull();
    expect(response.tokenUsage.mode).toBe('no_ai');
    expect(service.removeVietnameseTone(response.answer)).toContain('Hien tai co 2 san pham');
  });

  it('renders ad group profit classification as a table in rule-based fallback', () => {
    const service = createService() as any;
    const source = { ok: true, data: null };
    const snapshot: any = {
      generatedAt: '2026-06-10T00:00:00.000Z',
      windowDays: 7,
      finance: { dashboard: source, forecast: source, optimalAds: source, actions: source },
      ads: {
        performance: source,
        profitClassification: {
          ok: true,
          data: {
            periodDays: 7,
            total: 2,
            summary: { profitable: 1, loss: 1, breakEven: 0, insufficientData: 0 },
            groups: [
              {
                adGroupId: 'ag-1',
                name: 'Nhóm A',
                platform: 'facebook',
                spend: 100000,
                leads: 5,
                orders: 2,
                revenue: 500000,
                netProfitAfterAds: 200000,
                status: 'profitable',
                reason: 'Lợi nhuận sau ads dương.',
              },
              {
                adGroupId: 'ag-2',
                name: 'Nhóm B',
                platform: 'google',
                spend: 90000,
                leads: 0,
                orders: 0,
                revenue: 0,
                netProfitAfterAds: -90000,
                status: 'loss',
                reason: 'Có spend nhưng chưa có đơn/doanh thu hoàn tất trong kỳ.',
              },
            ],
            dataQuality: { notes: [] },
          },
        },
        optimalSpendSuggestions: source,
        alerts: source,
      },
      orders: source,
      receivables: source,
      operations: source,
      strategic: {
        fundsOverview: source,
        availableFunds: source,
        budgetPreview: source,
        loanDashboard: source,
        ownerFund: source,
        laborCashflow: source,
        otherCostCashflow: source,
        adsCostCashflow: source,
        aiMarketingOverview: source,
        aiMarketingPlans: source,
        aiMarketingEvaluations: source,
        quoteReadiness: source,
        accessAudit: source,
      },
      dataGaps: [],
    };

    const answer = service.buildRuleBasedAnswer(
      'Có bao nhiêu nhóm quảng cáo? Nhóm nào lãi/lỗ?',
      snapshot,
      [],
      {},
      'director',
      { intent: 'ad_group_profit_classification', reason: 'test' },
    );

    expect(answer).toContain('Tổng số nhóm quảng cáo đọc được: 2 nhóm');
    expect(answer).toContain('| Nhóm | Nền tảng | Spend | Lead | Đơn | Doanh thu | Lợi nhuận sau ads | Trạng thái | Lý do |');
    expect(answer).toContain('| Nhóm A | facebook | 100.000d | 5 | 2 | 500.000d | 200.000d | Lãi |');
  });

  it('keeps all manager workflows at 9+ read-analysis quality', () => {
    const service = createService() as any;
    const managerWorkflows = SCENARIO_WORKFLOWS.filter((workflow) => workflow.scenarioId.startsWith('MGR-'));

    expect(managerWorkflows.length).toBeGreaterThan(0);
    for (const workflow of managerWorkflows) {
      const quality = service.buildWorkflowQualityItem(workflow);
      expect(quality.score).toBeGreaterThanOrEqual(85);
      expect(quality.qualityStatus).toBe('good');
      expect(quality.notLoadedReadApis).toHaveLength(0);
      expect(quality.missingReadApis).toHaveLength(0);
    }
  });

  it('keeps every workflow at 9+ read-analysis quality', () => {
    const service = createService() as any;

    for (const workflow of SCENARIO_WORKFLOWS) {
      const quality = service.buildWorkflowQualityItem(workflow);
      expect(quality.score).toBeGreaterThanOrEqual(85);
      expect(quality.qualityStatus).toBe('good');
      expect(quality.notLoadedReadApis).toHaveLength(0);
      expect(quality.missingReadApis).toHaveLength(0);
    }
  });
});
