// ─── Core Domain Types ────────────────────────────────────────────────────────

export type UserRole = "user" | "admin" | "super_admin";
export type TaskType = "verified" | "unverified";
export type TaskStatus = "draft" | "active" | "paused" | "completed" | "archived";
export type CompletionStatus = "pending" | "approved" | "rejected" | "flagged";
export type WithdrawalStatus = "pending" | "under_review" | "approved" | "rejected" | "paid";
export type LedgerType = "credit" | "debit";
export type LedgerRef =
  | "task_reward"
  | "referral_bonus"
  | "signup_bonus"
  | "withdrawal_debit"
  | "withdrawal_reversal"
  | "admin_adjustment"
  | "penalty";
export type FraudSeverity = "low" | "medium" | "high" | "critical";
export type NotificationType =
  | "task_approved"
  | "task_rejected"
  | "withdrawal_approved"
  | "withdrawal_rejected"
  | "referral_bonus"
  | "signup_bonus"
  | "fraud_flag"
  | "general";

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: UserRole;
  referral_code: string;
  referred_by: string | null;
  is_active: boolean;
  is_email_verified: boolean;
  kyc_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  instructions: string;
  category_id: string;
  category?: TaskCategory;
  type: TaskType;
  status: TaskStatus;
  reward_amount: number; // in kobo (1 NGN = 100 kobo)
  max_completions: number | null;
  current_completions: number;
  requires_proof: boolean;
  proof_instructions: string | null;
  time_limit_hours: number | null;
  verification_url: string | null;
  created_by: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  task?: Task;
  user_id: string;
  user?: UserProfile;
  status: CompletionStatus;
  proof_url: string | null;
  proof_text: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referrer?: UserProfile;
  referred_id: string;
  referred?: UserProfile;
  bonus_credited: boolean;
  bonus_amount: number;
  credited_at: string | null;
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  user_id: string;
  type: LedgerType;
  delta: number; // positive for credit, negative for debit (in kobo)
  ref_type: LedgerRef;
  ref_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  user?: UserProfile;
  account_id: string;
  account?: WithdrawalAccount;
  amount: number; // in kobo
  status: WithdrawalStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  paid_at: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  ledger_entry_id: string | null;
  created_at: string;
}

export interface WithdrawalAccount {
  id: string;
  user_id: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_verified: boolean;
  is_default: boolean;
  created_at: string;
}

export interface FraudFlag {
  id: string;
  user_id: string;
  user?: UserProfile;
  reason: string;
  severity: FraudSeverity;
  details: Record<string, unknown> | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface Device {
  id: string;
  user_id: string;
  fingerprint: string;
  ip_address: string | null;
  user_agent: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  ref_id: string | null;
  read: boolean;
  created_at: string;
}

export interface AdminNote {
  id: string;
  target_type: "user" | "task" | "withdrawal" | "completion";
  target_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ─── Paystack Types ───────────────────────────────────────────────────────────

export interface PaystackBank {
  id: number;
  name: string;
  slug: string;
  code: string;
  longcode: string;
  country: string;
  currency: string;
  type: string;
  is_deleted: boolean;
  active: boolean;
}

export interface PaystackResolveResponse {
  account_number: string;
  account_name: string;
  bank_id: number;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Naira amount (human-readable) from kobo */
export const koboToNaira = (kobo: number): number => kobo / 100;

/** Format as ₦ */
export const formatNaira = (kobo: number): string =>
  `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

/** Naira string to kobo */
export const nairaToKobo = (naira: number): number => Math.round(naira * 100);
