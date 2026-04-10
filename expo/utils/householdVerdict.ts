import { Product, Profile, VerdictLevel, HouseholdMemberVerdict, HouseholdVerdict } from '@/types';
import { evaluateProduct } from './evaluationEngine';
import { engineToLegacyVerdict } from './unifiedEvaluation';

export function calculateHouseholdVerdict(
  product: Product,
  members: Profile[]
): HouseholdVerdict {
  if (members.length === 0) {
    return {
      overallLevel: 'unknown',
      memberVerdicts: [],
      affectedMembers: [],
      safeMembers: [],
      message: 'No household members to check against.',
    };
  }

  const memberVerdicts: HouseholdMemberVerdict[] = members.map(member => {
    const evalResult = evaluateProduct(product, member);
    const verdict = engineToLegacyVerdict(evalResult);
    console.log(`[HouseholdVerdict] ${member.name}: ${verdict.level} (${evalResult.matchedConcerns.length} concerns)`);
    return {
      profileId: member.id,
      profileName: member.name,
      relationship: member.relationship,
      avatarColor: member.avatarColor,
      verdict,
      hasAnaphylaxis: member.hasAnaphylaxis,
    };
  });

  const affectedMembers: string[] = [];
  const safeMembers: string[] = [];
  let worstLevel: VerdictLevel = 'safe';

  for (const mv of memberVerdicts) {
    if (mv.verdict.level === 'danger') {
      worstLevel = 'danger';
      affectedMembers.push(mv.profileName);
    } else if (mv.verdict.level === 'caution') {
      if (worstLevel !== 'danger') worstLevel = 'caution';
      affectedMembers.push(mv.profileName);
    } else if (mv.verdict.level === 'unknown') {
      if (worstLevel === 'safe') worstLevel = 'unknown';
    } else {
      safeMembers.push(mv.profileName);
    }
  }

  let message: string;
  if (worstLevel === 'danger') {
    const anaphylaxisMembers = memberVerdicts
      .filter(mv => mv.verdict.level === 'danger' && mv.hasAnaphylaxis)
      .map(mv => mv.profileName);

    if (anaphylaxisMembers.length > 0) {
      message = `DANGER for ${affectedMembers.join(', ')}. ${anaphylaxisMembers.join(', ')} ${anaphylaxisMembers.length === 1 ? 'has' : 'have'} anaphylaxis risk.`;
    } else {
      message = `Unsafe for ${affectedMembers.join(', ')}.`;
    }
  } else if (worstLevel === 'caution') {
    message = `Caution needed for ${affectedMembers.join(', ')}.`;
  } else if (worstLevel === 'unknown') {
    message = 'Cannot verify safety — missing ingredient data.';
  } else {
    message = `Safe for all ${members.length} household member${members.length > 1 ? 's' : ''}.`;
  }

  console.log('[HouseholdVerdict]', message);

  return {
    overallLevel: worstLevel,
    memberVerdicts,
    affectedMembers,
    safeMembers,
    message,
  };
}

export function getVerdictSortOrder(level: VerdictLevel): number {
  switch (level) {
    case 'danger': return 0;
    case 'caution': return 1;
    case 'unknown': return 2;
    case 'safe': return 3;
  }
}
