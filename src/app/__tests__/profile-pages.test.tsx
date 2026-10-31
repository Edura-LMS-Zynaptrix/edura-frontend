jest.mock(
  'next/navigation',
  () => require('@/test-utils/navigation').navigationMock
);
jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock());
jest.mock('@/lib/api/auth');
jest.mock('@/lib/api/student');

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import apiClient from '@/lib/api/client';
import * as authApi from '@/lib/api/auth';
import * as studentApi from '@/lib/api/student';
import ProfilePage from '@/app/profile/page';
import BadgesPage from '@/app/student/profile/badges/page';
import { httpError, reply, type MockClient } from '@/test-utils/api';
import { nav } from '@/test-utils/navigation';
import { makeStore, renderWithStore } from '@/test-utils/store';

const auth = authApi as jest.Mocked<typeof authApi>;
const student = studentApi as jest.Mocked<typeof studentApi>;
const client = apiClient as unknown as MockClient;

const streams = [
  { id: 's1', name: 'Maths', is_active: true },
  { id: 's2', name: 'Arts', is_active: true },
  { id: 's3', name: 'Old', is_active: false },
];
const enrollments = {
  courses: [1, 2, 3, 4].map((n) => ({
    enrollment_id: `ec${n}`,
    course: { id: `c${n}`, title: `Course ${n}` },
  })),
  exams: [{ enrollment_id: 'ee1', exam: { title: 'Mock Paper' } }],
};

let me: any;
const user = (profile: any = {}, extra: any = {}) => ({
  id: '7',
  email: 'kasun@example.com',
  role: 'student',
  is_active: true,
  has_password: true,
  profile: {
    full_name: 'Kasun Perera',
    phone_number: '0771234567',
    school: 'Royal College',
    district: 'Colombo',
    grade: 11,
    stream_id: '',
    selected_subjects: ['Maths'],
    nic_number: '',
    ...profile,
  },
  ...extra,
});

function renderProfile(u = user()) {
  me = u;
  return renderWithStore(<ProfilePage />, {
    store: makeStore({
      auth: { isAuthenticated: true, isInitialized: true, user: u as any },
    }),
  });
}

beforeEach(() => {
  nav.reset();
  jest.resetAllMocks();
  auth.getCurrentUser.mockImplementation(async () => me);
  student.getMyEnrollments.mockResolvedValue(enrollments as any);
  student.getStreams.mockResolvedValue(streams as any);
  student.getSubjects.mockResolvedValue(['Maths', 'Science', 'English']);
  student.getAvailableCourses.mockResolvedValue([]);
});

