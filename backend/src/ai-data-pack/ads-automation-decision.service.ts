import { Injectable } from "@nestjs/common";
import {
  AdsAutomationAdGroupInput,
  AdsAutomationCategoryKey,
  AdsAutomationConfidence,
  AdsAutomationDecisionCategory,
  AdsAutomationDecisionItem,
  AdsAutomationDecisionSnapshot,
  AdsAutomationDecisionSnapshotInput,
  AdsAutomationDecisionStatus,
  AdsAutomationEvidenceWindow,
  AdsAutomationPolicyInput,
  AdsAutomationProductInput,
  AdsAutomationRiskLevel,
  AdsAutomationSupplierInput,
} from "./contracts/ads-automation-decision.contract";

type NormalizedPolicy = Required<AdsAutomationPolicyInput>;

interface SupplierGateResult {
  status: AdsAutomationDecisionStatus;
  fitScore: number;
  blockers: string[];
  missingFields: string[];
}

interface ProductGateResult {
  status: AdsAutomationDecisionStatus;
  blockers: string[];
  missingFields: string[];
}

const DECISION_TYPES: AdsAutomationCategoryKey[] = [
  "scale_ads",
  "scale_amount",
  "target_ad_groups",
  "product_budget_allocation",
  "supplier_gate",
  "product_kill_or_stop_review",
  "campaign_or_ad_group_pause",
];

@Injectable()
export class AdsAutomationDecisionService {
  build(
    input: AdsAutomationDecisionSnapshotInput = {},
  ): AdsAutomationDecisionSnapshot {
    const generatedAt = new Date().toISOString();
    const snapshotDate =
      this.validDate(input.snapshotDate) || generatedAt.slice(0, 10);
    const evidenceWindow =
      input.evidenceWindow || this.defaultEvidenceWindow(snapshotDate);
    const policy = this.policy(input.policy);
    const policyMissing = this.policyMissingFields(input.policy);
    const suppliers = input.suppliers || [];
    const products = input.products || [];
    const adGroups = input.adGroups || [];

    const decisions: AdsAutomationDecisionItem[] = [];
    const supplierResults = new Map<string, SupplierGateResult>();
    const productResults = new Map<string, ProductGateResult>();

    decisions.push(
      ...this.evaluateSuppliers(
        suppliers,
        policy,
        evidenceWindow,
        snapshotDate,
        supplierResults,
      ),
    );
    decisions.push(
      ...this.evaluateProducts(
        products,
        policy,
        evidenceWindow,
        snapshotDate,
        supplierResults,
        productResults,
      ),
    );
    decisions.push(
      ...this.evaluateAdGroups(
        adGroups,
        policy,
        policyMissing,
        evidenceWindow,
        snapshotDate,
        productResults,
      ),
    );
    decisions.push(
      ...this.evaluatePauseCandidates(
        adGroups,
        policy,
        evidenceWindow,
        snapshotDate,
      ),
    );

    if (!adGroups.length) {
      decisions.push(
        this.insufficientPolicyDecision(
          "scale_ads",
          "adGroups",
          ["adGroups"],
          ["Sync or provide ERP ad group performance rows."],
          evidenceWindow,
          snapshotDate,
        ),
      );
      decisions.push(
        this.insufficientPolicyDecision(
          "target_ad_groups",
          "adGroups",
          ["adGroups"],
          ["Sync or provide ERP ad group performance rows."],
          evidenceWindow,
          snapshotDate,
        ),
      );
      decisions.push(
        this.insufficientPolicyDecision(
          "scale_amount",
          "adGroups",
          ["adGroups"],
          [
            "Sync or provide verified currentBudgetVnd and campaignBudgetId rows.",
          ],
          evidenceWindow,
          snapshotDate,
        ),
      );
      decisions.push(
        this.insufficientPolicyDecision(
          "campaign_or_ad_group_pause",
          "adGroups",
          ["adGroups"],
          [
            "Sync or provide ad group spend/profit rows and bottleneck review flags.",
          ],
          evidenceWindow,
          snapshotDate,
        ),
      );
    }

    if (!products.length) {
      decisions.push(
        this.insufficientPolicyDecision(
          "product_budget_allocation",
          "products",
          ["products"],
          [
            "Provide product economics, stock, readiness, and ad group mapping rows.",
          ],
          evidenceWindow,
          snapshotDate,
        ),
      );
      decisions.push(
        this.insufficientPolicyDecision(
          "product_kill_or_stop_review",
          "products",
          ["products"],
          [
            "Provide product economics and return/cancel/refund evidence before stop review.",
          ],
          evidenceWindow,
          snapshotDate,
        ),
      );
    }

    if (!suppliers.length) {
      decisions.push(
        this.insufficientPolicyDecision(
          "supplier_gate",
          "suppliers",
          ["suppliers"],
          [
            "Provide supplier quote, margin, lead-time, capacity, and payment freshness rows.",
          ],
          evidenceWindow,
          snapshotDate,
        ),
      );
    }

    const categories = this.buildCategories(decisions);

    return {
      schemaVersion: "ads_automation_decision_snapshot.v1",
      generatedAt,
      snapshotDate,
      safety: {
        read_only: true,
        provider_api_used: false,
        google_ads_api_used: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        approval_required_for_future_actions: true,
      },
      summary: {
        categories: DECISION_TYPES.length,
        decisions: decisions.length,
        scale_candidates: decisions.filter(
          (item) =>
            item.decision_type === "scale_ads" && item.status === "scale_ready",
        ).length,
        pause_candidates: decisions.filter(
          (item) =>
            item.decision_type === "campaign_or_ad_group_pause" &&
            item.status === "needs_review",
        ).length,
        product_scale_candidates: decisions.filter(
          (item) =>
            item.decision_type === "product_budget_allocation" &&
            item.status === "scale_ready",
        ).length,
        supplier_safe_candidates: decisions.filter(
          (item) =>
            item.decision_type === "supplier_gate" && item.status === "safe",
        ).length,
        insufficient_data_decisions: decisions.filter(
          (item) => item.status === "insufficient_data",
        ).length,
      },
      categories,
      decisions,
    };
  }

