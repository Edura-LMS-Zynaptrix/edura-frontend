jest.mock(
  'next/navigation',
  () => require('@/test-utils/navigation').navigationMock
);
jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock());
jest.mock('@/lib/api/auth');
jest.mock('@/lib/api/admin');

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as adminApi from '@/lib/api/admin';
import * as authApi from '@/lib/api/auth';
import AdminDashboard from '@/app/admin/dashboard/page';
import AdminAnalyticsPage from '@/app/admin/analytics/page';
import AdminRankingsPage from '@/app/admin/rankings/page';
import AdminSettingsPage from '@/app/admin/settings/page';
import { httpError } from '@/test-utils/api';
import { nav } from '@/test-utils/navigation';
import { makeStore, renderWithStore } from '@/test-utils/store';

const admin = adminApi as jest.Mocked<typeof adminApi>;
const auth = authApi as jest.Mocked<typeof authApi>;

const adminUser = {
  id: 'a1',
  email: 'admin@edura.lk',
  role: 'admin',
  is_active: true,
  profile: { full_name: 'Nimal Silva' },
};
const asAdmin = (extra: any = {}) =>
  makeStore({
    auth: {
      isAuthenticated: true,
      isInitialized: true,
      user: adminUser as any,
    },
    ...extra,
  });
const asStudent = () =>
  makeStore({
    auth: {
      isAuthenticated: true,
      isInitialized: true,
      user: { id: 's1', role: 'student' } as any,
    },
  });

const stats = {
  total_students: 1520,
  total_courses: 14,
  total_exams: 210,
  total_exam_attempts: 8800,
  revenue_this_month: 45000,
  total_revenue: 1250000,
  pending_bank_slips: 3,
  recent_activity: [
    {
      type: 'student',
      title: 'New student',
      subtitle: 'kasun@example.com',
      timestamp: new Date().toISOString(),
    },
    {
      type: 'payment',
      title: 'Payment received',
      subtitle: 'LKR 2,500',
      timestamp: new Date().toISOString(),
    },
    {
      type: 'mystery',
      title: 'Something else',
      subtitle: '',
      timestamp: new Date().toISOString(),
    },
  ],
};

beforeEach(() => {
  nav.reset();
  jest.resetAllMocks();
  admin.getAdminStats.mockResolvedValue(stats as any);
});

describe('Admin dashboard', () => {
  it('sends visitors to log in', () => {
    nav.pathname = '/admin/dashboard';
    renderWithStore(<AdminDashboard />, {
      store: makeStore({ auth: { isInitialized: true } }),
    });
    expect(nav.router.push).toHaveBeenCalledWith(
      '/login?callbackUrl=%2Fadmin%2Fdashboard'
    );
  });

  it('fetches the user when signed in without one', () => {
    auth.getCurrentUser.mockReturnValue(new Promise(() => {}));
    renderWithStore(<AdminDashboard />, {
      store: makeStore({
        auth: { isAuthenticated: true, isInitialized: true },
      }),
    });
    expect(auth.getCurrentUser).toHaveBeenCalled();
    expect(screen.getByText('Loading admin dashboard...')).toBeInTheDocument();
  });

  it('sends non-admins home without loading stats', () => {
    renderWithStore(<AdminDashboard />, { store: asStudent() });
    expect(nav.router.push).toHaveBeenCalledWith('/');
    expect(admin.getAdminStats).not.toHaveBeenCalled();
  });

  it('greets the admin and shows the stat cards', async () => {
    renderWithStore(<AdminDashboard />, { store: asAdmin() });
    expect(screen.getByText('Welcome back, Nimal! 👋')).toBeInTheDocument();
    expect(await screen.findByText('1,520')).toBeInTheDocument();
    expect(screen.getByText('14 active courses')).toBeInTheDocument();
    expect(screen.getByText('210')).toBeInTheDocument();
    expect(screen.getByText('8,800 attempts total')).toBeInTheDocument();
    expect(screen.getByText('Rs 45.0K')).toBeInTheDocument();
    expect(screen.getByText('Total: Rs 1.3M')).toBeInTheDocument();
    expect(screen.getByText('Pending Payments').closest('a')).toHaveAttribute(
      'href',
      '/admin/payments'
    );
  });

  it('highlights pending bank slips', async () => {
    renderWithStore(<AdminDashboard />, { store: asAdmin() });
    expect(
      await screen.findByRole('link', { name: /3 payments need review/ })
    ).toHaveAttribute('href', '/admin/payments');
    const payments = screen.getByRole('link', {
      name: /Verify and manage bank slips/,
    });
    expect(within(payments).getByText('3')).toBeInTheDocument();
  });

  it('uses the singular for one pending slip and hides the banner for none', async () => {
    admin.getAdminStats.mockResolvedValueOnce({
      ...stats,
      pending_bank_slips: 1,
    } as any);
    const { unmount } = renderWithStore(<AdminDashboard />, {
      store: asAdmin(),
    });
    expect(
      await screen.findByText(/1 payment need review/)
    ).toBeInTheDocument();
    unmount();
    admin.getAdminStats.mockResolvedValueOnce({
      ...stats,
      pending_bank_slips: 0,
    } as any);
    renderWithStore(<AdminDashboard />, { store: asAdmin() });
    await screen.findByText('1,520');
    expect(screen.queryByText(/need review/)).not.toBeInTheDocument();
  });

  it('links every quick action', () => {
    renderWithStore(<AdminDashboard />, { store: asAdmin() });
    for (const [name, href] of [
      ['Subjects & Streams', '/admin/streams'],
      ['Courses & Exams', '/admin/courses'],
      ['Manage Students', '/admin/students'],
      ['Manage Admins', '/admin/admins'],
      ['Analytics', '/admin/analytics'],
      ['Rankings', '/admin/rankings'],
      ['Messages', '/admin/messages'],
      ['Settings', '/admin/settings'],
    ]) {
      expect(
        screen.getByRole('link', { name: new RegExp(name) })
      ).toHaveAttribute('href', href);
    }
  });

  it('lists recent activity', async () => {
    renderWithStore(<AdminDashboard />, { store: asAdmin() });
    expect(await screen.findByText('New student')).toBeInTheDocument();
    expect(screen.getByText('Payment received')).toBeInTheDocument();
    expect(screen.getByText('Something else')).toBeInTheDocument(); // unknown types fall back to the student icon
  });

  it('shows placeholders while loading and an empty activity message', async () => {
    let resolve!: (v: any) => void;
    admin.getAdminStats.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    const { container } = renderWithStore(<AdminDashboard />, {
      store: asAdmin(),
    });
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(
      4
    );
    resolve({ ...stats, recent_activity: [] });
    expect(
      await screen.findByText('No recent activity yet.')
    ).toBeInTheDocument();
  });
});

