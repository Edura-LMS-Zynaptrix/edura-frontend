jest.mock(
  'next/navigation',
  () => require('@/test-utils/navigation').navigationMock
);
jest.mock('@/lib/api/auth');
jest.mock('@/lib/api/googleAuth');
jest.mock('@/lib/api/student');

const google = { options: null as any };
jest.mock('@react-oauth/google', () => ({
  useGoogleLogin: (options: any) => {
    google.options = options;
    return () => options.onSuccess({ access_token: 'g-token' });
  },
}));

import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authApi from '@/lib/api/auth';
import { googleLogin } from '@/lib/api/googleAuth';
import * as studentApi from '@/lib/api/student';
import CompleteProfilePage from '@/app/auth/complete-profile/page';
import RegisterPage from '@/app/register/page';
import { nav } from '@/test-utils/navigation';
import { makeStore, renderWithStore } from '@/test-utils/store';

const auth = authApi as jest.Mocked<typeof authApi>;
const student = studentApi as jest.Mocked<typeof studentApi>;
const select = (container: HTMLElement, name: string) =>
  container.querySelector(`select[name=${name}]`) as HTMLSelectElement;
const input = (container: HTMLElement, name: string) =>
  container.querySelector(`input[name=${name}]`) as HTMLInputElement;

beforeEach(() => {
  nav.reset();
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  student.getStreams.mockResolvedValue([
    {
      id: '3',
      name: 'Bio Science',
      subjects: [],
      description: null,
      is_active: true,
    },
  ]);
  student.getSubjects.mockImplementation(async (grade, stream) =>
    (grade ?? 0) >= 12
      ? stream === '3'
        ? ['Biology', 'Chemistry']
        : []
      : ['Maths', 'Science']
  );
});

