jest.mock(
  'next/navigation',
  () => require('@/test-utils/navigation').navigationMock
);
jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock());
jest.mock('@/lib/api/auth');
jest.mock('@/lib/api/admin');

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as adminApi from '@/lib/api/admin';
import * as authApi from '@/lib/api/auth';
import CourseExamsPage from '@/app/admin/courses/[courseId]/sub-courses/[subCourseId]/exams/page';
import QuestionsPage from '@/app/admin/courses/[courseId]/sub-courses/[subCourseId]/exams/[examId]/questions/page';
import { httpError } from '@/test-utils/api';
import { nav } from '@/test-utils/navigation';
import { makeStore, renderWithStore } from '@/test-utils/store';

const admin = adminApi as jest.Mocked<typeof adminApi>;
const auth = authApi as jest.Mocked<typeof authApi>;

const asRole = (role: string, extra: any = {}) =>
  makeStore({
    auth: {
      isAuthenticated: true,
      isInitialized: true,
      user: { id: 'a1b2c3d4e5', role, email: 'admin@edura.lk' } as any,
    },
    ...extra,
  });

const png = (name = 'pic.png') =>
  new File(['img'], name, { type: 'image/png' });
const fileInputs = () =>
  Array.from(
    document.querySelectorAll('input[type="file"]')
  ) as HTMLInputElement[];

const mathsCourse = (extra: any = {}) => ({
  id: 'c1',
  title: 'Combined Maths',
  subject: 'Maths',
  grade: 10,
  course_type: 'exam',
  image_url: null,
  price: 1500,
  stream_ids: [],
  sub_courses: [
    {
      id: 'l1',
      course_id: 'c1',
      title: 'Algebra',
      is_active: true,
      order_number: 1,
    },
  ],
  ...extra,
});

