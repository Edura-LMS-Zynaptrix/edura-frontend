jest.mock(
  'next/navigation',
  () => require('@/test-utils/navigation').navigationMock
);
jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock());
jest.mock('@/lib/api/payment');
jest.mock('@/lib/api/admin');

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as adminApi from '@/lib/api/admin';
import * as paymentApi from '@/lib/api/payment';
import AdminPaymentPage from '@/app/admin/payments/page';
import AdminBankAccountsPage from '@/app/admin/payments/bank-accounts/page';
import { httpError } from '@/test-utils/api';
import { nav } from '@/test-utils/navigation';
import { makeStore, renderWithStore } from '@/test-utils/store';

const admin = adminApi as jest.Mocked<typeof adminApi>;
const payment = paymentApi as jest.Mocked<typeof paymentApi>;

const asAdmin = () =>
  makeStore({
    auth: {
      isAuthenticated: true,
      isInitialized: true,
      user: { id: 'a1', role: 'admin' } as any,
    },
  });
const asStudent = () =>
  makeStore({
    auth: {
      isAuthenticated: true,
      isInitialized: true,
      user: { id: 's1', role: 'student' } as any,
    },
  });

beforeEach(() => {
  nav.reset();
  jest.resetAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Payment management', () => {
  const slip = (id: string, extra: any = {}) => ({
    id,
    status: 'pending',
    bank_name: 'BOC',
    item_name: `Course ${id}`,
    payment_type: 'course',
    amount: 2500,
    depositor_name: 'Kasun',
    reference_number: 'REF-1',
    deposit_date: '2026-03-01',
    created_at: '2026-03-02T10:00:00Z',
    slip_image_url: '/uploads/slip.png',
    rejection_reason: null,
    ...extra,
  });
  const courses = [
    { id: 'c1', title: 'Physics', subject: 'Physics', grade: 13 },
  ];
  const lastSlipCall = () =>
    payment.getAllBankSlips.mock.calls[
      payment.getAllBankSlips.mock.calls.length - 1
    ];

  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.edura.lk';
    admin.getCourses.mockResolvedValue(courses as any);
    payment.getAllBankSlips.mockResolvedValue([
      slip('p1'),
      slip('p2', {
        bank_name: null,
        depositor_name: null,
        item_name: null,
        payment_type: null,
        amount: null,
      }),
    ] as any);
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  });

  it('sends non-admins to their dashboard', () => {
    const { container } = renderWithStore(<AdminPaymentPage />, {
      store: asStudent(),
    });
    expect(nav.router.push).toHaveBeenCalledWith('/dashboard');
    expect(container).toBeEmptyDOMElement();
  });

  it('loads pending slips and the course filter', async () => {
    renderWithStore(<AdminPaymentPage />, { store: asAdmin() });
    expect(await screen.findByText('Course p1')).toBeInTheDocument();
    expect(payment.getAllBankSlips).toHaveBeenCalledWith('pending', undefined);
    expect(
      screen.getByRole('button', { name: 'Pending Review (2)' })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('option', { name: 'Physics (Physics - G13)' })
    ).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Pending')).toHaveClass('bg-yellow-100');
    expect(within(rows[0]).getByText('Rs. 2,500')).toBeInTheDocument();
    expect(within(rows[1]).getAllByText('—')).toHaveLength(4);
    expect(within(rows[1]).getByText('Rs. 0')).toBeInTheDocument();
  });

  it('opens the bank accounts page', async () => {
    renderWithStore(<AdminPaymentPage />, { store: asAdmin() });
    await userEvent.click(
      screen.getByRole('button', { name: /Manage Bank Accounts/ })
    );
    expect(nav.router.push).toHaveBeenCalledWith(
      '/admin/payments/bank-accounts'
    );
  });

  it('shows all submissions and filters by course', async () => {
    renderWithStore(<AdminPaymentPage />, { store: asAdmin() });
    await screen.findByText('Course p1');
    payment.getAllBankSlips.mockResolvedValue([
      slip('v1', { status: 'verified' }),
      slip('r1', { status: 'rejected' }),
    ] as any);
    await userEvent.click(
      screen.getByRole('button', { name: 'All Submissions' })
    );
    await waitFor(() => expect(lastSlipCall()).toEqual([undefined, undefined]));
    expect(await screen.findByText('Verified')).toHaveClass('bg-green-100');
    expect(screen.getByText('Rejected')).toHaveClass('bg-red-100');
    await userEvent.selectOptions(screen.getByRole('combobox'), 'c1');
    await waitFor(() => expect(lastSlipCall()).toEqual([undefined, 'c1']));
    await userEvent.click(
      screen.getByRole('button', { name: 'Clear Filters' })
    );
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue(''));
  });

  it('says when there is nothing to review', async () => {
    payment.getAllBankSlips.mockResolvedValue([]);
    renderWithStore(<AdminPaymentPage />, { store: asAdmin() });
    expect(
      await screen.findByText('No bank slips to review')
    ).toBeInTheDocument();
  });

  it('shows the load error', async () => {
    payment.getAllBankSlips.mockImplementation(() =>
      httpError(500, { detail: 'Payment service down' })
    );
    renderWithStore(<AdminPaymentPage />, { store: asAdmin() });
    expect(await screen.findByText('Payment service down')).toBeInTheDocument();
  });

  it('keeps working when the course list fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    admin.getCourses.mockImplementation(() => httpError(500));
    renderWithStore(<AdminPaymentPage />, { store: asAdmin() });
    expect(await screen.findByText('Course p1')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  describe('reviewing a slip', () => {
    const open = async (s = slip('p1')) => {
      payment.getAllBankSlips.mockResolvedValue([s] as any);
      renderWithStore(<AdminPaymentPage />, { store: asAdmin() });
      await userEvent.click(
        await screen.findByRole('button', { name: 'Review' })
      );
    };

    it('shows the slip details with the image from the API host', async () => {
      await open();
      expect(screen.getByText('Bank Slip Review')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Bank slip' })).toHaveAttribute(
        'src',
        'https://api.edura.lk/uploads/slip.png'
      );
      expect(screen.getByText('REF-1')).toBeInTheDocument();
      expect(screen.getByText('Depositor:')).toBeInTheDocument();
    });

    it('uses absolute image urls as they are', async () => {
      await open(slip('p1', { slip_image_url: 'https://cdn/slip.png' }));
      expect(screen.getByRole('img', { name: 'Bank slip' })).toHaveAttribute(
        'src',
        'https://cdn/slip.png'
      );
    });

    it('shows no image without an API url configured', async () => {
      const err = jest.spyOn(console, 'error').mockImplementation(() => {});
      delete process.env.NEXT_PUBLIC_API_URL;
      await open();
      expect(
        screen.getByRole('img', { name: 'Bank slip' })
      ).not.toHaveAttribute('src');
      expect(err).toHaveBeenCalledWith('NEXT_PUBLIC_API_URL is not configured');
    });

    it('approves a slip', async () => {
      payment.verifyBankSlip.mockResolvedValue(
        slip('p1', { status: 'verified' }) as any
      );
      await open();
      await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
      expect(payment.verifyBankSlip).toHaveBeenCalledWith('p1', {
        status: 'verified',
      });
      await waitFor(() =>
        expect(screen.queryByText('Bank Slip Review')).not.toBeInTheDocument()
      );
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('needs a reason to reject', async () => {
      await open();
      await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
      expect(
        screen.getAllByText('Please provide a rejection reason').length
      ).toBeGreaterThan(0);
      expect(payment.verifyBankSlip).not.toHaveBeenCalled();
    });

    it('rejects with the reason', async () => {
      payment.verifyBankSlip.mockResolvedValue(
        slip('p1', { status: 'rejected', rejection_reason: 'Blurry' }) as any
      );
      await open();
      await userEvent.type(
        screen.getByPlaceholderText('Provide reason if rejecting...'),
        'Blurry'
      );
      await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
      expect(payment.verifyBankSlip).toHaveBeenCalledWith('p1', {
        status: 'rejected',
        rejection_reason: 'Blurry',
      });
      expect(await screen.findByText('Rejected')).toBeInTheDocument();
    });

    it('shows a failed approval', async () => {
      payment.verifyBankSlip.mockImplementation(() =>
        httpError(409, { detail: 'Already processed' })
      );
      await open();
      await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
      // Shown in the review and, behind it, in place of the slip list.
      await waitFor(() =>
        expect(screen.getAllByText('Already processed')).toHaveLength(2)
      );
    });

    it('shows the rejection reason and no actions for processed slips', async () => {
      await open(
        slip('r1', { status: 'rejected', rejection_reason: 'Amount mismatch' })
      );
      expect(screen.getByText('Amount mismatch')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Approve' })
      ).not.toBeInTheDocument();
    });

    it('closes the review', async () => {
      await open();
      const close = within(
        screen.getByText('Bank Slip Review').parentElement!
      ).getByRole('button');
      await userEvent.click(close);
      expect(screen.queryByText('Bank Slip Review')).not.toBeInTheDocument();
    });
  });

  describe('earnings', () => {
    const analysis = {
      updated_at: '2026-03-01T10:00:00Z',
      total_revenue: 125000,
      total_enrollments: 48,
      by_item: [
        {
          item_type: 'course',
          item_id: 'c1',
          item_title: 'Physics',
          item_grade: 13,
          enrollment_count: 40,
          total_revenue: 100000,
        },
        {
          item_type: 'class_package',
          item_id: 'p1',
          item_title: 'A/L Package',
          item_grade: null,
          enrollment_count: 8,
          total_revenue: 25000,
        },
      ],
    };

    it('shows the global revenue summary', async () => {
      payment.getEarningsAnalysis.mockResolvedValue(analysis as any);
      renderWithStore(<AdminPaymentPage />, { store: asAdmin() });
      await userEvent.click(
        screen.getByRole('button', { name: 'Earnings Analysis' })
      );
      expect(
        await screen.findByText('Global Revenue Summary')
      ).toBeInTheDocument();
      expect(payment.getEarningsAnalysis).toHaveBeenCalledWith(undefined);
      expect(screen.getByText('Rs. 125,000')).toBeInTheDocument();
      expect(screen.getByText('48')).toBeInTheDocument();
      expect(screen.getByText('course')).toHaveClass('bg-blue-100');
      expect(screen.getByText('class_package')).toHaveClass('bg-gray-100');
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('breaks earnings down for one course', async () => {
      payment.getEarningsAnalysis.mockResolvedValue(analysis as any);
      renderWithStore(<AdminPaymentPage />, { store: asAdmin() });
      await screen.findByRole('option', { name: /Physics/ });
      await userEvent.click(
        screen.getByRole('button', { name: 'Earnings Analysis' })
      );
      await userEvent.selectOptions(screen.getByRole('combobox'), 'c1');
      expect(
        await screen.findByText('Course-Specific Breakdown')
      ).toBeInTheDocument();
      expect(payment.getEarningsAnalysis).toHaveBeenLastCalledWith('c1');
    });

    it('says when there is no analysis', async () => {
      payment.getEarningsAnalysis.mockResolvedValue(null as any);
      renderWithStore(<AdminPaymentPage />, { store: asAdmin() });
      await userEvent.click(
        screen.getByRole('button', { name: 'Earnings Analysis' })
      );
      expect(
        await screen.findByText(
          'No analysis data available for current selection'
        )
      ).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Bank accounts', () => {
  const account = (id: string, extra: any = {}) => ({
    id,
    bank_name: `Bank ${id}`,
    account_number: `000${id}`,
    account_name: 'Edura (Pvt) Ltd',
    branch: 'Colombo',
    is_active: true,
    order_number: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...extra,
  });

  beforeEach(() => {
    payment.getAdminBankAccounts.mockResolvedValue([
      account('1'),
      account('2', { is_active: false, order_number: 1 }),
    ] as any);
  });

  it('sends non-admins to their dashboard', () => {
    renderWithStore(<AdminBankAccountsPage />, { store: asStudent() });
    expect(nav.router.push).toHaveBeenCalledWith('/dashboard');
    expect(payment.getAdminBankAccounts).not.toHaveBeenCalled();
  });

  it('lists every account, active or not', async () => {
    renderWithStore(<AdminBankAccountsPage />, { store: asAdmin() });
    expect(await screen.findByText('Bank 1')).toBeInTheDocument();
    expect(payment.getAdminBankAccounts).toHaveBeenCalled();
    expect(screen.getByText('0002')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByTitle('Deactivate')).toBeInTheDocument();
    expect(screen.getByTitle('Activate')).toBeInTheDocument();
  });

  it('shows a loader, then an empty state that opens the form', async () => {
    let resolve!: (v: any) => void;
    payment.getAdminBankAccounts.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    renderWithStore(<AdminBankAccountsPage />, { store: asAdmin() });
    expect(screen.getByText('Loading bank accounts...')).toBeInTheDocument();
    resolve([]);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Add Account Now →' })
    );
    expect(
      screen.getByRole('heading', { name: 'New Bank Account' })
    ).toBeInTheDocument();
  });

  it('adds an account with a live preview', async () => {
    payment.createBankAccount.mockResolvedValue(
      account('3', { bank_name: 'HNB' }) as any
    );
    renderWithStore(<AdminBankAccountsPage />, { store: asAdmin() });
    await userEvent.click(
      await screen.findByRole('button', { name: /Add New Account/ })
    );
    expect(screen.getByText('Your Bank Name')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(2); // next display order
    await userEvent.type(
      screen.getByPlaceholderText('e.g. Commercial Bank'),
      'HNB'
    );
    expect(screen.getAllByText('HNB')[0]).toBeInTheDocument();
    await userEvent.type(
      screen.getByPlaceholderText('e.g. 1234 5678 90'),
      '9999'
    );
    await userEvent.type(
      screen.getByPlaceholderText('e.g. Edura (Pvt) Ltd'),
      'Edura'
    );
    await userEvent.type(
      screen.getByPlaceholderText('e.g. City Office'),
      'Kandy'
    );
    await userEvent.click(screen.getByLabelText(/Activate this account/));
    await userEvent.click(screen.getByRole('button', { name: 'Save Account' }));
    expect(payment.createBankAccount).toHaveBeenCalledWith({
      bank_name: 'HNB',
      account_number: '9999',
      account_name: 'Edura',
      branch: 'Kandy',
      is_active: false,
      order_number: 2,
    });
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'New Bank Account' })
      ).not.toBeInTheDocument()
    );
  });

  it('edits an account', async () => {
    payment.updateBankAccount.mockResolvedValue(
      account('1', { branch: 'Galle' }) as any
    );
    renderWithStore(<AdminBankAccountsPage />, { store: asAdmin() });
    await userEvent.click((await screen.findAllByTitle('Edit Account'))[0]);
    expect(
      screen.getByRole('heading', { name: 'Edit Bank Account' })
    ).toBeInTheDocument();
    const branch = screen.getByDisplayValue('Colombo');
    await userEvent.clear(branch);
    await userEvent.type(branch, 'Galle');
    await userEvent.click(
      screen.getByRole('button', { name: 'Update Account' })
    );
    expect(payment.updateBankAccount).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ branch: 'Galle', bank_name: 'Bank 1' })
    );
    expect(await screen.findByText('Galle')).toBeInTheDocument();
  });

  it('toggles an account on and off', async () => {
    payment.updateBankAccount.mockResolvedValue(
      account('1', { is_active: false }) as any
    );
    renderWithStore(<AdminBankAccountsPage />, { store: asAdmin() });
    await userEvent.click(await screen.findByTitle('Deactivate'));
    expect(payment.updateBankAccount).toHaveBeenCalledWith('1', {
      is_active: false,
    });
    await waitFor(() =>
      expect(screen.getAllByText('Inactive')).toHaveLength(2)
    );
  });

  it('deletes only after confirming', async () => {
    const confirm = jest
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    payment.deleteBankAccount.mockResolvedValue(undefined as any);
    renderWithStore(<AdminBankAccountsPage />, { store: asAdmin() });
    await userEvent.click((await screen.findAllByTitle('Delete Account'))[0]);
    expect(payment.deleteBankAccount).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByTitle('Delete Account')[0]);
    expect(payment.deleteBankAccount).toHaveBeenCalledWith('1');
    await waitFor(() =>
      expect(screen.queryByText('Bank 1')).not.toBeInTheDocument()
    );
    confirm.mockRestore();
  });

  it('cancel closes the form', async () => {
    renderWithStore(<AdminBankAccountsPage />, { store: asAdmin() });
    await userEvent.click(
      await screen.findByRole('button', { name: /Add New Account/ })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('heading', { name: 'New Bank Account' })
    ).not.toBeInTheDocument();
  });

  it('shows the load error', async () => {
    payment.getAdminBankAccounts.mockImplementation(() =>
      httpError(500, { detail: 'Cannot load accounts' })
    );
    renderWithStore(<AdminBankAccountsPage />, { store: asAdmin() });
    expect(await screen.findByText('Cannot load accounts')).toBeInTheDocument();
  });

  // Bug: create/update/delete have no rejected reducers, so a failed save
  // leaves the form open with no message at all.
  test.failing('explains why saving an account failed', async () => {
    payment.createBankAccount.mockImplementation(() =>
      httpError(400, { detail: 'Account number already exists' })
    );
    renderWithStore(<AdminBankAccountsPage />, { store: asAdmin() });
    await userEvent.click(
      await screen.findByRole('button', { name: /Add New Account/ })
    );
    await userEvent.type(
      screen.getByPlaceholderText('e.g. Commercial Bank'),
      'HNB'
    );
    await userEvent.type(
      screen.getByPlaceholderText('e.g. 1234 5678 90'),
      '0001'
    );
    await userEvent.type(
      screen.getByPlaceholderText('e.g. Edura (Pvt) Ltd'),
      'Edura'
    );
    await userEvent.type(
      screen.getByPlaceholderText('e.g. City Office'),
      'Kandy'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save Account' }));
    expect(
      await screen.findByText('Account number already exists')
    ).toBeInTheDocument();
  });
});
