import { SHOW_DEV_GALLERY } from '../app/constants/flags';
import { isSupabaseConfigured } from './supabaseClient';

/** Beta: no fake auth or persistence when env is missing (except dev screen gallery). */
export const SUPABASE_REQUIRED_USER_MESSAGE =
  'This workspace requires Supabase. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment, then reload.';

/** True when only devNavMap / gallery may run without Supabase (VITE_SHOW_DEV_GALLERY=true). */
export const OFFLINE_DEV_GALLERY_ONLY = SHOW_DEV_GALLERY && !isSupabaseConfigured();

export const DEV_ONLY_SCREENS_WITHOUT_SUPABASE = ['devNavMap', 'gallery'] as const;

export function isDevOnlyScreenWithoutSupabase(screen: string): boolean {
  return (DEV_ONLY_SCREENS_WITHOUT_SUPABASE as readonly string[]).includes(screen);
}
