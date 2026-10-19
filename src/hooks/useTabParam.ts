import { useLocation } from 'react-router-dom';

/**
 * Lets a link (e.g. a notification) open a page on a given tab: `?tab=waivers`.
 * Spread onto <Tabs>; the key remounts the tabs when the link changes while
 * the page is already open.
 */
export function useTabParam(fallback: string): { key: string; defaultValue: string } {
  const { search } = useLocation();
  const tab = new URLSearchParams(search).get('tab');
  return { key: search, defaultValue: tab || fallback };
}
