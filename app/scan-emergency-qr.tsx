import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { AlertCircle, Phone, Pill, X, Camera, Flashlight, FlashlightOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { EmergencyContact } from '@/types';

interface EmergencyCardData {
  type: string;
  version: string;
  name: string;
  allergens: string[];
  hasAnaphylaxis: boolean;
  medications: string[];
  emergencyContacts: EmergencyContact[];
  dateOfBirth?: string;
  relationship?: string;
  generatedAt: string;
}

export default function ScanEmergencyQRScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState<EmergencyCardData | null>(null);
  const [error, setError] = useState<string>('');
  const [torchEnabled, setTorchEnabled] = useState(false);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    try {
      console.log('QR Code scanned:', data);
      const parsed = JSON.parse(data);
      
      if (parsed.type === 'EMERGENCY_ALLERGY_CARD') {
        setScannedData(parsed);
        setError('');
      } else {
        setError('This is not a valid emergency allergy card QR code');
      }
    } catch (err) {
      console.error('Error parsing QR code:', err);
      setError('Invalid QR code format');
    }
  };

  const handleClose = () => {
    router.back();
  };

  const handleCallContact = (phone: string) => {
    if (Platform.OS === 'web') {
      window.open(`tel:${phone}`, '_self');
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Linking = require('react-native').Linking;
      Linking.openURL(`tel:${phone}`);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.messageText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Scan Emergency QR' }} />
        <Camera size={64} color="#9CA3AF" />
        <Text style={styles.messageText}>Camera permission required</Text>
        <Text style={styles.subText}>We need camera access to scan emergency QR codes</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (scannedData) {
    return (
      <>
        <Stack.Screen 
          options={{ 
            title: 'Emergency Card',
            headerRight: () => (
              <TouchableOpacity onPress={handleClose} style={{ marginRight: 16 }}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            ),
          }} 
        />
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <View style={styles.emergencyHeader}>
            <AlertCircle size={48} color="#DC2626" />
            <Text style={styles.emergencyTitle}>EMERGENCY CARD</Text>
            <Text style={styles.scannedLabel}>Scanned from QR Code</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>ALLERGY ALERT</Text>
            <Text style={styles.profileName}>{scannedData.name}</Text>
            
            {scannedData.relationship && (
              <Text style={styles.relationshipText}>Relationship: {scannedData.relationship}</Text>
            )}
            
            {scannedData.dateOfBirth && (
              <Text style={styles.dobText}>DOB: {new Date(scannedData.dateOfBirth).toLocaleDateString()}</Text>
            )}
            
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ALLERGIC TO:</Text>
              <View style={styles.allergenList}>
                {scannedData.allergens.map((allergen, index) => (
                  <View key={index} style={styles.allergenBadge}>
                    <Text style={styles.allergenText}>{allergen}</Text>
                  </View>
                ))}
              </View>
            </View>

            {scannedData.hasAnaphylaxis && (
              <View style={styles.warningBox}>
                <AlertCircle size={24} color="#DC2626" />
                <Text style={styles.warningText}>RISK OF ANAPHYLAXIS</Text>
              </View>
            )}
          </View>

          {scannedData.medications.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Pill size={24} color="#0891B2" />
                <Text style={styles.cardTitle}>MEDICATIONS</Text>
              </View>
              {scannedData.medications.map((med, index) => (
                <View key={index} style={styles.medicationItem}>
                  <Text style={styles.medicationText}>{med}</Text>
                </View>
              ))}
            </View>
          )}

          {scannedData.emergencyContacts.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Phone size={24} color="#0891B2" />
                <Text style={styles.cardTitle}>EMERGENCY CONTACTS</Text>
              </View>
              {scannedData.emergencyContacts.map((contact, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.contactItem}
                  onPress={() => handleCallContact(contact.phone)}
                >
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactRelationship}>{contact.relationship}</Text>
                  <Text style={styles.contactPhone}>{contact.phone}</Text>
                  <Text style={styles.tapToCall}>Tap to call</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>IN CASE OF SEVERE REACTION:</Text>
            <View style={styles.instructionsList}>
              <Text style={styles.instructionItem}>1. Administer epinephrine if prescribed</Text>
              <Text style={styles.instructionItem}>2. Call 911 immediately</Text>
              <Text style={styles.instructionItem}>3. Contact emergency contacts above</Text>
              <Text style={styles.instructionItem}>4. Keep person lying down (unless vomiting)</Text>
              <Text style={styles.instructionItem}>5. Second dose may be needed after 5-15 minutes</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.scanAgainButton}
            onPress={() => setScannedData(null)}
          >
            <Camera size={24} color="#FFFFFF" />
            <Text style={styles.scanAgainButtonText}>Scan Another QR Code</Text>
          </TouchableOpacity>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Scan Emergency QR',
          headerRight: () => (
            <TouchableOpacity onPress={handleClose} style={{ marginRight: 16 }}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          ),
        }} 
      />
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          enableTorch={torchEnabled}
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.instructionText}>
              Position the QR code within the frame
            </Text>
            {error ? (
              <View style={styles.errorBox}>
                <AlertCircle size={20} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>
        </CameraView>

        <TouchableOpacity
          style={styles.flashButton}
          onPress={async () => {
            if (Platform.OS !== 'web') {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            setTorchEnabled(!torchEnabled);
          }}
          testID="qr-flash-button"
          activeOpacity={0.7}
        >
          {torchEnabled ? (
            <Flashlight size={24} color="#FBBF24" />
          ) : (
            <FlashlightOff size={24} color="#FFFFFF" />
          )}
          <Text style={[styles.flashButtonText, torchEnabled && styles.flashButtonTextActive]}>
            {torchEnabled ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    padding: 16,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scanArea: {
    width: 280,
    height: 280,
    position: 'relative' as const,
  },
  corner: {
    position: 'absolute' as const,
    width: 40,
    height: 40,
    borderColor: '#FFFFFF',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 24,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  messageText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
    marginTop: 16,
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  permissionButton: {
    backgroundColor: '#0891B2',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  emergencyHeader: {
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 3,
    borderColor: '#DC2626',
  },
  emergencyTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#DC2626',
    marginTop: 12,
    letterSpacing: 2,
  },
  scannedLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#DC2626',
    marginTop: 8,
    opacity: 0.8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    letterSpacing: 1,
  },
  profileName: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 12,
  },
  relationshipText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },
  dobText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#6B7280',
    marginBottom: 12,
    letterSpacing: 1,
  },
  allergenList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allergenBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  allergenText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#DC2626',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  warningText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#DC2626',
    letterSpacing: 1,
  },
  medicationItem: {
    backgroundColor: '#F0FDFA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#0891B2',
  },
  medicationText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  contactItem: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 4,
  },
  contactRelationship: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#0891B2',
    marginBottom: 4,
  },
  tapToCall: {
    fontSize: 12,
    color: '#0891B2',
    fontWeight: '600' as const,
    fontStyle: 'italic' as const,
  },
  instructionsCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#92400E',
    marginBottom: 16,
    letterSpacing: 1,
  },
  instructionsList: {
    gap: 12,
  },
  instructionItem: {
    fontSize: 16,
    color: '#92400E',
    lineHeight: 24,
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#0891B2',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    marginBottom: 32,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  scanAgainButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  flashButton: {
    position: 'absolute' as const,
    bottom: 40,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  flashButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  flashButtonTextActive: {
    color: '#FBBF24',
  },
});