  private evaluateSuppliers(
    suppliers: AdsAutomationSupplierInput[],
    policy: NormalizedPolicy,
    evidenceWindow: AdsAutomationEvidenceWindow,
    snapshotDate: string,
    results: Map<string, SupplierGateResult>,
  ): AdsAutomationDecisionItem[] {
    return suppliers.map((supplier) => {
      const entityId = this.id(supplier.supplierId);
      const missing = this.missing(supplier, [
        "productId",
        "supplierId",
        "quoteApproved",
        "marginAfterCostPercent",
        "leadTimeDays",
        "lateDeliveryRatePercent",
        "paymentFreshnessDays",
        "capacityStatus",
        "returnFaultRatePercent",
      ]);
      if (missing.length) {
        const result = {
          status: "insufficient_data" as AdsAutomationDecisionStatus,
          fitScore: 0,
          blockers: [],
          missingFields: missing,
        };
        results.set(entityId, result);
        return this.decision({
          decisionType: "supplier_gate",
          entityType: "supplier",
          entityId,
          productId: supplier.productId || null,
          supplierId: supplier.supplierId || null,
          status: "insufficient_data",
          missingFields: missing,
          nextRequiredData: this.nextRequired(missing),
          evidenceWindow,
          snapshotDate,
          evidenceMetrics: this.supplierMetrics(supplier),
          dataQualityScore: 0,
          confidence: "low",
          riskLevel: "high",
          currentValue: this.supplierMetrics(supplier),
          proposedValue: { action: "supplier_data_completion" },
          rationale:
            "Supplier cannot support scale until required quote, delivery, capacity, and payment data exists.",
        });
      }

      const blockers = this.supplierBlockers(supplier, policy);
      const fitScore = this.supplierFitScore(supplier, policy, blockers);
      const status: AdsAutomationDecisionStatus = blockers.length
        ? blockers.includes("capacity_blocked") ||
          blockers.includes("margin_after_cost_below_minimum")
          ? "blocked"
          : "needs_review"
        : "safe";
      const result = { status, fitScore, blockers, missingFields: [] };
      results.set(entityId, result);

      return this.decision({
        decisionType: "supplier_gate",
        entityType: "supplier",
        entityId,
        productId: supplier.productId || null,
        supplierId: supplier.supplierId || null,
        status,
        blockers,
        evidenceWindow,
        snapshotDate,
        evidenceMetrics: this.supplierMetrics(supplier),
        dataQualityScore: fitScore / 100,
        confidence: fitScore >= 85 ? "high" : fitScore >= 70 ? "medium" : "low",
        riskLevel: blockers.length ? "high" : fitScore >= 85 ? "low" : "medium",
        currentValue: this.supplierMetrics(supplier),
        proposedValue: {
          action:
            status === "safe"
              ? "preferredSupplierCandidate"
              : "supplier_sourcing",
          supplierFitScore: fitScore,
        },
        rationale:
          status === "safe"
            ? "Supplier quote, margin, delivery, payment freshness, and fault signals pass the scale gate."
            : "Supplier needs review before supporting additional ads budget.",
      });
    });
  }

