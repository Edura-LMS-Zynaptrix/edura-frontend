jest.mock(
  'next/navigation',
  () => require('@/test-utils/navigation').navigationMock
);
jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock());
jest.mock('@/lib/api/auth');
jest.mock('@/lib/api/student');
jest.mock('@/components/CheckpointOverlay', () => ({
  __esModule: true,
  default: ({ checkpoint, onSuccess }: any) => (
    <div role="dialog" aria-label="checkpoint">
      {checkpoint.question}
      <button onClick={onSuccess}>Answer correctly</button>
    </div>
  ),
}));

import { Component, type ReactNode } from 'react';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authApi from '@/lib/api/auth';
import * as studentApi from '@/lib/api/student';
import CourseOverviewPage from '@/app/student/courses/[courseId]/page';
import VideoClassPlayerPage from '@/app/student/video-classes/[courseId]/page';
import { clearNeedsProfileCompletion } from '@/lib/redux/slices/authSlice';
import { saveOngoingExam } from '@/lib/ongoingExam';
import { httpError } from '@/test-utils/api';
import { nav } from '@/test-utils/navigation';
import { makeStore, renderWithStore } from '@/test-utils/store';

class Boundary extends Component<
  { children: ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  render() {
    return this.state.crashed ? <p>crashed</p> : this.props.children;
  }
}

const auth = authApi as jest.Mocked<typeof authApi>;
const student = studentApi as jest.Mocked<typeof studentApi>;
const signedIn = (extra: any = {}) =>
  makeStore({
    auth: {
      isAuthenticated: true,
      isInitialized: true,
      user: { id: '7', role: 'student' } as any,
    },
    ...extra,
  });