describe('Profile page', () => {
  it('sends visitors to log in, back to the profile', () => {
    nav.pathname = '/profile';
    renderWithStore(<ProfilePage />, {
      store: makeStore({ auth: { isInitialized: true } }),
    });
    expect(nav.router.push).toHaveBeenCalledWith(
      '/login?callbackUrl=%2Fprofile'
    );
  });

  it('shows a loader until auth is initialised', () => {
    renderWithStore(<ProfilePage />);
    expect(screen.getByText('Loading your profile...')).toBeInTheDocument();
  });

  it('refreshes the user, enrollments and streams on load', async () => {
    renderProfile();
    await screen.findByText('Course 1');
    expect(auth.getCurrentUser).toHaveBeenCalled();
    expect(student.getMyEnrollments).toHaveBeenCalled();
    expect(student.getStreams).toHaveBeenCalled();
    expect(student.getSubjects).toHaveBeenCalledWith(11, null);
  });

  it('shows the profile read-only with initials and subjects', async () => {
    renderProfile();
    expect(
      await screen.findByRole('heading', { name: 'Kasun Perera' })
    ).toBeInTheDocument();
    expect(screen.getByText('KP')).toBeInTheDocument();
    expect(screen.getByText('Grade 11')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Royal College')).toBeDisabled();
    expect(screen.getByDisplayValue('kasun@example.com')).toBeDisabled();
    expect(screen.getByText('Maths')).toBeInTheDocument();
    expect(screen.queryByText('NIC Number')).not.toBeInTheDocument();
  });

  it('lists up to three enrolled courses and the exam count', async () => {
    renderProfile();
    expect(
      await screen.findByRole('link', { name: 'Course 1' })
    ).toHaveAttribute('href', '/student/courses/c1');
    expect(screen.queryByText('Course 4')).not.toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Mock Paper')).toBeInTheDocument();
  });

  it('saves edits, then reloads the user and their courses', async () => {
    auth.updateProfile.mockResolvedValue({} as any);
    renderProfile();
    await userEvent.click(
      await screen.findByRole('button', { name: /Edit Profile/ })
    );
    const school = screen.getByDisplayValue('Royal College');
    await userEvent.clear(school);
    await userEvent.type(school, 'Ananda College');
    await userEvent.selectOptions(screen.getByDisplayValue('Colombo'), 'Kandy');
    await userEvent.click(
      await screen.findByRole('checkbox', { name: 'Science' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('Profile updated successfully!');
    expect(auth.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        school: 'Ananda College',
        district: 'Kandy',
        selected_subjects: ['Maths', 'Science'],
      })
    );
    expect(student.getAvailableCourses).toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Save Changes' })
    ).not.toBeInTheDocument();
  });

  it('unticks a subject', async () => {
    auth.updateProfile.mockResolvedValue({} as any);
    renderProfile();
    await userEvent.click(
      await screen.findByRole('button', { name: /Edit Profile/ })
    );
    await userEvent.click(
      await screen.findByRole('checkbox', { name: 'Maths' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() =>
      expect(auth.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ selected_subjects: [] })
      )
    );
  });

  it('shows the server error when saving fails', async () => {
    auth.updateProfile.mockImplementation(() =>
      httpError(400, { detail: 'Phone number already used' })
    );
    renderProfile();
    await userEvent.click(
      await screen.findByRole('button', { name: /Edit Profile/ })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(
      await screen.findByText('Phone number already used')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save Changes' })
    ).toBeInTheDocument();
  });

  it('cancel throws away unsaved edits', async () => {
    renderProfile();
    await userEvent.click(
      await screen.findByRole('button', { name: /Edit Profile/ })
    );
    const name = screen.getByDisplayValue('Kasun Perera');
    await userEvent.clear(name);
    await userEvent.type(name, 'Someone Else');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByDisplayValue('Kasun Perera')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Edit Profile/ }));
    expect(screen.getByDisplayValue('Kasun Perera')).toBeEnabled();
  });

  describe('A/L students', () => {
    const alUser = (profile: any = {}) =>
      user({ grade: 13, stream_id: 's1', ...profile });

    it('warns about a missing NIC and opens the editor from the warning', async () => {
      renderProfile(alUser());
      expect(
        await screen.findByText('NIC Information Required')
      ).toBeInTheDocument();
      expect(screen.getByText('NIC: Missing')).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: /Update your NIC now/ })
      );
      expect(screen.getByPlaceholderText('e.g. 200123456789')).toBeEnabled();
      expect(
        screen.getByText('Required for Grade 12-13 students.')
      ).toBeInTheDocument();
    });

    it('shows the stream name and loads subjects for it', async () => {
      renderProfile(alUser({ nic_number: '200012345678' }));
      expect(await screen.findByDisplayValue('Maths')).toBeDisabled();
      expect(screen.getByText('NIC: 200012345678')).toBeInTheDocument();
      expect(
        screen.queryByText('NIC Information Required')
      ).not.toBeInTheDocument();
      await waitFor(() =>
        expect(student.getSubjects).toHaveBeenCalledWith(13, 's1')
      );
    });

    it('rejects a badly formatted NIC without calling the API', async () => {
      renderProfile(alUser());
      await userEvent.click(
        await screen.findByRole('button', { name: /Edit Profile/ })
      );
      await userEvent.type(
        screen.getByPlaceholderText('e.g. 200123456789'),
        '12345'
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Save Changes' })
      );
      expect(screen.getByText(/Invalid NIC format/)).toBeInTheDocument();
      expect(auth.updateProfile).not.toHaveBeenCalled();
    });

    it.each(['123456789V', '123456789x', '200012345678'])(
      'accepts NIC %s',
      async (nic) => {
        auth.updateProfile.mockResolvedValue({} as any);
        renderProfile(alUser());
        await userEvent.click(
          await screen.findByRole('button', { name: /Edit Profile/ })
        );
        await userEvent.type(
          screen.getByPlaceholderText('e.g. 200123456789'),
          nic
        );
        await userEvent.click(
          screen.getByRole('button', { name: 'Save Changes' })
        );
        await waitFor(() =>
          expect(auth.updateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ nic_number: nic })
          )
        );
      }
    );

    it('offers only active streams and asks for one before listing subjects', async () => {
      renderProfile(alUser({ nic_number: '200012345678' }));
      await userEvent.click(
        await screen.findByRole('button', { name: /Edit Profile/ })
      );
      const select = screen.getByDisplayValue('Maths');
      expect(
        within(select)
          .getAllByRole('option')
          .map((o) => o.textContent)
      ).toEqual(['Select stream', 'Maths', 'Arts']);
      await userEvent.selectOptions(select, '');
      expect(
        await screen.findByText('Please select an educational stream first.')
      ).toBeInTheDocument();
    });
  });

  describe('photo upload', () => {
    it('uploads the chosen file and reloads the user', async () => {
      auth.updateProfilePhoto.mockResolvedValue({} as any);
      const { container } = renderProfile();
      await screen.findByText('Course 1');
      const input = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      await userEvent.upload(
        input,
        new File(['x'], 'me.png', { type: 'image/png' })
      );
      await waitFor(() => expect(auth.updateProfilePhoto).toHaveBeenCalled());
      const form = auth.updateProfilePhoto.mock.calls[0][0] as FormData;
      expect((form.get('file') as File).name).toBe('me.png');
      await waitFor(() => expect(auth.getCurrentUser).toHaveBeenCalledTimes(2));
    });

    it('reports a failed upload', async () => {
      auth.updateProfilePhoto.mockImplementation(() =>
        httpError(413, { detail: 'File too large' })
      );
      const { container } = renderProfile();
      await screen.findByText('Course 1');
      await userEvent.upload(
        container.querySelector('input[type="file"]') as HTMLInputElement,
        new File(['x'], 'big.png', { type: 'image/png' })
      );
      expect(await screen.findByText('File too large')).toBeInTheDocument();
    });

    it('shows the photo instead of initials when there is one', async () => {
      renderProfile(user({ profile_photo_url: 'https://cdn/me.png' }));
      expect(
        await screen.findByRole('img', { name: 'Kasun Perera' })
      ).toHaveAttribute('src', 'https://cdn/me.png');
    });
  });

  describe('password', () => {
    const googleUser = () =>
      user({}, { has_password: false, auth_provider: 'google' });

    it('links password users to the reset flow', async () => {
      renderProfile();
      expect(
        await screen.findByRole('link', { name: 'Send Change Password Link' })
      ).toHaveAttribute('href', '/forgot-password');
    });

    it('hides the section until has_password is known', async () => {
      renderProfile(user({}, { has_password: undefined }));
      await screen.findByText('Course 1');
      expect(screen.queryByText('Password & Security')).not.toBeInTheDocument();
    });

    it('lets Google users set a password', async () => {
      auth.setPassword.mockResolvedValue({} as any);
      renderProfile(googleUser());
      await userEvent.type(
        await screen.findByPlaceholderText('At least 8 characters'),
        'longpassword'
      );
      await userEvent.type(
        screen.getByPlaceholderText('Repeat password'),
        'longpassword'
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Set Password' })
      );
      expect(await screen.findByText(/Password set!/)).toBeInTheDocument();
      expect(auth.setPassword).toHaveBeenCalledWith({
        new_password: 'longpassword',
        confirm_password: 'longpassword',
      });
      expect(screen.getByPlaceholderText('At least 8 characters')).toHaveValue(
        ''
      );
    });

    it('checks the passwords match', async () => {
      renderProfile(googleUser());
      await userEvent.type(
        await screen.findByPlaceholderText('At least 8 characters'),
        'longpassword'
      );
      await userEvent.type(
        screen.getByPlaceholderText('Repeat password'),
        'different1'
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Set Password' })
      );
      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
      expect(auth.setPassword).not.toHaveBeenCalled();
    });

    it('shows the server error when setting fails', async () => {
      auth.setPassword.mockImplementation(() =>
        httpError(400, { detail: 'Password too common' })
      );
      renderProfile(googleUser());
      await userEvent.type(
        await screen.findByPlaceholderText('At least 8 characters'),
        'password123'
      );
      await userEvent.type(
        screen.getByPlaceholderText('Repeat password'),
        'password123'
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Set Password' })
      );
      expect(
        await screen.findByText('Password too common')
      ).toBeInTheDocument();
    });
  });
});

