import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  MessageSquare,
  CheckCircle,
  Flag,
  Package,
  Tag,
  Send,
  User,
  Smartphone,
  Clock,
  ScanLine,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useUser } from '@/contexts/UserContext';
import {
  fetchIssueById,
  fetchIssueNotes,
  addIssueNote,
  updateIssueStatus,
  updateIssueFlags,
} from '@/services/adminSupportService';
import { analyzeIssue, shouldTriggerAI } from '@/services/aiCopilotService';
import {
  IssueStatus,
  ISSUE_TYPE_LABELS,
  ISSUE_STATUS_LABELS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  STATUS_COLORS,
  APP_SECTION_LABELS,
} from '@/types/adminSupport';

const STATUS_FLOW: IssueStatus[] = ['new', 'investigating', 'waiting_on_user', 'resolved'];

export default function IssueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useUser();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const issueQuery = useQuery({
    queryKey: ['support-issue', id],
    queryFn: () => fetchIssueById(id!),
    enabled: !!id,
  });

  const notesQuery = useQuery({
    queryKey: ['issue-notes', id],
    queryFn: () => fetchIssueNotes(id!),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: IssueStatus) => updateIssueStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-issue', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-support-stats'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const flagMutation = useMutation({
    mutationFn: (flags: Parameters<typeof updateIssueFlags>[1]) => updateIssueFlags(id!, flags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-issue', id] });
    },
  });

  const noteMutation = useMutation({
    mutationFn: () => addIssueNote({
      issue_id: id!,
      author_id: currentUser?.id || '',
      author_email: currentUser?.email,
      content: noteText,
      is_system: false,
    }),
    onSuccess: () => {
      setNoteText('');
      queryClient.invalidateQueries({ queryKey: ['issue-notes', id] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const aiMutation = useMutation({
    mutationFn: () => {
      if (!issueQuery.data) throw new Error('No issue data');
      return analyzeIssue(issueQuery.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-issue', id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([issueQuery.refetch(), notesQuery.refetch()]);
    setRefreshing(false);
  }, [issueQuery, notesQuery]);

  const issue = issueQuery.data;

  if (issueQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Issue Detail', headerStyle: { backgroundColor: '#1E293B' }, headerTintColor: '#F1F5F9', headerTitleStyle: { color: '#F1F5F9' } }} />
        <ActivityIndicator size="small" color="#10B981" />
      </View>
    );
  }

  if (!issue) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Issue Detail', headerStyle: { backgroundColor: '#1E293B' }, headerTintColor: '#F1F5F9', headerTitleStyle: { color: '#F1F5F9' } }} />
        <Text style={styles.errorText}>Issue not found</Text>
      </View>
    );
  }

  const sevColor = SEVERITY_COLORS[issue.severity];
  const statusColor = STATUS_COLORS[issue.status];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: ISSUE_TYPE_LABELS[issue.issue_type], headerStyle: { backgroundColor: '#1E293B' }, headerTintColor: '#F1F5F9', headerTitleStyle: { color: '#F1F5F9' } }} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        <View style={styles.topBadges}>
          <View style={[styles.badge, { backgroundColor: sevColor + '20' }]}>
            <Text style={[styles.badgeText, { color: sevColor }]}>{SEVERITY_LABELS[issue.severity]}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{ISSUE_STATUS_LABELS[issue.status]}</Text>
          </View>
          {issue.is_repeated && (
            <View style={[styles.badge, { backgroundColor: '#F59E0B20' }]}>
              <Text style={[styles.badgeText, { color: '#F59E0B' }]}>Repeated</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Description</Text>
          <Text style={styles.descText}>{issue.description || 'No description provided'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <DetailRow icon={User} label="User" value={issue.user_email || issue.user_id} />
          <DetailRow icon={Smartphone} label="Platform" value={issue.device_platform} />
          <DetailRow icon={Tag} label="App Version" value={issue.app_version} />
          <DetailRow icon={Tag} label="Section" value={APP_SECTION_LABELS[issue.app_section] || issue.app_section} />
          {issue.barcode ? <DetailRow icon={ScanLine} label="Barcode" value={issue.barcode} /> : null}
          {issue.product_name ? <DetailRow icon={Package} label="Product" value={issue.product_name} /> : null}
          {issue.profile_name ? <DetailRow icon={User} label="Profile" value={issue.profile_name} /> : null}
          <DetailRow icon={Clock} label="Created" value={new Date(issue.created_at).toLocaleString()} />
          {issue.resolved_at ? <DetailRow icon={CheckCircle} label="Resolved" value={new Date(issue.resolved_at).toLocaleString()} /> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Bot size={18} color="#8B5CF6" />
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>AI Copilot</Text>
            <TouchableOpacity
              style={styles.aiBtn}
              onPress={() => aiMutation.mutate()}
              disabled={aiMutation.isPending}
            >
              {aiMutation.isPending ? (
                <ActivityIndicator size="small" color="#8B5CF6" />
              ) : (
                <RefreshCw size={14} color="#8B5CF6" />
              )}
              <Text style={styles.aiBtnText}>{issue.ai_summary ? 'Re-analyze' : 'Analyze'}</Text>
            </TouchableOpacity>
          </View>

          {issue.ai_summary ? (
            <View style={styles.aiContent}>
              <AiSection label="Summary" value={issue.ai_summary} />
              <AiSection label="Likely Cause" value={issue.ai_likely_cause || ''} />
              <AiSection label="Next Checks" value={issue.ai_suggested_checks || ''} />
              <AiSection label="Suggested Reply" value={issue.ai_suggested_reply || ''} />
            </View>
          ) : (
            <Text style={styles.aiPlaceholder}>
              {shouldTriggerAI(issue)
                ? 'Tap Analyze to generate AI insights for this issue'
                : 'AI analysis available on demand'}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status Actions</Text>
          <View style={styles.statusRow}>
            {STATUS_FLOW.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusBtn,
                  issue.status === s && { backgroundColor: STATUS_COLORS[s] + '30', borderColor: STATUS_COLORS[s] },
                ]}
                onPress={() => {
                  if (issue.status !== s) {
                    statusMutation.mutate(s);
                  }
                }}
                disabled={statusMutation.isPending}
              >
                <Text style={[
                  styles.statusBtnText,
                  issue.status === s && { color: STATUS_COLORS[s] },
                ]}>
                  {ISSUE_STATUS_LABELS[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Admin Flags</Text>
          <View style={styles.flagsRow}>
            <FlagToggle
              label="Repeated Issue"
              active={issue.is_repeated}
              onToggle={() => flagMutation.mutate({ is_repeated: !issue.is_repeated })}
            />
            <FlagToggle
              label="Product Incomplete"
              active={issue.product_data_incomplete}
              onToggle={() => flagMutation.mutate({ product_data_incomplete: !issue.product_data_incomplete })}
            />
            <FlagToggle
              label="Category Corrected"
              active={issue.category_corrected}
              onToggle={() => flagMutation.mutate({ category_corrected: !issue.category_corrected })}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MessageSquare size={18} color="#3B82F6" />
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Notes ({notesQuery.data?.length ?? 0})</Text>
          </View>

          {(notesQuery.data?.length ?? 0) > 0 ? (
            <View style={styles.notesList}>
              {notesQuery.data?.map((note) => (
                <View key={note.id} style={[styles.noteItem, note.is_system && styles.noteSystem]}>
                  <View style={styles.noteHeader}>
                    <Text style={styles.noteAuthor}>{note.author_email || 'System'}</Text>
                    <Text style={styles.noteTime}>{new Date(note.created_at).toLocaleString()}</Text>
                  </View>
                  <Text style={styles.noteContent}>{note.content}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyNotes}>No notes yet</Text>
          )}

          <View style={styles.noteInputRow}>
            <TextInput
              style={styles.noteInput}
              placeholder="Add a note..."
              placeholderTextColor="#64748B"
              value={noteText}
              onChangeText={setNoteText}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, !noteText.trim() && styles.sendBtnDisabled]}
              onPress={() => noteText.trim() && noteMutation.mutate()}
              disabled={!noteText.trim() || noteMutation.isPending}
            >
              {noteMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Send size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Icon size={14} color="#64748B" />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function AiSection({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.aiSection}>
      <Text style={styles.aiSectionLabel}>{label}</Text>
      <Text style={styles.aiSectionValue}>{value}</Text>
    </View>
  );
}

function FlagToggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.flagBtn, active && styles.flagBtnActive]}
      onPress={onToggle}
    >
      {active ? <CheckCircle size={14} color="#10B981" /> : <Flag size={14} color="#64748B" />}
      <Text style={[styles.flagLabel, active && styles.flagLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  topBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#E2E8F0',
    marginBottom: 10,
    flex: 1,
  },
  descText: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  detailLabel: {
    fontSize: 13,
    color: '#94A3B8',
    width: 80,
  },
  detailValue: {
    fontSize: 13,
    color: '#F1F5F9',
    flex: 1,
  },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#8B5CF620',
  },
  aiBtnText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '600' as const,
  },
  aiContent: {
    gap: 10,
  },
  aiSection: {
    gap: 2,
  },
  aiSectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#8B5CF6',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  aiSectionValue: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
  },
  aiPlaceholder: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic' as const,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
  },
  statusBtnText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  flagsRow: {
    gap: 8,
  },
  flagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  flagBtnActive: {
    backgroundColor: '#10B98115',
    borderWidth: 1,
    borderColor: '#10B98140',
  },
  flagLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  flagLabelActive: {
    color: '#10B981',
  },
  notesList: {
    gap: 8,
    marginBottom: 12,
  },
  noteItem: {
    backgroundColor: '#334155',
    borderRadius: 8,
    padding: 10,
  },
  noteSystem: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  noteAuthor: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#94A3B8',
  },
  noteTime: {
    fontSize: 10,
    color: '#64748B',
  },
  noteContent: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
  },
  emptyNotes: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic' as const,
    marginBottom: 12,
  },
  noteInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  noteInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    color: '#F1F5F9',
    fontSize: 14,
    maxHeight: 80,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#334155',
  },
});
