import { SourceAssessment } from "../source-registry/source-registry.types";

export type ProviderReadOnlySourceKey = "google_ads";
export type ProviderReadOnlyMode = "read_only";

export interface ProviderReadOnlyAssessmentInput {
  sourceKey: ProviderReadOnlySourceKey;
  reportDate: string;
  now?: Date;
}

export type SourceFreshnessAssessment = SourceAssessment;
export type SourceCoverageAssessment = SourceAssessment;

export interface AiDataPackProviderReadOnlyAdapter<
  TSyncInput = unknown,
  TSyncResult = unknown,
> {
  readonly sourceKey: ProviderReadOnlySourceKey;
  readonly mode: ProviderReadOnlyMode;
  readonly supportsSourceRegistry: true;

  assessLocalFreshness(
    input: ProviderReadOnlyAssessmentInput,
  ): Promise<SourceFreshnessAssessment>;

  syncReadOnly(input: TSyncInput): Promise<TSyncResult>;

  assessCoverage(
    input: ProviderReadOnlyAssessmentInput,
  ): Promise<SourceCoverageAssessment>;
}
