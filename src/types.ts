export type StartupStage = 'idea' | 'prototype';

export interface StartupInfo {
  name: string;
  idea: string;
  stage: StartupStage;
  targetUsers: string;
  budget: string;
  goals: string;
}

export interface Stakeholder {
  name: string;
  role: string;
  reaction: 'positive' | 'negative' | 'neutral';
  comment: string;
}

export interface Metrics {
  impact: number;
  financials: number;
  risk: number;
  trust: number;
}

export interface Option {
  id: string;
  text: string;
  description: string;
}

export interface DecisionPoint {
  id: string;
  title: string;
  scenario: string;
  options: Option[];
}

export interface SimulationOutcome {
  stakeholders: Stakeholder[];
  metricsDelta: Metrics;
  insight: string;
  alternative: string;
}

export interface FinalReport {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  observations: string[];
  dashboard: {
    impact: number;
    financials: number;
    risk: number;
    readiness: number;
  };
  roadmap: {
    step: string;
    action: string;
  }[];
}
