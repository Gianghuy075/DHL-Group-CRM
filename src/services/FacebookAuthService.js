// Real Facebook OAuth (Option 1): log the user in with the Facebook JS SDK,
// obtain a short-lived user access token, and hand it to the backend, which
// calls the Graph API (/me?fields=id,name,friends.summary(true)) to verify the
// profile authoritatively. The user cannot self-report their friend count here.
import { apiClient } from './apiClient.js';

let sdkPromise = null;

function getConfig() {
  const fb = window.DHL_CONFIG?.facebook || {};
  return {
    appId: fb.appId || '',
    version: fb.graphVersion || 'v19.0',
  };
}

// Injects and initialises the Facebook JS SDK exactly once.
function loadSdk() {
  if (sdkPromise) return sdkPromise;

  const { appId, version } = getConfig();
  if (!appId) {
    return Promise.reject(
      new Error('Chưa cấu hình Facebook App ID (config.local.js → facebook.appId).'),
    );
  }

  sdkPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = function fbAsyncInit() {
      window.FB.init({ appId, cookie: true, xfbml: false, version });
      resolve(window.FB);
    };

    const id = 'facebook-jssdk';
    if (document.getElementById(id)) {
      if (window.FB) resolve(window.FB);
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Không tải được Facebook SDK (kiểm tra kết nối mạng).'));
    document.body.appendChild(script);
  });

  return sdkPromise;
}

export const FacebookAuthService = {
  isConfigured() {
    return Boolean(getConfig().appId);
  },

  // Opens the Facebook login dialog and resolves with a user access token.
  async login() {
    const FB = await loadSdk();
    return new Promise((resolve, reject) => {
      FB.login(
        (response) => {
          if (response?.authResponse?.accessToken) {
            resolve(response.authResponse.accessToken);
          } else {
            reject(new Error('Bạn đã hủy đăng nhập Facebook hoặc không cấp quyền.'));
          }
        },
        // public_profile is granted by default; user_friends returns the
        // friend count (needs App Review for production data).
        { scope: 'public_profile,user_friends' },
      );
    });
  },

  // Full flow: login → send token to BE → BE verifies via Graph API & stores it.
  // Requires an authenticated app session (used from a logged-in profile page).
  async verifyProfile() {
    const accessToken = await this.login();
    return apiClient.post('/facebook/verify-profile', { accessToken });
  },

  // Registration flow (no app session yet): BE verifies via Graph API but does
  // NOT persist — the profile is saved when the account is created.
  async verifyProfilePreview() {
    const accessToken = await this.login();
    return apiClient.post('/facebook/verify-profile-preview', { accessToken });
  },
};