describe('Badges page', () => {
  const badges = [
    {
      id: 'b1',
      name: 'First Steps',
      category: 'activity',
      description: 'Finish an exam',
      icon_url: null,
    },
    {
      id: 'b2',
      name: 'Streak',
      category: 'activity',
      description: 'Seven days',
      icon_url: null,
    },
    {
      id: 'b3',
      name: 'Ace',
      category: 'performance',
      description: 'Score 100%',
      icon_url: null,
    },
    {
      id: 'b4',
      name: 'Veteran',
      category: 'milestone',
      description: '100 exams',
      icon_url: null,
    },
  ];

  it('loads the badge dashboard and shows earned, locked and percentage', async () => {
    client.get.mockResolvedValue(
      reply({
        available_badges: badges,
        earned_badges: [{ badge_id: 'b1', awarded_at: '2026-01-01T00:00:00Z' }],
      })
    );
    renderWithStore(<BadgesPage />);
    expect(await screen.findByText('Activity Badges')).toBeInTheDocument();
    expect(client.get).toHaveBeenCalledWith(
      '/api/assessments/badges/dashboard'
    );
    expect(screen.getByText('Earned').previousSibling).toHaveTextContent('1');
    expect(screen.getByText('Locked').previousSibling).toHaveTextContent('3');
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('Performance Mastery')).toBeInTheDocument();
    expect(screen.getByText('Legendary Milestones')).toBeInTheDocument();
    expect(screen.getByText('First Steps')).toBeInTheDocument();
  });

  it('skips categories with no badges', async () => {
    client.get.mockResolvedValue(
      reply({ available_badges: badges.slice(0, 2), earned_badges: [] })
    );
    renderWithStore(<BadgesPage />);
    expect(await screen.findByText('Activity Badges')).toBeInTheDocument();
    expect(screen.queryByText('Performance Mastery')).not.toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows a loader on first load', () => {
    client.get.mockReturnValue(new Promise(() => {}));
    renderWithStore(<BadgesPage />);
    expect(
      screen.getByText('Loading your achievements...')
    ).toBeInTheDocument();
  });

  it('shows 0% when there are no badges at all', async () => {
    client.get.mockImplementation(() => httpError(500, {}));
    renderWithStore(<BadgesPage />);
    expect(await screen.findByText('0%')).toBeInTheDocument();
  });
});
