import { generateObject } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { SupportIssue, AICopilotAnalysis, ISSUE_TYPE_LABELS } from '@/types/adminSupport';
import { updateIssueAI } from '@/services/adminSupportService';

const copilotSchema = z.object({
  summary: z.string().describe('A short plain-English summary of the issue'),
  likely_cause: z.string().describe('The most likely root cause'),
  next_checks: z.string().describe('Recommended next steps for admin to investigate'),
  suggested_reply: z.string().describe('A suggested user-facing reply message'),
});

export async function analyzeIssue(issue: SupportIssue): Promise<AICopilotAnalysis> {
  const issueLabel = ISSUE_TYPE_LABELS[issue.issue_type] || issue.issue_type;

  const prompt = `You are a SafeBite support copilot. Analyze this user-reported issue and provide troubleshooting guidance.

Issue Type: ${issueLabel}
Description: ${issue.description}
App Section: ${issue.app_section}
Severity: ${issue.severity}
${issue.barcode ? `Barcode: ${issue.barcode}` : ''}
${issue.product_name ? `Product: ${issue.product_name}` : ''}
${issue.profile_name ? `Profile: ${issue.profile_name}` : ''}
Platform: ${issue.device_platform}
App Version: ${issue.app_version}
Is Repeated: ${issue.is_repeated ? 'Yes' : 'No'}

SafeBite context:
- SafeBite scans food barcodes and checks for allergens, eczema triggers, and sensitivities
- Product data comes from OpenFoodFacts, Supabase cache, and manual entries
- Profiles contain allergens, eczema triggers, and sensitivities with status (confirmed/suspected/resolved)
- Only active (confirmed/suspected) issues drive safety verdicts
- Common failures: barcode not in database, incomplete ingredient data, API timeout, category misclassification (food vs skin product)

Provide analysis focused on SafeBite-specific troubleshooting. Be concise and actionable.`;

  try {
    const result = await generateObject({
      messages: [{ role: 'user', content: prompt }],
      schema: copilotSchema,
    });

    const analysis: AICopilotAnalysis = {
      summary: result.summary,
      likely_cause: result.likely_cause,
      next_checks: result.next_checks,
      suggested_reply: result.suggested_reply,
    };

    await updateIssueAI(issue.id, {
      ai_summary: analysis.summary,
      ai_likely_cause: analysis.likely_cause,
      ai_suggested_checks: analysis.next_checks,
      ai_suggested_reply: analysis.suggested_reply,
    });

    console.log('[AICopilot] Analysis complete for issue:', issue.id);
    return analysis;
  } catch (err) {
    console.error('[AICopilot] Analysis failed:', err);
    return {
      summary: 'AI analysis unavailable',
      likely_cause: 'Could not generate analysis at this time',
      next_checks: 'Review the issue details manually',
      suggested_reply: 'We are looking into your reported issue and will get back to you shortly.',
    };
  }
}

export function shouldTriggerAI(issue: SupportIssue): boolean {
  if (issue.severity === 'critical' || issue.severity === 'high') return true;
  if (issue.is_repeated) return true;
  if (issue.status === 'new') return true;
  return false;
}
