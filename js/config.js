/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM - SUPABASE CONFIGURATION
 * ==============================================================================
 */

window.SUPABASE_CONFIG = {
  // 🔗 1. Supabase Project URL
  url: 'https://vpimfibtizurhuhljcpb.supabase.co',

  // 🔑 2. Supabase Anon / Public API Key
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwaW1maWJ0aXp1cmh1aGxqY3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NzExNzIsImV4cCI6MjEwNDQ0NzE3Mn0.tziYyO2_xJY3xoRfwVIn34jsGYnuAo6_YXdDPtOYKDU',

  // ⚡ 3. Supabase Edge Function for password reset (configured in Supabase Dashboard)
  passwordResetFunction: 'hyper-handler'
};

// Global variables set for direct compatibility
window.SUPABASE_CONFIG_URL = window.SUPABASE_CONFIG.url;
window.SUPABASE_CONFIG_KEY = window.SUPABASE_CONFIG.anonKey;

// Automatically persist / overwrite in localStorage
try {
  localStorage.setItem('carepulse_supabase_url', window.SUPABASE_CONFIG.url);
  localStorage.setItem('carepulse_supabase_anon_key', window.SUPABASE_CONFIG.anonKey);
} catch (e) {
  console.warn('LocalStorage access note:', e);
}
