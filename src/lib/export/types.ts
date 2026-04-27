// Export types for the PDF report feature

export interface SGSDimensions {
  reactionTime: number;    // 0-100
  inhibition: number;      // 0-100
  workingMemory: number;   // 0-100
  attention: number;       // 0-100
  flexibility: number;     // 0-100
  anticipation: number;    // 0-100
}

export interface SimonMetrics {
  simon_effect_ms: number | null;
  simon_error_pct: number | null;
  simon_rt_congruent: number | null;
  simon_rt_incongruent: number | null;
}

export interface NBackMetrics {
  nback_dprime: number | null;
  nback_accuracy: number | null;
  nback_hit_rate: number | null;
  nback_false_alarm: number | null;
}

export interface TMTMetrics {
  tmt_a_time: number | null;
  tmt_b_time: number | null;
  tmt_ratio: number | null;
  tmt_errors: number | null;
}

export interface SessionExportData {
  id: string;
  createdAt: string;
  sgsScore: number | null;
  dimensions: SGSDimensions;
  simon: SimonMetrics;
  nback: NBackMetrics;
  tmt: TMTMetrics;
}

export interface PlayerExportData {
  id: string;
  fullName: string | null;
  position: string | null;
  avatarUrl: string | null;
  sessions: SessionExportData[];
}

export interface TeamAverages {
  reactionTime: number;
  inhibition: number;
  workingMemory: number;
  attention: number;
  flexibility: number;
  anticipation: number;
  sgsScore: number;
}

export interface TeamExportData {
  players: PlayerExportData[];
  teamAverages: TeamAverages;
  generatedAt: string;
}

export interface ExportOptions {
  scope: 'player' | 'team';
  playerId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}
