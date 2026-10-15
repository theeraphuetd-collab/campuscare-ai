export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'investigating' | 'resolved' | 'duplicate';

export interface CampusIssue {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  severity: SeverityLevel;
  status: IssueStatus;
  is_duplicate: boolean;
  duplicate_of_id?: string;
  audio_url?: string;
  created_at: string;
}