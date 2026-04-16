export type IssueType =
  | 'scan_failed'
  | 'product_not_found'
  | 'missing_ingredient_data'
  | 'allergen_warning_wrong'
  | 'eczema_result_wrong'
  | 'category_incorrect'
  | 'login_problem'
  | 'profile_not_saving'
  | 'app_loading_freeze'
  | 'sync_history_issue'
  | 'other';

export type IssueStatus = 'new' | 'investigating' | 'waiting_on_user' | 'resolved';
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AppSection =
  | 'scanner'
  | 'product_detail'
  | 'profiles'
  | 'history'
  | 'settings'
  | 'login'
  | 'shopping_list'
  | 'recalls'
  | 'other';

export interface SupportIssue {
  id: string;
  user_id: string;
  user_email?: string;
  issue_type: IssueType;
  description: string;
  screenshot_url?: string;
  app_section: AppSection;
  barcode?: string;
  product_name?: string;
  device_platform: string;
  app_version: string;
  profile_id?: string;
  profile_name?: string;
  severity: IssueSeverity;
  status: IssueStatus;
  ai_summary?: string;
  ai_likely_cause?: string;
  ai_suggested_checks?: string;
  ai_suggested_reply?: string;
  is_repeated: boolean;
  product_data_incomplete: boolean;
  category_corrected: boolean;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface IssueNote {
  id: string;
  issue_id: string;
  author_id: string;
  author_email?: string;
  content: string;
  is_system: boolean;
  created_at: string;
}

export interface ErrorLog {
  id: string;
  user_id?: string;
  error_type: string;
  error_message: string;
  stack_trace?: string;
  context?: Record<string, unknown>;
  created_at: string;
}

export interface AdminDashboardStats {
  open_issues: number;
  critical_issues: number;
  scan_failures_today: number;
  product_lookup_failures: number;
  profile_save_failures: number;
  unresolved_reports: number;
}

export interface AICopilotAnalysis {
  summary: string;
  likely_cause: string;
  next_checks: string;
  suggested_reply: string;
}

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  scan_failed: 'Scan Failed',
  product_not_found: 'Product Not Found',
  missing_ingredient_data: 'Missing Ingredient Data',
  allergen_warning_wrong: 'Allergen/Sensitivity Warning Seems Wrong',
  eczema_result_wrong: 'Eczema Result Seems Wrong',
  category_incorrect: 'Category Incorrect',
  login_problem: 'Login Problem',
  profile_not_saving: 'Profile/Preferences Not Saving',
  app_loading_freeze: 'App Loading/Freeze',
  sync_history_issue: 'Sync/History Issue',
  other: 'Other',
};

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  new: 'New',
  investigating: 'Investigating',
  waiting_on_user: 'Waiting on User',
  resolved: 'Resolved',
};

export const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const SEVERITY_COLORS: Record<IssueSeverity, string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#F97316',
  critical: '#EF4444',
};

export const STATUS_COLORS: Record<IssueStatus, string> = {
  new: '#3B82F6',
  investigating: '#F59E0B',
  waiting_on_user: '#8B5CF6',
  resolved: '#10B981',
};

export const APP_SECTION_LABELS: Record<AppSection, string> = {
  scanner: 'Scanner',
  product_detail: 'Product Detail',
  profiles: 'Profiles',
  history: 'History',
  settings: 'Settings',
  login: 'Login',
  shopping_list: 'Shopping List',
  recalls: 'Recalls',
  other: 'Other',
};
