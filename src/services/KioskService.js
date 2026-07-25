import { apiClient } from './apiClient.js';

const KIOSK_MUTABLE_FIELDS = [
  'customer_id',
  'facebook_name',
  'facebook_id',
  'facebook_link',
  'facebook_group_link',
  'category_id',
  'business_type_id',
  'start_date',
  'end_date',
  'status',
  'auto_approve',
  'note',
];

// Talks to the NestJS backend (GET/POST/PATCH /kiosks). Public method
// signatures and return shapes match the old Supabase-backed service, so pages
// and components need no changes. Search/status filtering now runs on the BE.
export const KioskService = {
  async list({
    searchTerm = '',
    status = '',
    businessTypeId = '',
    customerId = '',
    sort = { column: 'created_at', ascending: false },
    pagination,
  } = {}) {
    return apiClient.get('/kiosks', {
      searchTerm,
      status,
      businessTypeId,
      customerId,
      sortColumn: sort?.column || 'created_at',
      sortAscending: sort?.ascending === true,
      page: Number(pagination?.page || 1),
      pageSize: Number(pagination?.pageSize || 20),
    });
  },

  async getById(id) {
    return apiClient.get(`/kiosks/${id}`);
  },

  async listByCustomer(customerId) {
    return apiClient.get(`/kiosks/by-customer/${customerId}`);
  },

  async create(kiosk) {
    return apiClient.post('/kiosks', pickKioskPayload(kiosk));
  },

  async update(id, kiosk) {
    return apiClient.patch(`/kiosks/${id}`, pickKioskPayload(kiosk));
  },

  async setStatus(id, status) {
    return apiClient.patch(`/kiosks/${id}/status`, { status });
  },

  // Người dùng mua gói Kiosk, trừ trực tiếp từ Ví (POST /kiosks/purchase).
  async purchase({ businessTypeId, months, facebookName, facebookLink } = {}) {
    return apiClient.post('/kiosks/purchase', {
      businessTypeId,
      months: Number(months),
      facebookName,
      facebookLink,
    });
  },
};

function pickKioskPayload(kiosk = {}) {
  return KIOSK_MUTABLE_FIELDS.reduce((payload, field) => {
    if (Object.prototype.hasOwnProperty.call(kiosk, field)) {
      payload[field] = kiosk[field] ?? null;
    }

    return payload;
  }, {});
}
