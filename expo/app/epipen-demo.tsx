import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { AlertCircle, CheckCircle, ChevronRight, Play, AlertTriangle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const EPIPEN_STEPS = [
  {
    number: 1,
    title: 'Recognize Symptoms',
    description: 'Signs of anaphylaxis include difficulty breathing, swelling of throat/tongue, rapid pulse, dizziness, or severe skin reactions.',
    warning: 'DO NOT DELAY - Time is critical. Use EpiPen first, ask questions later.',
    color: '#DC2626',
  },
  {
    number: 2,
    title: 'Call 911 Immediately',
    description: 'Before or while administering epinephrine, call emergency services. Tell them you are treating anaphylaxis with epinephrine.',
    warning: 'Even if symptoms improve after using EpiPen, you MUST go to the emergency room.',
    color: '#DC2626',
  },
  {
    number: 3,
    title: 'Remove EpiPen from Carrier',
    description: 'Take the EpiPen auto-injector out of its protective carrier tube. Do not put your thumb, fingers, or hand over either end.',
    warning: 'Never put your thumb over the orange tip - that is where the needle comes out.',
    color: '#F59E0B',
  },
  {
    number: 4,
    title: 'Form a Fist Around EpiPen',
    description: 'Hold the EpiPen in your dominant hand with the orange tip pointing downward. Make a fist around the middle of the device.',
    warning: 'Orange tip DOWN, blue safety cap UP.',
    color: '#0891B2',
  },
  {
    number: 5,
    title: 'Remove Blue Safety Cap',
    description: 'With your other hand, pull off the blue safety release straight up. Do not bend or twist it. You will hear a click.',
    warning: 'Once the blue cap is removed, the EpiPen is armed and ready to inject.',
    color: '#F59E0B',
  },
  {
    number: 6,
    title: 'Position Against Outer Thigh',
    description: 'Place the orange tip against the outer thigh (you can inject through clothing if needed). Hold it at a 90-degree angle.',
    warning: 'Inject into the outer thigh only - never into buttocks, veins, hands, or feet.',
    color: '#0891B2',
  },
  {
    number: 7,
    title: 'Push Down Hard and Hold',
    description: 'Push the EpiPen firmly straight down until you hear a click. This activates the needle. Hold it in place for 3 seconds (count: 1-one-thousand, 2-one-thousand, 3-one-thousand).',
    warning: 'You must hold for the full 3 seconds for the dose to be delivered.',
    color: '#DC2626',
  },
  {
    number: 8,
    title: 'Remove and Massage',
    description: 'After 3 seconds, remove the EpiPen from the thigh. The orange tip will extend to cover the needle. Massage the injection area for 10 seconds.',
    warning: 'Do not rub too hard - gentle massage helps distribute the medication.',
    color: '#10B981',
  },
  {
    number: 9,
    title: 'Note Time and Monitor',
    description: 'Note the time of injection. Monitor the person closely. Lie them down with legs elevated (unless vomiting). Keep them warm.',
    warning: 'If symptoms persist after 5-15 minutes, use a second EpiPen if available.',
    color: '#F59E0B',
  },
  {
    number: 10,
    title: 'Go to Emergency Room',
    description: 'Always go to the ER after using EpiPen, even if symptoms improve. Bring the used EpiPen with you to show medical staff.',
    warning: 'Biphasic reactions can occur 4-12 hours later. Hospital monitoring is essential.',
    color: '#DC2626',
  },
];

export default function EpiPenDemoScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const handleStepComplete = (stepNumber: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    const newCompleted = new Set(completedSteps);
    newCompleted.add(stepNumber);
    setCompletedSteps(newCompleted);
    
    if (stepNumber < EPIPEN_STEPS.length) {
      setCurrentStep(stepNumber);
    }
  };

  const resetDemo = () => {
    setCurrentStep(0);
    setCompletedSteps(new Set());
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: 'EpiPen Administration',
        headerStyle: { backgroundColor: '#DC2626' },
        headerTintColor: '#FFFFFF',
      }} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.emergencyBanner}>
          <AlertCircle size={32} color="#FFFFFF" />
          <View style={styles.emergencyContent}>
            <Text style={styles.emergencyTitle}>LIFE-SAVING DEMONSTRATION</Text>
            <Text style={styles.emergencySubtitle}>
              Learn proper EpiPen technique. In an emergency, every second counts.
            </Text>
          </View>
        </View>

        <View style={styles.importantCard}>
          <AlertTriangle size={24} color="#DC2626" />
          <View style={styles.importantContent}>
            <Text style={styles.importantTitle}>Practice Makes Prepared</Text>
            <Text style={styles.importantText}>
              Use this guide to practice with a trainer device. Most EpiPen manufacturers provide free trainers. Ask your pharmacist or allergist.
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Progress: {completedSteps.size} of {EPIPEN_STEPS.length} steps completed
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${(completedSteps.size / EPIPEN_STEPS.length) * 100}%` }
              ]} 
            />
          </View>
        </View>

        {EPIPEN_STEPS.map((step, index) => {
          const isCompleted = completedSteps.has(step.number);
          const isCurrent = currentStep === index;
          
          return (
            <TouchableOpacity
              key={step.number}
              style={[
                styles.stepCard,
                isCurrent && styles.stepCardActive,
                isCompleted && styles.stepCardCompleted,
                { borderLeftColor: step.color, borderLeftWidth: 4 }
              ]}
              onPress={() => setCurrentStep(index)}
            >
              <View style={styles.stepHeader}>
                <View style={[styles.stepNumber, { backgroundColor: step.color }]}>
                  {isCompleted ? (
                    <CheckCircle size={24} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.stepNumberText}>{step.number}</Text>
                  )}
                </View>
                <View style={styles.stepTitleContainer}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  {isCurrent && (
                    <View style={styles.currentBadge}>
                      <Play size={12} color="#FFFFFF" />
                      <Text style={styles.currentBadgeText}>Current</Text>
                    </View>
                  )}
                </View>
              </View>

              {(isCurrent || isCompleted) && (
                <View style={styles.stepContent}>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                  
                  <View style={styles.warningBox}>
                    <AlertCircle size={16} color="#DC2626" />
                    <Text style={styles.warningText}>{step.warning}</Text>
                  </View>

                  {!isCompleted && (
                    <TouchableOpacity
                      style={[styles.completeButton, { backgroundColor: step.color }]}
                      onPress={() => handleStepComplete(step.number)}
                    >
                      <CheckCircle size={20} color="#FFFFFF" />
                      <Text style={styles.completeButtonText}>Mark as Reviewed</Text>
                      <ChevronRight size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}

                  {isCompleted && (
                    <View style={styles.completedBanner}>
                      <CheckCircle size={20} color="#10B981" />
                      <Text style={styles.completedText}>Step reviewed</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {completedSteps.size === EPIPEN_STEPS.length && (
          <View style={styles.completionCard}>
            <CheckCircle size={48} color="#10B981" />
            <Text style={styles.completionTitle}>Demonstration Complete!</Text>
            <Text style={styles.completionText}>
              You have reviewed all steps. Practice regularly and always carry two EpiPens.
            </Text>
            <TouchableOpacity style={styles.resetButton} onPress={resetDemo}>
              <Text style={styles.resetButtonText}>Review Again</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>Additional Tips</Text>
          
          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>✓ Always Carry Two EpiPens</Text>
            <Text style={styles.tipText}>
              One may not be enough. 20-30% of severe reactions require a second dose.
            </Text>
          </View>

          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>✓ Check Expiration Dates</Text>
            <Text style={styles.tipText}>
              Check your EpiPen monthly. Set a calendar reminder. Expired epinephrine is less effective.
            </Text>
          </View>

          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>✓ Teach Others</Text>
            <Text style={styles.tipText}>
              Show family, friends, teachers, and coworkers how to use your EpiPen. In an emergency, you may not be able to do it yourself.
            </Text>
          </View>

          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>✓ Get a Trainer Device</Text>
            <Text style={styles.tipText}>
              Practice with a trainer pen that has no needle or medication. Ask your pharmacist for a free trainer.
            </Text>
          </View>

          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>✓ Keep EpiPen Accessible</Text>
            <Text style={styles.tipText}>
              Don&apos;t store in hot cars or refrigerators. Keep at room temperature in its carrier tube. Never leave home without it.
            </Text>
          </View>

          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>✓ Medical Alert Identification</Text>
            <Text style={styles.tipText}>
              Wear a medical alert bracelet or necklace stating your allergies and that you carry epinephrine.
            </Text>
          </View>
        </View>

        <View style={styles.emergencyCard}>
          <AlertCircle size={24} color="#DC2626" />
          <Text style={styles.emergencyCardTitle}>In Case of Emergency</Text>
          <Text style={styles.emergencyCardText}>
            1. Inject epinephrine immediately{'\n'}
            2. Call 911{'\n'}
            3. Lie down with legs elevated{'\n'}
            4. Use second EpiPen if needed after 5-15 minutes{'\n'}
            5. Go to emergency room even if symptoms improve
          </Text>
        </View>

        <View style={styles.disclaimer}>
          <AlertCircle size={16} color="#9CA3AF" />
          <Text style={styles.disclaimerText}>
            This demonstration is for educational purposes only and does not replace medical training or advice from your healthcare provider. Always follow your doctor&apos;s specific instructions and your personal allergy action plan. Consider taking a first aid or allergy emergency course for hands-on training.
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
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  emergencySubtitle: {
    fontSize: 14,
    color: '#FEE2E2',
    lineHeight: 20,
  },
  importantCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  importantContent: {
    flex: 1,
  },
  importantTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#92400E',
    marginBottom: 8,
  },
  importantText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  stepCardActive: {
    borderColor: '#0891B2',
    borderWidth: 2,
    shadowOpacity: 0.1,
  },
  stepCardCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepNumber: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  stepTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0891B2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  stepContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  stepDescription: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 16,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#991B1B',
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 16,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  completedText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#047857',
  },
  completionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
    marginTop: 16,
    marginBottom: 12,
  },
  completionText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  resetButton: {
    backgroundColor: '#0891B2',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  tipsSection: {
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 16,
  },
  tipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  emergencyCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  emergencyCardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#991B1B',
    marginTop: 12,
    marginBottom: 12,
  },
  emergencyCardText: {
    fontSize: 14,
    color: '#7F1D1D',
    lineHeight: 24,
    fontWeight: '500' as const,
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