let confirmSpy: jest.SpyInstance;
beforeEach(() => {
  nav.reset();
  jest.resetAllMocks();
  confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => confirmSpy.mockRestore());

// ─────────────────────────────────────────────────────────────────────────────
describe('Lesson exams', () => {
  const exam = (id: string, extra: any = {}) => ({
    id,
    course_id: 'c1',
    sub_course_id: 'l1',
    title: `Exam ${id}`,
    image_url: null,
    image_public_id: null,
    description: null,
    duration_minutes: 60,
    total_questions: 10,
    order_number: 1,
    scheduled_start: null,
    ...extra,
  });
  const exams = [
    exam('e1', {
      title: 'Paper 2',
      order_number: 2,
      duration_minutes: 90,
      total_questions: 25,
      description: 'Final paper',
      image_url: 'https://img/e1.png',
      image_public_id: 'pid-e1',
      scheduled_start: '2026-11-01T04:00:00.000Z',
    }),
    exam('e2', { title: 'Paper 1', order_number: 1 }),
    exam('e3', { title: 'Other lesson paper', sub_course_id: 'l9' }),
  ];
  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const withCourse = (role = 'admin') =>
    asRole(role, { courses: { courses: [mathsCourse()] } });
  const card = (title: string) =>
    within(
      screen
        .getByRole('heading', { name: title })
        .closest('.overflow-hidden') as HTMLElement
    );
  const schedule = () =>
    document.querySelector('input[type="datetime-local"]') as HTMLInputElement;

  const renderPage = async (store = withCourse()) => {
    const view = renderWithStore(<CourseExamsPage />, { store });
    await screen.findByText('Paper 1');
    return view;
  };

  beforeEach(() => {
    nav.params = { courseId: 'c1', subCourseId: 'l1' };
    admin.getExams.mockResolvedValue(exams as any);
  });

  describe('access', () => {
    it('sends visitors to log in', () => {
      nav.pathname = '/admin/courses/c1/sub-courses/l1/exams';
      renderWithStore(<CourseExamsPage />, {
        store: makeStore({ auth: { isInitialized: true } }),
      });
      expect(nav.router.push).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fadmin%2Fcourses%2Fc1%2Fsub-courses%2Fl1%2Fexams'
      );
    });

    it('fetches the user when signed in without one', () => {
      auth.getCurrentUser.mockReturnValue(new Promise(() => {}));
      renderWithStore(<CourseExamsPage />, {
        store: makeStore({
          auth: { isAuthenticated: true, isInitialized: true },
        }),
      });
      expect(auth.getCurrentUser).toHaveBeenCalled();
      expect(screen.getByText('Loading admin panel...')).toBeInTheDocument();
    });

    it('sends students home', () => {
      renderWithStore(<CourseExamsPage />, { store: withCourse('student') });
      expect(nav.router.push).toHaveBeenCalledWith('/');
      expect(admin.getExams).not.toHaveBeenCalled();
    });

    it('loads courses too when the store is empty', async () => {
      admin.getCourses.mockResolvedValue([mathsCourse()] as any);
      renderWithStore(<CourseExamsPage />, { store: asRole('super_admin') });
      expect(
        screen.getByRole('heading', { name: 'Manage Exams' })
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('heading', { name: 'Manage Exams • Algebra' })
      ).toBeInTheDocument();
      expect(admin.getExams).toHaveBeenCalledWith('c1');
    });
  });

  describe('list', () => {
    it("shows this lesson's exams in order", async () => {
      await renderPage();
      expect(
        screen.getByText('Grade 10 • Maths • LKR 1,500')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Back to Lessons' })
      ).toHaveAttribute('href', '/admin/courses/c1/sub-courses');
      expect(screen.queryByText('Other lesson paper')).not.toBeInTheDocument();
      expect(
        screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
      ).toEqual(['Paper 1', 'Paper 2']);

      const paper2 = card('Paper 2');
      expect(paper2.getByText('#2')).toBeInTheDocument();
      expect(paper2.getByText('Duration: 90 minutes')).toBeInTheDocument();
      expect(paper2.getByText('Questions: 25')).toBeInTheDocument();
      expect(
        paper2.getByText(
          `Starts: ${new Date('2026-11-01T04:00:00.000Z').toLocaleString()}`
        )
      ).toBeInTheDocument();
      expect(paper2.getByText('Final paper')).toBeInTheDocument();
      expect(paper2.getByRole('img', { name: 'Paper 2' })).toHaveAttribute(
        'src',
        'https://img/e1.png'
      );
      expect(
        paper2.getByRole('link', { name: 'Manage Questions' })
      ).toHaveAttribute(
        'href',
        '/admin/courses/c1/sub-courses/l1/exams/e1/questions'
      );
      expect(
        card('Paper 1').getByText('Available Anytime')
      ).toBeInTheDocument();
    });

    it('shows a loading state, then an empty lesson', async () => {
      admin.getExams.mockResolvedValue([]);
      renderWithStore(<CourseExamsPage />, {
        store: asRole('admin', {
          courses: { courses: [mathsCourse({ price: 0 })] },
        }),
      });
      expect(screen.getByText('Loading data...')).toBeInTheDocument();
      expect(
        await screen.findByText('No exams yet in this lesson')
      ).toBeInTheDocument();
      expect(screen.getByText('Grade 10 • Maths • Free')).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'Create your first exam' })
      );
      expect(
        screen.getByRole('heading', { name: 'Create Exam' })
      ).toBeInTheDocument();
    });

    it('shows a failed load', async () => {
      admin.getExams.mockImplementation(() =>
        httpError(500, { detail: 'Assessment service down' })
      );
      renderWithStore(<CourseExamsPage />, { store: withCourse() });
      expect(
        await screen.findByText('Assessment service down')
      ).toBeInTheDocument();
    });
  });

  describe('create', () => {
    const openCreate = async () => {
      await renderPage();
      await userEvent.click(
        screen.getByRole('button', { name: '+ Create Exam' })
      );
    };
    const form = () =>
      screen.getByPlaceholderText('Exam title').closest('form')!;

    it('suggests the next order number and creates a scheduled exam', async () => {
      admin.createExam.mockResolvedValue(
        exam('e4', { title: 'Paper 3', order_number: 3 }) as any
      );
      await openCreate();
      expect(screen.getByPlaceholderText('Enter order number')).toHaveValue(3);
      await userEvent.type(
        screen.getByPlaceholderText('Exam title'),
        ' Paper 3 '
      );
      await userEvent.type(
        screen.getByPlaceholderText('Description (optional)'),
        ' Mock '
      );
      await userEvent.type(screen.getByPlaceholderText('Hours'), '1');
      await userEvent.type(screen.getByPlaceholderText('Minutes'), '30');
      fireEvent.change(schedule(), { target: { value: '2026-12-01T09:30' } });
      await userEvent.click(
        screen.getByRole('button', { name: 'Create Exam' })
      );

      expect(admin.createExam).toHaveBeenCalledWith({
        course_id: 'c1',
        sub_course_id: 'l1',
        title: 'Paper 3',
        image_url: null,
        image_public_id: null,
        description: 'Mock',
        duration_minutes: 90,
        order_number: 3,
        scheduled_start: new Date('2026-12-01T09:30').toISOString(),
      });
      expect(
        await screen.findByRole('heading', { name: 'Paper 3' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Create Exam' })
      ).not.toBeInTheDocument();
    });

    it('creates an anytime exam with an image', async () => {
      admin.uploadImage.mockResolvedValue({
        image_url: 'https://img/new.png',
        image_public_id: 'pid-new',
      } as any);
      admin.createExam.mockResolvedValue(exam('e4') as any);
      await openCreate();
      await userEvent.type(
        screen.getByPlaceholderText('Exam title'),
        'Paper 3'
      );
      await userEvent.type(screen.getByPlaceholderText('Minutes'), '45');
      await userEvent.clear(screen.getByPlaceholderText('Enter order number'));
      await userEvent.upload(fileInputs()[0], png('cover.png'));
      expect(screen.getByText('Selected: cover.png')).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'Create Exam' })
      );
      expect(admin.uploadImage).toHaveBeenCalledWith(expect.any(File), 'exams');
      await waitFor(() =>
        expect(admin.createExam).toHaveBeenCalledWith(
          expect.objectContaining({
            image_url: 'https://img/new.png',
            image_public_id: 'pid-new',
            description: null,
            duration_minutes: 45,
            order_number: 0,
            scheduled_start: null,
          })
        )
      );
    });

    it('validates title and duration', async () => {
      await openCreate();
      await userEvent.type(screen.getByPlaceholderText('Exam title'), '  ');
      fireEvent.submit(form());
      expect(
        await screen.findByText('Please enter exam title')
      ).toBeInTheDocument();

      await userEvent.type(
        screen.getByPlaceholderText('Exam title'),
        'Paper 3'
      );
      fireEvent.submit(form());
      expect(
        await screen.findByText(
          'Please enter exam duration (hours and/or minutes)'
        )
      ).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText('Hours'), {
        target: { value: '9' },
      });
      fireEvent.submit(form());
      expect(
        await screen.findByText('Duration must be between 1 minute and 8 hours')
      ).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText('Hours'), {
        target: { value: '0' },
      });
      fireEvent.change(screen.getByPlaceholderText('Minutes'), {
        target: { value: '0' },
      });
      fireEvent.submit(form());
      expect(
        await screen.findByText('Duration must be between 1 minute and 8 hours')
      ).toBeInTheDocument();
      expect(admin.createExam).not.toHaveBeenCalled();
    });

    it('stops when the image upload fails', async () => {
      admin.uploadImage.mockImplementation(() =>
        httpError(413, { detail: 'Image too big' })
      );
      await openCreate();
      await userEvent.type(
        screen.getByPlaceholderText('Exam title'),
        'Paper 3'
      );
      await userEvent.type(screen.getByPlaceholderText('Hours'), '2');
      await userEvent.upload(fileInputs()[0], png());
      await userEvent.click(
        screen.getByRole('button', { name: 'Create Exam' })
      );
      expect(await screen.findByText('Image too big')).toBeInTheDocument();
      expect(admin.createExam).not.toHaveBeenCalled();
    });

    it('needs a lesson id', async () => {
      nav.params = { courseId: 'c1' };
      admin.getExams.mockResolvedValue([]);
      renderWithStore(<CourseExamsPage />, { store: withCourse() });
      await userEvent.click(
        await screen.findByRole('button', { name: '+ Create Exam' })
      );
      await userEvent.type(
        screen.getByPlaceholderText('Exam title'),
        'Paper 3'
      );
      await userEvent.type(screen.getByPlaceholderText('Hours'), '2');
      await userEvent.click(
        screen.getByRole('button', { name: 'Create Exam' })
      );
      expect(
        await screen.findByText('Course ID or lesson ID is missing')
      ).toBeInTheDocument();
    });

    it('shows a failed create and closes', async () => {
      admin.createExam.mockImplementation(() =>
        httpError(409, { detail: 'Duplicate order' })
      );
      await openCreate();
      await userEvent.type(
        screen.getByPlaceholderText('Exam title'),
        'Paper 3'
      );
      await userEvent.type(screen.getByPlaceholderText('Hours'), '2');
      await userEvent.click(
        screen.getByRole('button', { name: 'Create Exam' })
      );
      expect(await screen.findByText('Duplicate order')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(
        screen.queryByRole('heading', { name: 'Create Exam' })
      ).not.toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: '+ Create Exam' })
      );
      await userEvent.click(screen.getByRole('button', { name: '✕' }));
      expect(
        screen.queryByRole('heading', { name: 'Create Exam' })
      ).not.toBeInTheDocument();
    });
  });

  describe('edit', () => {
    const openEdit = async (title = 'Paper 2') => {
      await renderPage();
      await userEvent.click(card(title).getByRole('button', { name: 'Edit' }));
    };
    const save = () =>
      userEvent.click(screen.getByRole('button', { name: 'Update Exam' }));

    it('prefills the form and keeps the current image', async () => {
      admin.updateExam.mockResolvedValue(exams[0] as any);
      await openEdit();
      expect(screen.getByPlaceholderText('Exam title')).toHaveValue('Paper 2');
      expect(screen.getByPlaceholderText('Hours')).toHaveValue(1);
      expect(screen.getByPlaceholderText('Minutes')).toHaveValue(30);
      expect(schedule()).toHaveValue(toLocalInput('2026-11-01T04:00:00.000Z'));
      expect(screen.getByRole('img', { name: 'Current exam' })).toHaveAttribute(
        'src',
        'https://img/e1.png'
      );
      await save();
      expect(admin.updateExam).toHaveBeenCalledWith('e1', {
        title: 'Paper 2',
        image_url: 'https://img/e1.png',
        image_public_id: 'pid-e1',
        description: 'Final paper',
        duration_minutes: 90,
        order_number: 2,
        scheduled_start: new Date(
          toLocalInput('2026-11-01T04:00:00.000Z')
        ).toISOString(),
      });
      await waitFor(() =>
        expect(
          screen.queryByRole('heading', { name: 'Edit Exam' })
        ).not.toBeInTheDocument()
      );
    });

    it('leaves whole-hour durations without minutes and can clear the schedule', async () => {
      admin.updateExam.mockResolvedValue(exams[1] as any);
      await openEdit('Paper 1');
      expect(screen.getByPlaceholderText('Hours')).toHaveValue(1);
      expect(screen.getByPlaceholderText('Minutes')).toHaveValue(null);
      expect(schedule()).toHaveValue('');
      await save();
      expect(admin.updateExam).toHaveBeenCalledWith(
        'e2',
        expect.objectContaining({
          duration_minutes: 60,
          image_url: null,
          image_public_id: null,
          scheduled_start: null,
        })
      );
    });

    it('opens a sub-hour exam with minutes only', async () => {
      admin.getExams.mockResolvedValue([
        exam('e5', { title: 'Quiz', duration_minutes: 20 }),
      ] as any);
      renderWithStore(<CourseExamsPage />, { store: withCourse() });
      await userEvent.click(
        within(
          (await screen.findByRole('heading', { name: 'Quiz' })).closest(
            '.overflow-hidden'
          ) as HTMLElement
        ).getByRole('button', { name: 'Edit' })
      );
      expect(screen.getByPlaceholderText('Hours')).toHaveValue(null);
      expect(screen.getByPlaceholderText('Minutes')).toHaveValue(20);
    });

    it('removes the image, with undo', async () => {
      admin.updateExam.mockResolvedValue(exams[0] as any);
      admin.deleteImage.mockResolvedValue({} as any);
      await openEdit();
      await userEvent.click(
        screen.getByRole('button', { name: 'Remove Image' })
      );
      expect(
        screen.getByText('Image will be removed when you save')
      ).toBeInTheDocument();
      expect(fileInputs()).toHaveLength(0);
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(
        screen.getByRole('img', { name: 'Current exam' })
      ).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'Remove Image' })
      );
      await save();
      expect(admin.deleteImage).toHaveBeenCalledWith('pid-e1');
      await waitFor(() =>
        expect(admin.updateExam).toHaveBeenCalledWith(
          'e1',
          expect.objectContaining({ image_url: null, image_public_id: null })
        )
      );
    });

    it('replaces the image and deletes the old one', async () => {
      admin.uploadImage.mockResolvedValue({
        image_url: 'https://img/v2.png',
        image_public_id: 'pid-v2',
      } as any);
      admin.updateExam.mockResolvedValue(exams[0] as any);
      await openEdit();
      await userEvent.upload(fileInputs()[0], png('v2.png'));
      expect(
        screen.getByText('Selected: v2.png (will replace current image)')
      ).toBeInTheDocument();
      await save();
      await waitFor(() =>
        expect(admin.updateExam).toHaveBeenCalledWith(
          'e1',
          expect.objectContaining({
            image_url: 'https://img/v2.png',
            image_public_id: 'pid-v2',
          })
        )
      );
      expect(admin.deleteImage).toHaveBeenCalledWith('pid-e1');
    });

    it('stops when the new image fails to upload', async () => {
      admin.uploadImage.mockImplementation(() =>
        httpError(400, { detail: 'Bad image' })
      );
      await openEdit();
      await userEvent.upload(fileInputs()[0], png());
      await save();
      expect(await screen.findByText('Bad image')).toBeInTheDocument();
      expect(admin.updateExam).not.toHaveBeenCalled();
    });

    it('validates and reports a failed save', async () => {
      admin.updateExam.mockImplementation(() =>
        httpError(400, { detail: 'Exam already started' })
      );
      await openEdit();
      fireEvent.change(screen.getByPlaceholderText('Hours'), {
        target: { value: '' },
      });
      fireEvent.change(screen.getByPlaceholderText('Minutes'), {
        target: { value: '' },
      });
      fireEvent.submit(
        screen.getByPlaceholderText('Exam title').closest('form')!
      );
      expect(
        await screen.findByText(
          'Please enter exam duration (hours and/or minutes)'
        )
      ).toBeInTheDocument();
      await userEvent.type(screen.getByPlaceholderText('Hours'), '2');
      await save();
      expect(
        await screen.findByText('Exam already started')
      ).toBeInTheDocument();
    });

    it('closes with Cancel or ✕', async () => {
      await openEdit();
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(
        screen.queryByRole('heading', { name: 'Edit Exam' })
      ).not.toBeInTheDocument();
      await userEvent.click(
        card('Paper 2').getByRole('button', { name: 'Edit' })
      );
      await userEvent.click(screen.getByRole('button', { name: '✕' }));
      expect(
        screen.queryByRole('heading', { name: 'Edit Exam' })
      ).not.toBeInTheDocument();
    });
  });

  describe('delete', () => {
    it('deletes the exam and its image after confirming', async () => {
      admin.deleteExam.mockResolvedValue(undefined as any);
      admin.deleteImage.mockResolvedValue({} as any);
      confirmSpy.mockReturnValueOnce(false);
      await renderPage();
      await userEvent.click(
        card('Paper 2').getByRole('button', { name: 'Delete' })
      );
      expect(confirmSpy).toHaveBeenCalledWith('Delete exam "Paper 2"?');
      expect(admin.deleteExam).not.toHaveBeenCalled();
      await userEvent.click(
        card('Paper 2').getByRole('button', { name: 'Delete' })
      );
      expect(admin.deleteImage).toHaveBeenCalledWith('pid-e1');
      await waitFor(() => expect(admin.deleteExam).toHaveBeenCalledWith('e1'));
      await waitFor(() =>
        expect(screen.queryByText('Paper 2')).not.toBeInTheDocument()
      );
    });

    it('shows a failed delete', async () => {
      admin.deleteExam.mockImplementation(() =>
        httpError(409, { detail: 'Exam has attempts' })
      );
      await renderPage();
      await userEvent.click(
        card('Paper 1').getByRole('button', { name: 'Delete' })
      );
      expect(await screen.findByText('Exam has attempts')).toBeInTheDocument();
      expect(admin.deleteImage).not.toHaveBeenCalled();
    });
  });

  describe('bulk import', () => {
    const zip = () =>
      new File(['x'.repeat(1024 * 1024 * 2)], 'papers.zip', {
        type: 'application/zip',
      });
    const zipInput = () =>
      document.getElementById('bulk-import-zip') as HTMLInputElement;
    const openImport = async () => {
      await renderPage();
      await userEvent.click(
        screen.getByRole('button', { name: 'Bulk Import' })
      );
    };
    const result = {
      created_exams: 2,
      total_questions_created: 50,
      skipped_exams: 1,
      details: [
        {
          exam_id: 'n1',
          title: 'Paper A',
          questions_created: 30,
          images_applied: 4,
          warnings: ['Row 7 had no explanation'],
        },
        {
          exam_id: 'n2',
          title: 'Paper B',
          questions_created: 20,
          images_applied: 0,
          warnings: [],
        },
      ],
      errors: [{ exam: 'Paper C', message: 'Missing questions.csv' }],
    };

    it('downloads the template', async () => {
      admin.downloadBulkImportTemplate.mockResolvedValue(undefined as any);
      await openImport();
      expect(
        screen.getByRole('heading', { name: 'Bulk Import Exams' })
      ).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'Download Template' })
      );
      expect(admin.downloadBulkImportTemplate).toHaveBeenCalled();
    });

    it('logs a failed template download', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      admin.downloadBulkImportTemplate.mockRejectedValue(new Error('offline'));
      await openImport();
      await userEvent.click(
        screen.getByRole('button', { name: 'Download Template' })
      );
      await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'offline' })
        )
      );
      errorSpy.mockRestore();
    });

    it('imports a ZIP, shows the summary and reloads exams', async () => {
      admin.bulkImportExams.mockResolvedValue(result as any);
      await openImport();
      expect(screen.getByText(/Click to select a/)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Import Exams' })
      ).toBeDisabled();
      await userEvent.upload(zipInput(), zip());
      expect(screen.getByText('papers.zip')).toBeInTheDocument();
      expect(screen.getByText('2.0 MB — click to change')).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'Import Exams' })
      );

      expect(admin.bulkImportExams).toHaveBeenCalledWith(
        'c1',
        'l1',
        expect.any(File)
      );
      expect(await screen.findByText('Exams Created')).toBeInTheDocument();
      expect(
        screen.getByText('Exams Created').previousSibling
      ).toHaveTextContent('2');
      expect(
        screen.getByText('Questions Imported').previousSibling
      ).toHaveTextContent('50');
      expect(screen.getByText('Skipped')).toHaveClass('text-red-600');
      expect(screen.getByText('(30 questions, 4 images)')).toBeInTheDocument();
      expect(screen.getByText(/Row 7 had no explanation/)).toBeInTheDocument();
      expect(screen.getByText('Paper C:')).toBeInTheDocument();
      expect(
        screen.getByText('Missing questions.csv', { exact: false })
      ).toBeInTheDocument();
      await waitFor(() => expect(admin.getExams).toHaveBeenCalledTimes(2));

      await userEvent.click(
        screen.getByRole('button', { name: 'Import Another' })
      );
      expect(screen.getByText(/Click to select a/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(
        screen.queryByRole('heading', { name: 'Bulk Import Exams' })
      ).not.toBeInTheDocument();
    });

    it('does not reload when nothing was created', async () => {
      admin.bulkImportExams.mockResolvedValue({
        created_exams: 0,
        total_questions_created: 0,
        skipped_exams: 0,
        details: [],
        errors: [],
      } as any);
      await openImport();
      await userEvent.upload(zipInput(), zip());
      await userEvent.click(
        screen.getByRole('button', { name: 'Import Exams' })
      );
      expect(await screen.findByText('Skipped')).toHaveClass('text-gray-400');
      expect(screen.queryByText('Created Exams')).not.toBeInTheDocument();
      expect(admin.getExams).toHaveBeenCalledTimes(1);
      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(
        screen.queryByRole('heading', { name: 'Bulk Import Exams' })
      ).not.toBeInTheDocument();
    });

    it('stays open while importing and shows failures', async () => {
      let fail!: (e: any) => void;
      admin.bulkImportExams.mockReturnValue(
        new Promise((_, reject) => {
          fail = reject;
        })
      );
      await openImport();
      await userEvent.upload(zipInput(), zip());
      await userEvent.click(
        screen.getByRole('button', { name: 'Import Exams' })
      );
      expect(
        screen.getByRole('button', { name: 'Importing...' })
      ).toBeDisabled();
      await userEvent.click(screen.getByRole('button', { name: '×' }));
      expect(
        screen.getByRole('heading', { name: 'Bulk Import Exams' })
      ).toBeInTheDocument();
      fail(
        Object.assign(new Error('x'), {
          response: { status: 400, data: { detail: 'Not a ZIP file' } },
        })
      );
      expect(await screen.findByText('Not a ZIP file')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: '×' }));
      expect(
        screen.queryByRole('heading', { name: 'Bulk Import Exams' })
      ).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Exam questions', () => {
  const opt = (order: number, text: string | null, extra: any = {}) => ({
    id: `o${order}`,
    option_text: text,
    option_image_url: null,
    option_image_public_id: null,
    is_correct: false,
    order_number: order,
    ...extra,
  });
  const question = (id: string, extra: any = {}) => ({
    id,
    exam_id: 'e1',
    question_text: `Question ${id}`,
    question_image_url: null,
    question_image_public_id: null,
    explanation: null,
    video_url: null,
    order_number: 1,
    options: [opt(1, 'Yes', { is_correct: true }), opt(2, 'No')],
    ...extra,
  });
  const questions = [
    question('q1', {
      question_text: 'What is 2 + 2?',
      question_image_url: 'https://img/q1.png',
      question_image_public_id: 'pid-q1',
      explanation: 'Basic addition',
      video_url: 'https://www.youtube.com/watch?v=abc123&t=5',
      options: [
        opt(1, '3'),
        opt(2, '4', { is_correct: true }),
        opt(3, null, {
          option_image_url: 'https://img/o3.png',
          option_image_public_id: 'pid-o3',
        }),
        opt(4, '5'),
      ],
    }),
    question('q2', { question_text: 'Is the sky blue?' }),
  ];
  const paper = {
    id: 'e1',
    course_id: 'c1',
    sub_course_id: 'l1',
    title: 'Paper 1',
    total_questions: 3,
  };
  const store = (courseExtra: any = {}, extra: any = {}) =>
    asRole('admin', {
      courses: { courses: [mathsCourse(courseExtra)] },
      exams: { exams: [paper] },
      ...extra,
    });

  const renderPage = async (s = store()) => {
    const view = renderWithStore(<QuestionsPage />, { store: s });
    await screen.findByText('What is 2 + 2?');
    return view;
  };
  const block = (text: string) =>
    within(screen.getByText(text).closest('.rounded-xl') as HTMLElement);
  const optionBoxes = () =>
    screen.queryAllByPlaceholderText(/^Enter option [A-E] text$/);
  // jsdom still treats a required file input as empty after userEvent.upload,
  // so check the button is enabled and submit the form directly.
  const submitFile = async (button: string) => {
    const btn = screen.getByRole('button', { name: button });
    expect(btn).toBeEnabled();
    await act(async () => {
      fireEvent.submit(btn.closest('form')!);
    });
  };
  const expectError = async (msg: string) =>
    expect((await screen.findAllByText(msg)).length).toBeGreaterThan(0);

  beforeEach(() => {
    (URL as any).createObjectURL = jest.fn(() => 'blob:preview');
    nav.params = { courseId: 'c1', subCourseId: 'l1', examId: 'e1' };
    admin.getQuestions.mockResolvedValue(
      questions.map((q) => ({
        ...q,
        options: q.options.map((o) => ({ ...o })),
      })) as any
    );
  });

  describe('access', () => {
    it('sends visitors to log in', () => {
      nav.pathname = '/admin/courses/c1/sub-courses/l1/exams/e1/questions';
      renderWithStore(<QuestionsPage />, {
        store: makeStore({ auth: { isInitialized: true } }),
      });
      expect(nav.router.push).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fadmin%2Fcourses%2Fc1%2Fsub-courses%2Fl1%2Fexams%2Fe1%2Fquestions'
      );
    });

    it('fetches the user when signed in without one', () => {
      auth.getCurrentUser.mockReturnValue(new Promise(() => {}));
      renderWithStore(<QuestionsPage />, {
        store: makeStore({
          auth: { isAuthenticated: true, isInitialized: true },
        }),
      });
      expect(auth.getCurrentUser).toHaveBeenCalled();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('sends students home', () => {
      renderWithStore(<QuestionsPage />, { store: asRole('student') });
      expect(nav.router.push).toHaveBeenCalledWith('/');
      expect(admin.getQuestions).not.toHaveBeenCalled();
    });

    it('loads the course and exams when the store is empty', async () => {
      admin.getCourses.mockResolvedValue([mathsCourse()] as any);
      admin.getExams.mockResolvedValue([paper] as any);
      renderWithStore(<QuestionsPage />, { store: asRole('super_admin') });
      expect(
        screen.getByRole('heading', { name: 'Manage Questions • Loading...' })
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('heading', {
          name: 'Manage Questions • Paper 1',
        })
      ).toBeInTheDocument();
      expect(admin.getExams).toHaveBeenCalledWith('c1');
      expect(admin.getQuestions).toHaveBeenCalledWith('e1');
    });
  });

  describe('list', () => {
    it('shows progress and each question', async () => {
      await renderPage();
      expect(admin.getCourses).not.toHaveBeenCalled();
      expect(admin.getExams).not.toHaveBeenCalled();
      expect(
        screen.getByText('Combined Maths • 2/3 questions created')
      ).toBeInTheDocument();
      expect(screen.getByText('1 more question needed')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Back to Exams' })
      ).toHaveAttribute('href', '/admin/courses/c1/sub-courses/l1/exams');

      const q1 = block('What is 2 + 2?');
      expect(q1.getByRole('img', { name: 'Question' })).toHaveAttribute(
        'src',
        'https://img/q1.png'
      );
      expect(q1.getByRole('img', { name: 'Option C' })).toHaveAttribute(
        'src',
        'https://img/o3.png'
      );
      expect(q1.getAllByText('Correct')).toHaveLength(1);
      expect(q1.getByText('4').closest('.border-2')).toHaveClass(
        'border-green-500'
      );
      expect(q1.getByText('Basic addition')).toBeInTheDocument();
      expect(q1.getByTitle('Explanation Video')).toHaveAttribute(
        'src',
        'https://www.youtube.com/embed/abc123'
      );
      expect(
        block('Is the sky blue?').queryByText('Explanation')
      ).not.toBeInTheDocument();
    });

    it.each([
      ['https://youtu.be/xyz789?t=3', 'https://www.youtube.com/embed/xyz789'],
      [
        'https://www.youtube.com/embed/emb456?rel=0',
        'https://www.youtube.com/embed/emb456',
      ],
      ['https://vimeo.com/123', 'https://vimeo.com/123'],
    ])('embeds the explanation video %s', async (url, src) => {
      admin.getQuestions.mockResolvedValue([
        question('q1', { question_text: 'What is 2 + 2?', video_url: url }),
      ] as any);
      await renderPage();
      expect(screen.getByTitle('Explanation Video')).toHaveAttribute(
        'src',
        src
      );
    });

    it('counts remaining questions', async () => {
      await renderPage(
        asRole('admin', {
          courses: { courses: [mathsCourse()] },
          exams: { exams: [{ ...paper, total_questions: 5 }] },
        })
      );
      expect(screen.getByText('3 more questions needed')).toBeInTheDocument();
    });

    it('says when all questions exist', async () => {
      admin.getQuestions.mockResolvedValue([
        ...questions,
        question('q3'),
      ] as any);
      await renderPage();
      expect(screen.getByText('All questions created')).toBeInTheDocument();
    });

    it('shows loading, then an empty exam', async () => {
      admin.getQuestions.mockResolvedValue([]);
      renderWithStore(<QuestionsPage />, { store: store() });
      expect(screen.getByText('Loading questions...')).toBeInTheDocument();
      expect(await screen.findByText(/No questions yet/)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Preview Exam' })
      ).toBeDisabled();
    });

    it('shows a failed load', async () => {
      admin.getQuestions.mockImplementation(() =>
        httpError(500, { detail: 'Questions unavailable' })
      );
      renderWithStore(<QuestionsPage />, { store: store() });
      expect(
        await screen.findByText('Questions unavailable')
      ).toBeInTheDocument();
    });
  });

  describe('create', () => {
    const openCreate = async (s = store()) => {
      await renderPage(s);
      await userEvent.click(
        screen.getByRole('button', { name: '+ Add Question' })
      );
    };
    const text = () => screen.getByPlaceholderText('Enter your question here');
    const form = () => text().closest('form')!;

    it.each([
      [5, 3],
      [10, 4],
      [12, 5],
    ])('gives grade %i courses %i options', async (grade, count) => {
      await openCreate(store({ grade }));
      expect(optionBoxes()).toHaveLength(count);
    });

    it('defaults to four options when the course is unknown', async () => {
      await openCreate(
        asRole('admin', {
          courses: { courses: [mathsCourse({ id: 'other' })] },
          exams: { exams: [paper] },
        })
      );
      expect(optionBoxes()).toHaveLength(4);
    });

    it('creates a question from the filled options', async () => {
      admin.createQuestion.mockResolvedValue(
        question('q3', { question_text: 'New one?' }) as any
      );
      await openCreate();
      await userEvent.type(text(), ' New one? ');
      await userEvent.type(optionBoxes()[0], ' Alpha ');
      await userEvent.type(optionBoxes()[2], 'Gamma');
      await userEvent.click(screen.getAllByRole('radio')[2]);
      expect(optionBoxes()[2].closest('.border-2')).toHaveClass(
        'border-green-500'
      );
      await userEvent.type(
        screen.getByPlaceholderText('Explain the correct answer'),
        ' Because '
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Create Question' })
      );

      expect(admin.createQuestion).toHaveBeenCalledWith({
        exam_id: 'e1',
        question_text: 'New one?',
        question_image_url: '',
        question_image_public_id: '',
        explanation: 'Because',
        video_url: null,
        order_number: 3,
        options: [
          {
            option_text: 'Alpha',
            option_image_url: null,
            option_image_public_id: null,
            is_correct: false,
            order_number: 1,
          },
          {
            option_text: 'Gamma',
            option_image_url: null,
            option_image_public_id: null,
            is_correct: true,
            order_number: 3,
          },
        ],
      });
      expect(
        await screen.findByText('Question created successfully')
      ).toBeInTheDocument();
      expect(screen.getByText('New one?')).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Create Question' })
      ).not.toBeInTheDocument();
    });

    it('uploads question and option images', async () => {
      admin.uploadImage
        .mockResolvedValueOnce({
          image_url: 'https://img/q.png',
          image_public_id: 'pid-q',
        } as any)
        .mockResolvedValueOnce({
          image_url: 'https://img/b.png',
          image_public_id: 'pid-b',
        } as any);
      admin.createQuestion.mockResolvedValue(question('q3') as any);
      await openCreate();
      await userEvent.type(text(), 'Pick the shape');
      await userEvent.type(optionBoxes()[0], 'Circle');
      await userEvent.type(optionBoxes()[1], 'Square');
      await userEvent.click(screen.getAllByRole('radio')[0]);
      await userEvent.upload(fileInputs()[0], png('q.png'));
      expect(screen.getByRole('img', { name: 'Preview' })).toHaveAttribute(
        'src',
        'blob:preview'
      );
      await userEvent.upload(fileInputs()[2], png('b.png'));
      expect(
        screen.getByRole('img', { name: 'Option B preview' })
      ).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'Create Question' })
      );

      await waitFor(() => expect(admin.createQuestion).toHaveBeenCalled());
      expect(admin.uploadImage).toHaveBeenCalledWith(
        expect.any(File),
        'questions'
      );
      const payload = admin.createQuestion.mock.calls[0][0] as any;
      expect(payload.question_image_url).toBe('https://img/q.png');
      expect(payload.question_image_public_id).toBe('pid-q');
      expect(payload.options[1]).toEqual(
        expect.objectContaining({
          option_text: 'Square',
          option_image_url: 'https://img/b.png',
          option_image_public_id: 'pid-b',
        })
      );
    });

    it('keeps going when an option image fails to upload', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      admin.uploadImage.mockImplementation(() => httpError(500));
      admin.createQuestion.mockResolvedValue(question('q3') as any);
      await openCreate();
      await userEvent.type(text(), 'Pick one');
      await userEvent.type(optionBoxes()[0], 'A1');
      await userEvent.type(optionBoxes()[1], 'B1');
      await userEvent.click(screen.getAllByRole('radio')[1]);
      await userEvent.upload(fileInputs()[1], png());
      await userEvent.click(
        screen.getByRole('button', { name: 'Create Question' })
      );
      await waitFor(() => expect(admin.createQuestion).toHaveBeenCalled());
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to upload image for option 1'
      );
      expect(
        (admin.createQuestion.mock.calls[0][0] as any).options[0]
          .option_image_url
      ).toBeNull();
      errorSpy.mockRestore();
    });

    it('stops when the question image fails to upload', async () => {
      admin.uploadImage.mockImplementation(() => httpError(500));
      await openCreate();
      await userEvent.type(text(), 'Pick one');
      await userEvent.type(optionBoxes()[0], 'A1');
      await userEvent.type(optionBoxes()[1], 'B1');
      await userEvent.click(screen.getAllByRole('radio')[0]);
      await userEvent.upload(fileInputs()[0], png());
      await userEvent.click(
        screen.getByRole('button', { name: 'Create Question' })
      );
      await expectError('Failed to upload question image');
      expect(admin.createQuestion).not.toHaveBeenCalled();
    });

    it('validates text, options and the correct answer', async () => {
      await openCreate();
      await userEvent.type(text(), '   ');
      fireEvent.submit(form());
      await expectError('Please enter question text');

      await userEvent.type(text(), 'Real question');
      await userEvent.type(optionBoxes()[0], 'Only one');
      fireEvent.submit(form());
      await expectError('Please provide at least 2 options');

      await userEvent.type(optionBoxes()[1], 'Second');
      fireEvent.submit(form());
      await expectError('Please select exactly one correct answer');
      expect(admin.createQuestion).not.toHaveBeenCalled();
    });

    it('shows a failed create and closes', async () => {
      admin.createQuestion.mockImplementation(() =>
        httpError(400, { detail: 'Exam is full' })
      );
      await openCreate();
      await userEvent.type(text(), 'Pick one');
      await userEvent.type(optionBoxes()[0], 'A1');
      await userEvent.type(optionBoxes()[1], 'B1');
      await userEvent.click(screen.getAllByRole('radio')[0]);
      await userEvent.click(
        screen.getByRole('button', { name: 'Create Question' })
      );
      await expectError('Exam is full');
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(
        screen.queryByRole('heading', { name: 'Create Question' })
      ).not.toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: '+ Add Question' })
      );
      await userEvent.click(screen.getByRole('button', { name: '✕' }));
      expect(
        screen.queryByRole('heading', { name: 'Create Question' })
      ).not.toBeInTheDocument();
    });
  });

  describe('edit', () => {
    const openEdit = async (questionText = 'What is 2 + 2?', s = store()) => {
      await renderPage(s);
      await userEvent.click(
        block(questionText).getByRole('button', { name: 'Edit' })
      );
    };
    const save = () =>
      userEvent.click(screen.getByRole('button', { name: 'Update Question' }));
    const lastUpdate = () =>
      admin.updateQuestion.mock.calls[
        admin.updateQuestion.mock.calls.length - 1
      ] as any[];

    it('prefills the form and saves unchanged images', async () => {
      admin.updateQuestion.mockResolvedValue(questions[0] as any);
      await openEdit();
      expect(
        screen.getByRole('heading', { name: 'Edit Question' })
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue('What is 2 + 2?')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('https://www.youtube.com/watch?v=...')
      ).toHaveValue('https://www.youtube.com/watch?v=abc123&t=5');
      expect(screen.getByDisplayValue('Basic addition')).toBeInTheDocument();
      expect(optionBoxes().map((b) => (b as HTMLInputElement).value)).toEqual([
        '3',
        '4',
        '',
        '5',
      ]);
      expect(screen.getAllByRole('radio')[1]).toBeChecked();
      expect(screen.getByRole('img', { name: 'Current' })).toHaveAttribute(
        'src',
        'https://img/q1.png'
      );
      await save();
      expect(admin.updateQuestion).toHaveBeenCalledWith('q1', {
        question_text: 'What is 2 + 2?',
        question_image_url: 'https://img/q1.png',
        question_image_public_id: 'pid-q1',
        explanation: 'Basic addition',
        video_url: 'https://www.youtube.com/watch?v=abc123&t=5',
        options: [
          {
            option_text: '3',
            option_image_url: null,
            option_image_public_id: null,
            is_correct: false,
            order_number: 1,
          },
          {
            option_text: '4',
            option_image_url: null,
            option_image_public_id: null,
            is_correct: true,
            order_number: 2,
          },
          {
            option_text: '5',
            option_image_url: null,
            option_image_public_id: null,
            is_correct: false,
            order_number: 4,
          },
        ],
      });
      expect(
        await screen.findByText('Question updated successfully')
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Edit Question' })
      ).not.toBeInTheDocument();
    });

    it('pads options up to the grade count', async () => {
      admin.updateQuestion.mockResolvedValue(questions[1] as any);
      await openEdit('Is the sky blue?', store({ grade: 12 }));
      expect(optionBoxes()).toHaveLength(5);
      await userEvent.type(optionBoxes()[4], 'Maybe');
      await userEvent.type(
        screen.getByPlaceholderText('https://www.youtube.com/watch?v=...'),
        'https://youtu.be/abc'
      );
      await save();
      const [, data] = lastUpdate();
      expect(
        data.options.map((o: any) => [o.option_text, o.order_number])
      ).toEqual([
        ['Yes', 1],
        ['No', 2],
        ['Maybe', 5],
      ]);
      expect(data.video_url).toBe('https://youtu.be/abc');
      expect(data.explanation).toBeNull();
    });

    it('trims extra options for lower grades and fills blank questions', async () => {
      admin.getQuestions.mockResolvedValue([
        question('q1', {
          question_text: 'What is 2 + 2?',
          options: [opt(1, 'a'), opt(2, 'b'), opt(3, 'c'), opt(4, 'd')],
        }),
        question('q9', { question_text: 'Empty one', options: [] }),
      ] as any);
      await openEdit('What is 2 + 2?', store({ grade: 5 }));
      expect(optionBoxes()).toHaveLength(3);
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await userEvent.click(
        block('Empty one').getByRole('button', { name: 'Edit' })
      );
      expect(optionBoxes().map((b) => (b as HTMLInputElement).value)).toEqual([
        '',
        '',
        '',
      ]);
    });

    it('removes the question image, with undo', async () => {
      admin.updateQuestion.mockResolvedValue(questions[0] as any);
      admin.deleteImage.mockResolvedValue({} as any);
      await openEdit();
      await userEvent.click(
        screen.getByRole('button', { name: 'Remove Image' })
      );
      expect(
        screen.getByText('Image will be removed when you save')
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(screen.getByRole('img', { name: 'Current' })).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'Remove Image' })
      );
      await save();
      expect(admin.deleteImage).toHaveBeenCalledWith('pid-q1');
      await waitFor(() => expect(admin.updateQuestion).toHaveBeenCalled());
      expect(lastUpdate()[1]).toEqual(
        expect.objectContaining({
          question_image_url: null,
          question_image_public_id: null,
        })
      );
    });

    it('replaces the question image and deletes the old one', async () => {
      admin.uploadImage.mockResolvedValue({
        image_url: 'https://img/q-v2.png',
        image_public_id: 'pid-q-v2',
      } as any);
      admin.updateQuestion.mockResolvedValue(questions[0] as any);
      await openEdit();
      await userEvent.upload(fileInputs()[0], png());
      expect(screen.getByText('New Image Preview:')).toBeInTheDocument();
      await save();
      await waitFor(() => expect(admin.updateQuestion).toHaveBeenCalled());
      expect(lastUpdate()[1]).toEqual(
        expect.objectContaining({
          question_image_url: 'https://img/q-v2.png',
          question_image_public_id: 'pid-q-v2',
        })
      );
      expect(admin.deleteImage).toHaveBeenCalledWith('pid-q1');
    });

    it('stops when the new question image fails to upload', async () => {
      admin.uploadImage.mockImplementation(() => httpError(500));
      await openEdit();
      await userEvent.upload(fileInputs()[0], png());
      await save();
      await expectError('Failed to upload question image');
      expect(admin.updateQuestion).not.toHaveBeenCalled();
    });

    it('removes an option image, with undo', async () => {
      admin.updateQuestion.mockResolvedValue(questions[0] as any);
      admin.deleteImage.mockResolvedValue({} as any);
      await openEdit();
      await userEvent.type(optionBoxes()[2], 'Picture');
      const form = within(optionBoxes()[2].closest('form')!);
      expect(form.getByRole('img', { name: 'Option C' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
      expect(screen.getByText('Image will be removed')).toBeInTheDocument();
      expect(
        form.queryByRole('img', { name: 'Option C' })
      ).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(form.getByRole('img', { name: 'Option C' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
      await save();
      await waitFor(() => expect(admin.updateQuestion).toHaveBeenCalled());
      expect(admin.deleteImage).toHaveBeenCalledWith('pid-o3');
      expect(lastUpdate()[1].options[2]).toEqual(
        expect.objectContaining({
          option_text: 'Picture',
          option_image_url: null,
          option_image_public_id: null,
        })
      );
    });

    it('replaces option images, deleting old ones, and skips failed uploads', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      admin.uploadImage.mockImplementation(((file: File) =>
        file.name === 'bad.png'
          ? httpError(500)
          : Promise.resolve({
              image_url: 'https://img/o-v2.png',
              image_public_id: 'pid-o-v2',
            })) as any);
      admin.updateQuestion.mockResolvedValue(questions[0] as any);
      await openEdit();
      await userEvent.type(optionBoxes()[2], 'Picture');
      const [, a, , c] = fileInputs();
      await userEvent.upload(c, png('good.png'));
      expect(
        screen.getByRole('img', { name: 'Option C preview' })
      ).toBeInTheDocument();
      await userEvent.upload(a, png('bad.png'));
      await save();
      await waitFor(() => expect(admin.updateQuestion).toHaveBeenCalled());
      expect(admin.deleteImage).toHaveBeenCalledWith('pid-o3');
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to upload image for option 1'
      );
      const options = lastUpdate()[1].options;
      expect(options[0].option_image_url).toBeNull();
      expect(options[2]).toEqual(
        expect.objectContaining({
          option_image_url: 'https://img/o-v2.png',
          option_image_public_id: 'pid-o-v2',
        })
      );
      errorSpy.mockRestore();
    });

    it('validates and reports a failed save', async () => {
      admin.updateQuestion.mockImplementation(() =>
        httpError(400, { detail: 'Question locked' })
      );
      await openEdit();
      const form = screen.getByDisplayValue('What is 2 + 2?').closest('form')!;
      await userEvent.clear(screen.getByDisplayValue('What is 2 + 2?'));
      fireEvent.submit(form);
      await expectError('Please enter question text');

      fireEvent.change(form.querySelector('textarea')!, {
        target: { value: 'Edited?' },
      });
      [0, 1, 3].forEach((i) =>
        fireEvent.change(optionBoxes()[i], { target: { value: '' } })
      );
      fireEvent.submit(form);
      await expectError('Please provide at least 2 options');

      fireEvent.change(optionBoxes()[0], { target: { value: 'One' } });
      fireEvent.change(optionBoxes()[3], { target: { value: 'Two' } });
      await userEvent.click(screen.getAllByRole('radio')[1]);
      fireEvent.change(optionBoxes()[1], { target: { value: 'Three' } });
      fireEvent.submit(form);
      await waitFor(() => expect(admin.updateQuestion).toHaveBeenCalled());
      await expectError('Question locked');
    });

    it('needs exactly one correct answer', async () => {
      admin.getQuestions.mockResolvedValue([
        question('q1', {
          question_text: 'What is 2 + 2?',
          options: [opt(1, 'a'), opt(2, 'b')],
        }),
      ] as any);
      await openEdit();
      await save();
      await expectError('Please select exactly one correct answer');
      expect(admin.updateQuestion).not.toHaveBeenCalled();
    });

    it('closes with Cancel or ✕', async () => {
      await openEdit();
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(
        screen.queryByRole('heading', { name: 'Edit Question' })
      ).not.toBeInTheDocument();
      await userEvent.click(
        block('What is 2 + 2?').getByRole('button', { name: 'Edit' })
      );
      await userEvent.click(screen.getByRole('button', { name: '✕' }));
      expect(
        screen.queryByRole('heading', { name: 'Edit Question' })
      ).not.toBeInTheDocument();
    });
  });

  describe('delete', () => {
    it('deletes the question and its images after confirming', async () => {
      admin.deleteQuestion.mockResolvedValue(undefined as any);
      admin.deleteImage.mockResolvedValue({} as any);
      confirmSpy.mockReturnValueOnce(false);
      await renderPage();
      await userEvent.click(
        block('What is 2 + 2?').getByRole('button', { name: 'Delete' })
      );
      expect(confirmSpy).toHaveBeenCalledWith('Delete this question?');
      expect(admin.deleteQuestion).not.toHaveBeenCalled();
      await userEvent.click(
        block('What is 2 + 2?').getByRole('button', { name: 'Delete' })
      );
      expect(
        await screen.findByText('Question deleted successfully')
      ).toBeInTheDocument();
      expect(admin.deleteImage).toHaveBeenCalledWith('pid-q1');
      expect(admin.deleteImage).toHaveBeenCalledWith('pid-o3');
      expect(admin.deleteQuestion).toHaveBeenCalledWith('q1');
      expect(screen.queryByText('What is 2 + 2?')).not.toBeInTheDocument();
    });

    it('shows a failed delete', async () => {
      admin.deleteQuestion.mockImplementation(() =>
        httpError(409, { detail: 'Question has answers' })
      );
      await renderPage();
      await userEvent.click(
        block('Is the sky blue?').getByRole('button', { name: 'Delete' })
      );
      expect(
        await screen.findByText('Question has answers')
      ).toBeInTheDocument();
      expect(admin.deleteImage).not.toHaveBeenCalled();
    });
  });

  describe('CSV import', () => {
    const csv = () =>
      new File(['question_text'], 'questions.csv', { type: 'text/csv' });
    const openImport = async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: 'Import CSV' }));
    };

    it('imports, lists skipped rows and reloads', async () => {
      admin.importQuestionsCSV.mockResolvedValue({
        questions_created: 5,
        errors: ['Row 3: no correct answer', 'Row 9: empty'],
      } as any);
      await openImport();
      expect(
        screen.getByRole('heading', { name: 'Import Questions from CSV' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Import Questions' })
      ).toBeDisabled();
      await userEvent.upload(fileInputs()[0], csv());
      await submitFile('Import Questions');
      expect(admin.importQuestionsCSV).toHaveBeenCalledWith(
        'e1',
        expect.any(File)
      );
      expect(
        await screen.findByText(/✅ 5 question\(s\) imported successfully/)
      ).toHaveTextContent(
        '2 row(s) skipped: Row 3: no correct answer Row 9: empty'
      );
      expect(
        screen.queryByRole('heading', { name: 'Import Questions from CSV' })
      ).not.toBeInTheDocument();
      await waitFor(() => expect(admin.getQuestions).toHaveBeenCalledTimes(2));
    });

    it('reports zero imports without skipped rows', async () => {
      admin.importQuestionsCSV.mockResolvedValue({} as any);
      await openImport();
      await userEvent.upload(fileInputs()[0], csv());
      await submitFile('Import Questions');
      expect(
        await screen.findByText('✅ 0 question(s) imported successfully')
      ).toBeInTheDocument();
    });

    it('needs a file and shows failed imports', async () => {
      admin.importQuestionsCSV.mockImplementation(() =>
        httpError(400, { detail: 'Wrong columns' })
      );
      await openImport();
      fireEvent.submit(fileInputs()[0].closest('form')!);
      await expectError('Please select a CSV file');
      await userEvent.upload(fileInputs()[0], csv());
      await submitFile('Import Questions');
      await expectError('Wrong columns');
      expect(
        screen.getByRole('heading', { name: 'Import Questions from CSV' })
      ).toBeInTheDocument();
    });

    it('downloads the template', async () => {
      let finish!: () => void;
      admin.downloadQuestionsCSVTemplate.mockReturnValue(
        new Promise<void>((r) => {
          finish = r;
        }) as any
      );
      await openImport();
      await userEvent.click(
        screen.getByRole('button', { name: 'Download Template' })
      );
      expect(
        screen.getByRole('button', { name: 'Downloading...' })
      ).toBeDisabled();
      finish();
      expect(
        await screen.findByRole('button', { name: 'Download Template' })
      ).toBeEnabled();
    });

    it('shows a failed template download', async () => {
      admin.downloadQuestionsCSVTemplate.mockImplementation(() =>
        httpError(500, { detail: 'Template missing' })
      );
      await openImport();
      await userEvent.click(
        screen.getByRole('button', { name: 'Download Template' })
      );
      await expectError('Template missing');
    });

    it('closes with Cancel or ✕', async () => {
      await openImport();
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(
        screen.queryByRole('heading', { name: 'Import Questions from CSV' })
      ).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Import CSV' }));
      await userEvent.click(screen.getByRole('button', { name: '✕' }));
      expect(
        screen.queryByRole('heading', { name: 'Import Questions from CSV' })
      ).not.toBeInTheDocument();
    });
  });

  describe('image ZIP upload', () => {
    const zip = () =>
      new File(['zip'], 'images.zip', { type: 'application/zip' });
    const openZip = async () => {
      await renderPage();
      await userEvent.click(
        screen.getByRole('button', { name: 'Upload Images ZIP' })
      );
    };

    it('applies images, lists errors and reloads', async () => {
      admin.uploadQuestionImagesZip.mockResolvedValue({
        applied: 3,
        skipped: 1,
        errors: ['99-1.png: no question 99'],
        message: 'Applied 3 images',
      });
      await openZip();
      expect(
        screen.getByRole('heading', { name: 'Upload Question Images (ZIP)' })
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Upload ZIP' })).toBeDisabled();
      await userEvent.upload(fileInputs()[0], zip());
      expect(screen.getByText('images.zip — 0.00 MB')).toBeInTheDocument();
      await submitFile('Upload ZIP');
      expect(admin.uploadQuestionImagesZip).toHaveBeenCalledWith(
        'e1',
        expect.any(File)
      );
      expect(await screen.findByText('Applied 3 images')).toBeInTheDocument();
      expect(screen.getByText('Show 1 error(s)')).toBeInTheDocument();
      expect(screen.getByText('99-1.png: no question 99')).toBeInTheDocument();
      await waitFor(() => expect(admin.getQuestions).toHaveBeenCalledTimes(2));
      await userEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(
        screen.queryByRole('heading', { name: 'Upload Question Images (ZIP)' })
      ).not.toBeInTheDocument();
    });

    it('shows a clean result without an error list', async () => {
      admin.uploadQuestionImagesZip.mockResolvedValue({
        applied: 2,
        skipped: 0,
        errors: [],
        message: 'Applied 2 images',
      });
      await openZip();
      await userEvent.upload(fileInputs()[0], zip());
      await submitFile('Upload ZIP');
      expect(
        (await screen.findByText('Applied 2 images')).parentElement
      ).toHaveClass('bg-green-50');
      expect(screen.queryByText(/error\(s\)/)).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: '✕' }));
      expect(screen.queryByText('Applied 2 images')).not.toBeInTheDocument();
    });

    it('needs a file and shows failed uploads', async () => {
      admin.uploadQuestionImagesZip.mockImplementation(() =>
        httpError(400, { detail: 'Corrupt ZIP' })
      );
      await openZip();
      fireEvent.submit(fileInputs()[0].closest('form')!);
      await expectError('Please select a ZIP file');
      await userEvent.upload(fileInputs()[0], zip());
      await submitFile('Upload ZIP');
      await expectError('Corrupt ZIP');
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(
        screen.queryByRole('heading', { name: 'Upload Question Images (ZIP)' })
      ).not.toBeInTheDocument();
    });
  });

  describe('preview', () => {
    it('shows the paper as students see it, with an answer toggle', async () => {
      await renderPage();
      await userEvent.click(
        screen.getByRole('button', { name: 'Preview Exam' })
      );
      expect(screen.getAllByText('admin@edura.lk • a1b2c3d4')).toHaveLength(32);
      expect(
        screen.getByText('Maths • Grade 10 •', { exact: false })
      ).toBeInTheDocument();
      expect(screen.getByText('End of Preview')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: '1. What is 2 + 2?' })
      ).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Question 1' })).toHaveAttribute(
        'src',
        'https://img/q1.png'
      );
      expect(screen.getByRole('img', { name: 'Option' })).toHaveAttribute(
        'src',
        'https://img/o3.png'
      );
      expect(screen.getByText('Explanation:')).toBeInTheDocument();
      expect(screen.getByTitle('Video Explanation')).toHaveAttribute(
        'src',
        'https://www.youtube.com/embed/abc123'
      );

      const radios = (q: string) =>
        Array.from(
          document.querySelectorAll(`input[name="question-${q}-preview"]`)
        ) as HTMLInputElement[];
      expect(radios('q1').map((r) => r.checked)).toEqual([
        false,
        true,
        false,
        false,
      ]);

      await userEvent.click(
        screen.getByRole('checkbox', { name: 'Master Copy (Show Answers)' })
      );
      expect(radios('q1').every((r) => !r.checked)).toBe(true);
      expect(screen.queryByText('Explanation:')).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', { name: 'CLOSE PREVIEW' })
      );
      expect(screen.queryByText('End of Preview')).not.toBeInTheDocument();
    });

    it('omits grade details when the course is unknown', async () => {
      admin.getQuestions.mockResolvedValue([
        question('q1', {
          question_text: 'What is 2 + 2?',
          video_url: 'https://youtu.be/v1',
        }),
      ] as any);
      await renderPage(
        asRole('admin', {
          courses: { courses: [mathsCourse({ id: 'other' })] },
          exams: { exams: [paper] },
        })
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Preview Exam' })
      );
      expect(screen.queryByText(/Grade 10/)).not.toBeInTheDocument();
      expect(screen.queryByText('Explanation:')).not.toBeInTheDocument();
      expect(screen.getByTitle('Video Explanation')).toHaveAttribute(
        'src',
        'https://www.youtube.com/embed/v1'
      );
    });
  });
});
