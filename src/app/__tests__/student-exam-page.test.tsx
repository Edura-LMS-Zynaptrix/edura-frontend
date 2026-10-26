jest.mock(
  'next/navigation',
  () => require('@/test-utils/navigation').navigationMock
);
jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock());
jest.mock('@/lib/api/student');
const pdf = {
  setFillColor: jest.fn(),
  rect: jest.fn(),
  setTextColor: jest.fn(),
  setFontSize: jest.fn(),
  setFont: jest.fn(),
  text: jest.fn(),
  setDrawColor: jest.fn(),
  setLineWidth: jest.fn(),
  line: jest.fn(),
  addPage: jest.fn(),
  addImage: jest.fn(),
  save: jest.fn(),
};
jest.mock('html2canvas', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('jspdf', () => ({ jsPDF: jest.fn(() => pdf) }));

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import html2canvas from 'html2canvas';
import * as studentApi from '@/lib/api/student';
import StudentExamPage from '@/app/student/exams/[examId]/page';
import { getOngoingExam, saveOngoingExam } from '@/lib/ongoingExam';
import { httpError } from '@/test-utils/api';
import { nav } from '@/test-utils/navigation';
import { makeStore, renderWithStore } from '@/test-utils/store';

const student = studentApi as jest.Mocked<typeof studentApi>;
const signedIn = (extra: any = {}) =>
  makeStore({
    auth: {
      isAuthenticated: true,
      isInitialized: true,
      user: {
        id: '7f3a9c21-aaaa',
        email: 'kasun@example.com',
        role: 'student',
      } as any,
    },
    ...extra,
  });

const minutesFromNow = (m: number) =>
  new Date(Date.now() + m * 60_000).toISOString();
const started = (extra: any = {}) => ({
  attempt_id: 'att-1',
  exam_title: 'Physics Paper 1',
  subject: 'Physics',
  ends_at: minutesFromNow(30),
  questions: [
    {
      id: 'q1',
      question_text: 'What is g?',
      question_image_url: 'https://cdn/q1.png',
      options: [
        {
          id: 'q1a',
          order_number: 1,
          option_text: '9.8 m/s²',
          option_image_url: null,
        },
        {
          id: 'q1b',
          order_number: 2,
          option_text: '1.6 m/s²',
          option_image_url: 'https://cdn/moon.png',
        },
      ],
    },
    {
      id: 'q2',
      question_text: 'Unit of force?',
      question_image_url: null,
      options: [
        {
          id: 'q2a',
          order_number: 1,
          option_text: 'Newton',
          option_image_url: null,
        },
        {
          id: 'q2b',
          order_number: 2,
          option_text: 'Joule',
          option_image_url: null,
        },
      ],
    },
  ],
  ...extra,
});
const submitted = (extra: any = {}) => ({
  marks_obtained: 1,
  total_questions: 2,
  time_taken_seconds: 754,
  ranking: {
    exam_title: 'Physics Paper 1',
    overall_rank: 12,
    district_rank: null,
    course_id: 'c9',
  },
  review: [
    {
      question_id: 'q1',
      question_text: 'What is g?',
      is_correct: true,
      selected_option_id: 'q1a',
      correct_option_id: 'q1a',
      explanation: 'Earth gravity',
      video_url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA&t=3',
    },
    {
      question_id: 'q2',
      question_text: 'Unit of force?',
      is_correct: false,
      selected_option_id: null,
      correct_option_id: 'q2a',
      explanation: null,
      video_url: null,
    },
  ],
  new_badges: [],
  ...extra,
});
const access = (extra: any = {}) => ({
  exam: { title: 'Physics Paper 1', duration_minutes: 30, total_questions: 2 },
  is_locked: false,
  ...extra,
});

beforeEach(() => {
  nav.reset();
  jest.clearAllMocks();
  for (const fn of [
    student.checkExamAccess,
    student.startExam,
    student.submitExamAttempt,
    student.getLastAttempt,
    student.reportViolation,
  ]) {
    (fn as jest.Mock).mockReset();
  }
  nav.params = { examId: 'ex1' };
  student.checkExamAccess.mockResolvedValue(access() as any);
  student.startExam.mockResolvedValue(started() as any);
  student.reportViolation.mockResolvedValue(undefined as any);
});

async function startPaper(store = signedIn()) {
  const result = renderWithStore(<StudentExamPage />, { store });
  await userEvent.click(
    await screen.findByRole('button', { name: /විභාගය ආරම්භ කරන්න/ })
  );
  await screen.findByRole('heading', { name: 'Physics Paper 1', level: 1 });
  return result;
}

describe('Before the exam', () => {
  it('sends visitors to log in, back to the exam', () => {
    nav.pathname = '/student/exams/ex1';
    renderWithStore(<StudentExamPage />, {
      store: makeStore({ auth: { isInitialized: true } }),
    });
    expect(nav.router.push).toHaveBeenCalledWith(
      '/login?callbackUrl=%2Fstudent%2Fexams%2Fex1'
    );
    expect(student.checkExamAccess).not.toHaveBeenCalled();
  });

  it('checks access and shows the start modal with the exam details', async () => {
    renderWithStore(<StudentExamPage />, { store: signedIn() });
    expect(screen.getByText('Checking exam status...')).toBeInTheDocument();
    expect(
      await screen.findByText('Ready to start the exam?')
    ).toBeInTheDocument();
    expect(student.checkExamAccess).toHaveBeenCalledWith('ex1');
    expect(
      screen.getByRole('heading', { name: 'Physics Paper 1' })
    ).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('uses cached course data for the modal', async () => {
    const store = signedIn({
      courses: {
        currentCourseExams: [
          {
            id: 'ex1',
            title: 'Cached Paper',
            duration_minutes: 45,
            total_questions: 50,
            is_locked: false,
          },
        ],
      },
    });
    student.checkExamAccess.mockReturnValue(new Promise(() => {}));
    renderWithStore(<StudentExamPage />, { store });
    await waitFor(() => expect(student.checkExamAccess).toHaveBeenCalled());
  });

  it('blocks a locked exam from the cache without asking the server', async () => {
    const store = signedIn({
      courses: {
        currentCourseExams: [
          {
            id: 'ex1',
            title: 'P',
            duration_minutes: 1,
            total_questions: 1,
            is_locked: true,
            lock_message: 'Pass paper 0 first',
          },
        ],
      },
    });
    renderWithStore(<StudentExamPage />, { store });
    expect(
      await screen.findByText('Exam Protocol Blocked')
    ).toBeInTheDocument();
    expect(screen.getByText('Pass paper 0 first')).toBeInTheDocument();
    expect(student.checkExamAccess).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Go Back' }));
    expect(nav.router.back).toHaveBeenCalled();
  });

  it('blocks an exam the server says is locked', async () => {
    student.checkExamAccess.mockResolvedValue(
      access({ is_locked: true, lock_message: null }) as any
    );
    renderWithStore(<StudentExamPage />, { store: signedIn() });
    expect(
      await screen.findByText('Exam Protocol Blocked')
    ).toBeInTheDocument();
    expect(
      screen.getByText('මෙම විභාග පටිපාටිය අවහිර කර ඇත.')
    ).toBeInTheDocument();
  });

  it('still offers the exam when the access check fails', async () => {
    student.checkExamAccess.mockImplementation(() => httpError(500));
    renderWithStore(<StudentExamPage />, { store: signedIn() });
    expect(
      await screen.findByText('Ready to start the exam?')
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Exam' })).toBeInTheDocument();
  });

  it('"later" goes back', async () => {
    renderWithStore(<StudentExamPage />, { store: signedIn() });
    await userEvent.click(
      await screen.findByRole('button', { name: "I'll do it later" })
    );
    expect(nav.router.back).toHaveBeenCalled();
  });

  it('resumes an attempt saved in this browser without the modal', async () => {
    saveOngoingExam({
      examId: 'ex1',
      attemptId: 'att-1',
      endsAt: minutesFromNow(10),
      examTitle: 'Physics Paper 1',
      durationMinutes: 30,
      totalQuestions: 2,
    });
    renderWithStore(<StudentExamPage />, { store: signedIn() });
    expect(
      await screen.findByRole('heading', { name: 'Physics Paper 1', level: 1 })
    ).toBeInTheDocument();
    expect(student.startExam).toHaveBeenCalledWith('ex1');
    expect(student.checkExamAccess).not.toHaveBeenCalled();
  });

  it('shows when a scheduled exam opens', async () => {
    student.startExam.mockImplementation(() =>
      httpError(403, {
        detail: {
          not_started_yet: true,
          message: 'Opens soon',
          scheduled_start: '2026-12-01T09:00:00Z',
        },
      })
    );
    renderWithStore(<StudentExamPage />, { store: signedIn() });
    await userEvent.click(
      await screen.findByRole('button', { name: /විභාගය ආරම්භ කරන්න/ })
    );
    expect(await screen.findByText('Exam not started yet')).toBeInTheDocument();
    expect(screen.getByText('Opens soon')).toBeInTheDocument();
    expect(
      screen.getByText(/Starts at: .*December 1, 2026/)
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '← Go Back' }));
    expect(nav.router.back).toHaveBeenCalled();
  });

  it('blocks when starting hits a progression lock', async () => {
    student.startExam.mockImplementation(() =>
      httpError(403, {
        detail: {
          is_locked: true,
          lock_message: 'Score 85% on paper 1 first',
          lock_reason: 'score_too_low',
        },
      })
    );
    renderWithStore(<StudentExamPage />, { store: signedIn() });
    await userEvent.click(
      await screen.findByRole('button', { name: /විභාගය ආරම්භ කරන්න/ })
    );
    expect(
      await screen.findByText('Score 85% on paper 1 first')
    ).toBeInTheDocument();
  });

  it('shows the last result when the exam was already attempted', async () => {
    student.startExam.mockImplementation(() =>
      httpError(409, { detail: { already_attempted: true } })
    );
    student.getLastAttempt.mockResolvedValue(submitted() as any);
    renderWithStore(<StudentExamPage />, { store: signedIn() });
    await userEvent.click(
      await screen.findByRole('button', { name: /විභාගය ආරම්භ කරන්න/ })
    );
    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(student.getLastAttempt).toHaveBeenCalledWith('ex1');
  });

  it('returns to the modal after a general start failure', async () => {
    student.startExam.mockImplementation(() =>
      httpError(500, { detail: 'Assessment service down' })
    );
    renderWithStore(<StudentExamPage />, { store: signedIn() });
    await userEvent.click(
      await screen.findByRole('button', { name: /විභාගය ආරම්භ කරන්න/ })
    );
    expect(
      await screen.findByRole('button', { name: /විභාගය ආරම්භ කරන්න/ })
    ).toBeEnabled();
  });

  // Bug: the "Failed to Start" StatusModal is set, but the confirm-phase render
  // returns only the start modal, so the student never sees why it failed.
  test.failing('explains a general start failure', async () => {
    student.startExam.mockImplementation(() =>
      httpError(500, { detail: 'Assessment service down' })
    );
    renderWithStore(<StudentExamPage />, { store: signedIn() });
    await userEvent.click(
      await screen.findByRole('button', { name: /විභාගය ආරම්භ කරන්න/ })
    );
    expect(
      await screen.findByText('Assessment service down')
    ).toBeInTheDocument();
  });

  describe('?view=results', () => {
    beforeEach(() => nav.setSearch({ view: 'results' }));

    it('shows the last attempt, reading options from the review', async () => {
      student.getLastAttempt.mockResolvedValue(
        submitted({
          review: [
            {
              question_id: 'q1',
              question_text: 'What is g?',
              is_correct: false,
              selected_option_id: 'o2',
              correct_option_id: 'o1',
              options: [
                { id: 'o1', order_number: 1, option_text: '9.8' },
                { id: 'o2', order_number: 2, option_text: '1.6' },
              ],
            },
          ],
        }) as any
      );
      renderWithStore(<StudentExamPage />, { store: signedIn() });
      expect(
        screen.getByText('Fetching your previous results...')
      ).toBeInTheDocument();
      expect(
        await screen.findByText('Your Answer: B. 1.6')
      ).toBeInTheDocument();
      expect(screen.getByText('Correct Answer: A. 9.8')).toBeInTheDocument();
      expect(student.checkExamAccess).not.toHaveBeenCalled();
    });

    it('falls back to the start modal when there is no previous attempt', async () => {
      student.getLastAttempt.mockResolvedValue(null);
      renderWithStore(<StudentExamPage />, { store: signedIn() });
      expect(
        await screen.findByText('Ready to start the exam?')
      ).toBeInTheDocument();
    });
  });
});

describe('During the exam', () => {
  it('shows questions, the timer, the watermark and saves the attempt locally', async () => {
    await startPaper();
    expect(screen.getByText('1. What is g?')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Question 1' })).toHaveAttribute(
      'src',
      'https://cdn/q1.png'
    );
    expect(screen.getByRole('img', { name: 'Option' })).toHaveAttribute(
      'src',
      'https://cdn/moon.png'
    );
    expect(screen.getByText(/^(29:59|30:00)$/)).toHaveClass('bg-white/95');
    expect(screen.getAllByText('kasun@example.com • 7f3a9c21')).toHaveLength(
      32
    );
    expect(screen.getByText('2 unanswered')).toBeInTheDocument();
    expect(getOngoingExam('ex1')).toMatchObject({
      attemptId: 'att-1',
      examTitle: 'Physics Paper 1',
      totalQuestions: 2,
    });
  });

  it('tracks answers and the unanswered count', async () => {
    await startPaper();
    await userEvent.click(screen.getByRole('radio', { name: /9.8/ }));
    expect(screen.getByText('1 unanswered')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Newton/ }));
    expect(screen.getByText('All answered ✓')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Joule/ }));
    expect(screen.getByRole('radio', { name: /Newton/ })).not.toBeChecked();
  });

  it.each([
    [4, 'bg-amber-50/95'],
    [0.5, 'bg-red-50/95'],
  ])('colours the timer with %s minutes left', async (m, cls) => {
    student.startExam.mockResolvedValue(
      started({ ends_at: minutesFromNow(m) }) as any
    );
    await startPaper();
    expect(screen.getByText(/^\d\d:\d\d$/)).toHaveClass(cls);
  });

  it('shows hours for long exams', async () => {
    student.startExam.mockResolvedValue(
      started({ ends_at: minutesFromNow(90) }) as any
    );
    await startPaper();
    expect(screen.getByText(/^01:(29:59|30:00)$/)).toBeInTheDocument();
  });

  describe('submitting', () => {
    it('warns about unanswered questions and lets the student go back', async () => {
      await startPaper();
      await userEvent.click(
        screen.getByRole('button', { name: 'Submit Paper' })
      );
      expect(screen.getByText('Submit Answer Sheet?')).toBeInTheDocument();
      expect(screen.getByText('2', { selector: 'strong' })).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'Review Answers' })
      );
      expect(
        screen.queryByText('Submit Answer Sheet?')
      ).not.toBeInTheDocument();
    });

    it('sends every question, clears local state and shows the results', async () => {
      student.submitExamAttempt.mockResolvedValue(
        submitted({ new_badges: [{ id: 'b1', name: 'First Steps' }] }) as any
      );
      const { store } = await startPaper();
      await userEvent.click(screen.getByRole('radio', { name: /9.8/ }));
      await userEvent.click(screen.getByRole('radio', { name: /Newton/ }));
      await userEvent.click(
        screen.getByRole('button', { name: 'Submit Paper' })
      );
      expect(
        screen.getByText(/ඔබ සියලුම ප්‍රශ්න සඳහා පිළිතුරු සපයා ඇත/)
      ).toBeInTheDocument();
      await userEvent.click(
        within(
          screen.getByText('Submit Answer Sheet?').parentElement!
        ).getByRole('button', { name: 'Submit Paper' })
      );
      expect(await screen.findByText('50%')).toBeInTheDocument();
      expect(student.submitExamAttempt).toHaveBeenCalledWith('att-1', {
        answers: [
          { question_id: 'q1', selected_option_id: 'q1a' },
          { question_id: 'q2', selected_option_id: 'q2a' },
        ],
      });
      expect(getOngoingExam('ex1')).toBeNull();
      expect(store.getState().badges.newlyEarned).toEqual([
        { id: 'b1', name: 'First Steps' },
      ]);
    });

    it('shows the result screen with the review', async () => {
      student.submitExamAttempt.mockResolvedValue(submitted() as any);
      await startPaper();
      await userEvent.click(
        screen.getByRole('button', { name: 'Submit Paper' })
      );
      await userEvent.click(
        within(
          screen.getByText('Submit Answer Sheet?').parentElement!
        ).getByRole('button', { name: 'Submit Paper' })
      );
      expect(await screen.findByText('Time Taken: 12:34')).toBeInTheDocument();
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('-')).toBeInTheDocument(); // no district rank
      expect(screen.getByText('✓ Correct')).toBeInTheDocument();
      expect(screen.getByText('✗ Incorrect')).toBeInTheDocument();
      expect(screen.getByText('Your Answer: A. 9.8 m/s²')).toBeInTheDocument();
      expect(screen.getByText('Your Answer: Not answered')).toBeInTheDocument();
      expect(screen.getByText('Correct Answer: A. Newton')).toBeInTheDocument();
      expect(screen.getByText('Earth gravity')).toBeInTheDocument();
      expect(screen.getByTitle('Explanation Video')).toHaveAttribute(
        'src',
        'https://www.youtube.com/embed/AAAAAAAAAAA'
      );
    });

    it.each([
      [
        'https://youtu.be/BBBBBBBBBBB?t=1',
        'https://www.youtube.com/embed/BBBBBBBBBBB',
      ],
      [
        'https://youtube.com/embed/CCCCCCCCCCC?rel=0',
        'https://www.youtube.com/embed/CCCCCCCCCCC',
      ],
      ['https://vimeo.com/1', 'https://vimeo.com/1'],
    ])('embeds explanation video %s', async (url, src) => {
      nav.setSearch({ view: 'results' });
      student.getLastAttempt.mockResolvedValue(
        submitted({
          review: [
            {
              question_id: 'q1',
              question_text: 'Q',
              is_correct: true,
              video_url: url,
            },
          ],
        }) as any
      );
      renderWithStore(<StudentExamPage />, { store: signedIn() });
      expect(await screen.findByTitle('Explanation Video')).toHaveAttribute(
        'src',
        src
      );
    });

    it('links back to the dashboard and the course', async () => {
      nav.setSearch({ view: 'results' });
      student.getLastAttempt.mockResolvedValue(submitted() as any);
      renderWithStore(<StudentExamPage />, { store: signedIn() });
      await userEvent.click(
        await screen.findByRole('button', { name: 'Back to Course' })
      );
      expect(nav.router.push).toHaveBeenLastCalledWith('/student/courses/c9');
      await userEvent.click(
        screen.getByRole('button', { name: 'Back to Dashboard' })
      );
      expect(nav.router.push).toHaveBeenLastCalledWith('/dashboard');
    });

    it('falls back to the course list when the result has no course', async () => {
      nav.setSearch({ view: 'results' });
      student.getLastAttempt.mockResolvedValue(
        submitted({
          ranking: { exam_title: 'P', course_id: 'undefined' },
        }) as any
      );
      renderWithStore(<StudentExamPage />, { store: signedIn() });
      await userEvent.click(
        await screen.findByRole('button', { name: 'Back to Course' })
      );
      expect(nav.router.push).toHaveBeenCalledWith('/student/courses');
    });

    // Bug: a failed manual submit closes the dialog and leaves the student on
    // the paper with no message (the error only lands in Redux state).
    test.failing('tells the student when a manual submit fails', async () => {
      student.submitExamAttempt.mockImplementation(() =>
        httpError(500, { detail: 'Could not save answers' })
      );
      await startPaper();
      await userEvent.click(
        screen.getByRole('button', { name: 'Submit Paper' })
      );
      await userEvent.click(
        within(
          screen.getByText('Submit Answer Sheet?').parentElement!
        ).getByRole('button', { name: 'Submit Paper' })
      );
      expect(
        await screen.findByText('Could not save answers')
      ).toBeInTheDocument();
    });

    it('auto-submits when time runs out', async () => {
      student.startExam.mockResolvedValue(
        started({ ends_at: new Date(Date.now() + 900).toISOString() }) as any
      );
      student.submitExamAttempt.mockResolvedValue(submitted() as any);
      await startPaper();
      await waitFor(
        () => expect(student.submitExamAttempt).toHaveBeenCalledTimes(1),
        { timeout: 3000 }
      );
      expect(await screen.findByText('50%')).toBeInTheDocument();
    });

    it('warns when the auto-submit fails, and clears the saved attempt', async () => {
      student.startExam.mockResolvedValue(
        started({ ends_at: new Date(Date.now() + 900).toISOString() }) as any
      );
      student.submitExamAttempt.mockImplementation(() => httpError(500));
      await startPaper();
      expect(
        await screen.findByText('Auto-Submit Error', {}, { timeout: 3000 })
      ).toBeInTheDocument();
      expect(getOngoingExam('ex1')).toBeNull();
      expect(
        screen.getByRole('button', { name: 'Submit Paper' })
      ).toBeDisabled(); // time is up
      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByText('Auto-Submit Error')).not.toBeInTheDocument();
    });
  });

  describe('integrity rules', () => {
    let hidden = false;
    beforeAll(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => hidden,
      });
    });
    afterEach(() => {
      hidden = false;
    });

    const switchTab = () => {
      hidden = true;
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
    };

    it('wipes answers, reports and warns when the student leaves the tab', async () => {
      await startPaper();
      await userEvent.click(screen.getByRole('radio', { name: /9.8/ }));
      switchTab();
      expect(student.reportViolation).toHaveBeenCalledWith(
        'att-1',
        'tab_switch'
      );
      expect(
        screen.getByText('⚠️ නීති උල්ලංඝනය කිරීමක් හඳුනා ගන්නා ලදී!')
      ).toBeInTheDocument();
      expect(
        screen.getByText('නීති උල්ලංඝනය කිරීම් ප්‍රමාණය: 1')
      ).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /9.8/ })).not.toBeChecked();
      expect(
        screen.getByText('⚠️ 1 rule violations detected')
      ).toBeInTheDocument();
      hidden = false;
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(
        screen.queryByText('⚠️ නීති උල්ලංඝනය කිරීමක් හඳුනා ගන්නා ලදී!')
      ).not.toBeInTheDocument();
    });

    it('a click dismisses the violation overlay', async () => {
      await startPaper();
      switchTab();
      fireEvent.click(screen.getByText('1. What is g?'));
      expect(
        screen.queryByText('⚠️ නීති උල්ලංඝනය කිරීමක් හඳුනා ගන්නා ලදී!')
      ).not.toBeInTheDocument();
    });

    it('does not penalise mobile devices for the screen turning off', async () => {
      const ua = jest
        .spyOn(window.navigator, 'userAgent', 'get')
        .mockReturnValue('Mozilla/5.0 (iPhone)');
      try {
        await startPaper();
        switchTab();
        expect(student.reportViolation).not.toHaveBeenCalled();
        expect(
          screen.queryByText(/rule violations detected/)
        ).not.toBeInTheDocument();
      } finally {
        ua.mockRestore();
      }
    });

    it.each([
      [{ key: 'PrintScreen' }],
      [{ key: '4', metaKey: true, shiftKey: true }],
      [{ key: 'p', metaKey: true }],
    ])('treats %o as a screenshot attempt', async (keys) => {
      await startPaper();
      await userEvent.click(screen.getByRole('radio', { name: /Newton/ }));
      fireEvent.keyDown(document, keys);
      expect(
        screen.getByText('🚨 Rule Violation Detected!')
      ).toBeInTheDocument();
      expect(student.reportViolation).toHaveBeenCalledWith(
        'att-1',
        'other',
        'screenshot_attempt'
      );
      expect(screen.getByRole('radio', { name: /Newton/ })).not.toBeChecked();
    });

    it('ignores ordinary keys and blocks the context menu', async () => {
      await startPaper();
      fireEvent.keyDown(document, { key: 'a' });
      expect(
        screen.queryByText('🚨 Rule Violation Detected!')
      ).not.toBeInTheDocument();
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });

    it('stops watching once the paper is submitted', async () => {
      student.submitExamAttempt.mockResolvedValue(submitted() as any);
      await startPaper();
      await userEvent.click(
        screen.getByRole('button', { name: 'Submit Paper' })
      );
      await userEvent.click(
        within(
          screen.getByText('Submit Answer Sheet?').parentElement!
        ).getByRole('button', { name: 'Submit Paper' })
      );
      await screen.findByText('50%');
      switchTab();
      expect(student.reportViolation).not.toHaveBeenCalled();
    });
  });
});

describe('Results PDF', () => {
  it('captures the summary and each review item into the PDF', async () => {
    nav.setSearch({ view: 'results' });
    student.getLastAttempt.mockResolvedValue(submitted() as any);
    jest
      .mocked(html2canvas)
      .mockResolvedValue({
        width: 100,
        height: 20,
        toDataURL: () => 'img',
      } as any);
    renderWithStore(<StudentExamPage />, { store: signedIn() });
    await userEvent.click(
      await screen.findByRole('button', { name: /Download PDF/ })
    );
    expect(screen.getByText(/Watch:/)).toBeInTheDocument(); // videos become links while capturing
    await waitFor(() =>
      expect(pdf.save).toHaveBeenCalledWith('exam-results-ex1.pdf')
    );
    expect(html2canvas).toHaveBeenCalledTimes(3);
    expect(pdf.text).toHaveBeenCalledWith('Score: 50% | 1/2', 200, 21, {
      align: 'right',
    });
    expect(pdf.text).toHaveBeenCalledWith('Page 1 / 1', 200, 282, {
      align: 'right',
    });
    expect(await screen.findByTitle('Explanation Video')).toBeInTheDocument();
  });
});
