/**
 * Payment API Client
 *
 * Edura's payment_service only knows whole-course PayHere checkout, PayHere's
 * webhook (server-to-server, not called from the browser), manual receipt
 * upload, and a single "list my/all payments" endpoint — no bank-account
 * management, no earnings analysis, no per-payment admin review workflow.
 * Every export keeps its original name/signature; those with a real backing
 * endpoint call it (with field translation), the rest return empty defaults
 * or reject clearly.
 */
import api from './client'

export interface PaymentInitiateRequest {
  payment_type: 'course' | 'sub_course' | 'module' | 'exam' | 'class_package'
  course_id?: string
  sub_course_id?: string
  module_id?: string
  exam_id?: string
  class_package_id?: string
  payment_method: 'payhere' | 'bank_slip'
}

export interface PaymentResponse {
  id: string
  user_id: string
  payment_type: string
  course_id?: string
  sub_course_id?: string
  module_id?: string
  exam_id?: string
  amount: number
  payment_method: string
  status: string
  payhere_order_id?: string
  created_at: string
  completed_at?: string
}

export interface PayHereConfig {
  merchant_id: string
  return_url: string
  cancel_url: string
  notify_url: string
  order_id: string
  items: string
  currency: string
  amount: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  hash: string
  sandbox: boolean
}

export interface BankSlipUploadRequest {
  payment_id: string
  bank_name?: string
  depositor_name?: string
  deposit_date?: string
  reference_number?: string
  slip_image: File
}

export interface BankSlipResponse {
  id: string
  payment_id: string
  user_id: string
  slip_image_url: string
  slip_image_public_id?: string
  bank_name?: string
  depositor_name?: string
  deposit_date?: string
  reference_number?: string
  status: string
  verified_by?: string
  verified_at?: string
  rejection_reason?: string
  created_at: string
  amount?: number
  payment_type?: string
  item_name?: string
}

export interface EarningsItem {
  item_id: string
  item_title: string
  item_type: string
  item_grade?: number
  total_revenue: number
  enrollment_count: number
}

export interface EarningsAnalysisResponse {
  total_revenue: number
  total_enrollments: number
  by_item: EarningsItem[]
  updated_at: string
}

function mapPayment(p: any): PaymentResponse {
  return {
    id: String(p.id),
    user_id: String(p.student_id),
    payment_type: 'course',
    course_id: String(p.course_id),
    amount: Number(p.amount),
    payment_method: p.payment_method === 'PAYHERE' ? 'payhere' : 'bank_slip',
    status: p.payment_status?.toLowerCase?.() ?? p.payment_status,
    payhere_order_id: p.payhere_order_id ?? undefined,
    created_at: p.created_at,
  }
}

// Course price + PayHere checkout context for a bank-slip payment that hasn't
// been submitted with a file yet — Edura's /receipts endpoint creates the
// payment and the receipt together in one call, unlike the original two-step
// initiate-then-upload flow this file was designed around.
const pendingBankSlip = new Map<string, { course_id: number; amount: number }>()
const payHereCheckoutCache = new Map<string, any>()

async function getCoursePrice(courseId: string): Promise<number> {
  const res = await api.get(`/api/courses/${courseId}`)
  return Number(res.data.price ?? 0)
}

// Student Payment APIs

export async function initiatePayment(data: PaymentInitiateRequest): Promise<PaymentResponse> {
  if (data.payment_type !== 'course' || !data.course_id) {
    throw new Error('Only whole-course payments are supported by the Edura backend today.')
  }

  const amount = await getCoursePrice(data.course_id)

  if (data.payment_method === 'payhere') {
    const res = await api.post('/api/payments/checkout', {
      course_id: Number(data.course_id),
      amount,
    })
    const checkout = res.data
    payHereCheckoutCache.set(checkout.order_id, checkout)
    return {
      id: checkout.order_id,
      user_id: '',
      payment_type: 'course',
      course_id: data.course_id,
      amount: checkout.amount,
      payment_method: 'payhere',
      status: 'pending',
      payhere_order_id: checkout.order_id,
      created_at: new Date().toISOString(),
    }
  }

  // bank_slip: defer the actual API call to uploadBankSlip(), which is where
  // the receipt file becomes available.
  const localId = `pending-${Date.now()}`
  pendingBankSlip.set(localId, { course_id: Number(data.course_id), amount })
  return {
    id: localId,
    user_id: '',
    payment_type: 'course',
    course_id: data.course_id,
    amount,
    payment_method: 'bank_slip',
    status: 'pending',
    created_at: new Date().toISOString(),
  }
}

