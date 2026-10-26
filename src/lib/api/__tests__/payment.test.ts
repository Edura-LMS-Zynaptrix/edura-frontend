jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock())

import api from '@/lib/api/client'
import * as payment from '@/lib/api/payment'
import { reply, type MockClient } from '@/test-utils/api'

const http = api as unknown as MockClient

const rawPayment = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  student_id: 7,
  course_id: 10,
  amount: '1500.00',
  payment_method: 'PAYHERE',
  payment_status: 'SUCCESS',
  payhere_order_id: 'ORD-1',
  created_at: '2026-10-01T00:00:00Z',
  ...overrides,
})

const rawReceipt = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  payment_id: 1,
  student_id: 7,
  course_id: 10,
  amount: 1500,
  receipt_url: 'https://cdn/r.pdf',
  receipt_public_id: 'edura/receipts/r',
  status: 'pending',
  reviewer_id: null,
  reviewer_note: null,
  reviewed_at: null,
  created_at: '2026-10-01T00:00:00Z',
  ...overrides,
})

beforeEach(() => jest.resetAllMocks())

describe('initiatePayment', () => {
  it('only supports whole-course payments', async () => {
    await expect(
      payment.initiatePayment({ payment_type: 'exam', exam_id: '1', payment_method: 'payhere' })
    ).rejects.toThrow('Only whole-course payments')
    await expect(
      payment.initiatePayment({ payment_type: 'course', payment_method: 'payhere' })
    ).rejects.toThrow('Only whole-course payments')
    expect(http.get).not.toHaveBeenCalled()
  })

  it('starts a PayHere checkout at the real course price', async () => {
    http.get.mockReturnValue(reply({ price: '2500.00' }))
    http.post.mockReturnValue(
      reply({
        order_id: 'ORD-9',
        merchant_id: 'M1',
        amount: 2500,
        currency: 'LKR',
        hash: 'H',
        redirect_url: 'https://sandbox.payhere.lk/pay/checkout',
      })
    )

    const res = await payment.initiatePayment({
      payment_type: 'course',
      course_id: '10',
      payment_method: 'payhere',
    })

    expect(http.get).toHaveBeenCalledWith('/api/courses/10')
    expect(http.post).toHaveBeenCalledWith('/api/payments/checkout', {
      course_id: 10,
      amount: 2500,
    })
    expect(res).toMatchObject({
      id: 'ORD-9',
      payhere_order_id: 'ORD-9',
      amount: 2500,
      status: 'pending',
      payment_method: 'payhere',
    })

    const config = await payment.getPayHereConfig('ORD-9')
    expect(config).toMatchObject({
      merchant_id: 'M1',
      order_id: 'ORD-9',
      amount: '2500',
      currency: 'LKR',
      hash: 'H',
      sandbox: true,
      return_url: `${window.location.origin}/payment/success`,
      cancel_url: `${window.location.origin}/payment/cancel`,
      notify_url: '',
      country: 'Sri Lanka',
    })
  })

  it('treats a missing price as free and a live gateway as non-sandbox', async () => {
    http.get.mockReturnValue(reply({}))
    http.post.mockReturnValue(
      reply({
        order_id: 'ORD-LIVE',
        merchant_id: 'M',
        amount: 0,
        currency: 'LKR',
        hash: 'H',
        redirect_url: 'https://www.payhere.lk/pay/checkout',
      })
    )
    await payment.initiatePayment({ payment_type: 'course', course_id: '3', payment_method: 'payhere' })
    expect(http.post.mock.calls[0][1].amount).toBe(0)
    expect((await payment.getPayHereConfig('ORD-LIVE')).sandbox).toBe(false)
  })

  it('refuses a PayHere config for an unknown order', async () => {
    await expect(payment.getPayHereConfig('nope')).rejects.toThrow('was not initiated')
  })
})

