import { Platform } from 'react-native';
import { createIssue } from '@/services/adminSupportService';
import { IssueType, IssueSeverity, AppSection } from '@/types/adminSupport';

const APP_VERSION = '1.0.0';
const recentAutoLogs = new Map<string, number>();
const AUTO_LOG_DEDUPE_MS = 60000;

export async function autoLogIssue(params: {
  issueType: IssueType;
  description: string;
  severity?: IssueSeverity;
  appSection?: AppSection;
  barcode?: string;
  productName?: string;
  userId?: string;
  profileId?: string;
  profileName?: string;
}): Promise<void> {
  try {
    const dedupeKey = `${params.issueType}_${params.barcode || ''}_${params.userId || ''}`;
    const now = Date.now();
    const lastLog = recentAutoLogs.get(dedupeKey);
    if (lastLog && (now - lastLog) < AUTO_LOG_DEDUPE_MS) {
      console.log('[AutoIssueLogger] Dedupe: skipping duplicate log for', dedupeKey);
      return;
    }
    recentAutoLogs.set(dedupeKey, now);

    if (recentAutoLogs.size > 100) {
      const cutoff = now - 300000;
      for (const [key, ts] of recentAutoLogs) {
        if (ts < cutoff) recentAutoLogs.delete(key);
      }
    }

    console.log('[AutoIssueLogger] Logging issue:', params.issueType, params.barcode || '');

    await createIssue({
      user_id: params.userId || 'system',
      issue_type: params.issueType,
      description: params.description,
      app_section: params.appSection || 'product_detail',
      barcode: params.barcode,
      product_name: params.productName,
      device_platform: Platform.OS,
      app_version: APP_VERSION,
      profile_id: params.profileId,
      profile_name: params.profileName,
      severity: params.severity || 'low',
      status: 'new',
      is_repeated: false,
      product_data_incomplete: params.issueType === 'missing_ingredient_data' || params.issueType === 'product_not_found',
      category_corrected: params.issueType === 'category_incorrect',
    });
  } catch (err) {
    console.log('[AutoIssueLogger] Failed to log issue (non-critical):', err);
  }
}

export function logMissingData(barcode: string, productName?: string, userId?: string, profileId?: string, profileName?: string): void {
  void autoLogIssue({
    issueType: 'missing_ingredient_data',
    description: `Product ${productName || barcode} has no ingredient data available. Barcode: ${barcode}`,
    severity: 'medium',
    appSection: 'product_detail',
    barcode,
    productName,
    userId,
    profileId,
    profileName,
  });
}

export function logCategoryMismatch(barcode: string, productName: string, expectedCategory: string, detectedCategory: string, userId?: string): void {
  void autoLogIssue({
    issueType: 'category_incorrect',
    description: `Category mismatch for ${productName} (${barcode}). User selected: ${expectedCategory}, API detected: ${detectedCategory}`,
    severity: 'low',
    appSection: 'product_detail',
    barcode,
    productName,
    userId,
  });
}

export function logAllergenMismatch(barcode: string, productName: string, details: string, userId?: string, profileId?: string, profileName?: string): void {
  void autoLogIssue({
    issueType: 'allergen_warning_wrong',
    description: `Potential allergen mismatch for ${productName} (${barcode}). ${details}`,
    severity: 'medium',
    appSection: 'product_detail',
    barcode,
    productName,
    userId,
    profileId,
    profileName,
  });
}

export function logProductNotFound(barcode: string, userId?: string): void {
  void autoLogIssue({
    issueType: 'product_not_found',
    description: `Product not found in any database for barcode: ${barcode}`,
    severity: 'low',
    appSection: 'scanner',
    barcode,
    userId,
  });
}

export function logScanFailed(reason: string, barcode?: string, userId?: string): void {
  void autoLogIssue({
    issueType: 'scan_failed',
    description: `Scan failed: ${reason}${barcode ? ` (barcode: ${barcode})` : ''}`,
    severity: 'medium',
    appSection: 'scanner',
    barcode,
    userId,
  });
}

export function logProductLookupFailed(barcode: string, reason: string, userId?: string, profileId?: string, profileName?: string): void {
  void autoLogIssue({
    issueType: 'other',
    description: `Product lookup failed for ${barcode}: ${reason}`,
    severity: 'medium',
    appSection: 'product_detail',
    barcode,
    userId,
    profileId,
    profileName,
  });
}

export function logProfileSaveFailed(reason: string, userId?: string, profileId?: string, profileName?: string): void {
  void autoLogIssue({
    issueType: 'profile_not_saving',
    description: `Profile save failed: ${reason}`,
    severity: 'high',
    appSection: 'profiles',
    userId,
    profileId,
    profileName,
  });
}

export function logNetworkFailure(url: string, reason: string, userId?: string): void {
  void autoLogIssue({
    issueType: 'other',
    description: `Network request failed: ${reason} (url: ${url})`,
    severity: 'low',
    appSection: 'other',
    userId,
  });
}

export function logCircuitBreakerOpened(errorCount: number, userId?: string): void {
  void autoLogIssue({
    issueType: 'app_loading_freeze',
    description: `Circuit breaker opened after ${errorCount} recent network failures. App entered degraded state.`,
    severity: 'high',
    appSection: 'other',
    userId,
  });
}

export function logAppCrash(error: Error, componentStack?: string, userId?: string): void {
  void autoLogIssue({
    issueType: 'app_loading_freeze',
    description: `App crash (ErrorBoundary): ${error.message}${componentStack ? `\n\nComponent stack:\n${componentStack.slice(0, 500)}` : ''}${error.stack ? `\n\nStack:\n${error.stack.slice(0, 500)}` : ''}`,
    severity: 'critical',
    appSection: 'other',
    userId,
  });
}
