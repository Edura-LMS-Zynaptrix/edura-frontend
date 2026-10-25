jest.mock('next/navigation', () => require('@/test-utils/navigation').navigationMock)
jest.mock('@/lib/api/payment')

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as paymentApi from '@/lib/api/payment'
import BankSlipUploadPage from '@/app/payment/bank-slip/page'
import PaymentCancelPage from '@/app/payment/cancel/page'
import PaymentPage from '@/app/payment/page'
import PayHerePage from '@/app/payment/payhere/page'
import PaymentSuccessPage from '@/app/payment/success/page'
import { nav } from '@/test-utils/navigation'
import { makeStore, renderWithStore } from '@/test-utils/store'

const payment = paymentApi as jest.Mocked<typeof paymentApi>
const accounts = [
  { id: 'b1', bank_name: 'BOC', account_number: '111', account_name: 'Edura', branch: 'Colombo', is_active: true, order_number: 1, created_at: '' },
  { id: 'b2', bank_name: 'HNB', account_number: '222', account_name: 'Edura', branch: 'Kandy', is_active: true, order_number: 2, created_at: '' },
]
const signedIn = (extra: any = {}) =>
  makeStore({ auth: { isAuthenticated: true, isInitialized: true, user: { id: '7', role: 'student' } as any }, ...extra })

beforeEach(() => {
  nav.reset()
  jest.resetAllMocks()
  payment.getStudentBankAccounts.mockResolvedValue(accounts)
})

