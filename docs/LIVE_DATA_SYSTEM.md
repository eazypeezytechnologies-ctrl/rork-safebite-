# SafeBite Live Data System

## Overview

SafeBite now features a comprehensive live data solution that provides real-time synchronization, analytics tracking, notifications, and data management capabilities. This system ensures users always have access to the latest product information, recall alerts, and usage insights.

## Architecture

### 1. Database Layer (`backend/db/schema.ts`)

The database layer provides a structured storage system using AsyncStorage with the following entities:

- **DBUser**: User accounts with authentication and settings
- **DBProfile**: Allergy profiles with emergency contacts
- **DBProduct**: Cached product information with scan counts
- **DBScanHistory**: Historical scan records with verdicts
- **DBFavorite**: User's favorite products
- **DBShoppingListItem**: Shopping list items
- **DBAnalytics**: Event tracking and usage analytics
- **DBRecallCache**: Cached recall information

### 2. Service Layer

#### Product Service (`backend/services/productService.ts`)
- Fetches products from OpenFoodFacts, OpenBeautyFacts, and OpenProductsFacts
- Implements intelligent caching with 7-day expiry
- Tracks scan counts for popularity metrics
- Provides search functionality

#### Recall Service (`backend/services/recallService.ts`)
- Integrates with FDA recall API
- Caches recall data for 24 hours
- Supports search by product name and barcode
- Automatic cache cleanup

#### Analytics Service (`backend/services/analyticsService.ts`)
- Tracks user events (scans, searches, profile changes)
- Generates usage statistics
- Identifies top products and recent activity
- Automatic cleanup of old events (90-day retention)

### 3. tRPC API Routes

All backend functionality is exposed through type-safe tRPC routes:

#### Products
- `products.getByBarcode` - Fetch product by barcode
- `products.search` - Search products by name
- `products.popular` - Get most scanned products
- `products.recent` - Get recently scanned products

#### Recalls
- `recalls.search` - Search recalls by query
- `recalls.searchByBarcode` - Search recalls by barcode

#### Analytics
- `analytics.track` - Track user events
- `analytics.stats` - Get usage statistics

#### Profiles
- `profiles.list` - List user profiles
- `profiles.create` - Create new profile
- `profiles.update` - Update existing profile
- `profiles.delete` - Delete profile

#### Data Management
- `data.export` - Export all user data
- `data.import` - Import data from backup

### 4. React Query Integration

#### Custom Hooks (`hooks/useLiveData.ts`)

**useLiveProducts()**
- Fetches popular and recent products
- Auto-refreshes every 10 minutes
- 5-minute stale time

**useLiveProduct(barcode, forceRefresh)**
- Fetches single product by barcode
- 7-day cache duration
- Optional force refresh

**useProductSearch(query, page)**
- Real-time product search
- Enabled when query > 2 characters
- 5-minute cache

**useLiveRecalls(query)**
- Search recalls by query
- 24-hour cache duration

**useLiveRecallsByBarcode(barcode)**
- Fetch recalls for specific product
- 24-hour cache duration

**useLiveProfiles()**
- List, create, update, delete profiles
- Optimistic updates for instant UI feedback
- Automatic rollback on errors
- 1-minute stale time

**useLiveAnalytics(userId)**
- Fetch usage statistics
- Track events
- Auto-refresh every 10 minutes

**useDataExport()**
- Export user data to JSON
- Import data from backup file

### 5. Live Data Context (`contexts/LiveDataContext.tsx`)

Global context providing:
- Online/offline status detection
- Automatic data synchronization
- Last sync timestamp
- Event tracking wrapper
- Popular and recent products
- Analytics statistics

## Features

### Real-Time Synchronization

The system automatically syncs data when:
- App comes online after being offline
- User manually triggers sync
- Auto-sync is enabled (default)

```typescript
const { syncData, isOnline, lastSyncTime } = useLiveData();

// Manual sync
await syncData();

// Check online status
if (isOnline) {
  // Perform online-only operations
}
```

### Optimistic Updates

Profile operations use optimistic updates for instant UI feedback:

```typescript
const { profiles, create, update, delete: deleteProfile } = useLiveProfiles();

// Create profile - UI updates immediately
await create({
  userId: currentUser.id,
  name: "John Doe",
  allergens: ["peanuts", "shellfish"],
  // ...
});

// If error occurs, UI automatically rolls back
```

### Analytics Tracking

Track user events throughout the app:

```typescript
const { analytics } = useLiveData();

// Track scan event
await analytics.track('scan', {
  productCode: '123456789',
  verdict: 'safe',
});

// Track search
await analytics.track('search', {
  query: 'gluten free bread',
});

// View statistics
const stats = analytics.stats;
console.log(`Total scans: ${stats.totalScans}`);
```

### Notification System (`services/notificationService.ts`)

Push notifications for important events:

```typescript
import { NotificationService } from '@/services/notificationService';

// Request permissions
const granted = await NotificationService.requestPermissions();

// Schedule recall alert
await NotificationService.scheduleRecallAlert(
  'Product Name',
  'Recall reason'
);

// Schedule daily reminder
await NotificationService.scheduleDailyReminder();

// Manage settings
const settings = await NotificationService.getSettings();
await NotificationService.saveSettings({
  ...settings,
  recallAlerts: true,
  dailyReminders: false,
});
```

### Data Export/Import

Backup and restore user data:

```typescript
import { useDataExport } from '@/hooks/useLiveData';

const { exportData, importData, isExporting, isImporting } = useDataExport();

// Export data
const jsonData = await exportData();
// Save to file or share

// Import data
await importData({ jsonData });
```

## Components

### AnalyticsDashboard

Displays comprehensive usage statistics:
- Total scans, searches, recall checks
- Profile count
- Top scanned products
- Recent activity timeline

```typescript
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';

<AnalyticsDashboard />
```

### DataExportImport

UI for data backup and restore:
- Export to JSON file
- Import from backup
- Share functionality
- Warning messages

```typescript
import { DataExportImport } from '@/components/DataExportImport';

<DataExportImport />
```

## Usage Examples

### Scanning a Product

```typescript
import { useLiveProduct } from '@/hooks/useLiveData';
import { useLiveData } from '@/contexts/LiveDataContext';

function ScanScreen() {
  const [barcode, setBarcode] = useState('');
  const { data: product, isLoading } = useLiveProduct(barcode);
  const { analytics } = useLiveData();

  const handleScan = async (code: string) => {
    setBarcode(code);
    
    // Track scan event
    await analytics.track('scan', {
      productCode: code,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    // UI implementation
  );
}
```

### Checking Recalls

```typescript
import { useLiveRecallsByBarcode } from '@/hooks/useLiveData';
import { NotificationService } from '@/services/notificationService';

function RecallCheck({ productCode, productName }: Props) {
  const { data: recalls, isLoading } = useLiveRecallsByBarcode(productCode);

  useEffect(() => {
    if (recalls && recalls.length > 0) {
      // Notify user of recall
      NotificationService.scheduleRecallAlert(
        productName,
        recalls[0].reason_for_recall
      );
    }
  }, [recalls, productName]);

  return (
    // UI implementation
  );
}
```

### Managing Profiles

```typescript
import { useLiveProfiles } from '@/hooks/useLiveData';

function ProfileManager() {
  const { profiles, create, update, delete: deleteProfile, isLoading } = useLiveProfiles();

  const handleCreateProfile = async () => {
    await create({
      userId: currentUser.id,
      name: 'New Profile',
      allergens: ['milk', 'eggs'],
      customKeywords: [],
      hasAnaphylaxis: false,
      emergencyContacts: [],
      medications: [],
    });
  };

  const handleUpdateProfile = async (id: string) => {
    await update({
      id,
      allergens: ['milk', 'eggs', 'soy'],
    });
  };

  const handleDeleteProfile = async (id: string) => {
    await deleteProfile({ id });
  };

  return (
    // UI implementation
  );
}
```

## Performance Considerations

### Caching Strategy

- **Products**: 7-day cache, refreshed on force reload
- **Recalls**: 24-hour cache, auto-cleanup of expired entries
- **Analytics**: 5-minute stale time, 10-minute auto-refresh
- **Profiles**: 1-minute stale time for quick updates

### Offline Support

- All data stored locally in AsyncStorage
- Automatic sync when connection restored
- Optimistic updates work offline
- Queue system for pending operations

### Data Cleanup

- Analytics events: 90-day retention
- Expired cache entries: Automatic removal
- Old notifications: Cleared on app restart

## Security

- All data stored locally on device
- No sensitive data in analytics events
- Export files contain full user data - handle securely
- Notification permissions requested explicitly

## Future Enhancements

1. **Cloud Sync**: Sync data across devices
2. **Collaborative Lists**: Share shopping lists with family
3. **Advanced Analytics**: ML-powered insights
4. **Real-time Recall Alerts**: Push notifications for new recalls
5. **Barcode History**: Track scanning patterns
6. **Product Recommendations**: Based on safe products

## Troubleshooting

### Data Not Syncing

1. Check online status: `useLiveData().isOnline`
2. Verify auto-sync enabled: `useLiveData().autoSync`
3. Manually trigger sync: `useLiveData().syncData()`
4. Check console for errors

### Notifications Not Working

1. Verify permissions: `NotificationService.requestPermissions()`
2. Check settings: `NotificationService.getSettings()`
3. Platform: Notifications don't work on web
4. Review console logs for errors

### Export/Import Issues

1. Verify file format is valid JSON
2. Check file permissions
3. Ensure sufficient storage space
4. Review error messages in alerts

## API Reference

See individual service files for detailed API documentation:
- `backend/db/schema.ts` - Database schema
- `backend/services/productService.ts` - Product operations
- `backend/services/recallService.ts` - Recall operations
- `backend/services/analyticsService.ts` - Analytics operations
- `hooks/useLiveData.ts` - React hooks
- `contexts/LiveDataContext.tsx` - Global context
- `services/notificationService.ts` - Notifications
