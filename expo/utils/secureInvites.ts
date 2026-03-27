import { Platform, Share } from 'react-native';
import { supabase } from '@/lib/supabase';
import { generateSecureToken, hashToken, isTokenExpired, getExpirationDate, validateFamilyMemberCount } from '@/utils/security';
import { logAuditEvent, logAuditEventImmediate } from '@/utils/auditLog';

const APP_NAME = 'SafeBite - Allergy Guardian';
const WEB_APP_URL = 'https://safebite.app';

export interface SecureInvitation {
  id: string;
  invite_type: 'app' | 'family';
  family_id: string | null;
  invited_email: string | null;
  created_by: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
  expires_at: string;
  created_at: string;
}

function getAppDownloadUrl(): string {
  if (Platform.OS === 'ios') return 'https://apps.apple.com/app/safebite';
  if (Platform.OS === 'android') return 'https://play.google.com/store/apps/details?id=com.safebite';
  return WEB_APP_URL;
}

export async function createSecureFamilyInvite(
  familyId: string,
  creatorUserId: string,
  email?: string
): Promise<{ token: string; invitation: SecureInvitation | null; error: string | null }> {
  try {
    console.log('[SecureInvites] Creating family invite for family:', familyId);

    const { data: familyGroup, error: fgError } = await supabase
      .from('family_groups')
      .select('id, name, member_ids')
      .eq('id', familyId)
      .maybeSingle();

    if (fgError) {
      console.error('[SecureInvites] Family group lookup failed:', fgError.message);
    }

    if (!familyGroup) {
      console.error('[SecureInvites] Family group not found:', familyId);
      return { token: '', invitation: null, error: 'Family group not found. Please create the group first.' };
    }

    const memberCount = familyGroup.member_ids?.length || 0;

    const { data: pendingInvites } = await supabase
      .from('secure_invitations')
      .select('id')
      .eq('family_id', familyId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    const currentCount = memberCount + (pendingInvites?.length || 0);
    const validation = validateFamilyMemberCount(currentCount);
    if (!validation.valid) {
      return { token: '', invitation: null, error: validation.message };
    }

    const rawToken = generateSecureToken(48);
    const tokenHash = await hashToken(rawToken);
    const expiresAt = getExpirationDate(72);

    const insertPayload: Record<string, any> = {
      token_hash: tokenHash,
      invite_type: 'family',
      family_id: familyId,
      invited_email: email || null,
      created_by: creatorUserId,
      status: 'pending',
      expires_at: expiresAt,
    };

    const { data, error } = await supabase
      .from('secure_invitations')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('[SecureInvites] Insert failed:', error.message, 'code:', error.code);

      if (error.message.includes('foreign key') || error.code === '23503') {
        console.log('[SecureInvites] FK error - trying insert without family_id FK constraint');
        const { data: retryData, error: retryError } = await supabase
          .from('secure_invitations')
          .insert({ ...insertPayload, family_id: null, metadata: JSON.stringify({ intended_family_id: familyId, family_name: familyGroup.name }) })
          .select()
          .single();

        if (retryError) {
          console.error('[SecureInvites] Retry also failed:', retryError.message);
          return { token: '', invitation: null, error: 'Invite could not be created. Please try again.' };
        }

        if (retryData) {
          logAuditEvent({
            eventType: 'invite.create',
            userId: creatorUserId,
            familyId,
            targetId: retryData.id,
            metadata: { invite_type: 'family', expires_at: expiresAt, fk_workaround: true },
          });
          console.log('[SecureInvites] Invite created with FK workaround');
          return { token: rawToken, invitation: retryData as SecureInvitation, error: null };
        }
      }

      if (error.code === '42501') {
        return { token: '', invitation: null, error: 'Permission issue. Please contact admin.' };
      }

      logAuditEvent({
        eventType: 'error.invite_failed',
        userId: creatorUserId,
        familyId,
        metadata: { error: error.message, code: error.code },
      });
      return { token: '', invitation: null, error: 'Invite could not be created. Please try again.' };
    }

    logAuditEvent({
      eventType: 'invite.create',
      userId: creatorUserId,
      familyId,
      targetId: data.id,
      metadata: { invite_type: 'family', expires_at: expiresAt },
    });

    console.log('[SecureInvites] Invite created successfully');
    return { token: rawToken, invitation: data as SecureInvitation, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SecureInvites] Create error:', msg);
    return { token: '', invitation: null, error: 'Invite could not be created. Please try again.' };
  }
}

