import { trpc } from '@/lib/trpc';
import { useUser } from '@/contexts/UserContext';
import { useQueryClient } from '@tanstack/react-query';

export function useLiveProducts() {
  const isBackendEnabled = !!process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  
  const popularQuery = trpc.products.popular.useQuery({ limit: 10 }, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    retry: false,
    enabled: isBackendEnabled,
  });

  const recentQuery = trpc.products.recent.useQuery({ limit: 10 }, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
    retry: false,
    enabled: isBackendEnabled,
  });

  return {
    popular: popularQuery.data || [],
    recent: recentQuery.data || [],
    isLoading: popularQuery.isLoading || recentQuery.isLoading,
    refetch: () => {
      if (isBackendEnabled) {
        popularQuery.refetch();
        recentQuery.refetch();
      }
    },
  };
}

export function useLiveProduct(barcode: string, forceRefresh: boolean = false) {
  const isBackendEnabled = !!process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  
  return trpc.products.getByBarcode.useQuery(
    { barcode, forceRefresh },
    {
      enabled: isBackendEnabled && !!barcode,
      staleTime: 7 * 24 * 60 * 60 * 1000,
      refetchOnMount: forceRefresh,
      retry: false,
    }
  );
}

export function useProductSearch(query: string, page: number = 1) {
  const isBackendEnabled = !!process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  
  return trpc.products.search.useQuery(
    { query, page },
    {
      enabled: isBackendEnabled && query.length > 2,
      staleTime: 5 * 60 * 1000,
      retry: false,
    }
  );
}

export function useLiveRecalls(query: string) {
  const isBackendEnabled = !!process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  
  return trpc.recalls.search.useQuery(
    { query },
    {
      enabled: isBackendEnabled && query.length > 2,
      staleTime: 24 * 60 * 60 * 1000,
      retry: false,
    }
  );
}

export function useLiveRecallsByBarcode(barcode: string) {
  const isBackendEnabled = !!process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  
  return trpc.recalls.searchByBarcode.useQuery(
    { barcode },
    {
      enabled: isBackendEnabled && !!barcode,
      staleTime: 24 * 60 * 60 * 1000,
      retry: false,
    }
  );
}

export function useLiveProfiles() {
  const { currentUser } = useUser();
  const queryClient = useQueryClient();
  const isBackendEnabled = !!process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  const listQuery = trpc.profiles.list.useQuery(
    { userId: currentUser?.id || '' },
    {
      enabled: isBackendEnabled && !!currentUser?.id,
      staleTime: 1 * 60 * 1000,
      retry: false,
    }
  );

  const profilesQueryKey = listQuery.data !== undefined
    ? [['profiles', 'list'], { input: { userId: currentUser?.id || '' }, type: 'query' }]
    : undefined;

  const createMutation = trpc.profiles.create.useMutation({
    onSuccess: () => {
      listQuery.refetch();
    },
  });

  const updateMutation = trpc.profiles.update.useMutation({
    onSuccess: () => {
      listQuery.refetch();
    },
  });

  const deleteMutation = trpc.profiles.delete.useMutation({
    onSuccess: () => {
      listQuery.refetch();
    },
  });

  return {
    profiles: listQuery.data || [],
    isLoading: listQuery.isLoading,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    refetch: listQuery.refetch,
  };
}

export function useLiveAnalytics(userId?: string) {
  const isBackendEnabled = !!process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  
  const statsQuery = trpc.analytics.stats.useQuery(
    { userId },
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: false,
      retry: false,
      enabled: isBackendEnabled && !!userId,
    }
  );

  const trackMutation = trpc.analytics.track.useMutation();

  return {
    stats: statsQuery.data,
    isLoading: statsQuery.isLoading,
    track: async (...args: Parameters<typeof trackMutation.mutateAsync>) => {
      if (isBackendEnabled) {
        return trackMutation.mutateAsync(...args);
      }
    },
    refetch: () => {
      if (isBackendEnabled) {
        statsQuery.refetch();
      }
    },
  };
}

export function useDataExport() {
  const exportQuery = trpc.data.export.useQuery(undefined, {
    enabled: false,
    retry: false,
  });

  const importMutation = trpc.data.import.useMutation();

  return {
    exportData: async () => {
      const result = await exportQuery.refetch();
      return result.data;
    },
    importData: importMutation.mutateAsync,
    isExporting: exportQuery.isFetching,
    isImporting: importMutation.isPending,
  };
}
