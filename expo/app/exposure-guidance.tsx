import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform, Alert } from 'react-native';
import { useRouter, Stack, Href } from 'expo-router';
import { AlertCircle, Phone, AlertTriangle, Info, Heart, Stethoscope, Syringe } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function ExposureGuidanceScreen() {
  const router = useRouter();

  const handleEmergencyCall = async () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    
    Alert.alert(
      'Call 911?',
      'This will dial emergency services immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
          style: 'destructive',
          onPress: () => {
            Linking.openURL('tel:911');
          }
        }
      ]
    );
  };

  const handlePoisonControl = () => {
    Alert.alert(
      'Poison Control',
      'National Poison Control Center\n1-800-222-1222\n\nCall this number for guidance on accidental ingestion or exposure.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
          onPress: () => {
            Linking.openURL('tel:18002221222');
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Exposure Guidance' }} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.emergencyBanner}>
          <AlertCircle size={32} color="#FFFFFF" />
          <View style={styles.emergencyContent}>
            <Text style={styles.emergencyTitle}>EMERGENCY?</Text>
            <Text style={styles.emergencySubtitle}>
              If experiencing severe symptoms, call 911 immediately
            </Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.emergencyButton} onPress={handleEmergencyCall}>
            <Phone size={24} color="#FFFFFF" />
            <Text style={styles.emergencyButtonText}>Call 911</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.poisonButton} onPress={handlePoisonControl}>
            <AlertTriangle size={24} color="#FFFFFF" />
            <Text style={styles.poisonButtonText}>Poison Control</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AlertTriangle size={24} color="#DC2626" />
            <Text style={styles.sectionTitle}>Severe Reaction (Anaphylaxis)</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Symptoms:</Text>
            <Text style={styles.symptom}>• Difficulty breathing or wheezing</Text>
            <Text style={styles.symptom}>• Swelling of throat, tongue, or lips</Text>
            <Text style={styles.symptom}>• Rapid pulse or drop in blood pressure</Text>
            <Text style={styles.symptom}>• Dizziness or loss of consciousness</Text>
            <Text style={styles.symptom}>• Severe skin reactions (hives, itching)</Text>
            <Text style={styles.symptom}>• Nausea, vomiting, or diarrhea</Text>
            
            <View style={styles.actionSection}>
              <Text style={styles.actionTitle}>IMMEDIATE ACTIONS:</Text>
              <Text style={styles.action}>1. Use epinephrine auto-injector (EpiPen) immediately</Text>
              <Text style={styles.action}>2. Call 911 - Do not delay</Text>
              <Text style={styles.action}>3. Lie down with legs elevated (if not vomiting)</Text>
              <Text style={styles.action}>4. A second dose may be needed after 5-15 minutes</Text>
              <Text style={styles.action}>5. Go to emergency room even if symptoms improve</Text>
            </View>

            <View style={styles.warningBox}>
              <AlertCircle size={20} color="#DC2626" />
              <Text style={styles.warningText}>
                Do NOT wait to see if symptoms improve. Use epinephrine first, ask questions later.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Info size={24} color="#F59E0B" />
            <Text style={styles.sectionTitle}>Moderate Reaction</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Symptoms:</Text>
            <Text style={styles.symptom}>• Mild hives or skin rash</Text>
            <Text style={styles.symptom}>• Itching or tingling in mouth</Text>
            <Text style={styles.symptom}>• Mild stomach discomfort</Text>
            <Text style={styles.symptom}>• Runny nose or sneezing</Text>
            
            <View style={styles.actionSection}>
              <Text style={styles.actionTitle}>ACTIONS:</Text>
              <Text style={styles.action}>1. Take antihistamine (e.g., Benadryl) as directed</Text>
              <Text style={styles.action}>2. Monitor symptoms closely for 2-4 hours</Text>
              <Text style={styles.action}>3. Have epinephrine ready if symptoms worsen</Text>
              <Text style={styles.action}>4. Contact your doctor or allergist</Text>
              <Text style={styles.action}>5. Document the exposure and reaction</Text>
            </View>

            <View style={styles.infoBox}>
              <Info size={20} color="#F59E0B" />
              <Text style={styles.infoText}>
                Watch for progression to severe symptoms. If symptoms worsen, use epinephrine and call 911.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Heart size={24} color="#10B981" />
            <Text style={styles.sectionTitle}>Mild Reaction</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Symptoms:</Text>
            <Text style={styles.symptom}>• Minor skin irritation</Text>
            <Text style={styles.symptom}>• Slight itching</Text>
            <Text style={styles.symptom}>• Mild discomfort</Text>
            
            <View style={styles.actionSection}>
              <Text style={styles.actionTitle}>ACTIONS:</Text>
              <Text style={styles.action}>1. Wash exposed area thoroughly with soap and water</Text>
              <Text style={styles.action}>2. Take antihistamine if needed</Text>
              <Text style={styles.action}>3. Monitor for any progression of symptoms</Text>
              <Text style={styles.action}>4. Note the product and allergen for future reference</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Stethoscope size={24} color="#0891B2" />
            <Text style={styles.sectionTitle}>By Type of Exposure</Text>
          </View>
          
          <View style={styles.card}>
            <Text style={styles.exposureType}>INGESTION (Swallowed)</Text>
            <Text style={styles.exposureText}>
              Most dangerous route. Highest risk of anaphylaxis. Monitor very closely for systemic symptoms.
            </Text>
            <Text style={styles.exposureAction}>
              • DO NOT induce vomiting unless told by medical professional{'\n'}
              • Have epinephrine ready{'\n'}
              • Call Poison Control: 1-800-222-1222
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.exposureType}>SKIN CONTACT</Text>
            <Text style={styles.exposureText}>
              Lower risk but can still cause reactions, especially with broken skin or prolonged contact.
            </Text>
            <Text style={styles.exposureAction}>
              • Immediately wash area with soap and water{'\n'}
              • Remove contaminated clothing{'\n'}
              • Apply cold compress if swelling occurs{'\n'}
              • Monitor for spreading or systemic symptoms
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.exposureType}>INHALATION (Breathed In)</Text>
            <Text style={styles.exposureText}>
              Can occur with airborne particles from cooking or processing. Can trigger respiratory symptoms.
            </Text>
            <Text style={styles.exposureAction}>
              • Move to fresh air immediately{'\n'}
              • Remove from source of allergen{'\n'}
              • Monitor breathing closely{'\n'}
              • Use rescue inhaler if prescribed{'\n'}
              • Be ready to use epinephrine if breathing difficulty worsens
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.exposureType}>CROSS-CONTAMINATION</Text>
            <Text style={styles.exposureText}>
              Trace amounts from shared surfaces, utensils, or processing equipment.
            </Text>
            <Text style={styles.exposureAction}>
              • Stop eating immediately if uncertain{'\n'}
              • Monitor for any symptoms{'\n'}
              • Have epinephrine accessible{'\n'}
              • Response depends on your sensitivity level
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Important Reminders</Text>
          <View style={styles.reminderCard}>
            <Text style={styles.reminderText}>
              ✓ Always carry two epinephrine auto-injectors{'\n'}
              ✓ Check expiration dates regularly{'\n'}
              ✓ Wear medical alert bracelet or necklace{'\n'}
              ✓ Tell others about your allergies{'\n'}
              ✓ Have an allergy action plan from your doctor{'\n'}
              ✓ After using epinephrine, always go to ER{'\n'}
              ✓ Biphasic reactions can occur 4-12 hours later
            </Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.epipenDemoButton}
            onPress={() => router.push('/epipen-demo' as Href)}
          >
            <Syringe size={24} color="#FFFFFF" />
            <View style={styles.buttonContent}>
              <Text style={styles.buttonTitle}>How to Use EpiPen</Text>
              <Text style={styles.buttonSubtitle}>Step-by-step demonstration</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.emergencyCardButton}
            onPress={() => router.push('/emergency-card' as Href)}
          >
            <Text style={styles.emergencyCardButtonText}>View My Emergency Card</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.disclaimer}>
          <AlertCircle size={16} color="#9CA3AF" />
          <Text style={styles.disclaimerText}>
            This guidance is for informational purposes only and does not replace medical advice. 
            Always follow your doctor&apos;s specific instructions and your personal allergy action plan. 
            When in doubt, err on the side of caution and seek immediate medical attention.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emergencyBanner: {
    flexDirection: 'row',
    backgroundColor: '#DC2626',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    gap: 16,
  },
  emergencyContent: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  emergencySubtitle: {
    fontSize: 14,
    color: '#FEE2E2',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  emergencyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emergencyButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  poisonButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  poisonButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 12,
  },
  symptom: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 6,
    lineHeight: 20,
  },
  actionSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#DC2626',
    marginBottom: 12,
  },
  action: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 8,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  exposureType: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0891B2',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
  },
  exposureText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
    lineHeight: 20,
  },
  exposureAction: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 22,
  },
  reminderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reminderText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 24,
  },
  actionButtons: {
    gap: 12,
    marginBottom: 16,
  },
  epipenDemoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#DC2626',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonContent: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  buttonSubtitle: {
    fontSize: 14,
    color: '#FEE2E2',
  },
  emergencyCardButton: {
    backgroundColor: '#0891B2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emergencyCardButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  disclaimer: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: 24,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
});
