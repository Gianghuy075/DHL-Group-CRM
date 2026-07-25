import { apiClient } from './apiClient.js';
import { addMonths, parseDateOnly, startOfToday, toDateOnly } from '../utils/date.js';

const PAYMENT_MUTABLE_FIELDS = [
  'customer_id',
  'kiosk_id',
  'start_date',
  'end_date',
  'months',
  'price_per_month',
  'discount',
  'discount_reason',
  'total_amount',
  'payment_method',
  'payment_status',
  'note',
];

// Talks to the NestJS backend (/payments). Public method signatures and return
// shapes match the old Supabase-backed service, so pages/components need no
// changes. Search, summary aggregation, the confirm RPC, renewal and the
// cancel transaction now run server-side. calculateRenewalPreview stays here so
// the renew form can show an instant client-side preview before submitting.
export const PaymentService = {
  calculateRenewalPreview(kiosk, { months = 1, discount = 0 } = {}) {
    return buildRenewalPreview(kiosk, { months, discount });
  },

  async renewKiosk({ kioskId, months = 1, discount = 0, discountReason = '', note = '' } = {}) {
    return apiClient.post('/payments/renew', {
      kioskId,
      months: Number(months),
      discount: Number(discount || 0),
      discountReason,
      note,
    });
  },

  async list(filters = {}) {
    return apiClient.get('/payments', buildListParams(filters));
  },

  async listWithSummary(filters = {}) {
    return apiClient.get('/payments/with-summary', buildListParams(filters));
  },

  async getSummary({ searchTerm = '', status = '', paymentMethod = '', businessTypeId = '' } = {}) {
    return apiClient.get('/payments/summary', {
      searchTerm,
      status,
      paymentMethod,
      businessTypeId,
    });
  },

  async listPending() {
    return apiClient.get('/payments/pending');
  },

  async listByKiosk(kioskId) {
    return apiClient.get(`/payments/by-kiosk/${kioskId}`);
  },

  async getById(id) {
    return apiClient.get(`/payments/${id}`);
  },

  async create(payment) {
    return apiClient.post('/payments', pickPaymentPayload(payment));
  },

  async updatePending(id, payment) {
    return apiClient.patch(`/payments/${id}`, pickPaymentPayload(payment));
  },

  async confirm(id) {
    return apiClient.post(`/payments/${id}/confirm`);
  },

  async cancelRegistration(id) {
    return apiClient.post(`/payments/${id}/cancel`);
  },

  async reject(id) {
    return apiClient.post(`/payments/${id}/reject`);
  },
};

function buildListParams({
  searchTerm = '',
  status = '',
  paymentMethod = '',
  businessTypeId = '',
  customerId = '',
  sort = { column: 'created_at', ascending: false },
  pagination,
} = {}) {
  return {
    searchTerm,
    status,
    paymentMethod,
    businessTypeId,
    customerId,
    sortColumn: sort?.column || 'created_at',
    sortAscending: sort?.ascending === true,
    page: Number(pagination?.page || 1),
    pageSize: Number(pagination?.pageSize || 20),
  };
}

function pickPaymentPayload(payment = {}) {
  return PAYMENT_MUTABLE_FIELDS.reduce((payload, field) => {
    if (Object.prototype.hasOwnProperty.call(payment, field)) {
      payload[field] = payment[field] ?? null;
    }

    return payload;
  }, {});
}

// --- client-side renewal preview (pure, no network) ---
function buildRenewalPreview(kiosk, { months = 1, discount = 0 } = {}) {
  if (!kiosk) {
    throw new Error('Kiosk là bắt buộc để gia hạn.');
  }

  if (!kiosk.business_types) {
    throw new Error('Kiosk thiếu loại hình kinh doanh.');
  }

  const normalizedMonths = Number(months);
  const normalizedDiscount = Math.max(Number(discount || 0), 0);
  const pricePerMonth = Number(kiosk.business_types.price_per_month);

  if (!Number.isInteger(normalizedMonths) || normalizedMonths < 1) {
    throw new Error('Số tháng phải là số nguyên lớn hơn 0.');
  }

  if (!Number.isFinite(pricePerMonth)) {
    throw new Error('Giá loại hình kinh doanh không hợp lệ.');
  }

  const start = nextRenewalStartDate(kiosk.end_date);
  const end = addMonths(start, normalizedMonths);
  const subtotal = pricePerMonth * normalizedMonths;

  return {
    businessTypeName: kiosk.business_types.name || '',
    months: normalizedMonths,
    startDate: toDateOnly(start),
    endDate: toDateOnly(end),
    pricePerMonth,
    discount: normalizedDiscount,
    subtotal,
    totalAmount: Math.max(subtotal - normalizedDiscount, 0),
  };
}

function nextRenewalStartDate(endDate) {
  if (!endDate) {
    return startOfToday();
  }

  const date = parseDateOnly(endDate);
  date.setDate(date.getDate() + 1);
  return date;
}
