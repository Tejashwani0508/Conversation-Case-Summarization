export const CaseStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;
export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];

export const CasePriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type CasePriority = (typeof CasePriority)[keyof typeof CasePriority];

export const CaseCategory = {
  BILLING: 'BILLING',
  PAYMENT: 'PAYMENT',
  METER_READING: 'METER_READING',
  POWER_OUTAGE: 'POWER_OUTAGE',
  CONNECTION: 'CONNECTION',
  SERVICE_REQUEST: 'SERVICE_REQUEST',
  COMPLAINT: 'COMPLAINT',
  ACCOUNT_UPDATE: 'ACCOUNT_UPDATE',
  OTHER: 'OTHER',
} as const;
export type CaseCategory = (typeof CaseCategory)[keyof typeof CaseCategory];

export const SenderType = {
  CUSTOMER: 'CUSTOMER',
  AGENT: 'AGENT',
} as const;
export type SenderType = (typeof SenderType)[keyof typeof SenderType];

export const ConversationChannel = {
  CHAT: 'CHAT',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  IMPORTED: 'IMPORTED',
} as const;
export type ConversationChannel = (typeof ConversationChannel)[keyof typeof ConversationChannel];

export const Sentiment = {
  POSITIVE: 'POSITIVE',
  NEUTRAL: 'NEUTRAL',
  CONCERNED: 'CONCERNED',
  FRUSTRATED: 'FRUSTRATED',
  ANGRY: 'ANGRY',
} as const;
export type Sentiment = (typeof Sentiment)[keyof typeof Sentiment];

export const AIAnalysisRunStatus = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;
export type AIAnalysisRunStatus = (typeof AIAnalysisRunStatus)[keyof typeof AIAnalysisRunStatus];