describe('bank slips', () => {
  it('defers the upload until the slip file is chosen, then sends one form', async () => {
    http.get.mockReturnValue(reply({ price: 1500 }))
    const pending = await payment.initiatePayment({
      payment_type: 'course',
      course_id: '10',
      payment_method: 'bank_slip',
    })
    expect(pending.id).toMatch(/^pending-/)
    expect(http.post).not.toHaveBeenCalled()

    http.post.mockReturnValue(
      reply({
        receipt_id: 5,
        payment_id: 1,
        receipt_url: 'https://cdn/r.pdf',
        receipt_public_id: 'pid',
        status: 'PENDING',
      })
    )
    const file = new File(['%PDF'], 'slip.pdf', { type: 'application/pdf' })
    const slip = await payment.uploadBankSlip({
      payment_id: pending.id,
      bank_name: 'BOC',
      slip_image: file,
    })

    const [url, form, options] = http.post.mock.calls[0]
    expect(url).toBe('/api/payments/receipts')
    expect(form.get('course_id')).toBe('10')
    expect(form.get('amount')).toBe('1500')
    expect(form.get('file')).toBeInstanceOf(File)
    expect(options).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } })
    expect(slip).toMatchObject({
      id: '5',
      payment_id: '1',
      status: 'pending',
      bank_name: 'BOC',
      amount: 1500,
      slip_image_url: 'https://cdn/r.pdf',
    })

    // The pending entry is used up.
    await expect(
      payment.uploadBankSlip({ payment_id: pending.id, slip_image: file })
    ).rejects.toThrow('not initiated correctly')
  })

  it('lists pending slips mapped for the admin screen', async () => {
    http.get.mockReturnValue(
      reply([rawReceipt(), rawReceipt({ id: 6, course_id: 11 })])
    )
    const slips = await payment.getPendingBankSlips('10')
    expect(http.get).toHaveBeenCalledWith('/api/payments/receipts', {
      params: { status_filter: 'pending' },
    })
    expect(slips).toEqual([
      expect.objectContaining({
        id: '5',
        user_id: '7',
        item_name: 'Course #10',
        amount: 1500,
        verified_by: undefined,
        rejection_reason: undefined,
      }),
    ])
    expect(await payment.getPendingBankSlips()).toHaveLength(2)
  })

  it('shows "approved" receipts as verified', async () => {
    http.get.mockReturnValue(
      reply([
        rawReceipt({
          status: 'approved',
          reviewer_id: 1,
          reviewed_at: '2026-10-02T00:00:00Z',
        }),
        rawReceipt({ id: 6, status: 'rejected', reviewer_note: 'Blurry' }),
      ])
    )
    const [approved, rejected] = await payment.getAllBankSlips('approved')
    expect(http.get).toHaveBeenCalledWith('/api/payments/receipts', {
      params: { status_filter: 'approved' },
    })
    expect(approved).toMatchObject({ status: 'verified', verified_by: '1' })
    expect(rejected).toMatchObject({ status: 'rejected', rejection_reason: 'Blurry' })
  })

  it('lists every slip without a filter and narrows by course', async () => {
    http.get.mockReturnValue(reply([rawReceipt(), rawReceipt({ id: 6, course_id: 11 })]))
    expect(await payment.getAllBankSlips(undefined, '11')).toHaveLength(1)
    expect(http.get).toHaveBeenCalledWith('/api/payments/receipts', { params: undefined })
  })

  it('finds one slip or fails', async () => {
    http.get.mockReturnValue(reply([rawReceipt()]))
    expect((await payment.getBankSlipDetails('5')).id).toBe('5')
    await expect(payment.getBankSlipDetails('99')).rejects.toThrow('Receipt not found')
  })

  it('verifies a slip', async () => {
    http.put.mockReturnValue(reply(rawReceipt({ status: 'approved' })))
    const res = await payment.verifyBankSlip('5', { status: 'verified' })
    expect(http.put).toHaveBeenCalledWith('/api/payments/receipts/5/verify', {
      status: 'verified',
    })
    expect(res.status).toBe('verified')
  })
})

