import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, Heart, Users, Shield, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TourSlide {
  id: number;
  icon: any;
  iconColor: string;
  title: string;
  description: string;
  backgroundColor: string;
}

const slides: TourSlide[] = [
  {
    id: 1,
    icon: Camera,
    iconColor: '#0891B2',
    title: 'Scan Any Product',
    description: 'Simply scan a barcode or take a photo of any product. Get instant allergen detection with 99.8% accuracy.',
    backgroundColor: '#F0FDFA',
  },
  {
    id: 2,
    icon: Shield,
    iconColor: '#10B981',
    title: 'Stay Safe',
    description: 'Our advanced AI checks 500+ allergen variations. Get clear safety verdicts: Safe, Caution, or Danger.',
    backgroundColor: '#D1FAE5',
  },
  {
    id: 3,
    icon: Users,
    iconColor: '#8B5CF6',
    title: 'Manage Family Profiles',
    description: 'Create profiles for each family member with their unique allergies. Switch between profiles instantly.',
    backgroundColor: '#F3E8FF',
  },
  {
    id: 4,
    icon: Heart,
    iconColor: '#DC2626',
    title: 'Track & Organize',
    description: 'Save favorites, build shopping lists, and review your scan history. Everything synced and secure.',
    backgroundColor: '#FEE2E2',
  },
];

export default function WelcomeTourScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      await markTourComplete();
      router.replace('/wizard');
    }
  };

  const handleSkip = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await markTourComplete();
    router.replace('/wizard');
  };

  const markTourComplete = async () => {
    try {
      await AsyncStorage.setItem('@welcome_tour_complete', 'true');
    } catch (error) {
      console.error('Error marking tour complete:', error);
    }
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <View style={[styles.container, { backgroundColor: slide.backgroundColor }]}>
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: '#FFFFFF' }]}>
          <Icon size={80} color={slide.iconColor} />
        </View>

        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.description}>{slide.description}</Text>

        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                {
                  backgroundColor: index === currentSlide ? slide.iconColor : '#D1D5DB',
                  width: index === currentSlide ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: slide.iconColor }]}
          onPress={handleNext}
        >
          {currentSlide === slides.length - 1 ? (
            <>
              <CheckCircle size={24} color="#FFFFFF" />
              <Text style={styles.nextButtonText}>Get Started</Text>
            </>
          ) : (
            <Text style={styles.nextButtonText}>Next</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  skipButton: {
    position: 'absolute' as const,
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 10,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 48,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
    transition: 'all 0.3s',
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
