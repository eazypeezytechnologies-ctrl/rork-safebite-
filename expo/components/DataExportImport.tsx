import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { useState } from 'react';
import { useDataExport } from '@/hooks/useLiveData';
import { Download, Upload, Share2, FileText } from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

const getCacheDirectory = () => {
  if (Platform.OS === 'web') return null;
  return (FileSystem as any).cacheDirectory as string | null;
};

const colors = {
  primary: '#007AFF',
  success: '#34C759',
  danger: '#FF3B30',
  background: '#F2F2F7',
  surface: '#FFFFFF',
  text: '#000000',
  textSecondary: '#8E8E93',
  border: '#E5E5EA',
};

export function DataExportImport() {
  const { exportData, importData, isExporting, isImporting } = useDataExport();
  const [lastExportTime, setLastExportTime] = useState<Date | null>(null);

  const handleExport = async () => {
    try {
      const data = await exportData();
      if (!data) {
        Alert.alert('Error', 'No data to export');
        return;
      }

      const fileName = `safebite-backup-${new Date().toISOString().split('T')[0]}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const cacheDir = getCacheDirectory();
        if (!cacheDir) {
          Alert.alert('Error', 'File system not available');
          return;
        }
        const fileUri = cacheDir + fileName;
        await FileSystem.writeAsStringAsync(fileUri, data);

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Export SafeBite Data',
          });
        } else {
          Alert.alert('Success', `Data exported to ${fileUri}`);
        }
      }

      setLastExportTime(new Date());
      Alert.alert('Success', 'Data exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const handleImport = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = async (e: any) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              try {
                const jsonData = event.target?.result as string;
                await importData({ jsonData });
                Alert.alert('Success', 'Data imported successfully!');
              } catch (error) {
                console.error('Import error:', error);
                Alert.alert('Error', 'Failed to import data. Please check the file format.');
              }
            };
            reader.readAsText(file);
          }
        };
        input.click();
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true,
        });

        if (result.canceled) {
          return;
        }

        const fileUri = result.assets[0].uri;
        const jsonData = await FileSystem.readAsStringAsync(fileUri);
        await importData({ jsonData });
        Alert.alert('Success', 'Data imported successfully!');
      }
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Error', 'Failed to import data. Please check the file format.');
    }
  };

  const confirmImport = () => {
    Alert.alert(
      'Import Data',
      'This will replace all existing data. Are you sure you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', style: 'destructive', onPress: handleImport },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <FileText size={32} color={colors.primary} />
        <Text style={styles.title}>Data Management</Text>
        <Text style={styles.subtitle}>
          Export your data for backup or import from a previous backup
        </Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.button, styles.exportButton]}
          onPress={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Download size={24} color="#FFFFFF" />
              <Text style={styles.buttonText}>Export Data</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.importButton]}
          onPress={confirmImport}
          disabled={isImporting}
        >
          {isImporting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Upload size={24} color="#FFFFFF" />
              <Text style={styles.buttonText}>Import Data</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {lastExportTime && (
        <View style={styles.infoCard}>
          <Share2 size={20} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            Last export: {lastExportTime.toLocaleString()}
          </Text>
        </View>
      )}

      <View style={styles.warningCard}>
        <Text style={styles.warningTitle}>⚠️ Important</Text>
        <Text style={styles.warningText}>
          • Export your data regularly to prevent data loss{'\n'}
          • Importing will replace all existing data{'\n'}
          • Keep your backup files secure{'\n'}
          • Backup files contain sensitive information
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  section: {
    gap: 16,
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    gap: 12,
  },
  exportButton: {
    backgroundColor: colors.primary,
  },
  importButton: {
    backgroundColor: colors.success,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  warningCard: {
    padding: 20,
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#856404',
    marginBottom: 12,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 22,
  },
});
