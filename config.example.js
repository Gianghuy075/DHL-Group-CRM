window.DHL_CONFIG = {
  supabaseUrl: 'https://YOUR_SUPABASE_PROJECT_REF.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
  dbSchema: 'DHL-Group-CRM',
  // NestJS backend base URL
  apiBaseUrl: 'http://localhost:4567',
  payos: {
    clientId: 'YOUR_PAYOS_CLIENT_ID',
    apiKey: 'YOUR_PAYOS_API_KEY',
    checksumKey: 'YOUR_PAYOS_CHECKSUM_KEY',
  },
  facebook: {
    // Facebook App ID (Meta for Developers). Only the public App ID lives here;
    // the App Secret stays on the backend (.env FB_APP_SECRET).
    appId: 'YOUR_FACEBOOK_APP_ID',
    graphVersion: 'v19.0',
  },
};