  private evaluateProducts(
    products: AdsAutomationProductInput[],
    policy: NormalizedPolicy,
    evidenceWindow: AdsAutomationEvidenceWindow,
    snapshotDate: string,
    supplierResults: Map<string, SupplierGateResult>,
    productResults: Map<string, ProductGateResult>,
  ): AdsAutomationDecisionItem[] {
    const decisions: AdsAutomationDecisionItem[] = [];
    for (const product of products) {
      const entityId = this.id(product.productId);
      const missing = this.missing(product, [
        "productId",
        "name",
        "netProfitVnd",
        "marginPercent",
        "returnCancelRefundRatePercent",
        "stockAvailable",
        "daysOfCover",
        "mappedAdGroupIds",
        "supplierIds",
      ]);
      if (
        !product.mappedAdGroupIds?.length &&
        !missing.includes("mappedAdGroupIds")
      )
        missing.push("mappedAdGroupIds");
      if (!product.supplierIds?.length && !missing.includes("supplierIds"))
        missing.push("supplierIds");

      if (missing.length) {
        const result = {
          status: "insufficient_data" as AdsAutomationDecisionStatus,
          blockers: [],
          missingFields: missing,
        };
        productResults.set(entityId, result);
        decisions.push(
          this.decision({
            decisionType: "product_budget_allocation",
            entityType: "product",
            entityId,
            productId: product.productId || null,
            status: "insufficient_data",
            missingFields: missing,
            nextRequiredData: this.nextRequired(missing),
            evidenceWindow,
            snapshotDate,
            evidenceMetrics: this.productMetrics(product),
            dataQualityScore: 0,
            confidence: "low",
            riskLevel: "high",
            currentValue: this.productMetrics(product),
            proposedValue: { action: "product_data_completion" },
            rationale:
              "Product allocation cannot be decided until economics, stock, supplier, and mapping data exists.",
          }),
        );
        continue;
      }

      const safeSuppliers = (product.supplierIds || [])
        .map((supplierId) => supplierResults.get(this.id(supplierId)))
        .filter((result) => result?.status === "safe");
      const blockers = this.productBlockers(
        product,
        policy,
        safeSuppliers.length,
      );
      const productStatus: AdsAutomationDecisionStatus = blockers.length
        ? "blocked"
        : "scale_ready";
      productResults.set(entityId, {
        status: productStatus,
        blockers,
        missingFields: [],
      });

      decisions.push(
        this.decision({
          decisionType: "product_budget_allocation",
          entityType: "product",
          entityId,
          productId: product.productId || null,
          status: productStatus,
          blockers,
          evidenceWindow,
          snapshotDate,
          evidenceMetrics: this.productMetrics(product),
          dataQualityScore: productStatus === "scale_ready" ? 0.9 : 0.65,
          confidence: productStatus === "scale_ready" ? "high" : "medium",
          riskLevel: blockers.length ? "high" : "low",
          currentValue: this.productMetrics(product),
          proposedValue: {
            action:
              productStatus === "scale_ready"
                ? "productScaleCandidate"
                : "hold",
            safeSupplierCount: safeSuppliers.length,
          },
          rationale:
            productStatus === "scale_ready"
              ? "Product economics, return rate, stock, mapping, and supplier gate support additional budget."
              : "Product should not receive more ads budget until blockers are cleared.",
        }),
      );

      const stopAction = this.productStopAction(
        product,
        policy,
        safeSuppliers.length,
      );
      if (stopAction) {
        decisions.push(
          this.decision({
            decisionType: "product_kill_or_stop_review",
            entityType: "product",
            entityId,
            productId: product.productId || null,
            status: "needs_review",
            blockers: stopAction.blockers,
            evidenceWindow,
            snapshotDate,
            evidenceMetrics: this.productMetrics(product),
            dataQualityScore: 0.8,
            confidence: "medium",
            riskLevel: "high",
            currentValue: this.productMetrics(product),
            proposedValue: {
              action: stopAction.action,
              disallowedActions: [
                "delete_product",
                "provider_delete",
                "auto_hide_product_globally",
              ],
            },
            rationale: stopAction.rationale,
          }),
        );
      }
    }
    return decisions;
  }

  private evaluateAdGroups(
    adGroups: AdsAutomationAdGroupInput[],
    policy: NormalizedPolicy,
    policyMissing: string[],
    evidenceWindow: AdsAutomationEvidenceWindow,
    snapshotDate: string,
    productResults: Map<string, ProductGateResult>,
  ): AdsAutomationDecisionItem[] {
    const scaleDecisions: AdsAutomationDecisionItem[] = [];
    const rankedGroups = [...adGroups].sort(
      (left, right) =>
        Number(right.netProfitAfterAdsVnd || 0) -
        Number(left.netProfitAfterAdsVnd || 0),
    );
    let remainingCash = Number.isFinite(policy.availableAdsCashVnd)
      ? policy.availableAdsCashVnd
      : 0;

    for (const group of rankedGroups) {
      const entityId = this.id(group.adGroupId);
      const groupMissing = this.scaleMissingFields(group);
      const missing = [...new Set([...groupMissing, ...policyMissing])];
      const productGate = this.productGateForGroup(group, productResults);
      const protectedBlockers = this.protectedLabelBlockers(group);

      if (missing.length) {
        scaleDecisions.push(
          this.decision({
            decisionType: "scale_ads",
            entityType: "ad_group",
            entityId,
            platform: group.platform || null,
            accountId: group.accountId || null,
            productId: this.first(group.productIds),
            status: "insufficient_data",
            blockers: protectedBlockers,
            missingFields: missing,
            nextRequiredData: this.nextRequired(missing),
            evidenceWindow: group.evidenceWindow || evidenceWindow,
            snapshotDate,
            evidenceMetrics: this.adGroupMetrics(group),
            dataQualityScore: Number(group.dataQualityScore || 0),
            confidence: "low",
            riskLevel: "high",
            currentValue: this.adGroupCurrentValue(group),
            proposedValue: { action: "monitor_only" },
            rationale:
              "Ad group cannot be evaluated for scale until required budget, cashflow, performance, and mapping fields exist.",
          }),
        );
        continue;
      }

      const blockers = [
        ...protectedBlockers,
        ...this.adGroupScaleBlockers(group, policy),
        ...productGate.blockers,
      ];
      const status: AdsAutomationDecisionStatus = blockers.length
        ? "blocked"
        : "scale_ready";
      const confidence = this.confidence(
        Number(group.dataQualityScore),
        Number(group.orders || 0),
      );
      scaleDecisions.push(
        this.decision({
          decisionType: "scale_ads",
          entityType: "ad_group",
          entityId,
          platform: group.platform || null,
          accountId: group.accountId || null,
          productId: this.first(group.productIds),
          status,
          blockers,
          evidenceWindow: group.evidenceWindow || evidenceWindow,
          snapshotDate,
          evidenceMetrics: this.adGroupMetrics(group),
          dataQualityScore: Number(group.dataQualityScore || 0),
          confidence,
          riskLevel: blockers.length
            ? "high"
            : confidence === "high"
              ? "low"
              : "medium",
          currentValue: this.adGroupCurrentValue(group),
          proposedValue: {
            action: status === "scale_ready" ? "scale_ready" : "monitor_only",
          },
          rationale:
            status === "scale_ready"
              ? "Ad group passes profit, data quality, cashflow, budget verification, product, and supplier gates."
              : "Ad group is blocked from scale by one or more ERP gates.",
        }),
      );

      if (status === "scale_ready") {
        const percent =
          confidence === "high"
            ? policy.maxBudgetIncreasePercent
            : policy.mediumConfidenceIncreasePercent;
        const currentBudget = Number(group.currentBudgetVnd || 0);
        const cappedIncrease = Math.round(currentBudget * (percent / 100));
        const appliedIncrease = Math.min(cappedIncrease, remainingCash);
        remainingCash -= appliedIncrease;
        const proposedBudget = currentBudget + appliedIncrease;
        const amountBlockers =
          appliedIncrease <= 0 ? ["available_ads_cash_exhausted"] : [];

        scaleDecisions.push(
          this.decision({
            decisionType: "scale_amount",
            entityType: "ad_group",
            entityId,
            platform: group.platform || null,
            accountId: group.accountId || null,
            productId: this.first(group.productIds),
            status: amountBlockers.length ? "blocked" : "scale_ready",
            blockers: amountBlockers,
            evidenceWindow: group.evidenceWindow || evidenceWindow,
            snapshotDate,
            evidenceMetrics: this.adGroupMetrics(group),
            dataQualityScore: Number(group.dataQualityScore || 0),
            confidence,
            riskLevel: amountBlockers.length
              ? "high"
              : confidence === "high"
                ? "low"
                : "medium",
            currentValue: this.adGroupCurrentValue(group),
            proposedValue: {
              action: "update_campaign_budget_draft",
              currentBudgetVnd: currentBudget,
              proposedBudgetVnd: proposedBudget,
              increaseVnd: appliedIncrease,
              increasePercent: currentBudget
                ? Math.round((appliedIncrease / currentBudget) * 10000) / 100
                : 0,
              maxIncreasePercent: policy.maxBudgetIncreasePercent,
              campaignBudgetId: group.campaignBudgetId || null,
              campaignBudgetResourceName:
                group.campaignBudgetResourceName || null,
            },
            idempotencyKey: this.idempotency(
              snapshotDate,
              "scale_amount",
              entityId,
            ),
            rollbackPlan:
              "Restore previous campaign budget and evaluate after 3/7 days before any next increase.",
            rationale:
              "Budget increase is capped by ERP policy and available ads cash; it is a draft only.",
          }),
        );

        scaleDecisions.push(
          this.decision({
            decisionType: "target_ad_groups",
            entityType: "ad_group",
            entityId,
            platform: group.platform || null,
            accountId: group.accountId || null,
            productId: this.first(group.productIds),
            status: "scale_ready",
            evidenceWindow: group.evidenceWindow || evidenceWindow,
            snapshotDate,
            evidenceMetrics: this.adGroupMetrics(group),
            dataQualityScore: Number(group.dataQualityScore || 0),
            confidence,
            riskLevel: confidence === "high" ? "low" : "medium",
            currentValue: this.adGroupCurrentValue(group),
            proposedValue: {
              action: "rank_for_scale",
              rankReason:
                "Positive net profit after ads with verified budget and passed gates.",
            },
            rationale:
              "Ad group belongs in the next scale-candidate review queue.",
          }),
        );
      }
    }

    return scaleDecisions;
  }