describe('Payment page', () => {
  it('sends visitors to log in, back to this page', () => {
    nav.setSearch({ type: 'course', id: '10' })
    window.history.pushState({}, '', '/payment?type=course&id=10')
    renderWithStore(<PaymentPage />, { store: makeStore({ auth: { isInitialized: true } }) })
    expect(nav.router.push).toHaveBeenCalledWith('/login?callbackUrl=%2Fpayment%3Ftype%3Dcourse%26id%3D10')
  })

  it('needs a payment type and item', () => {
    renderWithStore(<PaymentPage />, { store: signedIn() })
    expect(screen.getByText('Invalid payment parameters')).toBeInTheDocument()
  })

  it('summarises the item and lists deposit banks, selecting the first', async () => {
    nav.setSearch({ type: 'course', id: '10', name: 'Maths', amount: '1500' })
    renderWithStore(<PaymentPage />, { store: signedIn() })
    expect(screen.getByText('Course:')).toBeInTheDocument()
    expect(screen.getByText('Maths')).toBeInTheDocument()
    expect(screen.getByText('LKR 1500')).toBeInTheDocument()
    expect(await screen.findByText('BOC')).toBeInTheDocument()
    expect(screen.getByText('222')).toBeInTheDocument()
  })

  it('starts a bank-slip payment with the chosen bank', async () => {
    nav.setSearch({ type: 'course', id: '10', name: 'Maths', amount: '1500' })
    payment.initiatePayment.mockResolvedValue({ id: 'pending-1' } as any)
    renderWithStore(<PaymentPage />, { store: signedIn() })
    await userEvent.click(await screen.findByText('HNB'))
    await userEvent.click(screen.getByRole('button', { name: 'Continue to Payment' }))
    expect(payment.initiatePayment).toHaveBeenCalledWith({
      payment_type: 'course',
      payment_method: 'bank_slip',
      course_id: '10',
    })
    await waitFor(() => expect(nav.router.push).toHaveBeenCalledWith('/payment/bank-slip?payment_id=pending-1&bank_id=b2'))
  })

  it.each([
    ['sub_course', 'Exam Module', 'sub_course_id'],
    ['module', 'Video Module', 'module_id'],
    ['class_package', 'Class Package', 'class_package_id'],
    ['exam', 'Exam', 'exam_id'],
  ])('labels and sends a %s purchase', async (type, label, field) => {
    nav.setSearch({ type, id: '5' })
    payment.initiatePayment.mockRejectedValue(new Error('Only whole-course payments are supported by the Edura backend today.'))
    renderWithStore(<PaymentPage />, { store: signedIn() })
    expect(screen.getByText(`${label}:`)).toBeInTheDocument()
    expect(screen.getByText('Loading...')).toBeInTheDocument() // no name given
    expect(screen.getByText('LKR 0')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Continue to Payment' }))
    expect(payment.initiatePayment.mock.calls[0][0]).toMatchObject({ payment_type: type, [field]: '5' })
    expect(await screen.findByText(/Only whole-course payments/)).toBeInTheDocument()
  })

  it('waits for bank accounts and lets the student go back', async () => {
    nav.setSearch({ type: 'course', id: '10' })
    payment.getStudentBankAccounts.mockReturnValue(new Promise(() => {}))
    renderWithStore(<PaymentPage />, { store: signedIn() })
    expect(screen.getByText('Finding available bank accounts...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(nav.router.back).toHaveBeenCalled()
  })

  it('shows a server error from a failed bank-account load', async () => {
    payment.getStudentBankAccounts.mockRejectedValue(new Error('Bank list unavailable'))
    renderWithStore(<PaymentPage />, { store: signedIn() })
    expect(await screen.findByText('Bank list unavailable')).toBeInTheDocument()
  })
})

describe('PayHere page', () => {
  const config = {
    merchant_id: 'M1',
    return_url: '/payment/success',
    cancel_url: '/payment/cancel',
    notify_url: '',
    order_id: 'ORD-9',
    items: 'Course Payment',
    currency: 'LKR',
    amount: '2500',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Sri Lanka',
    hash: 'H',
    sandbox: true,
  }

  afterEach(() => {
    delete (window as any).payhere
    document.querySelectorAll('script[src*="payhere"]').forEach((s) => s.remove())
  })

  it('needs a payment id', () => {
    renderWithStore(<PayHerePage />)
    expect(screen.getByText('Payment ID is required')).toBeInTheDocument()
  })

  it('loads the checkout and adds the PayHere script', async () => {
    nav.setSearch({ payment_id: 'ORD-9' })
    payment.getPayHereConfig.mockResolvedValue(config)
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    renderWithStore(<PayHerePage />)

    expect(screen.getByText('Preparing secure payment gateway...')).toBeInTheDocument()
    await waitFor(() =>
      expect(document.querySelector('script[src="https://www.payhere.lk/lib/payhere.js"]')).not.toBeNull()
    )
    expect(payment.getPayHereConfig).toHaveBeenCalledWith('ORD-9')
    const script = document.querySelector('script[src*="payhere"]') as HTMLScriptElement
    script.onload!(new Event('load'))
    script.onerror!(new Event('error'))
    expect(log).toHaveBeenCalledWith('PayHere script loaded')
    expect(error).toHaveBeenCalledWith('Failed to load payment gateway')
    log.mockRestore()
    error.mockRestore()
  })

  it('does not add the script when the checkout cannot be loaded', async () => {
    nav.setSearch({ payment_id: 'nope' })
    payment.getPayHereConfig.mockRejectedValue(new Error('not initiated'))
    renderWithStore(<PayHerePage />)
    await waitFor(() => expect(payment.getPayHereConfig).toHaveBeenCalledWith('nope'))
    expect(document.querySelector('script[src*="payhere"]')).toBeNull()
  })

  // BUG: localLoading starts true and is only cleared when payment_id is
  // missing, so with a real payment the page never leaves the loader: the
  // "Ready to Pay" screen (and the error screen) can't be reached.
  test.failing('shows the ready-to-pay screen once the checkout has loaded', async () => {
    nav.setSearch({ payment_id: 'ORD-9' })
    payment.getPayHereConfig.mockResolvedValue(config)
    renderWithStore(<PayHerePage />)
    expect(await screen.findByRole('heading', { name: 'Ready to Pay' }, { timeout: 500 })).toBeInTheDocument()
  })

  test.failing('shows a failed checkout setup', async () => {
    nav.setSearch({ payment_id: 'nope' })
    payment.getPayHereConfig.mockRejectedValue(new Error('PayHere checkout was not initiated for this payment.'))
    renderWithStore(<PayHerePage />)
    expect(await screen.findByText('Payment Setup Failed', undefined, { timeout: 500 })).toBeInTheDocument()
  })
})

describe('Bank slip page', () => {
  const png = () => new File(['x'], 'slip.png', { type: 'image/png' })

  beforeEach(() => {
    ;(URL as any).createObjectURL = jest.fn(() => 'blob:preview')
  })

  it('shows the chosen bank and uploads the slip with the details', async () => {
    nav.setSearch({ payment_id: 'pending-1', bank_id: 'b2' })
    payment.uploadBankSlip.mockResolvedValue({ id: '5' } as any)
    const { container } = renderWithStore(<BankSlipUploadPage />)
    expect(await screen.findByText('Selected Bank for Deposit')).toBeInTheDocument()
    expect(screen.getByLabelText('Bank Name (Optional)')).toHaveValue('HNB')

    const submit = screen.getByRole('button', { name: 'Submit for Verification' })
    expect(submit).toBeDisabled()
    const user = userEvent.setup()
    await user.upload(container.querySelector('#slip-upload') as HTMLInputElement, png())
    expect(screen.getByRole('img', { name: 'Bank slip preview' })).toHaveAttribute('src', 'blob:preview')
    await user.type(screen.getByLabelText('Depositor Name (Optional)'), 'Ama')
    await user.type(screen.getByLabelText('Reference/Transaction Number (Optional)'), 'REF1')
    fireEvent.change(screen.getByLabelText('Deposit Date (Optional)'), { target: { value: '2026-10-20' } })
    await user.click(submit)

    expect(payment.uploadBankSlip).toHaveBeenCalledWith({
      payment_id: 'pending-1',
      slip_image: expect.any(File),
      bank_name: 'HNB',
      depositor_name: 'Ama',
      deposit_date: '2026-10-20',
      reference_number: 'REF1',
    })
    expect(await screen.findByRole('heading', { name: 'Bank Slip Uploaded!' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to Dashboard' }))
    expect(nav.router.push).toHaveBeenCalledWith('/dashboard')
  })

  it.each([
    [new File(['x'], 'slip.pdf', { type: 'application/pdf' }), 'Please select an image file'],
    [Object.defineProperty(new File(['x'], 'big.png', { type: 'image/png' }), 'size', { value: 6 * 1024 * 1024 }), 'Image size must be less than 5MB'],
  ])('rejects an unsuitable file (%#)', (file, message) => {
    nav.setSearch({ payment_id: 'p' })
    const { container } = renderWithStore(<BankSlipUploadPage />)
    fireEvent.change(container.querySelector('#slip-upload')!, { target: { files: [file] } })
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it('lets the student remove the chosen image', async () => {
    nav.setSearch({ payment_id: 'p' })
    const { container } = renderWithStore(<BankSlipUploadPage />)
    await userEvent.upload(container.querySelector('#slip-upload') as HTMLInputElement, png())
    expect(screen.getByText('Change Image')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('img').parentElement!.querySelector('button')!)
    expect(screen.getByText('Select Image')).toBeInTheDocument()
  })

  it('needs a payment id before uploading', async () => {
    const { container } = renderWithStore(<BankSlipUploadPage />)
    await userEvent.upload(container.querySelector('#slip-upload') as HTMLInputElement, png())
    await userEvent.click(screen.getByRole('button', { name: 'Submit for Verification' }))
    expect(screen.getByText('Payment ID is missing')).toBeInTheDocument()
    expect(payment.uploadBankSlip).not.toHaveBeenCalled()
  })

  it('needs an image before uploading', () => {
    nav.setSearch({ payment_id: 'p' })
    const { container } = renderWithStore(<BankSlipUploadPage />)
    fireEvent.submit(container.querySelector('form')!)
    expect(screen.getByText('Please select a bank slip image')).toBeInTheDocument()
  })

  it('shows an upload error, e.g. after a page refresh lost the pending payment', async () => {
    nav.setSearch({ payment_id: 'pending-1' })
    payment.uploadBankSlip.mockRejectedValue(new Error('This bank-slip payment was not initiated correctly.'))
    const { container } = renderWithStore(<BankSlipUploadPage />)
    await userEvent.upload(container.querySelector('#slip-upload') as HTMLInputElement, png())
    await userEvent.click(screen.getByRole('button', { name: 'Submit for Verification' }))
    expect(await screen.findAllByText('This bank-slip payment was not initiated correctly.')).not.toHaveLength(0)
  })

  it('shows placeholder bank details until the list loads, and does not refetch a loaded list', () => {
    nav.setSearch({ payment_id: 'p', bank_id: 'b9' })
    renderWithStore(<BankSlipUploadPage />, { store: makeStore({ payment: { bankAccounts: accounts } }) })
    expect(screen.getByText('Bank Details for Deposit')).toBeInTheDocument()
    expect(payment.getStudentBankAccounts).not.toHaveBeenCalled()
  })

  it('goes back on cancel', async () => {
    renderWithStore(<BankSlipUploadPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(nav.router.back).toHaveBeenCalled()
  })
})

describe('Payment result pages', () => {
  it.each([
    ['success', PaymentSuccessPage, 'Payment Successful!'],
    ['cancel', PaymentCancelPage, 'Payment Cancelled'],
  ] as const)('the %s page links back to the dashboard and courses', async (_n, Page, heading) => {
    render(<Page />)
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Go to Dashboard' }))
    await userEvent.click(screen.getByRole('button', { name: 'Browse Courses' }))
    expect(nav.router.push.mock.calls).toEqual([['/dashboard'], ['/student/courses']])
  })
})
