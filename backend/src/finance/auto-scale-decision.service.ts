/**
 * @deprecated This file is deprecated. Use './scale-decision/auto-scale-decision.service' instead.
 * 
 * This file is kept for backward compatibility.
 * All functionality has been moved to the scale-decision module.
 */

// Re-export everything from the new location for backward compatibility
export { 
  AutoScaleDecisionService,
  AggregatedMetrics, 
  ScaleDecision, 
  FrequencyCheck 
} from './scale-decision/auto-scale-decision.service';