describe('Admin analytics', () => {
  const analytics = {
    revenue_by_month: [1, 2, 3, 4, 5, 6, 7].map((month) => ({
      month,
      revenue: month * 1000,
    })),
    attempts_by_month: [{ month: 12, count: 40 }],
    students_by_grade: [
      { grade: 10, count: 50 },
      { grade: 11, count: 100 },
    ],
    enrollments_by_subject: [{ subject: 'Physics', count: 30 }],
    top_exams: [
      {
        exam_id: 'e1',
        title: 'Paper 1',
        grade: 13,
        subject: 'Physics',
        attempt_count: 120,
        avg_score: 64,
      },
      {
        exam_id: 'e2',
        title: 'Paper 2',
        grade: null,
        subject: 'Maths',
        attempt_count: 80,
        avg_score: 70,
      },
    ],
    students_by_district: [
      { district: 'Colombo', count: 70 },
      { district: 'Kandy', count: 35 },
    ],
  };

  it('sends non-admins home', () => {
    renderWithStore(<AdminAnalyticsPage />, { store: asStudent() });
    expect(nav.router.push).toHaveBeenCalledWith('/');
    expect(admin.getAdminAnalytics).not.toHaveBeenCalled();
  });

  it('loads analytics and stats and fills every panel', async () => {
    admin.getAdminAnalytics.mockResolvedValue(analytics as any);
    renderWithStore(<AdminAnalyticsPage />, { store: asAdmin() });
    expect(await screen.findByText('Paper 1')).toBeInTheDocument();
    expect(admin.getAdminStats).toHaveBeenCalled();
    expect(screen.getByText('1,520')).toBeInTheDocument();
    expect(screen.getByText('Rs 1.3M')).toBeInTheDocument();
    expect(screen.getByText('This month: Rs 45.0K')).toBeInTheDocument();
    // Only the last six months are charted.
    expect(screen.queryByText('Jan')).not.toBeInTheDocument();
    expect(screen.getByText('Jul')).toBeInTheDocument();
    expect(screen.getByText('Rs 7.0K')).toBeInTheDocument();
    expect(screen.getByText('Dec')).toBeInTheDocument();
    expect(screen.getByText('Grade 11')).toBeInTheDocument();
    expect(screen.getByText('Grade 13 · Physics')).toBeInTheDocument();
    expect(screen.getByText('Maths')).toBeInTheDocument();
    expect(screen.getByText('64% avg')).toBeInTheDocument();
    const colombo = screen.getByText('Colombo').parentElement!;
    expect(
      (colombo.querySelector('.bg-orange-400') as HTMLElement).style.width
    ).toBe('100%');
    const kandy = screen.getByText('Kandy').parentElement!;
    expect(
      (kandy.querySelector('.bg-orange-400') as HTMLElement).style.width
    ).toBe('50%');
  });

  it('shows empty states', async () => {
    admin.getAdminAnalytics.mockResolvedValue({
      revenue_by_month: [],
      attempts_by_month: [],
      students_by_grade: [],
      enrollments_by_subject: [],
      top_exams: [],
      students_by_district: [],
    } as any);
    renderWithStore(<AdminAnalyticsPage />, { store: asAdmin() });
    expect(await screen.findByText('No revenue data yet')).toBeInTheDocument();
    expect(screen.getByText('No attempt data yet')).toBeInTheDocument();
    expect(screen.getByText('No enrollment data yet')).toBeInTheDocument();
    expect(screen.getByText('No exam data yet')).toBeInTheDocument();
    expect(screen.getAllByText('No data yet')).toHaveLength(2);
  });

  it('shows placeholders while loading', () => {
    admin.getAdminAnalytics.mockReturnValue(new Promise(() => {}));
    renderWithStore(<AdminAnalyticsPage />, { store: asAdmin() });
    expect(screen.getAllByText('—')).toHaveLength(4);
  });

  it('shows the load error', async () => {
    admin.getAdminAnalytics.mockImplementation(() =>
      httpError(500, { detail: 'Analytics unavailable' })
    );
    renderWithStore(<AdminAnalyticsPage />, { store: asAdmin() });
    expect(
      await screen.findByText('Analytics unavailable')
    ).toBeInTheDocument();
  });
});

