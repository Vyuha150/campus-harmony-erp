import { create } from 'zustand';
import { fetchApi } from '@/lib/apiService';

interface DataStore {
  cache: Record<string, any>;
  loading: Record<string, boolean>;
  fetch: (key: string, endpoint: string) => Promise<any>;
  getOrFetch: (key: string, endpoint: string) => any;
}

export const useDataStore = create<DataStore>((set, get) => ({
  cache: {},
  loading: {},
  
  fetch: async (key: string, endpoint: string) => {
    set(state => ({ loading: { ...state.loading, [key]: true } }));
    try {
      const data = await fetchApi(endpoint);
      set(state => ({
        cache: { ...state.cache, [key]: data },
        loading: { ...state.loading, [key]: false }
      }));
      return data;
    } catch (error) {
      set(state => ({ loading: { ...state.loading, [key]: false } }));
      console.error(`Failed to fetch ${key}:`, error);
      return null;
    }
  },

  getOrFetch: (key: string, endpoint: string) => {
    const state = get();
    if (state.cache[key] !== undefined) return state.cache[key];
    if (!state.loading[key]) {
      state.fetch(key, endpoint);
    }
    return null;
  }
}));