  private evaluatePauseCandidates(
    adGroups: AdsAutomationAdGroupInput[],
    policy: NormalizedPolicy,
    evidenceWindow: AdsAutomationEvidenceWindow,
    snapshotDate: string,
  ): AdsAutomationDecisionItem[] {
    return adGroups.map((group) => {
      const entityId = this.id(group.adGroupId);
      const missing = this.pauseMissingFields(group);
      if (missing.length) {
        return this.decision({
          decisionType: "campaign_or_ad_group_pause",
          entityType: "ad_group",
          entityId,
          platform: group.platform || null,
          accountId: group.accountId || null,
          productId: this.first(group.productIds),
          status: "insufficient_data",
          missingFields: missing,
          nextRequiredData: this.nextRequired(missing),
          evidenceWindow: group.evidenceWindow || evidenceWindow,
          snapshotDate,
          evidenceMetrics: this.adGroupMetrics(group),
          dataQualityScore: Number(group.dataQualityScore || 0),
          confidence: "low",
          riskLevel: "high",
          currentValue: this.adGroupCurrentValue(group),
          proposedValue: { action: "pause_review_data_completion" },
          rationale:
            "Pause review needs spend, orders, profit, data quality, protected labels, and bottleneck checks.",
        });
      }

      const blockers = this.pauseBlockers(group, policy);
      const isCandidate =
        blockers.length === 0 &&
        Number(group.spendVnd || 0) >= policy.minSpendForPauseVnd &&
        (Number(group.orders || 0) === 0 ||
          Number(group.netProfitAfterAdsVnd || 0) < 0);

      return this.decision({
        decisionType: "campaign_or_ad_group_pause",
        entityType: "ad_group",
        entityId,
        platform: group.platform || null,
        accountId: group.accountId || null,
        productId: this.first(group.productIds),
        status: isCandidate
          ? "needs_review"
          : blockers.length
            ? "blocked"
            : "hold",
        blockers,
        evidenceWindow: group.evidenceWindow || evidenceWindow,
        snapshotDate,
        evidenceMetrics: this.adGroupMetrics(group),
        dataQualityScore: Number(group.dataQualityScore || 0),
        confidence: this.confidence(
          Number(group.dataQualityScore),
          Number(group.orders || 0),
        ),
        riskLevel: isCandidate ? "high" : blockers.length ? "high" : "medium",
        currentValue: this.adGroupCurrentValue(group),
        proposedValue: {
          action: isCandidate ? "pause_ad_group_draft" : "monitor_only",
          minSpendForPauseVnd: policy.minSpendForPauseVnd,
        },
        idempotencyKey: isCandidate
          ? this.idempotency(
              snapshotDate,
              "campaign_or_ad_group_pause",
              entityId,
            )
          : null,
        rollbackPlan: isCandidate
          ? "Resume the previous ad group status if qualified orders recover or tracking/root-cause review clears the issue."
          : null,
        rationale: isCandidate
          ? "Ad group has meaningful spend with no orders or negative net profit after ads; pause remains approval-only."
          : "Ad group does not currently pass the pause draft gate.",
      });
    });
  }