describe('Register page', () => {
  const fillValid = async (container: HTMLElement) => {
    const user = userEvent.setup();
    await user.type(input(container, 'full_name'), ' Ama  Kumari Perera ');
    await user.type(input(container, 'email'), 'ama@x.lk');
    await user.type(input(container, 'password'), 'Password@1');
    await user.type(input(container, 'confirm_password'), 'Password@1');
    await user.type(input(container, 'phone_number'), '077 123 4567');
    await user.type(input(container, 'school'), 'Royal College');
    await user.selectOptions(select(container, 'district'), 'Colombo');
    await user.click(await screen.findByText('Maths'));
    return user;
  };

  it('registers a student with their profile and asks them to verify', async () => {
    auth.register.mockResolvedValue({ id: 7 });
    const { container } = renderWithStore(<RegisterPage />);
    const user = await fillValid(container);
    const submit = screen.getByRole('button', { name: 'Create Account' });
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(auth.register).toHaveBeenCalledWith({
      email: 'ama@x.lk',
      password: 'Password@1',
      role: 'student',
      profile: {
        first_name: 'Ama',
        last_name: 'Kumari Perera',
        mobile_no: '0771234567',
        school: 'Royal College',
        district: 'Colombo',
        grade: 6,
        stream_id: undefined,
        nic_number: undefined,
        selected_subjects: ['Maths'],
        referral_code: undefined,
      },
    });
    expect(
      await screen.findByRole('heading', { name: 'Check your email' })
    ).toBeInTheDocument();
    expect(screen.getByText('ama@x.lk')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /resend in 60s/ })
    ).toBeDisabled();
  });

  it('keeps the button disabled until every rule passes', async () => {
    const { container } = renderWithStore(<RegisterPage />);
    const submit = screen.getByRole('button', { name: 'Create Account' });
    const user = userEvent.setup();
    await user.type(input(container, 'password'), 'weak');
    expect(submit).toBeDisabled();
    await fillValid(container); // appends to the weak password → no longer matches
    expect(submit).toBeDisabled();
  });

  it('needs an A/L stream and a valid NIC from grade 12', async () => {
    auth.register.mockResolvedValue({});
    const { container } = renderWithStore(<RegisterPage />);
    const user = userEvent.setup();
    await user.selectOptions(select(container, 'grade'), '12');
    expect(await screen.findByText('Loading subjects...')).toBeInTheDocument();
    await waitFor(() =>
      expect(select(container, 'stream_id').options.length).toBe(2)
    );
    await user.selectOptions(select(container, 'stream_id'), '3');
    expect(await screen.findByText('Biology')).toBeInTheDocument();

    await user.type(input(container, 'full_name'), 'Ama Perera');
    await user.type(input(container, 'email'), 'ama@x.lk');
    await user.type(input(container, 'password'), 'Password@1');
    await user.type(input(container, 'confirm_password'), 'Password@1');
    await user.type(input(container, 'phone_number'), '0771234567');
    await user.type(input(container, 'school'), 'Royal');
    await user.selectOptions(select(container, 'district'), 'Kandy');
    await user.click(screen.getByText('Biology'));
    await user.click(screen.getByText('Chemistry'));
    await user.click(screen.getByText('Chemistry')); // untick

    const submit = screen.getByRole('button', { name: 'Create Account' });
    await user.type(input(container, 'nic_number'), '1234');
    expect(submit).toBeDisabled();
    await user.clear(input(container, 'nic_number'));
    await user.type(input(container, 'nic_number'), '200012345678');
    await user.click(submit);

    expect(auth.register.mock.calls[0][0].profile).toMatchObject({
      grade: 12,
      stream_id: 3,
      nic_number: '200012345678',
      selected_subjects: ['Biology'],
    });
  });

  it('prefills a referral code from the link, upper-cased', async () => {
    nav.setSearch({ ref: 'ama1' });
    auth.register.mockResolvedValue({});
    const { container } = renderWithStore(<RegisterPage />);
    expect(input(container, 'referral_code')).toHaveValue('AMA1');
    const user = await fillValid(container);
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(auth.register.mock.calls[0][0].profile?.referral_code).toBe('AMA1');
  });

  it('shows a registration error and stays on the form', async () => {
    auth.register.mockRejectedValue(
      Object.assign(new Error('x'), {
        response: { data: { detail: { message: 'Email already registered' } } },
      })
    );
    const { container } = renderWithStore(<RegisterPage />);
    const user = await fillValid(container);
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(
      await screen.findByText('Email already registered')
    ).toBeInTheDocument();
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument();
  });

  it('lets the student resend the verification email after the wait', async () => {
    jest.useFakeTimers();
    auth.register.mockResolvedValue({});
    auth.resendVerification
      .mockResolvedValueOnce({ message: 'ok' })
      .mockRejectedValueOnce(new Error('down'));
    const { container } = renderWithStore(<RegisterPage />);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.type(input(container, 'full_name'), 'Ama Perera');
    await user.type(input(container, 'email'), 'ama@x.lk');
    await user.type(input(container, 'password'), 'Password@1');
    await user.type(input(container, 'confirm_password'), 'Password@1');
    await user.type(input(container, 'phone_number'), '0771234567');
    await user.type(input(container, 'school'), 'Royal');
    await user.selectOptions(select(container, 'district'), 'Galle');
    await user.click(await screen.findByText('Science'));
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    await screen.findByText('Check your email');

    for (let i = 0; i < 60; i++)
      await act(async () => jest.advanceTimersByTime(1000));
    await user.click(screen.getByRole('button', { name: 'resend the email' }));
    expect(auth.resendVerification).toHaveBeenCalledWith('ama@x.lk');
    expect(
      await screen.findByText('A new verification email is on its way.')
    ).toBeInTheDocument();

    for (let i = 0; i < 60; i++)
      await act(async () => jest.advanceTimersByTime(1000));
    await user.click(screen.getByRole('button', { name: 'resend the email' }));
    expect(
      await screen.findByText(/could not send the email/)
    ).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('toggles both password fields', async () => {
    const { container } = renderWithStore(<RegisterPage />);
    const [show1, show2] = screen.getAllByRole('button', {
      name: 'Show password',
    });
    await userEvent.click(show1);
    await userEvent.click(show2);
    expect(input(container, 'password')).toHaveAttribute('type', 'text');
    expect(input(container, 'confirm_password')).toHaveAttribute(
      'type',
      'text'
    );
    expect(
      screen.getAllByRole('button', { name: 'Hide password' })
    ).toHaveLength(2);
  });

  it.each([
    [true, { ref: 'AMA1' }, '/auth/complete-profile?ref=AMA1'],
    [true, {}, '/auth/complete-profile'],
    [false, {}, '/'],
  ])(
    'signs up with Google (needs profile: %s)',
    async (needs, query, target) => {
      nav.setSearch(query as any);
      (googleLogin as jest.Mock).mockResolvedValue({
        access_token: 'jwt',
        refresh_token: '',
      });
      auth.getCurrentUser.mockResolvedValue({
        id: '7',
        role: 'student',
        needs_profile_completion: needs,
      } as any);
      renderWithStore(<RegisterPage />);
      await userEvent.click(screen.getByRole('button', { name: /Google/ }));
      await waitFor(() => expect(nav.router.push).toHaveBeenCalledWith(target));
      google.options.onError();
    }
  );

  it('logs a failed Google sign-up', async () => {
    (googleLogin as jest.Mock).mockRejectedValue(new Error('cancelled'));
    renderWithStore(<RegisterPage />);
    await userEvent.click(screen.getByRole('button', { name: /Google/ }));
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        'Google login failed:',
        'cancelled'
      )
    );
    expect(nav.router.push).not.toHaveBeenCalled();
  });

  it('logs a failed subject lookup', async () => {
    student.getSubjects.mockRejectedValue(new Error('down'));
    renderWithStore(<RegisterPage />);
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch subjects:',
        expect.any(Error)
      )
    );
  });

  it('shows field hints after leaving invalid fields', async () => {
    const { container } = renderWithStore(<RegisterPage />);
    const user = userEvent.setup();
    await user.type(input(container, 'email'), 'not-an-email');
    await user.type(input(container, 'phone_number'), '123');
    await user.click(container);
    expect(container.textContent).toMatch(/valid email/i);
    expect(container.textContent).toMatch(/10 digits/i);
  });
});

