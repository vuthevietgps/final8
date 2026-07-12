import { AiDataPackMetadata, ConfidenceLevel, SectionQuality } from './metadata.contract';

export interface MappingSegment {
  mapping_segment: string;
  source_entity: string;
  target_entity: string;
  mapping_rate: number | null;
  confidence: ConfidenceLevel;
  missing_count: number;
  broken_reason: string | null;
  impact: string;
  required_fix_priority: 'P0' | 'P1' | 'P2';
}

export interface MappingReport {
  metadata: AiDataPackMetadata;
  segments: MappingSegment[];
  overall_attribution_confidence: number;
  quality: SectionQuality;
}