  private buildCategories(
    decisions: AdsAutomationDecisionItem[],
  ): Record<AdsAutomationCategoryKey, AdsAutomationDecisionCategory> {
    const result = {} as Record<
      AdsAutomationCategoryKey,
      AdsAutomationDecisionCategory
    >;
    for (const key of DECISION_TYPES) {
      const items = decisions.filter((item) => item.decision_type === key);
      const candidateCount = items.filter((item) =>
        ["scale_ready", "safe", "needs_review"].includes(item.status),
      ).length;
      const missing = [
        ...new Set(items.flatMap((item) => item.missing_fields)),
      ].sort();
      const blockers = [
        ...new Set(items.flatMap((item) => item.blockers)),
      ].sort();
      const nextRequired = [
        ...new Set(items.flatMap((item) => item.next_required_data)),
      ].sort();
      result[key] = {
        key,
        status: this.categoryStatus(items),
        candidate_count: candidateCount,
        missing_fields: missing,
        next_required_data: nextRequired,
        blockers,
      };
    }
    return result;
  }

  private categoryStatus(
    items: AdsAutomationDecisionItem[],
  ): AdsAutomationDecisionStatus {
    if (!items.length) return "no_candidates";
    if (items.every((item) => item.status === "insufficient_data"))
      return "insufficient_data";
    if (items.some((item) => item.status === "scale_ready"))
      return "scale_ready";
    if (items.some((item) => item.status === "safe")) return "safe";
    if (items.some((item) => item.status === "needs_review"))
      return "needs_review";
    if (items.some((item) => item.status === "blocked")) return "blocked";
    return "hold";
  }

  private policy(input: AdsAutomationPolicyInput = {}): NormalizedPolicy {
    return {
      availableAdsCashVnd: Number(input.availableAdsCashVnd),
      cashflowGatePassed: input.cashflowGatePassed === true,
      maxBudgetIncreasePercent: this.numberOr(
        input.maxBudgetIncreasePercent,
        20,
      ),
      mediumConfidenceIncreasePercent: this.numberOr(
        input.mediumConfidenceIncreasePercent,
        10,
      ),
      minOrdersForScale: this.numberOr(input.minOrdersForScale, 5),
      minDataQualityScore: this.numberOr(input.minDataQualityScore, 0.75),
      minSpendForPauseVnd: this.numberOr(input.minSpendForPauseVnd, 200000),
      maxReturnRatePercent: this.numberOr(input.maxReturnRatePercent, 25),
      minMarginPercent: this.numberOr(input.minMarginPercent, 20),
      minStockAvailable: this.numberOr(input.minStockAvailable, 10),
      minDaysOfCover: this.numberOr(input.minDaysOfCover, 7),
      maxSupplierLeadTimeDays: this.numberOr(input.maxSupplierLeadTimeDays, 10),
      maxSupplierLateDeliveryRatePercent: this.numberOr(
        input.maxSupplierLateDeliveryRatePercent,
        15,
      ),
      maxSupplierReturnFaultRatePercent: this.numberOr(
        input.maxSupplierReturnFaultRatePercent,
        12,
      ),
      maxSupplierPaymentFreshnessDays: this.numberOr(
        input.maxSupplierPaymentFreshnessDays,
        30,
      ),
    };
  }

  private policyMissingFields(input?: AdsAutomationPolicyInput): string[] {
    const missing: string[] = [];
    if (!input || !this.present(input.availableAdsCashVnd))
      missing.push("policy.availableAdsCashVnd");
    if (!input || !this.present(input.cashflowGatePassed))
      missing.push("policy.cashflowGatePassed");
    return missing;
  }

  private scaleMissingFields(group: AdsAutomationAdGroupInput): string[] {
    const missing = this.missing(group, [
      "platform",
      "accountId",
      "campaignId",
      "adGroupId",
      "resourceName",
      "currentStatus",
      "currentBudgetVnd",
      "spendVnd",
      "orders",
      "revenueVnd",
      "grossProfitVnd",
      "netProfitAfterAdsVnd",
      "dataQualityScore",
      "productIds",
    ]);
    if (!group.productIds?.length && !missing.includes("productIds"))
      missing.push("productIds");
    if (!group.campaignBudgetId && !group.campaignBudgetResourceName)
      missing.push("campaignBudgetId_or_campaignBudgetResourceName");
    return missing;
  }

  private pauseMissingFields(group: AdsAutomationAdGroupInput): string[] {
    const missing = this.missing(group, [
      "adGroupId",
      "currentStatus",
      "spendVnd",
      "orders",
      "netProfitAfterAdsVnd",
      "dataQualityScore",
      "bottlenecksChecked",
    ]);
    if (!Array.isArray(group.labels)) missing.push("labels");
    if (!this.present(group.bottlenecksChecked))
      missing.push("bottlenecksChecked");
    return [...new Set(missing)];
  }