beforeEach(() => {
  nav.reset();
  jest.resetAllMocks();
  nav.params = { courseId: 'c1' };
  student.getStreams.mockResolvedValue([
    { id: 's1', name: 'Physical Science' },
  ] as any);
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Course overview page', () => {
  const exam = (id: string, extra: any = {}) => ({
    id,
    title: `Exam ${id}`,
    image_url: null,
    total_questions: 40,
    duration_minutes: 60,
    is_enrolled: false,
    is_locked: false,
    already_attempted: false,
    is_passed: false,
    scheduled_start: null,
    ...extra,
  });
  const examCourse = (extra: any = {}) => ({
    id: 'c1',
    title: 'Physics Papers',
    description: 'Every past paper',
    price: 2500,
    course_type: 'exam',
    image_url: null,
    stream_ids: ['s1', 'gone'],
    is_enrolled: false,
    progress_percentage: 0,
    enrollment_expires_at: null,
    sub_courses: [
      {
        id: 'l1',
        title: 'Mechanics',
        description: 'Forces',
        order_number: 1,
        image_url: null,
        is_enrolled: false,
        exams: [exam('e1'), exam('e2')],
      },
      {
        id: 'l2',
        title: 'Waves',
        description: null,
        order_number: 0,
        image_url: 'https://cdn/w.png',
        is_enrolled: false,
        exams: [],
      },
    ],
    ...extra,
  });
  const videoCourse = (extra: any = {}) => ({
    id: 'c1',
    title: 'Physics Videos',
    description: null,
    price: 0,
    course_type: 'video',
    image_url: 'https://cdn/c.png',
    stream_ids: [],
    is_enrolled: false,
    modules: [
      {
        id: 'm1',
        title: 'Motion',
        description: 'Speed and velocity',
        order_number: 1,
        image_url: null,
        is_enrolled: false,
        video_count: 4,
      },
      {
        id: 'm2',
        title: 'Energy',
        description: null,
        order_number: 2,
        image_url: 'https://cdn/e.png',
        is_enrolled: true,
        video_count: 2,
        progress_percentage: 100,
      },
    ],
    ...extra,
  });

  it('loads the course and shows a spinner meanwhile', () => {
    student.getCourseOverview.mockReturnValue(new Promise(() => {}));
    renderWithStore(<CourseOverviewPage />);
    expect(
      screen.getByText('Preparing your course overview...')
    ).toBeInTheDocument();
    expect(student.getCourseOverview).toHaveBeenCalledWith('c1');
    expect(student.getStreams).toHaveBeenCalled();
  });

  it('shows the load error', async () => {
    student.getCourseOverview.mockImplementation(() =>
      httpError(404, { detail: 'Course not found' })
    );
    renderWithStore(<CourseOverviewPage />);
    expect(await screen.findByText('Course not found')).toBeInTheDocument();
  });

  it('shows the header, price and locked lessons for visitors', async () => {
    student.getCourseOverview.mockResolvedValue(examCourse() as any);
    renderWithStore(<CourseOverviewPage />);
    expect(
      await screen.findByRole('heading', { name: 'Physics Papers' })
    ).toBeInTheDocument();
    expect(screen.getByText('Every past paper')).toBeInTheDocument();
    expect(screen.getByText('LKR 2,500')).toBeInTheDocument();
    expect(await screen.findByText('Physical Science')).toBeInTheDocument();
    expect(screen.getByText('Stream')).toBeInTheDocument();
    expect(screen.getAllByText('Lesson Locked')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'LOCKED' })).toHaveLength(2);
    expect(screen.getByText('No exams yet')).toBeInTheDocument();
    expect(screen.getAllByText('Lesson 1')).toHaveLength(2); // order 0 is shown as lesson 1 too
  });

  it('goes back to the course list', async () => {
    student.getCourseOverview.mockResolvedValue(examCourse() as any);
    renderWithStore(<CourseOverviewPage />);
    await userEvent.click(
      await screen.findByRole('button', { name: /Exams \/ Courses/ })
    );
    expect(nav.router.push).toHaveBeenCalledWith('/student/courses');
  });

  it('sends visitors to log in before buying', async () => {
    window.history.pushState({}, '', '/student/courses/c1');
    student.getCourseOverview.mockResolvedValue(examCourse() as any);
    renderWithStore(<CourseOverviewPage />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Purchase Course' })
    );
    expect(nav.router.push).toHaveBeenCalledWith(
      '/login?callbackUrl=%2Fstudent%2Fcourses%2Fc1'
    );
  });

  it('takes signed-in students to payment', async () => {
    student.getCourseOverview.mockResolvedValue(examCourse() as any);
    renderWithStore(<CourseOverviewPage />, { store: signedIn() });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Purchase Course' })
    );
    expect(nav.router.push).toHaveBeenCalledWith(
      '/payment?type=course&id=c1&name=Physics%20Papers&amount=2500'
    );
  });

  it('enrols in a free exam course and reloads it', async () => {
    student.getCourseOverview.mockResolvedValue(
      examCourse({ price: 0 }) as any
    );
    student.enrollFreeCourse.mockResolvedValue({} as any);
    renderWithStore(<CourseOverviewPage />, { store: signedIn() });
    expect(await screen.findByText('Free')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enroll Now' }));
    expect(student.enrollFreeCourse).toHaveBeenCalledWith('c1');
    await waitFor(() =>
      expect(student.getCourseOverview).toHaveBeenCalledTimes(2)
    );
  });

  it('enrols in a free video course with the video endpoint', async () => {
    student.getCourseOverview.mockResolvedValue(videoCourse() as any);
    student.enrollFreeVideoCourse.mockResolvedValue({} as any);
    renderWithStore(<CourseOverviewPage />, { store: signedIn() });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Enroll Now' })
    );
    expect(student.enrollFreeVideoCourse).toHaveBeenCalledWith('c1');
    expect(student.enrollFreeCourse).not.toHaveBeenCalled();
  });

  // Bug: the enrol thunks' rejected case sets courses.studentError, which the
  // page treats as a load failure, so the whole course is replaced by the
  // error box and the "Enrollment Failed" modal can never appear.
  it.each([
    ['exam', examCourse, 'enrollFreeCourse'],
    ['video', videoCourse, 'enrollFreeVideoCourse'],
  ] as const)(
    'a failed free %s enrolment currently replaces the page with the error',
    async (_, build, method) => {
      student.getCourseOverview.mockResolvedValue(build({ price: 0 }) as any);
      (student[method] as jest.Mock).mockImplementation(() =>
        httpError(400, { detail: 'Not your grade' })
      );
      renderWithStore(<CourseOverviewPage />, { store: signedIn() });
      await userEvent.click(
        await screen.findByRole('button', { name: 'Enroll Now' })
      );
      expect(await screen.findByText('Not your grade')).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { level: 1 })
      ).not.toBeInTheDocument();
    }
  );

  test.failing(
    'keeps the course on screen and explains a failed enrolment in a modal',
    async () => {
      student.getCourseOverview.mockResolvedValue(
        examCourse({ price: 0 }) as any
      );
      student.enrollFreeCourse.mockImplementation(() =>
        httpError(400, { detail: 'Not your grade' })
      );
      renderWithStore(<CourseOverviewPage />, { store: signedIn() });
      await userEvent.click(
        await screen.findByRole('button', { name: 'Enroll Now' })
      );
      expect(await screen.findByText('Enrollment Failed')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Physics Papers' })
      ).toBeInTheDocument();
    }
  );

  it.each([examCourse, videoCourse])(
    'sends visitors to log in before a free enrolment',
    async (build) => {
      window.history.pushState({}, '', '/student/courses/c1');
      student.getCourseOverview.mockResolvedValue(build({ price: 0 }) as any);
      renderWithStore(<CourseOverviewPage />);
      await userEvent.click(
        await screen.findByRole('button', { name: 'Enroll Now' })
      );
      expect(nav.router.push).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fstudent%2Fcourses%2Fc1'
      );
      expect(student.enrollFreeCourse).not.toHaveBeenCalled();
    }
  );

  describe('enrolled exam course', () => {
    const day = 24 * 60 * 60 * 1000;

    it('shows overall progress and the exam actions', async () => {
      student.getCourseOverview.mockResolvedValue(
        examCourse({
          is_enrolled: true,
          progress_percentage: 45,
          sub_courses: [
            {
              id: 'l1',
              title: 'Mechanics',
              order_number: 1,
              is_enrolled: false,
              progress_percentage: 100,
              exams: [
                exam('new'),
                exam('retake', { already_attempted: true, is_passed: false }),
                exam('done', {
                  already_attempted: true,
                  is_passed: true,
                  image_url: 'https://cdn/x.png',
                }),
              ],
            },
          ],
        }) as any
      );
      renderWithStore(<CourseOverviewPage />, { store: signedIn() });
      expect(await screen.findByText('45%')).toBeInTheDocument();
      expect(screen.getAllByText('Completed').length).toBeGreaterThan(0); // the lesson's progress bar
      expect(screen.getByText('Retake Exam')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Purchase Course' })
      ).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Start' }));
      expect(nav.router.push).toHaveBeenLastCalledWith('/student/exams/new');
      await userEvent.click(screen.getByRole('button', { name: 'Retake' }));
      expect(nav.router.push).toHaveBeenLastCalledWith('/student/exams/retake');
      const results = screen.getAllByRole('button', { name: 'Results' });
      expect(results).toHaveLength(2);
      await userEvent.click(results[1]);
      expect(nav.router.push).toHaveBeenLastCalledWith(
        '/student/exams/done?view=results'
      );
      expect(
        screen.getAllByRole('button', { name: /Start|Retake/ })
      ).toHaveLength(2); // passed exams cannot be retaken
    });

    it.each([
      [-1, 'Access expired — please re-enroll to continue.'],
      [1.5, 'Access expires in 1 day — renew soon!'],
      [10.5, 'Access expires in 10 days — renew soon!'],
    ])('warns about expiry %s days out', async (days, text) => {
      student.getCourseOverview.mockResolvedValue(
        examCourse({
          is_enrolled: true,
          enrollment_expires_at: new Date(
            Date.now() + days * day
          ).toISOString(),
        }) as any
      );
      renderWithStore(<CourseOverviewPage />, { store: signedIn() });
      expect(await screen.findByText(text)).toBeInTheDocument();
    });

    it('shows the end date when access lasts a while', async () => {
      student.getCourseOverview.mockResolvedValue(
        examCourse({
          is_enrolled: true,
          enrollment_expires_at: new Date(
            Date.now() + 100.5 * day
          ).toISOString(),
        }) as any
      );
      renderWithStore(<CourseOverviewPage />, { store: signedIn() });
      expect(
        await screen.findByText(/Access valid for 100 more days \(until/)
      ).toBeInTheDocument();
    });

    it('marks future exams as scheduled', async () => {
      student.getCourseOverview.mockResolvedValue(
        examCourse({
          is_enrolled: true,
          sub_courses: [
            {
              id: 'l1',
              title: 'L',
              is_enrolled: true,
              exams: [
                exam('e1', {
                  scheduled_start: new Date(Date.now() + day).toISOString(),
                }),
              ],
            },
          ],
        }) as any
      );
      renderWithStore(<CourseOverviewPage />, { store: signedIn() });
      expect(await screen.findByText('Scheduled')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Start' })
      ).not.toBeInTheDocument();
    });

    it('explains why an exam is locked', async () => {
      student.getCourseOverview.mockResolvedValue(
        examCourse({
          is_enrolled: true,
          sub_courses: [
            {
              id: 'l1',
              title: 'L',
              is_enrolled: true,
              exams: [
                exam('e1', {
                  is_locked: true,
                  lock_reason: 'score_too_low',
                  lock_message: 'Score 50% on Exam 0 first',
                }),
                exam('e2', {
                  is_locked: true,
                  lock_reason: 'previous_incomplete',
                  lock_message: 'Finish Exam 1 first',
                }),
              ],
            },
          ],
        }) as any
      );
      renderWithStore(<CourseOverviewPage />, { store: signedIn() });
      expect(
        await screen.findByText('🔒 Action Required: Score Too Low')
      ).toBeInTheDocument();
      expect(screen.getByText('Score 50% on Exam 0 first')).toBeInTheDocument();
      expect(screen.getByText('🔒 Action Required:')).toBeInTheDocument();
      expect(screen.getAllByText('Locked')).toHaveLength(2);
    });

    it('shows a live countdown for an exam already in progress', async () => {
      saveOngoingExam({
        examId: 'e1',
        attemptId: 'a1',
        endsAt: new Date(Date.now() + 125_000).toISOString(),
        examTitle: 'Exam e1',
        durationMinutes: 60,
        totalQuestions: 40,
      } as any);
      student.getCourseOverview.mockResolvedValue(
        examCourse({ is_enrolled: true }) as any
      );
      renderWithStore(<CourseOverviewPage />, { store: signedIn() });
      const resume = await screen.findByRole('button', { name: /^02:0[45]$/ });
      await userEvent.click(resume);
      expect(nav.router.push).toHaveBeenCalledWith('/student/exams/e1');
    });
  });

  describe('video course', () => {
    it('locks lessons until enrolled, except ones bought on their own', async () => {
      student.getCourseOverview.mockResolvedValue(videoCourse() as any);
      renderWithStore(<CourseOverviewPage />, { store: signedIn() });
      expect(
        await screen.findByText(
          'Please enroll in the course to access this lesson.'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('UNLOCKED')).toBeInTheDocument();
      expect(screen.getByText('2 Videos')).toBeInTheDocument();
      expect(
        screen.getByRole('img', { name: 'Physics Videos' })
      ).toHaveAttribute('src', 'https://cdn/c.png');
      await userEvent.click(
        screen.getByRole('button', { name: /Watch Lessons/ })
      );
      expect(nav.router.push).toHaveBeenCalledWith('/student/video-classes/c1');
    });

    it('lets enrolled students continue the class', async () => {
      student.getCourseOverview.mockResolvedValue(
        videoCourse({ is_enrolled: true }) as any
      );
      renderWithStore(<CourseOverviewPage />, { store: signedIn() });
      await userEvent.click(
        await screen.findByRole('button', { name: /Continue Video Class/ })
      );
      expect(nav.router.push).toHaveBeenCalledWith('/student/video-classes/c1');
      expect(screen.getAllByText('UNLOCKED')).toHaveLength(2);
    });

    it('says when there are no lessons yet', async () => {
      student.getCourseOverview.mockResolvedValue(
        videoCourse({ modules: [] }) as any
      );
      renderWithStore(<CourseOverviewPage />);
      expect(
        await screen.findByText('No lessons added yet.')
      ).toBeInTheDocument();
    });
  });

  it('says when an exam course has no content yet', async () => {
    student.getCourseOverview.mockResolvedValue(
      examCourse({ sub_courses: [] }) as any
    );
    renderWithStore(<CourseOverviewPage />);
    expect(
      await screen.findByText('No content added yet.')
    ).toBeInTheDocument();
  });

  it('renders nothing while the profile still needs completing', () => {
    const { container } = renderWithStore(<CourseOverviewPage />, {
      store: makeStore({ auth: { needsProfileCompletion: true } }),
    });
    expect(container).toBeEmptyDOMElement();
  });

  // Bug: returns before its hooks run (same as CourseList and Rankings).
  test.failing(
    'keeps working when profile completion finishes while mounted',
    async () => {
      student.getCourseOverview.mockResolvedValue(examCourse() as any);
      const store = makeStore({ auth: { needsProfileCompletion: true } });
      renderWithStore(<CourseOverviewPage />, { store });
      act(() => {
        store.dispatch(clearNeedsProfileCompletion());
      });
      expect(
        await screen.findByRole('heading', { name: 'Physics Papers' })
      ).toBeInTheDocument();
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Video class player page', () => {
  const PlayerState = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 };
  let player: Record<string, jest.Mock>;
  let playerOptions: any[];
  const Player = jest.fn();

  const video = (id: string, extra: any = {}) => ({
    id,
    module_id: 'm1',
    title: `Video ${id}`,
    description: null,
    order_number: 1,
    duration_seconds: 125,
    yt_video_id: 'abcdefghijk',
    is_completed: false,
    materials: [],
    checkpoints: [],
    ...extra,
  });
  const course = (extra: any = {}) => ({
    id: 'c1',
    title: 'Physics Videos',
    grade: 12,
    modules: [
      {
        id: 'm2',
        title: 'Energy',
        order_number: 2,
        materials: [],
        videos: [video('v3', { module_id: 'm2', order_number: 1 })],
      },
      {
        id: 'm1',
        title: 'Motion',
        order_number: 1,
        materials: [
          {
            id: 'mat-shared',
            title: 'Lesson notes',
            file_url: 'https://cdn/notes.pdf',
            video_id: null,
          },
          {
            id: 'mat-v2',
            title: 'Belongs to v2',
            file_url: 'https://cdn/v2.pdf',
            video_id: 'v2',
          },
        ],
        videos: [
          video('v2', {
            order_number: 2,
            is_completed: true,
            duration_seconds: 3725,
            yt_video_id: 'https://youtu.be/zyxwvutsrqp',
          }),
          video('v1', {
            description: 'Intro to motion',
            materials: [
              {
                id: 'mat-v1',
                title: 'Worksheet',
                file_url: 'https://cdn/ws.pdf',
              },
            ],
          }),
        ],
      },
    ],
    ...extra,
  });

  beforeEach(() => {
    player = Object.fromEntries(
      [
        'loadVideoById',
        'getCurrentTime',
        'getDuration',
        'pauseVideo',
        'playVideo',
        'seekTo',
        'setVolume',
        'setPlaybackRate',
        'mute',
        'unMute',
        'destroy',
      ].map((m) => [m, jest.fn()])
    );
    player.getCurrentTime.mockReturnValue(0);
    player.getDuration.mockReturnValue(0);
    playerOptions = [];
    Player.mockReset().mockImplementation(function (_el: string, options: any) {
      playerOptions.push(options);
      return player;
    });
    (window as any).YT = { Player, PlayerState };
    document.body.style.overflow = '';
  });

  afterEach(() => {
    delete (window as any).YT;
  });

  const clock = () => document.querySelector('.tabular-nums')?.textContent;
  const lastPlayer = () => playerOptions[playerOptions.length - 1];
  const renderPlayer = async (c: any = course()) => {
    student.getVideoClassDetails.mockResolvedValue(c);
    const result = renderWithStore(<VideoClassPlayerPage />, {
      store: signedIn(),
    });
    await screen.findByRole('heading', { level: 1 });
    return result;
  };
  const fireReady = () =>
    act(() =>
      lastPlayer().events.onReady({
        target: { ...player, getDuration: () => 125 },
      })
    );
  const fireState = (data: number) =>
    act(() => lastPlayer().events.onStateChange({ data }));
  const controls = (container: HTMLElement) => {
    const row =
      container.querySelector('.tabular-nums')!.parentElement!.parentElement!;
    const [left, right] = Array.from(row.children) as HTMLElement[];
    const [play, rewind] = Array.from(
      left.querySelectorAll(':scope > button')
    ) as HTMLElement[];
    const mute = left.querySelector('.group\\/volume button') as HTMLElement;
    const [theater, fullscreen] = Array.from(
      right.querySelectorAll(':scope > button')
    ) as HTMLElement[];
    return {
      play,
      rewind,
      mute,
      theater,
      fullscreen,
      speed: within(right).getByRole('button', { name: /x$/ }),
    };
  };

  it('sends visitors to log in', () => {
    nav.pathname = '/student/video-classes/c1';
    student.getVideoClassDetails.mockReturnValue(new Promise(() => {}));
    renderWithStore(<VideoClassPlayerPage />, {
      store: makeStore({ auth: { isInitialized: true } }),
    });
    expect(nav.router.push).toHaveBeenCalledWith(
      '/login?callbackUrl=%2Fstudent%2Fvideo-classes%2Fc1'
    );
  });

  it('fetches the user when signed in without one', async () => {
    auth.getCurrentUser.mockResolvedValue({ id: '7', role: 'student' } as any);
    student.getVideoClassDetails.mockResolvedValue(course() as any);
    renderWithStore(<VideoClassPlayerPage />, {
      store: makeStore({
        auth: { isAuthenticated: true, isInitialized: true },
      }),
    });
    await waitFor(() => expect(auth.getCurrentUser).toHaveBeenCalled());
  });

  it('shows the course, progress and the first lesson of the first module', async () => {
    await renderPlayer();
    expect(student.getVideoClassDetails).toHaveBeenCalledWith('c1');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Physics Videos'
    );
    expect(screen.getByText('Grade 12', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('33% COMPLETE')).toBeInTheDocument(); // 1 of 3 videos done
    expect(screen.getByText('Total lessons: 3')).toBeInTheDocument();
    // Modules are sorted, but the first lesson comes from the API's first module.
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Video v3'
    );
    expect(
      screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    ).toEqual(['Motion', 'Energy']);
    expect(screen.getByRole('link', { name: '' })).toHaveAttribute(
      'href',
      '/student/courses/c1'
    );
  });

  it('starts the YouTube player for the current lesson', async () => {
    await renderPlayer();
    await waitFor(() => expect(Player).toHaveBeenCalledTimes(1));
    expect(Player.mock.calls[0][0]).toBe('youtube-player-element');
    expect(lastPlayer()).toMatchObject({
      videoId: 'abcdefghijk',
      playerVars: { autoplay: 1, controls: 0 },
    });
    fireReady();
    expect(player.setVolume).toHaveBeenCalledWith(100);
    expect(player.setPlaybackRate).toHaveBeenCalledWith(1);
    expect(player.playVideo).toHaveBeenCalled();
  });

  it.each([
    ['https://youtu.be/zyxwvutsrqp?t=4', 'zyxwvutsrqp'],
    ['https://www.youtube.com/watch?v=AAAAAAAAAAA&list=x', 'AAAAAAAAAAA'],
    ['youtube.com/embed/BBBBBBBBBBB', 'BBBBBBBBBBB'],
    ['https://m.youtube.com/shorts/CCCCCCCCCCC', 'CCCCCCCCCCC'],
    ['https://example.com/video', 'https://example.com/video'],
  ])('reads the video id from %s', async (url, id) => {
    await renderPlayer(
      course({
        modules: [
          {
            id: 'm1',
            title: 'M',
            order_number: 1,
            videos: [video('v1', { yt_video_id: url })],
          },
        ],
      })
    );
    await waitFor(() => expect(Player).toHaveBeenCalled());
    expect(lastPlayer().videoId).toBe(id);
  });

  it('loads the YouTube script when the API is missing and starts once it is ready', async () => {
    delete (window as any).YT;
    document.head.appendChild(document.createElement('script'));
    await renderPlayer();
    expect(
      document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
    ).toBeInTheDocument();
    (window as any).YT = { Player, PlayerState };
    act(() => (window as any).onYouTubeIframeAPIReady());
    expect(Player).toHaveBeenCalledTimes(1);
  });

  it('switches lessons from the curriculum', async () => {
    await renderPlayer();
    await waitFor(() => expect(Player).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', { name: /Motion/ }));
    await userEvent.click(screen.getByRole('button', { name: /Video v1/ }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Video v1'
    );
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
    await waitFor(() => expect(Player).toHaveBeenCalledTimes(2));
    expect(player.destroy).toHaveBeenCalled(); // the old player had no iframe left
    expect(screen.getByText('Intro to motion')).toBeInTheDocument();
  });

  it('reuses a live player when switching lessons', async () => {
    await renderPlayer();
    await waitFor(() => expect(Player).toHaveBeenCalledTimes(1));
    const iframe = document.createElement('iframe');
    document.getElementById('youtube-player-element')!.appendChild(iframe);
    await userEvent.click(screen.getByRole('button', { name: /Motion/ }));
    await userEvent.click(screen.getByRole('button', { name: /Video v2/ }));
    await waitFor(() =>
      expect(player.loadVideoById).toHaveBeenCalledWith('zyxwvutsrqp')
    );
    expect(Player).toHaveBeenCalledTimes(1);
  });

  it("lists the lesson's own and shared materials", async () => {
    await renderPlayer();
    await userEvent.click(screen.getByRole('button', { name: /Motion/ }));
    await userEvent.click(screen.getByRole('button', { name: /Video v1/ }));
    const resources = screen.getByRole('heading', { name: 'Resources' })
      .nextElementSibling as HTMLElement;
    expect(
      within(resources)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href'))
    ).toEqual(['https://cdn/ws.pdf', 'https://cdn/notes.pdf']);
    expect(screen.getAllByText('Worksheet')).toHaveLength(2); // also linked from the sidebar
  });

  it('shows placeholder text and no materials for a bare lesson', async () => {
    await renderPlayer();
    expect(
      screen.getByText(/In this session, we investigate key principles/)
    ).toBeInTheDocument();
    expect(screen.getByText('No Materials Available')).toBeInTheDocument();
  });

  it('collapses and expands modules', async () => {
    await renderPlayer();
    expect(
      screen.getByRole('button', { name: /Video v3/ })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Energy/ }));
    expect(
      screen.queryByRole('button', { name: /Video v3/ })
    ).not.toBeInTheDocument();
  });

  it('formats durations in the sidebar and header', async () => {
    await renderPlayer();
    await userEvent.click(screen.getByRole('button', { name: /Motion/ }));
    expect(screen.getByText('62m 5s')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Video v2/ }));
    expect(screen.getAllByText('1:02:05').length).toBeGreaterThan(0);
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
  });

  describe('player controls', () => {
    it('plays, pauses and shows buffering from player events', async () => {
      const { container } = await renderPlayer();
      await waitFor(() => expect(Player).toHaveBeenCalled());
      const { play } = controls(container);
      await userEvent.click(play);
      expect(player.playVideo).toHaveBeenCalled();
      fireState(PlayerState.PLAYING);
      await userEvent.click(play);
      expect(player.pauseVideo).toHaveBeenCalled();
      fireState(PlayerState.BUFFERING);
      expect(
        container.querySelector('.backdrop-blur-sm .animate-spin')
      ).toBeInTheDocument();
    });

    it('ignores play before the player exists', async () => {
      Player.mockImplementation(() => ({}));
      const { container } = await renderPlayer();
      await userEvent.click(controls(container).play);
      expect(player.playVideo).not.toHaveBeenCalled();
    });

    it('rewinds ten seconds, not below zero', async () => {
      const { container } = await renderPlayer();
      await waitFor(() => expect(Player).toHaveBeenCalled());
      await userEvent.click(controls(container).rewind);
      expect(player.seekTo).toHaveBeenCalledWith(0, true);
      player.getCurrentTime.mockReturnValue(50);
      await waitFor(() => expect(clock()).toBe('0:50 / 2:05'));
      await userEvent.click(controls(container).rewind);
      expect(player.seekTo).toHaveBeenLastCalledWith(40, true);
    });

    it('seeks and changes volume with the sliders', async () => {
      const { container } = await renderPlayer();
      await waitFor(() => expect(Player).toHaveBeenCalled());
      const [seek, volume] = screen.getAllByRole('slider');
      fireEvent.change(seek, { target: { value: '30' } });
      expect(player.seekTo).toHaveBeenCalledWith(30, true);
      fireEvent.change(volume, { target: { value: '40' } });
      expect(player.setVolume).toHaveBeenCalledWith(40);
      await userEvent.click(controls(container).mute);
      expect(player.mute).toHaveBeenCalled();
      expect(volume).toHaveValue('0');
      fireEvent.change(volume, { target: { value: '20' } }); // raising the volume unmutes
      expect(volume).toHaveValue('20');
      await userEvent.click(controls(container).mute);
      await userEvent.click(controls(container).mute);
      expect(player.unMute).toHaveBeenCalled();
      expect(player.setVolume).toHaveBeenLastCalledWith(20);
    });

    it('shows the time under the cursor on the seek bar', async () => {
      await renderPlayer();
      const seek = screen.getAllByRole('slider')[0];
      seek.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect;
      fireEvent.mouseMove(seek, { clientX: 50 });
      expect(screen.getByText('1:02')).toBeInTheDocument();
      fireEvent.mouseLeave(seek);
      expect(screen.queryByText('1:02')).not.toBeInTheDocument();
    });

    it('changes the playback speed', async () => {
      const { container } = await renderPlayer();
      await waitFor(() => expect(Player).toHaveBeenCalled());
      await userEvent.click(controls(container).speed);
      await userEvent.click(screen.getByRole('button', { name: '1.5x' }));
      expect(player.setPlaybackRate).toHaveBeenCalledWith(1.5);
      expect(
        screen.queryByRole('button', { name: '0.5x' })
      ).not.toBeInTheDocument();
      expect(controls(container).speed).toHaveTextContent('1.5x');
    });

    it('toggles theater mode, hiding the curriculum', async () => {
      const { container } = await renderPlayer();
      await userEvent.click(controls(container).theater);
      expect(screen.queryByText('Course Curriculum')).not.toBeInTheDocument();
      await userEvent.click(controls(container).theater);
      expect(screen.getByText('Course Curriculum')).toBeInTheDocument();
    });

    it('toggles fullscreen with inline styles', async () => {
      const { container } = await renderPlayer();
      const box = container.querySelector('.group.shadow-2xl') as HTMLElement;
      await userEvent.click(controls(container).fullscreen);
      expect(box.style.position).toBe('fixed');
      expect(document.body.style.overflow).toBe('hidden');
      await userEvent.click(controls(container).fullscreen);
      expect(box.style.position).toBe('');
      expect(document.body.style.overflow).toBe('');
    });

    it('hides the controls while playing after the mouse stops', async () => {
      const { container } = await renderPlayer();
      await waitFor(() => expect(Player).toHaveBeenCalled());
      fireState(PlayerState.PLAYING);
      const box = container.querySelector('.group.shadow-2xl') as HTMLElement;
      const overlay = box.querySelector('.z-30') as HTMLElement;
      fireEvent.mouseLeave(box);
      expect(overlay.className).toContain('opacity-0');
      jest.useFakeTimers();
      try {
        fireEvent.mouseMove(box);
        expect(overlay.className).toContain('opacity-100');
        act(() => {
          jest.advanceTimersByTime(3000);
        });
        expect(overlay.className).toContain('opacity-0');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('completion', () => {
    it('marks a lesson complete with the course lesson count', async () => {
      student.updateVideoProgress.mockResolvedValue({} as any);
      await renderPlayer();
      await userEvent.click(
        screen.getByRole('button', { name: /MARK AS COMPLETE/ })
      );
      expect(student.updateVideoProgress).toHaveBeenCalledWith({
        course_id: 'c1',
        video_id: 'v3',
        total_lessons: 3,
        watch_duration_seconds: 125,
      });
      expect(await screen.findByText('67% COMPLETE')).toBeInTheDocument();
    });

    // Bug: the YouTube onStateChange handler is created once (initPlayer has no
    // deps) and calls the first render's markAsCompleted, where course is still
    // null, so finishing a video never records completion.
    test.failing('marks a lesson complete when the video ends', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      student.updateVideoProgress.mockResolvedValue({} as any);
      await renderPlayer();
      await waitFor(() => expect(Player).toHaveBeenCalled());
      fireState(PlayerState.ENDED);
      await waitFor(() =>
        expect(student.updateVideoProgress).toHaveBeenCalledWith(
          expect.objectContaining({ video_id: 'v3' })
        )
      );
    });

    it('does not re-send completed lessons', async () => {
      await renderPlayer(
        course({
          modules: [
            {
              id: 'm1',
              title: 'M',
              order_number: 1,
              videos: [video('v1', { is_completed: true })],
            },
          ],
        })
      );
      await waitFor(() => expect(Player).toHaveBeenCalled());
      fireState(PlayerState.ENDED);
      expect(student.updateVideoProgress).not.toHaveBeenCalled();
    });

    it('keeps the lesson incomplete when saving fails', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      student.updateVideoProgress.mockImplementation(() => httpError(500));
      await renderPlayer();
      await userEvent.click(
        screen.getByRole('button', { name: /MARK AS COMPLETE/ })
      );
      await waitFor(() =>
        expect(console.error).toHaveBeenCalledWith(
          'Failed completion',
          expect.anything()
        )
      );
      expect(screen.getByText('33% COMPLETE')).toBeInTheDocument();
    });

    // Bug: markAsCompleted updates the course list but not currentVideo, so the
    // button keeps saying "MARK AS COMPLETE" after a successful save.
    test.failing('shows the lesson as completed after marking it', async () => {
      student.updateVideoProgress.mockResolvedValue({} as any);
      await renderPlayer();
      await userEvent.click(
        screen.getByRole('button', { name: /MARK AS COMPLETE/ })
      );
      expect(await screen.findByText('COMPLETED')).toBeInTheDocument();
    });
  });

  describe('checkpoints', () => {
    const withCheckpoint = () =>
      course({
        modules: [
          {
            id: 'm1',
            title: 'M',
            order_number: 1,
            videos: [
              video('v1', {
                checkpoints: [
                  { id: 'cp2', timestamp_seconds: 60, question: 'Second?' },
                  { id: 'cp1', timestamp_seconds: 20, question: 'First?' },
                ],
              }),
            ],
          },
        ],
      });

    it('pauses at the earliest missed checkpoint and resumes after a correct answer', async () => {
      const { container } = await renderPlayer(withCheckpoint());
      await waitFor(() => expect(Player).toHaveBeenCalled());
      player.getCurrentTime.mockReturnValue(90);
      expect(
        await screen.findByRole('dialog', { name: 'checkpoint' })
      ).toHaveTextContent('First?');
      expect(player.pauseVideo).toHaveBeenCalled();
      expect(player.seekTo).toHaveBeenCalledWith(20, true);
      player.playVideo.mockClear();
      await userEvent.click(controls(container).play); // blocked during a checkpoint
      expect(player.playVideo).not.toHaveBeenCalled();
      await userEvent.click(
        screen.getByRole('button', { name: 'Answer correctly' })
      );
      expect(player.playVideo).toHaveBeenCalled();
      expect(
        await screen.findByRole('dialog', { name: 'checkpoint' })
      ).toHaveTextContent('Second?');
      await userEvent.click(
        screen.getByRole('button', { name: 'Answer correctly' })
      );
      await new Promise((r) => setTimeout(r, 300));
      expect(
        screen.queryByRole('dialog', { name: 'checkpoint' })
      ).not.toBeInTheDocument();
    });

    it('clamps the clock to the lesson length', async () => {
      await renderPlayer();
      await waitFor(() => expect(Player).toHaveBeenCalled());
      player.getCurrentTime.mockReturnValue(500);
      await waitFor(() => expect(clock()).toBe('2:05 / 2:05'));
    });

    it('uses the live duration when the lesson has none', async () => {
      await renderPlayer(
        course({
          modules: [
            {
              id: 'm1',
              title: 'M',
              order_number: 1,
              videos: [video('v1', { duration_seconds: 0 })],
            },
          ],
        })
      );
      await waitFor(() => expect(Player).toHaveBeenCalled());
      player.getDuration.mockReturnValue(90);
      player.getCurrentTime.mockReturnValue(30);
      await waitFor(() => expect(clock()).toBe('0:30 / 1:30'));
    });
  });

  it('renders nothing while the profile still needs completing', () => {
    const { container } = renderWithStore(<VideoClassPlayerPage />, {
      store: makeStore({ auth: { needsProfileCompletion: true } }),
    });
    expect(container).toBeEmptyDOMElement();
    expect(student.getVideoClassDetails).not.toHaveBeenCalled();
  });

  // Bug: a failed load sets `error` but the page then reads course.title on a
  // null course and crashes instead of showing the message.
  test.failing('shows the error when the course fails to load', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    student.getVideoClassDetails.mockImplementation(() =>
      httpError(403, { detail: 'Not enrolled' })
    );
    renderWithStore(
      <Boundary>
        <VideoClassPlayerPage />
      </Boundary>,
      { store: signedIn() }
    );
    expect(await screen.findByText('Not enrolled')).toBeInTheDocument();
  });
});
