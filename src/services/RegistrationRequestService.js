import { requireSupabaseClient, runQuery } from './BaseService.js';

export const RegistrationRequestService = {
  async list(status = 'pending') {
    let query = requireSupabaseClient()
      .from('registration_requests')
      .select('id, facebook_name, facebook_id, facebook_link, phone, service_name, months, total_amount, status, submitted_at, reviewed_at, rejection_reason, customer_id, kiosk_id, categories(name), business_types(name)')
      .order('submitted_at', { ascending: false });
    if (status) query = query.eq('status', status);
    return runQuery(query);
  },

  async approve(id) {
    return runQuery(requireSupabaseClient().rpc('approve_registration_request', {
      request_id_input: id,
    }));
  },

  async reject(id, reason) {
    return runQuery(requireSupabaseClient().rpc('reject_registration_request', {
      request_id_input: id,
      reason_input: reason,
    }));
  },

  async submitGuestRequest({
    facebookName,
    facebookLink,
    facebookId = '',
    phone,
    businessTypeId,
    categoryId,
    months = 1,
    totalAmount,
    note = '',
  }) {
    const supabase = requireSupabaseClient();
    const payload = {
      facebook_name: facebookName,
      facebook_id: facebookId || '100088812345678',
      facebook_link: facebookLink,
      phone: phone || '',
      business_type_id: businessTypeId,
      category_id: categoryId || null,
      months: Number(months),
      total_amount: Number(totalAmount),
      status: 'pending',
      submitted_at: new Date().toISOString(),
      note: note ? `[LandingPage Guest] ${note}` : '[Mua Trực Tiếp từ Landing Page]',
    };

    return runQuery(
      supabase
        .from('registration_requests')
        .insert([payload])
        .select()
        .single(),
    );
  },
};
