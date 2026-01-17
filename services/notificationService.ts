import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_SETTINGS_KEY = '@safebite_notification_settings';

export interface NotificationSettings {
  enabled: boolean;
  recallAlerts: boolean;
  productUpdates: boolean;
  dailyReminders: boolean;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  static async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      console.log('Notifications not supported on web');
      return false;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return false;
      }

      console.log('Notification permissions granted');
      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  static async getSettings(): Promise<NotificationSettings> {
    try {
      const settingsStr = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (settingsStr) {
        return JSON.parse(settingsStr);
      }
    } catch (error) {
      console.error('Error getting notification settings:', error);
    }

    return {
      enabled: true,
      recallAlerts: true,
      productUpdates: true,
      dailyReminders: false,
    };
  }

  static async saveSettings(settings: NotificationSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
      console.log('Notification settings saved');
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  }

  static async scheduleRecallAlert(productName: string, recallReason: string): Promise<void> {
    if (Platform.OS === 'web') return;

    const settings = await this.getSettings();
    if (!settings.enabled || !settings.recallAlerts) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Product Recall Alert',
          body: `${productName}: ${recallReason}`,
          data: { type: 'recall', productName, recallReason },
          sound: true,
        },
        trigger: null,
      });
      console.log('Recall alert scheduled');
    } catch (error) {
      console.error('Error scheduling recall alert:', error);
    }
  }

  static async scheduleProductUpdate(productName: string, updateMessage: string): Promise<void> {
    if (Platform.OS === 'web') return;

    const settings = await this.getSettings();
    if (!settings.enabled || !settings.productUpdates) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📦 Product Update',
          body: `${productName}: ${updateMessage}`,
          data: { type: 'product_update', productName, updateMessage },
        },
        trigger: null,
      });
      console.log('Product update notification scheduled');
    } catch (error) {
      console.error('Error scheduling product update:', error);
    }
  }

  static async scheduleDailyReminder(): Promise<void> {
    if (Platform.OS === 'web') return;

    const settings = await this.getSettings();
    if (!settings.enabled || !settings.dailyReminders) return;

    try {
      await Notifications.cancelAllScheduledNotificationsAsync();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🛡️ SafeBite Daily Reminder',
          body: 'Check for product recalls and scan your groceries today!',
          data: { type: 'daily_reminder' },
        },
        trigger: {
          hour: 9,
          minute: 0,
          repeats: true,
        } as Notifications.CalendarTriggerInput,
      });
      console.log('Daily reminder scheduled');
    } catch (error) {
      console.error('Error scheduling daily reminder:', error);
    }
  }

  static async cancelAllNotifications(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Error cancelling notifications:', error);
    }
  }

  static async getBadgeCount(): Promise<number> {
    if (Platform.OS === 'web') return 0;

    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  static async setBadgeCount(count: number): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  static async clearBadge(): Promise<void> {
    await this.setBadgeCount(0);
  }
}