describe('payments, stats and earnings', () => {
  const payments = [
    rawPayment(),
    rawPayment({ id: 2, amount: 500, payment_status: 'PENDING', payment_method: 'MANUAL', payhere_order_id: null }),
    rawPayment({ id: 3, course_id: 11, amount: 2000 }),
    rawPayment({ id: 4, payment_status: 'FAILED' }),
  ]

  it('maps payments for the UI', async () => {
    http.get.mockReturnValue(reply([payments[1]]))
    expect(await payment.getMyPayments()).toEqual([
      {
        id: '2',
        user_id: '7',
        payment_type: 'course',
        course_id: '10',
        amount: 500,
        payment_method: 'bank_slip',
        status: 'pending',
        payhere_order_id: undefined,
        created_at: '2026-10-01T00:00:00Z',
      },
    ])
  })

  it('finds a payment by id or PayHere order id', async () => {
    http.get.mockReturnValue(reply(payments))
    expect((await payment.getPaymentDetails('3')).id).toBe('3')
    expect((await payment.getPaymentDetails('ORD-1')).id).toBe('1')
    await expect(payment.getPaymentDetails('missing')).rejects.toThrow('Payment not found')
  })

  it('filters all payments by status and method', async () => {
    http.get.mockReturnValue(reply(payments))
    expect((await payment.getAllPayments('success')).map((p) => p.id)).toEqual(['1', '3'])
    expect((await payment.getAllPayments(undefined, 'bank_slip')).map((p) => p.id)).toEqual(['2'])
    expect(await payment.getAllPayments()).toHaveLength(4)
  })

  it('derives stats from payments and receipts', async () => {
    http.get.mockImplementation((url: string) =>
      url === '/api/payments/'
        ? reply(payments)
        : reply([
            rawReceipt(),
            rawReceipt({ id: 6, status: 'approved' }),
            rawReceipt({ id: 7, status: 'rejected' }),
            rawReceipt({ id: 8, course_id: 11, status: 'pending' }),
          ])
    )
    expect(await payment.getPaymentStats()).toEqual({
      total_payments: 4,
      completed_payments: 2,
      pending_payments: 1,
      total_revenue: 3500,
      bank_slips: { pending: 2, verified: 1, rejected: 1 },
    })
    expect(await payment.getPaymentStats('11')).toEqual({
      total_payments: 1,
      completed_payments: 1,
      pending_payments: 0,
      total_revenue: 2000,
      bank_slips: { pending: 1, verified: 0, rejected: 0 },
    })
  })

  it('groups earnings by course from successful payments only', async () => {
    http.get.mockReturnValue(reply(payments))
    const all = await payment.getEarningsAnalysis()
    expect(all.total_revenue).toBe(3500)
    expect(all.total_enrollments).toBe(2)
    expect(all.by_item).toEqual([
      { item_id: '10', item_title: 'Course #10', item_type: 'course', total_revenue: 1500, enrollment_count: 1 },
      { item_id: '11', item_title: 'Course #11', item_type: 'course', total_revenue: 2000, enrollment_count: 1 },
    ])
    expect((await payment.getEarningsAnalysis('11')).total_revenue).toBe(2000)
  })
})

describe('bank accounts', () => {
  it.each([
    ['getStudentBankAccounts', () => payment.getStudentBankAccounts(), 'get', '/api/payments/bank-accounts'],
    ['getAdminBankAccounts', () => payment.getAdminBankAccounts(), 'get', '/api/payments/admin/bank-accounts'],
  ] as const)('%s turns ids into strings', async (_n, call, method, url) => {
    http[method].mockReturnValue(reply([{ id: 3, bank_name: 'BOC' }]))
    expect(await call()).toEqual([{ id: '3', bank_name: 'BOC' }])
    expect(http[method]).toHaveBeenCalledWith(url)
  })

  it('creates, updates and deletes accounts', async () => {
    http.post.mockReturnValue(reply({ id: 1, bank_name: 'BOC' }))
    http.patch.mockReturnValue(reply({ id: 1, is_active: false }))
    http.delete.mockReturnValue(reply(null))
    const body = { bank_name: 'BOC', account_number: '1', account_name: 'E', branch: 'C' }

    expect((await payment.createBankAccount(body)).id).toBe('1')
    expect(http.post).toHaveBeenCalledWith('/api/payments/admin/bank-accounts', body)
    expect((await payment.updateBankAccount('1', { is_active: false })).is_active).toBe(false)
    expect(http.patch).toHaveBeenCalledWith('/api/payments/admin/bank-accounts/1', {
      is_active: false,
    })
    await payment.deleteBankAccount('1')
    expect(http.delete).toHaveBeenCalledWith('/api/payments/admin/bank-accounts/1')
  })
})