describe('Admin rankings', () => {
  const exams = [
    {
      exam_id: 'e1',
      exam_title: 'Physics P1',
      subject: 'Physics',
      course_title: 'A/L Physics',
    },
    {
      exam_id: 'e2',
      exam_title: 'Chem P1',
      subject: 'Chemistry',
      course_title: 'A/L Chem',
    },
  ];
  const row = (rank: number, extra: any = {}) => ({
    user_id: `u${rank}`,
    island_rank: rank,
    district_rank: rank,
    full_name: `Student ${rank}`,
    school: 'Royal',
    grade: 13,
    district: 'Colombo',
    score_pct: 100 - rank * 15,
    total_marks: 40 - rank,
    total_questions: 40,
    time_taken_seconds: 125,
    attempt_count: 2,
    ...extra,
  });

  it('sends non-admins home', () => {
    renderWithStore(<AdminRankingsPage />, { store: asStudent() });
    expect(nav.router.push).toHaveBeenCalledWith('/');
  });

  it('loads the exam list first and asks for an exam', async () => {
    admin.getAdminRankings.mockResolvedValue({ exams, rankings: [] } as any);
    renderWithStore(<AdminRankingsPage />, { store: asAdmin() });
    expect(
      await screen.findByText(
        'Select an exam from the dropdown above to view its rankings.'
      )
    ).toBeInTheDocument();
    expect(admin.getAdminRankings).toHaveBeenCalledWith({ limit: 100 });
    const [group] = screen.getAllByRole('combobox');
    expect(
      within(group)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['All Courses', 'Chemistry - A/L Chem', 'Physics - A/L Physics']);
  });

  it('loads the leaderboard for an exam and district', async () => {
    admin.getAdminRankings
      .mockResolvedValueOnce({ exams, rankings: [] } as any)
      .mockResolvedValue({
        exams,
        rankings: [row(1), row(2), row(4, { score_pct: 30 })],
      } as any);
    renderWithStore(<AdminRankingsPage />, { store: asAdmin() });
    const [group, exam, district] = await screen.findAllByRole('combobox');
    await waitFor(() =>
      expect(within(exam).getAllByRole('option')).toHaveLength(3)
    );
    await userEvent.selectOptions(group, 'Physics - A/L Physics');
    expect(
      within(exam)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['-- Select an Exam --', 'Physics P1']);
    await userEvent.selectOptions(exam, 'e1');
    expect(await screen.findByText('Student 1')).toBeInTheDocument();
    expect(admin.getAdminRankings).toHaveBeenLastCalledWith({
      limit: 100,
      exam_id: 'e1',
    });
    expect(screen.getAllByText('🥇').length).toBeGreaterThan(0);
    expect(screen.getAllByText('#4')).toHaveLength(2); // island and district rank
    expect(screen.getByText('85%')).toHaveClass('text-green-600');
    expect(screen.getByText('70%')).toHaveClass('text-yellow-600');
    expect(screen.getByText('30%')).toHaveClass('text-red-500');
    expect(screen.getAllByText('2m 5s')).toHaveLength(3);
    await userEvent.selectOptions(district, 'Kandy');
    await waitFor(() =>
      expect(admin.getAdminRankings).toHaveBeenLastCalledWith({
        limit: 100,
        exam_id: 'e1',
        district: 'Kandy',
      })
    );
  });

  it('shows an empty board and clears filters', async () => {
    admin.getAdminRankings.mockResolvedValue({ exams, rankings: [] } as any);
    renderWithStore(<AdminRankingsPage />, { store: asAdmin() });
    const [, exam] = await screen.findAllByRole('combobox');
    await waitFor(() =>
      expect(within(exam).getAllByRole('option')).toHaveLength(3)
    );
    await userEvent.selectOptions(exam, 'e2');
    expect(
      await screen.findByText('No attempts found for this exam.')
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: /Clear filters/ })
    );
    expect(
      screen.getByText(
        'Select an exam from the dropdown above to view its rankings.'
      )
    ).toBeInTheDocument();
  });

  it('shows the load error', async () => {
    admin.getAdminRankings.mockImplementation(() =>
      httpError(500, { detail: 'Rankings down' })
    );
    renderWithStore(<AdminRankingsPage />, { store: asAdmin() });
    expect(await screen.findByText('Rankings down')).toBeInTheDocument();
  });
});