export async function getPayHereConfig(paymentId: string): Promise<PayHereConfig> {
  const checkout = payHereCheckoutCache.get(paymentId)
  if (!checkout) {
    throw new Error('PayHere checkout was not initiated for this payment.')
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return {
    merchant_id: checkout.merchant_id,
    return_url: `${origin}/payment/success`,
    cancel_url: `${origin}/payment/cancel`,
    notify_url: '', // PayHere calls payment_service's /webhook directly server-to-server
    order_id: checkout.order_id,
    items: 'Course Payment',
    currency: checkout.currency,
    amount: String(checkout.amount),
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Sri Lanka',
    hash: checkout.hash,
    sandbox: checkout.redirect_url.includes('sandbox'),
  }
}

export async function uploadBankSlip(data: BankSlipUploadRequest): Promise<BankSlipResponse> {
  const pending = pendingBankSlip.get(data.payment_id)
  if (!pending) {
    throw new Error('This bank-slip payment was not initiated correctly.')
  }

  const formData = new FormData()
  formData.append('course_id', String(pending.course_id))
  formData.append('amount', String(pending.amount))
  formData.append('file', data.slip_image)

  const response = await api.post('/api/payments/receipts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const result = response.data
  pendingBankSlip.delete(data.payment_id)

  return {
    id: String(result.receipt_id),
    payment_id: String(result.payment_id),
    user_id: '',
    slip_image_url: result.receipt_url,
    slip_image_public_id: result.receipt_public_id,
    bank_name: data.bank_name,
    depositor_name: data.depositor_name,
    deposit_date: data.deposit_date,
    reference_number: data.reference_number,
    status: result.status?.toLowerCase?.() ?? result.status,
    created_at: new Date().toISOString(),
    amount: pending.amount,
    payment_type: 'course',
  }
}

export async function getMyPayments(): Promise<PaymentResponse[]> {
  const response = await api.get('/api/payments/')
  return response.data.map(mapPayment)
}

export async function getPaymentDetails(paymentId: string): Promise<PaymentResponse> {
  const all = await getMyPayments()
  const found = all.find((p) => p.id === paymentId || p.payhere_order_id === paymentId)
  if (!found) throw new Error('Payment not found')
  return found
}

// Admin Payment APIs (real: payment_service /receipts)

function mapReceipt(r: any): BankSlipResponse {
  return {
    id: String(r.id),
    payment_id: String(r.payment_id),
    user_id: String(r.student_id),
    slip_image_url: r.receipt_url,
    slip_image_public_id: r.receipt_public_id ?? undefined,
    // payment_service's ReceiptStatus enum stores "approved"; the admin UI
    // (built around the verb the admin performs) expects "verified".
    status: r.status === 'approved' ? 'verified' : r.status,
    verified_by: r.reviewer_id != null ? String(r.reviewer_id) : undefined,
    verified_at: r.reviewed_at ?? undefined,
    rejection_reason: r.reviewer_note ?? undefined,
    created_at: r.created_at,
    amount: Number(r.amount),
    payment_type: 'course',
    item_name: `Course #${r.course_id}`,
  }
}

export async function getPendingBankSlips(courseId?: string): Promise<BankSlipResponse[]> {
  const response = await api.get('/api/payments/receipts', { params: { status_filter: 'pending' } })
  const receipts = response.data.map(mapReceipt)
  return courseId ? receipts.filter((r: any) => r.item_name === `Course #${courseId}`) : receipts
}

export async function getAllBankSlips(statusFilter?: string, courseId?: string): Promise<BankSlipResponse[]> {
  const response = await api.get('/api/payments/receipts', {
    params: statusFilter ? { status_filter: statusFilter } : undefined,
  })
  const receipts = response.data.map(mapReceipt)
  return courseId ? receipts.filter((r: any) => r.item_name === `Course #${courseId}`) : receipts
}

export async function getBankSlipDetails(slipId: string): Promise<BankSlipResponse> {
  const all = await getAllBankSlips()
  const found = all.find((r) => r.id === slipId)
  if (!found) throw new Error('Receipt not found')
  return found
}

export interface BankSlipVerification {
  status: 'verified' | 'rejected'
  rejection_reason?: string
}

export async function verifyBankSlip(slipId: string, verification: BankSlipVerification): Promise<BankSlipResponse> {
  const response = await api.put(`/api/payments/receipts/${slipId}/verify`, verification)
  return mapReceipt(response.data)
}

export interface PaymentStats {
  total_payments: number
  completed_payments: number
  pending_payments: number
  total_revenue: number
  bank_slips: {
    pending: number
    verified: number
    rejected: number
  }
}

// Derived client-side from the real payments list — payment_service has no
// dedicated stats endpoint.
export async function getPaymentStats(courseId?: string): Promise<PaymentStats> {
  const [all, receipts] = await Promise.all([getAllPayments(), getAllBankSlips()])
  const filtered = courseId ? all.filter((p) => p.course_id === courseId) : all
  const filteredReceipts = courseId ? receipts.filter((r) => r.item_name === `Course #${courseId}`) : receipts
  return {
    total_payments: filtered.length,
    completed_payments: filtered.filter((p) => p.status === 'success').length,
    pending_payments: filtered.filter((p) => p.status === 'pending').length,
    total_revenue: filtered
      .filter((p) => p.status === 'success')
      .reduce((sum, p) => sum + p.amount, 0),
    bank_slips: {
      pending: filteredReceipts.filter((r) => r.status === 'pending').length,
      verified: filteredReceipts.filter((r) => r.status === 'verified' || r.status === 'approved').length,
      rejected: filteredReceipts.filter((r) => r.status === 'rejected').length,
    },
  }
}

export async function getAllPayments(statusFilter?: string, paymentMethod?: string): Promise<PaymentResponse[]> {
  const all = await getMyPayments() // returns every payment when the caller is an admin
  return all.filter(
    (p) => (!statusFilter || p.status === statusFilter) && (!paymentMethod || p.payment_method === paymentMethod)
  )
}

// Derived client-side from the real payments list — payment_service has no
// dedicated earnings-by-course endpoint.
export async function getEarningsAnalysis(courseId?: string): Promise<EarningsAnalysisResponse> {
  const all = await getAllPayments('success')
  const filtered = courseId ? all.filter((p) => p.course_id === courseId) : all

  const byCourse = new Map<string, { total_revenue: number; enrollment_count: number }>()
  for (const p of filtered) {
    const key = p.course_id ?? 'unknown'
    const entry = byCourse.get(key) ?? { total_revenue: 0, enrollment_count: 0 }
    entry.total_revenue += p.amount
    entry.enrollment_count += 1
    byCourse.set(key, entry)
  }

  return {
    total_revenue: filtered.reduce((sum, p) => sum + p.amount, 0),
    total_enrollments: filtered.length,
    by_item: Array.from(byCourse.entries()).map(([courseIdKey, v]) => ({
      item_id: courseIdKey,
      item_title: `Course #${courseIdKey}`,
      item_type: 'course',
      total_revenue: v.total_revenue,
      enrollment_count: v.enrollment_count,
    })),
    updated_at: new Date().toISOString(),
  }
}

// Bank Account Management — no such concept exists in Edura.
export interface BankAccount {
  id: string
  bank_name: string
  account_number: string
  account_name: string
  branch: string
  is_active: boolean
  order_number: number
  created_at: string
  updated_at?: string
}

export interface BankAccountCreate {
  bank_name: string
  account_number: string
  account_name: string
  branch: string
  is_active?: boolean
  order_number?: number
}

export interface BankAccountUpdate {
  bank_name?: string
  account_number?: string
  account_name?: string
  branch?: string
  is_active?: boolean
  order_number?: number
}

export async function getStudentBankAccounts(): Promise<BankAccount[]> {
  return []
}

export async function getAdminBankAccounts(): Promise<BankAccount[]> {
  return []
}

export async function createBankAccount(_data: BankAccountCreate): Promise<BankAccount> {
  throw new Error('Bank account management is not supported by the Edura backend.')
}

export async function updateBankAccount(_id: string, _data: BankAccountUpdate): Promise<BankAccount> {
  throw new Error('Bank account management is not supported by the Edura backend.')
}

export async function deleteBankAccount(_id: string): Promise<void> {
  throw new Error('Bank account management is not supported by the Edura backend.')
}
