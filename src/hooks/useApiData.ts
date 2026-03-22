import { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '@/lib/apiService';

interface UseApiResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApiData<T>(endpoint: string, initialData: T): UseApiResult<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchApi<T>(endpoint)
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        console.error(`API Error [${endpoint}]:`, err);
        setError(err.message);
        setLoading(false);
      });
  }, [endpoint]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// For multiple API calls on dashboard pages
export function useMultiApiData<T extends Record<string, any>>(
  endpoints: Record<keyof T, string>,
  initialData: T
): UseApiResult<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    const keys = Object.keys(endpoints) as Array<keyof T>;
    Promise.all(
      keys.map(key =>
        fetchApi(endpoints[key])
          .then(result => ({ key, result }))
          .catch(err => {
            console.error(`API Error [${String(key)}]:`, err);
            return { key, result: initialData[key] };
          })
      )
    ).then(results => {
      const newData = { ...initialData } as any;
      for (const { key, result } of results) {
        newData[key] = result;
      }
      setData(newData as T);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