describe('Admin settings', () => {
  it('sends non-admins home', () => {
    renderWithStore(<AdminSettingsPage />, { store: asStudent() });
    expect(nav.router.push).toHaveBeenCalledWith('/');
  });

  it('shows account info and fills the name', () => {
    renderWithStore(<AdminSettingsPage />, { store: asAdmin() });
    expect(screen.getByText('admin@edura.lk')).toBeInTheDocument();
    expect(screen.getByText('Administrator')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Nimal Silva')).toBeInTheDocument();
    expect(screen.getByText('LKR (Sri Lankan Rupee)')).toBeInTheDocument();
  });

  it('shows inactive accounts', () => {
    renderWithStore(<AdminSettingsPage />, {
      store: makeStore({
        auth: { user: { ...adminUser, is_active: false } as any },
      }),
    });
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('reports profile saving as successful', async () => {
    auth.getCurrentUser.mockResolvedValue(adminUser as any);
    renderWithStore(<AdminSettingsPage />, { store: asAdmin() });
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(
      await screen.findByText('Profile updated successfully.')
    ).toBeInTheDocument();
    expect(auth.getCurrentUser).toHaveBeenCalled();
  });

  // Bug: "Save Changes" never sends the name anywhere (the update call is
  // commented out) yet still reports success.
  test.failing('actually saves the new name', async () => {
    auth.getCurrentUser.mockResolvedValue(adminUser as any);
    renderWithStore(<AdminSettingsPage />, { store: asAdmin() });
    const name = screen.getByDisplayValue('Nimal Silva');
    await userEvent.clear(name);
    await userEvent.type(name, 'Nimal Perera');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('Profile updated successfully.');
    expect(auth.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: 'Nimal Perera' })
    );
  });

  describe('password', () => {
    const fill = async (current: string, next: string, confirm: string) => {
      const [cur, nw, conf] = Array.from(
        document.querySelectorAll('input[type="password"]')
      ) as HTMLInputElement[];
      await userEvent.type(cur, current);
      await userEvent.type(nw, next);
      await userEvent.type(conf, confirm);
      await userEvent.click(
        screen.getByRole('button', { name: 'Change Password' })
      );
    };

    it('changes the password and clears the form', async () => {
      auth.changePassword.mockResolvedValue({} as any);
      renderWithStore(<AdminSettingsPage />, { store: asAdmin() });
      await fill('oldpass12', 'newpass123', 'newpass123');
      expect(
        await screen.findByText('Password changed successfully.')
      ).toBeInTheDocument();
      expect(auth.changePassword).toHaveBeenCalledWith({
        current_password: 'oldpass12',
        new_password: 'newpass123',
      });
      expect(
        document.querySelectorAll('input[type="password"]')[0]
      ).toHaveValue('');
    });

    it('checks the new passwords match and are long enough', async () => {
      renderWithStore(<AdminSettingsPage />, { store: asAdmin() });
      await fill('old', 'newpass123', 'different1');
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      const [, nw, conf] = Array.from(
        document.querySelectorAll('input[type="password"]')
      ) as HTMLInputElement[];
      await userEvent.clear(nw);
      await userEvent.clear(conf);
      await userEvent.type(nw, 'short');
      await userEvent.type(conf, 'short');
      await userEvent.click(
        screen.getByRole('button', { name: 'Change Password' })
      );
      expect(
        screen.getByText('Password must be at least 8 characters')
      ).toBeInTheDocument();
      expect(auth.changePassword).not.toHaveBeenCalled();
    });

    it('shows the server error', async () => {
      auth.changePassword.mockImplementation(() =>
        httpError(400, { detail: 'Current password is wrong' })
      );
      renderWithStore(<AdminSettingsPage />, { store: asAdmin() });
      await fill('bad', 'newpass123', 'newpass123');
      expect(
        await screen.findByText('Current password is wrong')
      ).toBeInTheDocument();
    });
  });
});
