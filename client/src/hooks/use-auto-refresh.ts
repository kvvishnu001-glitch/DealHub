import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Custom hook to auto-refresh React Query cache when deals are updated
 * Can be used to trigger UI updates when backend data changes
 */
export function useAutoRefresh(queryKey: string[], intervalMs: number = 30000) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const interval = setInterval(() => {
      // Invalidate and refetch the specified query
      queryClient.invalidateQueries({
        queryKey,
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [queryClient, queryKey, intervalMs]);

  // Provide manual refresh function
  const manualRefresh = () => {
    queryClient.invalidateQueries({
      queryKey,
    });
  };

  return { manualRefresh };
}

/**
 * Hook to listen for backend updates via WebSocket or Server-Sent Events
 * This would enable real-time updates when deals are added/modified
 */
export function useRealTimeUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // For now, we'll use polling, but this could be enhanced with WebSocket
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // When user returns to tab, refresh data immediately
        queryClient.invalidateQueries({
          queryKey: ['/api/deals'],
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/admin/deals'],
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/admin/metrics'],
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient]);
}