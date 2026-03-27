import { Platform, Share } from 'react-native';
import { supabase } from '@/lib/supabase';

const APP_NAME = 'SafeBite - Allergy Guardian';
const APP_STORE_URL = 'https://apps.apple.com/app/safebite';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.safebite';
const WEB_APP_URL = 'https://safebite.app';

export interface FamilyInvitation {
  id: string;
  family_group_id: string;
  inviter_id: string;
  email?: string;
  token: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expires_at: string;
  created_at: string;
}

export function generateInviteToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function getAppDownloadUrl(): string {
  if (Platform.OS === 'ios') {
    return APP_STORE_URL;
  } else if (Platform.OS === 'android') {
    return PLAY_STORE_URL;
  }
  return WEB_APP_URL;
}

export function generateAppInviteLink(): string {
  return getAppDownloadUrl();
}

export function generateFamilyInviteLink(token: string): string {
  const baseUrl = WEB_APP_URL;
  return `${baseUrl}/invite/${token}`;
}

export async function shareAppInvite(inviterName: string): Promise<boolean> {
  const downloadUrl = getAppDownloadUrl();
  
  const message = `${inviterName} invites you to try ${APP_NAME}!

SafeBite helps you safely navigate food allergies by scanning products and checking ingredients.

Download the app here: ${downloadUrl}`;

  try {
    const result = await Share.share({
      message,
      title: `Join ${APP_NAME}`,
    });
    
    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('[Invites] Error sharing app invite:', error);
    return false;
  }
}

export async function createFamilyInvitation(
  familyGroupId: string,
  inviterId: string,
  email?: string
): Promise<{ invitation: FamilyInvitation | null; error: string | null }> {
  try {
    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const { data, error } = await supabase
      .from('family_invitations')
      .insert({
        family_group_id: familyGroupId,
        inviter_id: inviterId,
        email: email || null,
        token,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Invites] Error creating invitation:', error);
      return { invitation: null, error: error.message };
    }
    
    return { invitation: data as FamilyInvitation, error: null };
  } catch (error) {
    console.error('[Invites] Error creating invitation:', error);
    return { invitation: null, error: 'Failed to create invitation' };
  }
}

export async function shareFamilyInvite(
  inviterName: string,
  familyGroupName: string,
  token: string
): Promise<boolean> {
  const inviteLink = generateFamilyInviteLink(token);
  const downloadUrl = getAppDownloadUrl();
  
  const message = `${inviterName} invites you to join their family group "${familyGroupName}" on ${APP_NAME}!

With a family plan, you can share allergy profiles and keep everyone safe together.

1. Download SafeBite: ${downloadUrl}
2. Create an account (or sign in)
3. Accept the family invite: ${inviteLink}

This invite expires in 7 days.`;

  try {
    const result = await Share.share({
      message,
      title: `Join ${familyGroupName} on ${APP_NAME}`,
    });
    
    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('[Invites] Error sharing family invite:', error);
    return false;
  }
}

export async function getFamilyInvitations(
  familyGroupId: string
): Promise<FamilyInvitation[]> {
  try {
    const { data, error } = await supabase
      .from('family_invitations')
      .select('*')
      .eq('family_group_id', familyGroupId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[Invites] Error fetching invitations:', error);
      return [];
    }
    
    return data as FamilyInvitation[];
  } catch (error) {
    console.error('[Invites] Error fetching invitations:', error);
    return [];
  }
}

export async function getPendingInvitationsForUser(
  email: string
): Promise<FamilyInvitation[]> {
  try {
    const { data, error } = await supabase
      .from('family_invitations')
      .select('*')
      .eq('email', email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());
    
    if (error) {
      console.error('[Invites] Error fetching pending invitations:', error);
      return [];
    }
    
    return data as FamilyInvitation[];
  } catch (error) {
    console.error('[Invites] Error fetching pending invitations:', error);
    return [];
  }
}

export async function acceptFamilyInvitation(
  invitationId: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: invitation, error: fetchError } = await supabase
      .from('family_invitations')
      .select('*, family_groups(*)')
      .eq('id', invitationId)
      .single();
    
    if (fetchError || !invitation) {
      return { success: false, error: 'Invitation not found' };
    }
    
    if (invitation.status !== 'pending') {
      return { success: false, error: 'This invitation has already been used' };
    }
    
    if (new Date(invitation.expires_at) < new Date()) {
      return { success: false, error: 'This invitation has expired' };
    }
    
    const familyGroup = invitation.family_groups;
    if (!familyGroup) {
      return { success: false, error: 'Family group not found' };
    }
    
    const currentMembers = familyGroup.member_ids || [];
    if (currentMembers.length >= 6) {
      return { success: false, error: 'This family group has reached the maximum of 6 members' };
    }
    
    if (currentMembers.includes(userId)) {
      await supabase
        .from('family_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);
      return { success: true, error: null };
    }
    
    const { error: updateError } = await supabase
      .from('family_groups')
      .update({ member_ids: [...currentMembers, userId] })
      .eq('id', familyGroup.id);
    
    if (updateError) {
      return { success: false, error: 'Failed to join family group' };
    }
    
    await supabase
      .from('family_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitationId);
    
    return { success: true, error: null };
  } catch (error) {
    console.error('[Invites] Error accepting invitation:', error);
    return { success: false, error: 'Failed to accept invitation' };
  }
}

export async function declineFamilyInvitation(
  invitationId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('family_invitations')
      .update({ status: 'declined' })
      .eq('id', invitationId);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error('[Invites] Error declining invitation:', error);
    return { success: false, error: 'Failed to decline invitation' };
  }
}

export async function revokeInvitation(
  invitationId: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: invitation, error: fetchError } = await supabase
      .from('family_invitations')
      .select('inviter_id')
      .eq('id', invitationId)
      .single();
    
    if (fetchError || !invitation) {
      return { success: false, error: 'Invitation not found' };
    }
    
    if (invitation.inviter_id !== userId) {
      return { success: false, error: 'You can only revoke invitations you created' };
    }
    
    const { error } = await supabase
      .from('family_invitations')
      .delete()
      .eq('id', invitationId);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error('[Invites] Error revoking invitation:', error);
    return { success: false, error: 'Failed to revoke invitation' };
  }
}

export async function getInvitationByToken(
  token: string
): Promise<FamilyInvitation | null> {
  try {
    const { data, error } = await supabase
      .from('family_invitations')
      .select('*')
      .eq('token', token)
      .single();
    
    if (error) {
      console.error('[Invites] Error fetching invitation by token:', error);
      return null;
    }
    
    return data as FamilyInvitation;
  } catch (error) {
    console.error('[Invites] Error fetching invitation by token:', error);
    return null;
  }
}