describe('Complete profile page', () => {
  const signedIn = (profile: any = null, extra: any = {}) =>
    makeStore({
      auth: {
        isAuthenticated: true,
        isInitialized: true,
        user: { id: '7', role: 'student', email: 'a@x.lk', profile } as any,
        ...extra,
      },
    });

  const fillDetails = async (container: HTMLElement) => {
    const user = userEvent.setup();
    await user.type(input(container, 'mobile_no'), '0771234567');
    await user.type(input(container, 'school'), 'Royal College');
    await user.selectOptions(select(container, 'district'), 'Colombo');
    await user.click(await screen.findByText('Maths'));
    return user;
  };

  it('sends visitors to log in first, keeping the page as the callback', () => {
    nav.pathname = '/auth/complete-profile';
    nav.setSearch({ ref: 'ama1' });
    renderWithStore(<CompleteProfilePage />, {
      store: makeStore({ auth: { isInitialized: true } }),
    });
    expect(nav.router.push).toHaveBeenCalledWith(
      '/login?callbackUrl=%2Fauth%2Fcomplete-profile%3Fref%3Dama1'
    );
  });

  it('creates the profile for a new account', async () => {
    auth.createProfile.mockResolvedValue({ name: 'Ama Perera' } as any);
    auth.getCurrentUser.mockResolvedValue({
      id: '7',
      needs_profile_completion: false,
    } as any);
    const { container } = renderWithStore(<CompleteProfilePage />, {
      store: signedIn(),
    });
    expect(screen.getByText('ST')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(input(container, 'first_name'), 'Ama Perera');
    expect(screen.getByText('AP')).toBeInTheDocument();
    await fillDetails(container);
    await user.click(
      screen.getByRole('button', { name: 'Complete My Profile →' })
    );

    await waitFor(() => expect(nav.router.push).toHaveBeenCalledWith('/'));
    expect(auth.createProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Ama',
        last_name: 'Perera',
        mobile_no: '0771234567',
        grade: 11,
        selected_subjects: ['Maths'],
        stream_id: undefined,
        nic_number: undefined,
      })
    );
  });

  it('fills in a Google-seeded profile without asking for the name again', async () => {
    auth.updateProfile.mockResolvedValue({} as any);
    auth.getCurrentUser.mockResolvedValue({ id: '7' } as any);
    const store = signedIn({
      first_name: 'Ama',
      last_name: 'Perera',
      avatar_url: 'https://img/g.png',
      mobile_no: '0770000000',
    });
    const { container } = renderWithStore(<CompleteProfilePage />, { store });

    expect(input(container, 'first_name')).toBeNull();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://img/g.png');
    expect(input(container, 'mobile_no')).toHaveValue('0770000000');

    const user = userEvent.setup();
    await user.type(input(container, 'school'), 'Royal');
    await user.selectOptions(select(container, 'district'), 'Kandy');
    await user.click(await screen.findByText('Science'));
    await user.click(
      screen.getByRole('button', { name: 'Complete My Profile →' })
    );

    await waitFor(() => expect(auth.updateProfile).toHaveBeenCalled());
    expect(auth.updateProfile.mock.calls[0][0]).not.toHaveProperty(
      'first_name'
    );
    expect(auth.createProfile).not.toHaveBeenCalled();
  });

  it('names an existing profile that has no name yet', async () => {
    auth.updateProfile.mockResolvedValue({} as any);
    auth.getCurrentUser.mockResolvedValue({ id: '7' } as any);
    const { container } = renderWithStore(<CompleteProfilePage />, {
      store: signedIn({ first_name: '' }),
    });
    const user = userEvent.setup();
    await user.type(input(container, 'first_name'), 'Kamal Silva');
    await fillDetails(container);
    await user.click(
      screen.getByRole('button', { name: 'Complete My Profile →' })
    );
    await waitFor(() =>
      expect(auth.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ first_name: 'Kamal', last_name: 'Silva' })
      )
    );
  });

  it('updates instead when the profile appeared meanwhile', async () => {
    auth.createProfile.mockRejectedValue(
      Object.assign(new Error('x'), {
        response: {
          data: { detail: { message: 'Profile already exists for this user' } },
        },
      })
    );
    auth.updateProfile.mockResolvedValue({} as any);
    auth.getCurrentUser.mockResolvedValue({ id: '7' } as any);
    const { container } = renderWithStore(<CompleteProfilePage />, {
      store: signedIn(),
    });
    const user = userEvent.setup();
    await user.type(input(container, 'first_name'), 'Ama');
    await fillDetails(container);
    await user.click(
      screen.getByRole('button', { name: 'Complete My Profile →' })
    );
    await waitFor(() => expect(auth.updateProfile).toHaveBeenCalled());
    await waitFor(() => expect(nav.router.push).toHaveBeenCalledWith('/'));
  });

  it('shows other save errors', async () => {
    auth.createProfile.mockRejectedValue(
      Object.assign(new Error('x'), {
        response: { data: { detail: { message: 'Invalid phone' } } },
      })
    );
    const { container } = renderWithStore(<CompleteProfilePage />, {
      store: signedIn(),
    });
    const user = userEvent.setup();
    await user.type(input(container, 'first_name'), 'Ama');
    await fillDetails(container);
    await user.click(
      screen.getByRole('button', { name: 'Complete My Profile →' })
    );
    expect(await screen.findByText('Invalid phone')).toBeInTheDocument();
    expect(nav.router.push).not.toHaveBeenCalled();
  });

  it('asks A/L students for a stream and NIC', async () => {
    auth.createProfile.mockResolvedValue({} as any);
    auth.getCurrentUser.mockResolvedValue({ id: '7' } as any);
    nav.setSearch({ referral_code: 'ref9' });
    const { container } = renderWithStore(<CompleteProfilePage />, {
      store: signedIn(),
    });
    expect(input(container, 'referral_code')).toHaveValue('REF9');
    const user = userEvent.setup();
    await user.selectOptions(select(container, 'grade'), '13');
    expect(
      await screen.findByText('Select a stream to see subjects')
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(select(container, 'stream_id').options.length).toBe(2)
    );
    await user.selectOptions(select(container, 'stream_id'), '3');
    await user.type(input(container, 'first_name'), 'Ama');
    await user.type(input(container, 'mobile_no'), '0771234567');
    await user.type(input(container, 'school'), 'Royal');
    await user.selectOptions(select(container, 'district'), 'Colombo');
    await user.click(await screen.findByText('Biology'));
    await user.click(screen.getByText('Biology'));
    await user.click(screen.getByText('Biology'));
    await user.type(input(container, 'nic_number'), '981234567V');
    await user.click(
      screen.getByRole('button', { name: 'Complete My Profile →' })
    );
    await waitFor(() =>
      expect(auth.createProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          grade: 13,
          stream_id: 3,
          nic_number: '981234567V',
          referral_code: 'REF9',
        })
      )
    );
  });

  it('tolerates the stream and subject lookups failing', async () => {
    student.getStreams.mockRejectedValue(new Error('down'));
    student.getSubjects.mockRejectedValue(new Error('down'));
    const { container } = renderWithStore(<CompleteProfilePage />, {
      store: signedIn(),
    });
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch subjects:',
        expect.any(Error)
      )
    );
    expect(
      screen.getByRole('button', { name: 'Complete My Profile →' })
    ).toBeDisabled();
    expect(container).toBeTruthy();
  });
});