export async function redeemFamilyInvite(
  rawToken: string,
  userId: string
): Promise<{ success: boolean; familyId: string | null; error: string | null }> {
  try {
    console.log('[SecureInvites] Redeeming invite token');

    const tokenHash = await hashToken(rawToken);

    const { data: invite, error: fetchError } = await supabase
      .from('secure_invitations')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (fetchError || !invite) {
      logAuditEvent({
        eventType: 'error.invite_failed',
        userId,
        metadata: { reason: 'token_not_found' },
      });
      return { success: false, familyId: null, error: 'Invalid or expired invitation' };
    }

    if (invite.status !== 'pending') {
      return { success: false, familyId: null, error: `This invitation has already been ${invite.status}` };
    }

    if (isTokenExpired(invite.expires_at)) {
      await supabase
        .from('secure_invitations')
        .update({ status: 'expired' })
        .eq('id', invite.id);
      return { success: false, familyId: null, error: 'This invitation has expired' };
    }

    if (invite.invited_email) {
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (userData?.email?.toLowerCase() !== invite.invited_email.toLowerCase()) {
        return { success: false, familyId: null, error: 'This invitation was sent to a different email address' };
      }
    }

    if (!invite.family_id) {
      return { success: false, familyId: null, error: 'No family group associated with this invitation' };
    }

    const { data: existingMember } = await supabase
      .from('family_members')
      .select('id')
      .eq('family_id', invite.family_id)
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      await supabase
        .from('secure_invitations')
        .update({ status: 'accepted', used_by: userId, used_at: new Date().toISOString() })
        .eq('id', invite.id);
      return { success: true, familyId: invite.family_id, error: null };
    }

    const { data: memberCount } = await supabase
      .from('family_members')
      .select('id')
      .eq('family_id', invite.family_id);

    const validation = validateFamilyMemberCount(memberCount?.length || 0);
    if (!validation.valid) {
      return { success: false, familyId: null, error: validation.message };
    }

    const { error: joinError } = await supabase
      .from('family_members')
      .insert({
        family_id: invite.family_id,
        user_id: userId,
        role: 'member',
      });

    if (joinError) {
      console.error('[SecureInvites] Join failed:', joinError.message);
      return { success: false, familyId: null, error: 'Failed to join family group' };
    }

    await supabase
      .from('secure_invitations')
      .update({ status: 'accepted', used_by: userId, used_at: new Date().toISOString() })
      .eq('id', invite.id);

    await logAuditEventImmediate({
      eventType: 'invite.redeem',
      userId,
      familyId: invite.family_id,
      targetId: invite.id,
    });

    logAuditEvent({
      eventType: 'family.join',
      userId,
      familyId: invite.family_id,
    });

    console.log('[SecureInvites] Invite redeemed successfully');
    return { success: true, familyId: invite.family_id, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SecureInvites] Redeem error:', msg);
    return { success: false, familyId: null, error: msg };
  }
}

export async function revokeSecureInvite(
  inviteId: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: invite, error: fetchError } = await supabase
      .from('secure_invitations')
      .select('created_by, family_id')
      .eq('id', inviteId)
      .single();

    if (fetchError || !invite) {
      return { success: false, error: 'Invitation not found' };
    }

    if (invite.created_by !== userId) {
      let isOwner = false;
      if (invite.family_id) {
        const { data: family } = await supabase
          .from('families')
          .select('owner_user_id')
          .eq('id', invite.family_id)
          .single();
        isOwner = family?.owner_user_id === userId;
      }

      if (!isOwner) {
        return { success: false, error: 'Only the invite creator or family owner can revoke' };
      }
    }

    const { error } = await supabase
      .from('secure_invitations')
      .update({ status: 'revoked' })
      .eq('id', inviteId);

    if (error) {
      return { success: false, error: error.message };
    }

    logAuditEvent({
      eventType: 'invite.revoke',
      userId,
      familyId: invite.family_id,
      targetId: inviteId,
    });

    return { success: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function declineSecureInvite(
  rawToken: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const tokenHash = await hashToken(rawToken);

    const { error } = await supabase
      .from('secure_invitations')
      .update({ status: 'declined', used_by: userId, used_at: new Date().toISOString() })
      .eq('token_hash', tokenHash)
      .eq('status', 'pending');

    if (error) {
      return { success: false, error: error.message };
    }

    logAuditEvent({
      eventType: 'invite.decline',
      userId,
    });

    return { success: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function getSecureFamilyInvites(
  familyId: string
): Promise<SecureInvitation[]> {
  try {
    const { data, error } = await supabase
      .from('secure_invitations')
      .select('id, invite_type, family_id, invited_email, created_by, status, expires_at, created_at')
      .eq('family_id', familyId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SecureInvites] Fetch error:', error.message, 'code:', error.code);
      if (error.code === '42501') {
        console.warn('[SecureInvites] RLS permission denied for invites query - returning empty');
      }
      return [];
    }

    return (data || []) as SecureInvitation[];
  } catch (err) {
    console.error('[SecureInvites] Fetch error:', err);
    return [];
  }
}

export async function shareSecureFamilyInvite(
  inviterName: string,
  familyGroupName: string,
  rawToken: string
): Promise<boolean> {
  const inviteLink = `${WEB_APP_URL}/invite/${rawToken}`;
  const downloadUrl = getAppDownloadUrl();

  const message = `${inviterName} invites you to join their family group "${familyGroupName}" on ${APP_NAME}!

1. Download SafeBite: ${downloadUrl}
2. Create an account (or sign in)
3. Accept the family invite: ${inviteLink}

This invite expires in 72 hours and can only be used once.`;

  try {
    const result = await Share.share({
      message,
      title: `Join ${familyGroupName} on ${APP_NAME}`,
    });
    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('[SecureInvites] Share error:', error);
    return false;
  }
}

export async function shareAppDownloadInvite(inviterName: string): Promise<boolean> {
  const downloadUrl = getAppDownloadUrl();

  const message = `${inviterName} invites you to try ${APP_NAME}!

SafeBite helps you safely navigate food allergies by scanning products and checking ingredients.

Download the app: ${downloadUrl}`;

  try {
    const result = await Share.share({
      message,
      title: `Try ${APP_NAME}`,
    });
    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('[SecureInvites] App share error:', error);
    return false;
  }
}