  private adGroupScaleBlockers(
    group: AdsAutomationAdGroupInput,
    policy: NormalizedPolicy,
  ): string[] {
    const blockers: string[] = [];
    if (!policy.cashflowGatePassed) blockers.push("cashflow_gate_blocked");
    if (Number(group.orders || 0) < policy.minOrdersForScale)
      blockers.push("orders_below_minimum");
    if (Number(group.netProfitAfterAdsVnd || 0) <= 0)
      blockers.push("net_profit_after_ads_not_positive");
    if (Number(group.dataQualityScore || 0) < policy.minDataQualityScore)
      blockers.push("data_quality_below_minimum");
    if (group.spendReconciliationStatus === "mismatch")
      blockers.push("platform_spend_order_ad_cost_mismatch");
    if (Number(group.returnRatePercent || 0) > policy.maxReturnRatePercent) {
      blockers.push("ad_group_return_cancel_refund_rate_too_high");
    }
    if (
      Number(group.cancelledReturnedRefundedOrders || 0) > 0 &&
      Number(group.orders || 0) === 0
    ) {
      blockers.push("returned_refunded_cancelled_order_profit_blocker");
    }
    if (this.paused(group.currentStatus)) blockers.push("ad_group_not_enabled");
    return blockers;
  }

  private pauseBlockers(
    group: AdsAutomationAdGroupInput,
    policy: NormalizedPolicy,
  ): string[] {
    const blockers = [...this.protectedLabelBlockers(group)];
    if (Number(group.dataQualityScore || 0) < policy.minDataQualityScore)
      blockers.push("data_quality_below_minimum");
    if (group.bottlenecksChecked !== true)
      blockers.push("sale_landing_tracking_bottlenecks_not_checked");
    if (Number(group.spendVnd || 0) < policy.minSpendForPauseVnd)
      blockers.push("spend_below_pause_threshold");
    return blockers;
  }

  private productBlockers(
    product: AdsAutomationProductInput,
    policy: NormalizedPolicy,
    safeSupplierCount: number,
  ): string[] {
    const blockers: string[] = [];
    if (Number(product.netProfitVnd || 0) <= 0)
      blockers.push("product_net_profit_not_positive");
    if (Number(product.marginPercent || 0) < policy.minMarginPercent)
      blockers.push("product_margin_below_minimum");
    if (
      Number(product.returnCancelRefundRatePercent || 0) >
      policy.maxReturnRatePercent
    )
      blockers.push("return_cancel_refund_rate_too_high");
    if (Number(product.stockAvailable || 0) < policy.minStockAvailable)
      blockers.push("stock_below_minimum");
    if (Number(product.daysOfCover || 0) < policy.minDaysOfCover)
      blockers.push("days_of_cover_below_minimum");
    if (!safeSupplierCount) blockers.push("no_safe_supplier_for_scale");
    if (product.mediaReady === false) blockers.push("media_not_ready");
    if (product.landingReady === false) blockers.push("landing_not_ready");
    if (product.offerReady === false) blockers.push("offer_not_ready");
    return blockers;
  }

  private productStopAction(
    product: AdsAutomationProductInput,
    policy: NormalizedPolicy,
    safeSupplierCount: number,
  ) {
    const blockers: string[] = [];
    if (Number(product.netProfitVnd || 0) < 0)
      blockers.push("negative_product_economics");
    if (Number(product.marginPercent || 0) < 0)
      blockers.push("negative_product_margin");
    if (
      Number(product.returnCancelRefundRatePercent || 0) >
      policy.maxReturnRatePercent
    )
      blockers.push("return_cancel_refund_rate_too_high");
    if (!safeSupplierCount && (product.supplierIds || []).length > 1)
      blockers.push("no_safe_supplier_across_multiple_suppliers");
    if (!blockers.length) return null;
    if (!safeSupplierCount && (product.supplierIds || []).length <= 1) {
      return {
        action: "supplier_sourcing",
        blockers: ["supplier_gate_weak_single_supplier"],
        rationale:
          "One weak supplier is not enough to kill a product; source or review suppliers first.",
      };
    }
    return {
      action:
        Number(product.netProfitVnd || 0) < 0 ||
        Number(product.returnCancelRefundRatePercent || 0) >
          policy.maxReturnRatePercent
          ? "stop_ads_review"
          : "monitor_only",
      blockers,
      rationale:
        "Product has negative economics or high return/cancel/refund evidence; only internal stop review is allowed.",
    };
  }

  private supplierBlockers(
    supplier: AdsAutomationSupplierInput,
    policy: NormalizedPolicy,
  ): string[] {
    const blockers: string[] = [];
    if (supplier.quoteApproved !== true) blockers.push("quote_not_approved");
    if (Number(supplier.marginAfterCostPercent || 0) < policy.minMarginPercent)
      blockers.push("margin_after_cost_below_minimum");
    if (Number(supplier.leadTimeDays || 0) > policy.maxSupplierLeadTimeDays)
      blockers.push("lead_time_too_high");
    if (
      Number(supplier.lateDeliveryRatePercent || 0) >
      policy.maxSupplierLateDeliveryRatePercent
    )
      blockers.push("late_delivery_rate_too_high");
    if (
      Number(supplier.paymentFreshnessDays || 0) >
      policy.maxSupplierPaymentFreshnessDays
    )
      blockers.push("payment_data_not_fresh");
    if (String(supplier.capacityStatus || "").toLowerCase() === "blocked")
      blockers.push("capacity_blocked");
    if (String(supplier.capacityStatus || "").toLowerCase() === "constrained")
      blockers.push("capacity_constrained");
    if (
      Number(supplier.returnFaultRatePercent || 0) >
      policy.maxSupplierReturnFaultRatePercent
    )
      blockers.push("return_fault_rate_too_high");
    return blockers;
  }

