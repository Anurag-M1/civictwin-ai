// CivicTwin AI - Domain Constants & Enumerations
// Digital Public Infrastructure & Governance Intelligence Platform

export const USER_ROLES = [
  'CITIZEN',
  'ANALYST',
  'FIELD_OFFICER',
  'COMMISSIONER',
  'ADMINISTRATOR',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CIVIC_CATEGORIES = [
  'Roads',
  'Water',
  'Sanitation',
  'Electricity',
  'Healthcare',
  'Education',
  'Public Transport',
  'Waste Management',
  'Digital Connectivity',
  'Disaster Resilience',
  'Other',
] as const;
export type CivicCategory = (typeof CIVIC_CATEGORIES)[number];

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const URGENCY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export const CHANNELS = ['WEB', 'VOICE', 'MESSAGING', 'KIOSK', 'PAPER'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CITIZEN_REQUEST_STATUSES = [
  'INGESTED',
  'NORMALIZED',
  'CLUSTERED',
  'FLAGGED',
  'IN_REVIEW',
  'RESOLVED',
] as const;
export type CitizenRequestStatus = (typeof CITIZEN_REQUEST_STATUSES)[number];

export const HOTSPOT_STATUSES = ['EMERGING', 'ELEVATED', 'MITIGATING', 'RESOLVED'] as const;
export type HotspotStatus = (typeof HOTSPOT_STATUSES)[number];

export const RECOMMENDATION_STATUSES = ['PROPOSED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const HUMAN_REVIEW_ACTIONS = [
  'APPROVED',
  'MODIFIED',
  'REJECTED',
  'DISPATCHED_INSPECTION',
] as const;
export type HumanReviewAction = (typeof HUMAN_REVIEW_ACTIONS)[number];

export const ASSET_TYPES = [
  'Road',
  'WaterNetwork',
  'HealthCentre',
  'School',
  'Transformer',
  'WasteFacility',
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_CONDITION_RATINGS = [
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'POOR',
  'CRITICAL',
] as const;
export type AssetConditionRating = (typeof ASSET_CONDITION_RATINGS)[number];

export const ADMIN_LEVELS = ['COUNTRY', 'STATE', 'DISTRICT', 'BLOCK', 'WARD'] as const;
export type AdminLevel = (typeof ADMIN_LEVELS)[number];

export const DATASET_TYPES = [
  'OFFICIAL_OPEN_DATA',
  'SYNTHETIC_BENCHMARK',
  'DEMO_SEED',
] as const;
export type DatasetType = (typeof DATASET_TYPES)[number];

export const AUDIT_EVENT_TYPES = [
  'AI_EXTRACTION',
  'HOTSPOT_DETECTED',
  'PRIORITY_COMPUTED',
  'SCENARIO_SIMULATED',
  'BRIEF_SYNTHESIS',
  'HUMAN_OVERRIDE',
  'HUMAN_REVIEW',
  'CITIZEN_INGESTION',
  'DATA_INGESTION_RUN',
  'CONFIG_UPDATE',
  'DEMO_RESET',
  'AUTH_LOGIN',
  'AUTH_FAILED',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const AUDIT_SOURCE_MODULES = [
  'INGESTION',
  'RADAR',
  'PRIORITY_ENGINE',
  'WHAT_IF_SIMULATOR',
  'BRIEF_SYNTHESIS',
  'HUMAN_REVIEW',
  'AUTH',
  'SYSTEM',
  'DATA_PIPELINE',
] as const;
export type AuditSourceModule = (typeof AUDIT_SOURCE_MODULES)[number];

// Standard explainable priority weights (must sum to 1.0)
export const DEFAULT_PRIORITY_WEIGHTS = {
  infrastructure_gap: 0.28,
  request_volume: 0.22,
  affected_population: 0.19,
  urgency: 0.14,
  service_criticality: 0.10,
  investment_gap: 0.07,
} as const;

export type PriorityFactorKey = keyof typeof DEFAULT_PRIORITY_WEIGHTS;

export const PRIORITY_FACTOR_LABELS: Record<PriorityFactorKey, string> = {
  infrastructure_gap: 'Infrastructure Gap & Distress',
  request_volume: 'Citizen Signal Volume & Concentration',
  affected_population: 'Vulnerable Population Density',
  urgency: 'Reported Incident Urgency',
  service_criticality: 'Essential Service Criticality',
  investment_gap: 'Historical Capital Expenditure Deficit',
};
