/**
 * Scale Decision Module
 * 
 * Barrel exports cho tất cả các services trong module
 */

// Interfaces
export * from './interfaces';

// Services
export { OptimalSpendCalculatorService } from './optimal-spend-calculator.service';
export { ScaleRulesService, KILL_THRESHOLDS, SCALE_DOWN_THRESHOLDS, MAINTAIN_THRESHOLDS, SCALE_UP_MODERATE_THRESHOLDS, SCALE_UP_AGGRESSIVE_THRESHOLDS } from './scale-rules.service';
export { PhaseRulesService, PHASE_THRESHOLDS } from './phase-rules.service';
