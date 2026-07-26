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
import { applyPagination, applySort, requireSupabaseClient, runQuery } from './BaseService.js';

export const KioskService = {
  async list({
    searchTerm = '',
    status = '',
    businessTypeId = '',
    customerId = '',
    sort = { column: 'created_at', ascending: false },
    pagination,
  } = {}) {
    try {
      const supabase = requireSupabaseClient();
      let query = supabase
        .from('kiosks')
        .select('*, business_types(id, name, price_per_month), categories(id, name), customers(id, facebook_name)', { count: 'exact' });

      if (searchTerm) {
        const pattern = `%${searchTerm}%`;
        query = query.or(`facebook_name.ilike.${pattern},facebook_id.ilike.${pattern}`);
      }
      if (status) query = query.eq('status', status);
      if (businessTypeId) query = query.eq('business_type_id', businessTypeId);
      if (customerId) query = query.eq('customer_id', customerId);

      query = applySort(query, sort);
      query = applyPagination(query, pagination);

      const { data, count } = await runQuery(query);
      return { data, count };
    } catch (err) {
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
    }
  },

  async getById(id) {
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('kiosks')
        .select('*, business_types(id, name, price_per_month), categories(id, name), customers(id, facebook_name)')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) return { data };
    } catch (err) {}
    return apiClient.get(`/kiosks/${id}`);
  },

  async listByCustomer(customerId) {
    return KioskService.list({ customerId });
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
