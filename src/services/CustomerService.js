import { apiClient } from './apiClient.js';

const CUSTOMER_MUTABLE_FIELDS = [
  'facebook_name',
  'facebook_id',
  'facebook_link',
  'facebook_group_link',
  'phone',
  'address',
  'status',
  'note',
  'facebook_verified',
  'facebook_verified_at',
  'friend_count',
  'follower_count',
  'is_public_profile',
];

// Talks to the NestJS backend (GET/POST/PATCH /customers). Public method
// signatures and return shapes match the old Supabase-backed service, so pages
// and components need no changes.
import { applyPagination, applySort, requireSupabaseClient, runQuery } from './BaseService.js';

export const CustomerService = {
  async list({
    searchTerm = '',
    status = '',
    kioskState = '',
    sort = { column: 'created_at', ascending: false },
    pagination,
  } = {}) {
    try {
      const supabase = requireSupabaseClient();
      let query = supabase.from('customers').select('*', { count: 'exact' });

      if (searchTerm) {
        const pattern = `%${searchTerm}%`;
        query = query.or(`facebook_name.ilike.${pattern},facebook_id.ilike.${pattern},phone.ilike.${pattern}`);
      }
      if (status) query = query.eq('status', status);

      query = applySort(query, sort);
      query = applyPagination(query, pagination);

      const { data, count } = await runQuery(query);
      return { data, count };
    } catch (err) {
      return apiClient.get('/customers', {
        searchTerm,
        status,
        kioskState,
        sortColumn: sort?.column || 'created_at',
        sortAscending: sort?.ascending !== false,
        page: Number(pagination?.page || 1),
        pageSize: Number(pagination?.pageSize || 25),
      });
    }
  },

  async getById(id) {
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) return { data };
    } catch (err) {}
    return apiClient.get(`/customers/${id}`);
  },

  async create(customer) {
    return apiClient.post('/customers', pickCustomerPayload(customer));
  },

  async update(id, customer) {
    return apiClient.patch(`/customers/${id}`, pickCustomerPayload(customer));
  },

  async updateFacebookVerification(
    id,
    { verified = true, friendCount = 0, followerCount = 0, isPublic = true, facebookId = '', facebookName = '' },
  ) {
    return apiClient.patch(`/customers/${id}/facebook-verification`, {
      verified,
      friendCount,
      followerCount,
      isPublic,
      facebookId,
      facebookName,
    });
  },

  async setStatus(id, status) {
    return CustomerService.update(id, { status });
  },

  async upsert(customer) {
    // Existing callers always pass a record with an id → update it; otherwise create.
    if (customer?.id) {
      const { id, ...rest } = customer;
      return CustomerService.update(id, rest);
    }
    return CustomerService.create(customer);
  },
};

function pickCustomerPayload(customer = {}) {
  return CUSTOMER_MUTABLE_FIELDS.reduce((payload, field) => {
    if (Object.prototype.hasOwnProperty.call(customer, field)) {
      payload[field] = customer[field] ?? null;
    }

    return payload;
  }, {});
}
