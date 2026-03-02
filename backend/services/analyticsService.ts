import { Database, DBAnalytics } from '@/storage/database';
import { randomUUID } from 'crypto';

export type AnalyticsEventType = 'scan' | 'search' | 'recall_check' | 'profile_create' | 'profile_update' | 'login' | 'signup' | 'favorite_add' | 'favorite_remove' | 'shopping_list_add' | 'shopping_list_remove';

export class AnalyticsService {
  static async trackEvent(
    userId: string,
    eventType: AnalyticsEventType,
    eventData?: Record<string, any>
  ): Promise<void> {
    try {
      const analytics = await Database.getAnalytics();
      
      const event: DBAnalytics = {
        id: randomUUID(),
        userId,
        eventType,
        eventData,
        timestamp: new Date().toISOString(),
      };

      analytics.push(event);
      await Database.saveAnalytics(analytics);
      
      console.log('Analytics event tracked:', eventType);
    } catch (error) {
      console.error('Error tracking analytics event:', error);
    }
  }

  static async getEventsByUser(userId: string, limit?: number): Promise<DBAnalytics[]> {
    const analytics = await Database.getAnalytics();
    const userEvents = analytics
      .filter(a => a.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return limit ? userEvents.slice(0, limit) : userEvents;
  }

  static async getEventsByType(eventType: AnalyticsEventType, limit?: number): Promise<DBAnalytics[]> {
    const analytics = await Database.getAnalytics();
    const typeEvents = analytics
      .filter(a => a.eventType === eventType)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return limit ? typeEvents.slice(0, limit) : typeEvents;
  }

  static async getStats(userId?: string): Promise<{
    totalScans: number;
    totalSearches: number;
    totalRecallChecks: number;
    totalProfiles: number;
    recentActivity: DBAnalytics[];
    topProducts: { productCode: string; count: number }[];
  }> {
    const analytics = await Database.getAnalytics();
    const filtered = userId ? analytics.filter(a => a.userId === userId) : analytics;

    const totalScans = filtered.filter(a => a.eventType === 'scan').length;
    const totalSearches = filtered.filter(a => a.eventType === 'search').length;
    const totalRecallChecks = filtered.filter(a => a.eventType === 'recall_check').length;
    const totalProfiles = filtered.filter(a => a.eventType === 'profile_create').length;

    const recentActivity = filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    const productCounts = new Map<string, number>();
    filtered
      .filter(a => a.eventType === 'scan' && a.eventData?.productCode)
      .forEach(a => {
        const code = a.eventData!.productCode;
        productCounts.set(code, (productCounts.get(code) || 0) + 1);
      });

    const topProducts = Array.from(productCounts.entries())
      .map(([productCode, count]) => ({ productCode, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalScans,
      totalSearches,
      totalRecallChecks,
      totalProfiles,
      recentActivity,
      topProducts,
    };
  }

  static async clearOldEvents(daysToKeep: number = 90): Promise<void> {
    const analytics = await Database.getAnalytics();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const filtered = analytics.filter(a => {
      const eventDate = new Date(a.timestamp);
      return eventDate >= cutoffDate;
    });

    await Database.saveAnalytics(filtered);
    console.log(`Cleared ${analytics.length - filtered.length} old analytics events`);
  }
}