  private supplierFitScore(
    supplier: AdsAutomationSupplierInput,
    policy: NormalizedPolicy,
    blockers: string[],
  ): number {
    let score = 100;
    if (supplier.quoteApproved !== true) score -= 25;
    score -= Math.max(
      0,
      Number(supplier.marginAfterCostPercent || 0) < policy.minMarginPercent
        ? 25
        : 0,
    );
    score -=
      Math.max(
        0,
        Number(supplier.leadTimeDays || 0) - policy.maxSupplierLeadTimeDays,
      ) * 2;
    score -= Math.max(
      0,
      Number(supplier.lateDeliveryRatePercent || 0) -
        policy.maxSupplierLateDeliveryRatePercent,
    );
    score -= Math.max(
      0,
      Number(supplier.paymentFreshnessDays || 0) -
        policy.maxSupplierPaymentFreshnessDays,
    );
    score -= Math.max(
      0,
      Number(supplier.returnFaultRatePercent || 0) -
        policy.maxSupplierReturnFaultRatePercent,
    );
    if (blockers.includes("capacity_constrained")) score -= 15;
    if (blockers.includes("capacity_blocked")) score -= 40;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private productGateForGroup(
    group: AdsAutomationAdGroupInput,
    products: Map<string, ProductGateResult>,
  ): ProductGateResult {
    const productIds = group.productIds || [];
    const missing = productIds.filter(
      (productId) => !products.has(this.id(productId)),
    );
    const related = productIds
      .map((productId) => products.get(this.id(productId)))
      .filter(Boolean) as ProductGateResult[];
    const blockers = related.flatMap((result) => result.blockers || []);
    if (missing.length) blockers.push("product_gate_missing_for_ad_group");
    if (related.some((result) => result.status === "insufficient_data"))
      blockers.push("product_gate_insufficient_data");
    if (related.some((result) => result.status === "blocked"))
      blockers.push("product_gate_blocked");
    return {
      status: blockers.length ? "blocked" : "scale_ready",
      blockers: [...new Set(blockers)],
      missingFields: missing.map((productId) => `products.${productId}`),
    };
  }

  private protectedLabelBlockers(group: AdsAutomationAdGroupInput): string[] {
    const labels = (group.labels || []).map((label) =>
      String(label).toUpperCase(),
    );
    return labels
      .filter((label) =>
        ["NO_AUTO", "BRAND_PROTECTED", "MANUAL_OVERRIDE"].includes(label),
      )
      .map((label) => `protected_label_${label.toLowerCase()}`);
  }

  private decision(params: {
    decisionType: AdsAutomationCategoryKey;
    entityType: AdsAutomationDecisionItem["entity_type"];
    entityId: string;
    platform?: string | null;
    accountId?: string | null;
    productId?: string | null;
    supplierId?: string | null;
    status: AdsAutomationDecisionStatus;
    blockers?: string[];
    missingFields?: string[];
    nextRequiredData?: string[];
    evidenceWindow: AdsAutomationEvidenceWindow;
    snapshotDate: string;
    evidenceMetrics?: Record<string, unknown>;
    dataQualityScore?: number;
    confidence?: AdsAutomationConfidence;
    riskLevel?: AdsAutomationRiskLevel;
    currentValue?: Record<string, unknown> | null;
    proposedValue?: Record<string, unknown> | null;
    idempotencyKey?: string | null;
    rollbackPlan?: string | null;
    rationale: string;
  }): AdsAutomationDecisionItem {
    return {
      decision_id: this.decisionId(
        params.snapshotDate,
        params.decisionType,
        params.entityId,
      ),
      decision_type: params.decisionType,
      entity_type: params.entityType,
      entity_id: params.entityId,
      platform: params.platform || null,
      accountId: params.accountId || null,
      productId: params.productId || null,
      supplierId: params.supplierId || null,
      currentValue: params.currentValue ?? null,
      proposedValue: params.proposedValue ?? null,
      evidence_window: params.evidenceWindow,
      evidence_metrics: params.evidenceMetrics || {},
      data_quality_score: this.roundScore(params.dataQualityScore ?? 0),
      confidence: params.confidence || "low",
      risk_level: params.riskLevel || "medium",
      status: params.status,
      blockers: params.blockers || [],
      missing_fields: params.missingFields || [],
      next_required_data: params.nextRequiredData || [],
      approval_required: true,
      execution_allowed_now: false,
      idempotency_key: params.idempotencyKey ?? null,
      rollback_plan: params.rollbackPlan ?? null,
      rationale: params.rationale,
    };
  }

  private insufficientPolicyDecision(
    decisionType: AdsAutomationCategoryKey,
    entityId: string,
    missingFields: string[],
    nextRequiredData: string[],
    evidenceWindow: AdsAutomationEvidenceWindow,
    snapshotDate: string,
  ): AdsAutomationDecisionItem {
    return this.decision({
      decisionType,
      entityType: "policy",
      entityId,
      status: "insufficient_data",
      missingFields,
      nextRequiredData,
      evidenceWindow,
      snapshotDate,
      confidence: "low",
      riskLevel: "high",
      proposedValue: { action: "data_completion" },
      rationale:
        "Required ERP input rows are missing for this decision category.",
    });
  }

  private adGroupCurrentValue(
    group: AdsAutomationAdGroupInput,
  ): Record<string, unknown> {
    return {
      campaignId: group.campaignId || null,
      adGroupId: group.adGroupId || null,
      currentStatus: group.currentStatus || null,
      currentBudgetVnd: group.currentBudgetVnd ?? null,
      campaignBudgetId: group.campaignBudgetId || null,
      campaignBudgetResourceName: group.campaignBudgetResourceName || null,
    };
  }

  private adGroupMetrics(
    group: AdsAutomationAdGroupInput,
  ): Record<string, unknown> {
    return {
      spendVnd: group.spendVnd ?? null,
      clicks: group.clicks ?? null,
      impressions: group.impressions ?? null,
      conversions: group.conversions ?? null,
      conversionValueVnd: group.conversionValueVnd ?? null,
      orders: group.orders ?? null,
      revenueVnd: group.revenueVnd ?? null,
      grossProfitVnd: group.grossProfitVnd ?? null,
      netProfitAfterAdsVnd: group.netProfitAfterAdsVnd ?? null,
      platformSpendSourceOfTruth: group.spendSourceOfTruth || null,
      orderAdvertisingCostVnd: group.orderAdvertisingCostVnd ?? null,
      spendReconciliationStatus: group.spendReconciliationStatus || null,
      spendMismatchVnd: group.spendMismatchVnd ?? null,
      spendMismatchPercent: group.spendMismatchPercent ?? null,
      attributedOrderIds: group.attributedOrderIds || [],
      excludedOrderIds: group.excludedOrderIds || [],
      cancelledReturnedRefundedOrders:
        group.cancelledReturnedRefundedOrders ?? null,
      returnRatePercent: group.returnRatePercent ?? null,
      dataQualityScore: group.dataQualityScore ?? null,
      productIds: group.productIds || [],
    };
  }

  private productMetrics(
    product: AdsAutomationProductInput,
  ): Record<string, unknown> {
    return {
      productId: product.productId || null,
      sku: product.sku || null,
      name: product.name || null,
      netProfitVnd: product.netProfitVnd ?? null,
      adAttributedNetProfitAfterAdsVnd:
        product.adAttributedNetProfitAfterAdsVnd ?? null,
      marginPercent: product.marginPercent ?? null,
      returnCancelRefundRatePercent:
        product.returnCancelRefundRatePercent ?? null,
      stockAvailable: product.stockAvailable ?? null,
      reservedQuantity: product.reservedQuantity ?? null,
      incomingQuantity: product.incomingQuantity ?? null,
      daysOfCover: product.daysOfCover ?? null,
      mediaReady: product.mediaReady ?? null,
      landingReady: product.landingReady ?? null,
      offerReady: product.offerReady ?? null,
      mappedAdGroupIds: product.mappedAdGroupIds || [],
      supplierIds: product.supplierIds || [],
    };
  }

  private supplierMetrics(
    supplier: AdsAutomationSupplierInput,
  ): Record<string, unknown> {
    return {
      productId: supplier.productId || null,
      supplierId: supplier.supplierId || null,
      supplierName: supplier.supplierName || null,
      quoteApproved: supplier.quoteApproved ?? null,
      currentQuoteVnd: supplier.currentQuoteVnd ?? null,
      priorQuoteVnd: supplier.priorQuoteVnd ?? null,
      marginAfterCostPercent: supplier.marginAfterCostPercent ?? null,
      leadTimeDays: supplier.leadTimeDays ?? null,
      lateDeliveryRatePercent: supplier.lateDeliveryRatePercent ?? null,
      paymentFreshnessDays: supplier.paymentFreshnessDays ?? null,
      capacityStatus: supplier.capacityStatus || null,
      returnFaultRatePercent: supplier.returnFaultRatePercent ?? null,
    };
  }

  private missing(source: any, fields: string[]): string[] {
    return fields.filter((field) => !this.present(source[field]));
  }

  private present(value: unknown): boolean {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== "";
  }

  private nextRequired(fields: string[]): string[] {
    return fields.map((field) => `Provide ${field} from ERP source data.`);
  }

  private confidence(
    dataQuality: number,
    orders: number,
  ): AdsAutomationConfidence {
    if (dataQuality >= 0.9 && orders >= 10) return "high";
    if (dataQuality >= 0.75 && orders >= 5) return "medium";
    return "low";
  }

  private defaultEvidenceWindow(
    snapshotDate: string,
  ): AdsAutomationEvidenceWindow {
    const to = new Date(`${snapshotDate}T00:00:00.000Z`);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 13);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      days: 14,
    };
  }

  private validDate(value?: string): string | null {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    return Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
      ? null
      : value;
  }

  private numberOr(value: unknown, fallback: number): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  private paused(status?: string): boolean {
    return ["paused", "removed", "disabled"].includes(
      String(status || "").toLowerCase(),
    );
  }

  private first(values?: string[]): string | null {
    return values?.length ? String(values[0]) : null;
  }

  private id(value: unknown): string {
    return String(value || "unknown");
  }

  private idempotency(
    snapshotDate: string,
    type: AdsAutomationCategoryKey,
    entityId: string,
  ): string {
    return `ads-decision:${snapshotDate}:${type}:${this.safeKey(entityId)}`;
  }

  private decisionId(
    snapshotDate: string,
    type: AdsAutomationCategoryKey,
    entityId: string,
  ): string {
    return `ADSDEC-${snapshotDate.replace(/-/g, "")}-${type}-${this.safeKey(entityId)}`;
  }

  private safeKey(value: string): string {
    return value.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);
  }

  private roundScore(value: number): number {
    return Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100) / 100;
  }
}
