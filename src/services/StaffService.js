import { apiClient } from './apiClient.js';

// Talks to the NestJS backend (/staff). Admin-only reviewer management.
// Replaces the old Supabase `manage-staff` edge function (self-managed JWT now).
export const StaffService = {
  async list() {
    return apiClient.get('/staff');
  },

  async create(payload) {
    return apiClient.post('/staff', {
      displayName: payload.displayName,
      username: payload.username,
      password: payload.password,
    });
  },

  async resetPassword(userId, password) {
    return apiClient.patch(`/staff/${userId}/password`, { password });
  },

  async update(userId, payload) {
    return apiClient.patch(`/staff/${userId}`, {
      displayName: payload.displayName,
      username: payload.username,
    });
  },

  async setActive(userId, isActive) {
    return apiClient.patch(`/staff/${userId}/active`, { isActive });
  },

  async remove(userId) {
    return apiClient.del(`/staff/${userId}`);
  },
};
