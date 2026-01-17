import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { User, Users } from 'lucide-react-native';
import { useFamily } from '@/contexts/FamilyContext';
import { useProfiles } from '@/contexts/ProfileContext';
import * as Haptics from 'expo-haptics';

export function ViewModeToggle() {
  const { viewMode, setViewMode, activeFamilyGroup } = useFamily();
  const { profiles } = useProfiles();

  if (!activeFamilyGroup || activeFamilyGroup.memberIds.length === 0) {
    return null;
  }

  const familyMemberCount = profiles.filter(p => activeFamilyGroup.memberIds.includes(p.id)).length;

  if (familyMemberCount <= 1) {
    return null;
  }

  const handleToggle = async (mode: 'individual' | 'family') => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await setViewMode(mode);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, viewMode === 'individual' && styles.activeButton]}
        onPress={() => handleToggle('individual')}
      >
        <User size={18} color={viewMode === 'individual' ? '#FFFFFF' : '#6B7280'} />
        <Text style={[styles.buttonText, viewMode === 'individual' && styles.activeButtonText]}>
          Individual
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, viewMode === 'family' && styles.activeButton]}
        onPress={() => handleToggle('family')}
      >
        <Users size={18} color={viewMode === 'family' ? '#FFFFFF' : '#6B7280'} />
        <Text style={[styles.buttonText, viewMode === 'family' && styles.activeButtonText]}>
          Family ({familyMemberCount})
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  activeButton: {
    backgroundColor: '#0891B2',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  activeButtonText: {
    color: '#FFFFFF',
  },
});
