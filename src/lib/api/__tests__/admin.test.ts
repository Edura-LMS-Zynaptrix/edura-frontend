jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock());

import api from '@/lib/api/client';
import * as admin from '@/lib/api/admin';
import { httpError, reply, type MockClient } from '@/test-utils/api';

const http = api as unknown as MockClient;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };
const file = (name = 'f.csv') => new File(['x'], name);

beforeEach(() => jest.resetAllMocks());

describe('dashboard, analytics and progress (pass-through)', () => {
  it.each([
    [
      'getAdminStats',
      () => admin.getAdminStats(),
      'get',
      '/api/analytics/admin/stats',
    ],
    [
      'getAdminAnalytics',
      () => admin.getAdminAnalytics(),
      'get',
      '/api/analytics/admin/analytics',
    ],
    [
      'getStudentProgress',
      () => admin.getStudentProgress('7'),
      'get',
      '/api/analytics/students/7/progress',
    ],
    [
      'getAllStudentsProgressSummary',
      () => admin.getAllStudentsProgressSummary(),
      'get',
      '/api/analytics/students/progress-summary',
    ],
    [
      'getCourseStruggleAnalysis',
      () => admin.getCourseStruggleAnalysis('10'),
      'get',
      '/api/analytics/courses/10/struggle',
    ],
    [
      'sendStudentReportDetail',
      () => admin.sendStudentReportDetail('7'),
      'post',
      '/api/analytics/students/7/send-report',
    ],
    [
      'autoGenerateClassPackages',
      () => admin.autoGenerateClassPackages(),
      'post',
      '/api/enrollments/admin/class-packages/auto-generate',
    ],
  ] as const)('%s', async (_n, call, method, url) => {
    http[method].mockReturnValue(reply({ ok: true }));
    expect(await call()).toEqual({ ok: true });
    expect(http[method]).toHaveBeenCalledWith(url);
  });

  it('maps a student attempt review', async () => {
    http.get.mockReturnValue(
      reply({
        attempt_id: 3,
        marks_obtained: 1,
        total_questions: 2,
        ranking: { exam_id: 1, course_id: 2 },
      })
    );
    const review = await admin.fetchStudentAttemptReview('7', '3');
    expect(http.get).toHaveBeenCalledWith(
      '/api/assessments/submissions/3/review'
    );
    expect(review).toMatchObject({
      attempt_id: '3',
      ranking: { exam_id: '1', course_id: '2' },
    });
  });
});

describe('students', () => {
  const profile = (overrides = {}) => ({
    id: 7,
    name: 'Ama Perera',
    email: 'ama@x.lk',
    is_active: true,
    created_at: '2026-01-01',
    mobile_no: '0771234567',
    school: 'Royal',
    district: 'Colombo',
    grade: 11,
    nic_number: null,
    avatar_url: null,
    referral_code: 'AMA1',
    ...overrides,
  });

  it('maps student profiles and turns skip/limit into a page', async () => {
    http.get.mockReturnValue(reply({ total: 45, items: [profile()] }));
    const res = await admin.getAdminStudents({
      search: 'ama',
      skip: 40,
      limit: 20,
    });
    expect(http.get).toHaveBeenCalledWith('/api/users/', {
      params: { page: 3, page_size: 20, role: 'student', search: 'ama' },
    });
    expect(res.total).toBe(45);
    expect(res.students[0]).toEqual({
      user_id: '7',
      email: 'ama@x.lk',
      is_active: true,
      needs_profile_completion: false,
      joined_at: '2026-01-01',
      full_name: 'Ama Perera',
      phone_number: '0771234567',
      parent_phone_number: null,
      school: 'Royal',
      district: 'Colombo',
      grade: 11,
      nic_number: null,
      profile_photo_url: null,
      enrollment_count: 0,
      attempt_count: 0,
      referral_code: 'AMA1',
      referred_by_code: null,
      wallet_credits: 0,
      successful_referrals: 0,
      total_referral_credits: 0,
    });
  });

  it('defaults missing profile fields', async () => {
    http.get.mockReturnValue(
      reply({ total: 1, items: [{ id: 8, name: 'X', created_at: null }] })
    );
    const [s] = (await admin.getAdminStudents()).students;
    expect(http.get).toHaveBeenCalledWith('/api/users/', {
      params: { page: 1, page_size: 20, role: 'student', search: undefined },
    });
    expect(s).toMatchObject({
      email: '',
      is_active: true,
      phone_number: '',
      school: '',
      grade: 0,
      referral_code: null,
    });
  });

  it('filters by district, grade and status on the current page', async () => {
    http.get.mockReturnValue(
      reply({
        total: 3,
        items: [
          profile(),
          profile({ id: 8, district: 'Kandy', grade: 11 }),
          profile({
            id: 9,
            district: 'colombo 7',
            grade: 10,
            is_active: false,
          }),
        ],
      })
    );
    const ids = async (p: any) =>
      (await admin.getAdminStudents(p)).students.map((s) => s.user_id);
    expect(await ids({ district: 'COLOMBO' })).toEqual(['7', '9']);
    expect(await ids({ grade: 11 })).toEqual(['7', '8']);
    expect(await ids({ is_active: false })).toEqual(['9']);
  });

  it('flips the active flag', async () => {
    http.get.mockReturnValue(reply({ is_active: true }));
    http.put.mockReturnValue(reply({ user_id: 7, is_active: false }));
    await admin.toggleStudentActive('7');
    expect(http.put).toHaveBeenCalledWith('/api/auth/users/7/status', {
      is_active: false,
    });

    http.get.mockReturnValue(reply({})); // unknown state counts as active
    await admin.toggleStudentActive('7');
    expect(http.put).toHaveBeenLastCalledWith('/api/auth/users/7/status', {
      is_active: false,
    });
  });

  it('deletes the profile and the login, tolerating a missing login', async () => {
    http.delete.mockImplementation((url: string) =>
      url.startsWith('/api/auth') ? httpError(404) : reply(null)
    );
    expect(await admin.deleteStudent('7')).toEqual({
      message: 'Student deleted',
    });
    expect(http.delete.mock.calls.map((c) => c[0])).toEqual([
      '/api/users/7',
      '/api/auth/users/7',
    ]);
  });

  it('stops if the profile cannot be deleted', async () => {
    http.delete.mockReturnValue(httpError(403));
    await expect(admin.deleteStudent('7')).rejects.toBeTruthy();
    expect(http.delete).toHaveBeenCalledTimes(1);
  });
});

describe('rankings', () => {
  it('lists nothing until an exam is chosen', async () => {
    expect(await admin.getAdminRankings()).toEqual({ rankings: [], exams: [] });
    expect(http.get).not.toHaveBeenCalled();
  });

  it('maps the course leaderboard of the chosen exam', async () => {
    http.get.mockImplementation((url: string) =>
      url === '/api/assessments/1'
        ? reply({ course_id: 10, title: 'Q1' })
        : reply([
            { rank: 1, student_id: 7, points: 90 },
            { rank: 2, student_id: 8, points: 80 },
          ])
    );
    const res = await admin.getAdminRankings({ exam_id: '1', limit: 1 });
    expect(http.get).toHaveBeenCalledWith(
      '/api/progress/courses/10/leaderboard'
    );
    expect(res.rankings).toEqual([
      expect.objectContaining({
        island_rank: 1,
        user_id: '7',
        full_name: 'Student #7',
        total_marks: 90,
      }),
    ]);
    expect(res.exams).toEqual([
      { exam_id: '1', exam_title: 'Q1', course_title: '', subject: '' },
    ]);
  });
});

describe('streams and grade subjects', () => {
  const stream = {
    id: 1,
    name: 'Bio',
    subjects: ['B'],
    description: null,
    is_active: true,
    created_at: 'c',
  };

  it('lists all streams, including inactive ones', async () => {
    http.get.mockReturnValue(reply([stream]));
    expect(await admin.getStreams()).toEqual([
      {
        id: '1',
        name: 'Bio',
        subjects: ['B'],
        description: null,
        is_active: true,
        created_at: 'c',
        updated_at: null,
      },
    ]);
    expect(http.get).toHaveBeenCalledWith('/api/users/streams', {
      params: { active_only: false },
    });
    expect((await admin.getStream('1')).name).toBe('Bio');
    await expect(admin.getStream('9')).rejects.toThrow('Stream not found');
  });

  it('creates, updates and deletes streams', async () => {
    http.post.mockReturnValue(reply(stream));
    http.put.mockReturnValue(reply({ ...stream, name: 'Biology' }));
    http.delete.mockReturnValue(reply(null));
    await admin.createStream({ name: 'Bio', subjects: ['B'] });
    expect(http.post).toHaveBeenCalledWith('/api/users/streams', {
      name: 'Bio',
      subjects: ['B'],
    });
    expect((await admin.updateStream('1', { name: 'Biology' })).name).toBe(
      'Biology'
    );
    expect(http.put).toHaveBeenCalledWith('/api/users/streams/1', {
      name: 'Biology',
    });
    await admin.deleteStream('1');
    expect(http.delete).toHaveBeenCalledWith('/api/users/streams/1');
  });

  it('manages grade subjects', async () => {
    const subject = {
      id: 2,
      name: 'Science',
      grade: 9,
      is_active: true,
      created_at: 'c',
    };
    http.get.mockReturnValue(reply([subject]));
    http.post.mockReturnValue(reply(subject));
    http.put.mockReturnValue(reply({ ...subject, is_active: false }));
    http.delete.mockReturnValue(reply(null));

    expect(await admin.getGradeSubjects(9)).toEqual([
      { ...subject, id: '2', updated_at: null },
    ]);
    expect(http.get).toHaveBeenCalledWith('/api/users/grade-subjects', {
      params: { grade: 9, active_only: false },
    });
    await admin.createGradeSubject({ name: 'Science', grade: 9 });
    expect(http.post).toHaveBeenCalledWith('/api/users/grade-subjects', {
      name: 'Science',
      grade: 9,
    });
    expect(
      (await admin.updateGradeSubject('2', { is_active: false })).is_active
    ).toBe(false);
    await admin.deleteGradeSubject('2');
    expect(http.delete).toHaveBeenCalledWith('/api/users/grade-subjects/2');
  });
});

describe('courses', () => {
  const rawCourse = (id: number, overrides = {}) => ({
    id,
    title: `C${id}`,
    grade: 11,
    course_type: 'exam',
    thumbnail_url: null,
    price: '100',
    status: 'PUBLISHED',
    stream_ids: [1],
    modules: [
      {
        id: 5,
        course_id: id,
        title: 'L',
        order: 2,
        lesson_count: 3,
        created_at: 'c',
      },
    ],
    ...overrides,
  });

  it('pages through every course', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => rawCourse(i + 1));
    http.get
      .mockReturnValueOnce(reply({ total: 101, items: page1 }))
      .mockReturnValueOnce(
        reply({
          total: 101,
          items: [
            rawCourse(101, {
              status: 'DRAFT',
              course_type: null,
              stream_ids: null,
              modules: null,
            }),
          ],
        })
      );

    const courses = await admin.getCourses();

    expect(courses).toHaveLength(101);
    expect(http.get).toHaveBeenNthCalledWith(2, '/api/courses/', {
      params: { include_modules: true, page: 2, page_size: 100 },
    });
    expect(courses[0]).toMatchObject({
      id: '1',
      price: 100,
      is_active: true,
      stream_ids: ['1'],
      sub_courses: [
        {
          id: '5',
          course_id: '1',
          title: 'L',
          order_number: 2,
          is_active: true,
          video_count: 3,
          description: null,
          image_url: null,
          image_public_id: null,
          created_at: 'c',
        },
      ],
    });
    expect(courses[100]).toMatchObject({
      is_active: false,
      course_type: 'video',
      stream_ids: [],
      sub_courses: [],
    });
  });

  it('stops after a short page', async () => {
    http.get.mockReturnValue(reply({ total: 500, items: [rawCourse(1)] }));
    expect(await admin.getCourses()).toHaveLength(1);
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('creates a course with course_service field names', async () => {
    http.post.mockReturnValue(reply(rawCourse(1)));
    await admin.createCourse({
      title: 'Maths',
      subject: 'ignored',
      grade: 0,
      course_type: 'video',
      price: 0,
      image_url: 'u',
      image_public_id: 'p',
      stream_ids: [],
    });
    expect(http.post).toHaveBeenCalledWith('/api/courses/', {
      title: 'Maths',
      description: undefined,
      price: 0,
      course_type: 'video',
      grade: undefined, // 0 = no grade
      stream_ids: undefined, // empty = all streams
      thumbnail_url: 'u',
      thumbnail_public_id: 'p',
    });
  });

  it('updates a course, sending stream ids as numbers', async () => {
    http.put.mockReturnValue(reply(rawCourse(1)));
    await admin.updateCourse('1', {
      status: 'PUBLISHED',
      grade: 12,
      stream_ids: ['2', '3'],
    });
    expect(http.put).toHaveBeenCalledWith(
      '/api/courses/1',
      expect.objectContaining({
        status: 'PUBLISHED',
        grade: 12,
        stream_ids: [2, 3],
      })
    );
    await admin.updateCourse('1', { stream_ids: [] });
    expect(http.put.mock.calls[1][1].stream_ids).toEqual([]);
  });

  it('deletes a course', async () => {
    http.delete.mockReturnValue(reply(null));
    expect(await admin.deleteCourse('1')).toEqual({
      message: 'Course deleted',
    });
  });
});

describe('lessons (modules / sub-courses)', () => {
  const rawModule = {
    id: 5,
    course_id: 1,
    title: 'L',
    order: 1,
    created_at: 'c',
  };

  it('lists, creates, updates and deletes modules', async () => {
    http.get.mockReturnValue(reply([rawModule]));
    http.post.mockReturnValue(reply(rawModule));
    http.put.mockReturnValue(reply(rawModule));
    http.delete.mockReturnValue(reply(null));

    expect((await admin.getSubCourses('1'))[0].id).toBe('5');
    expect(await admin.getModulesForCourse('1')).toHaveLength(1);
    expect(http.get).toHaveBeenCalledWith('/api/courses/1/modules');

    await admin.createSubCourse({
      course_id: '1',
      title: 'L',
      order_number: 3,
    });
    expect(http.post).toHaveBeenCalledWith('/api/courses/1/modules', {
      title: 'L',
      description: null,
      image_url: null,
      image_public_id: null,
      is_active: true,
      order: 3,
    });

    await admin.updateSubCourse('1', '5', {
      is_active: false,
      order_number: 4,
    });
    expect(http.put).toHaveBeenCalledWith(
      '/api/courses/1/modules/5',
      expect.objectContaining({ is_active: false, order: 4 })
    );

    expect(await admin.deleteModuleForCourse('1', '5')).toEqual({
      message: 'Module deleted',
    });
  });

  it("clears a lesson's exams before deleting the lesson", async () => {
    http.delete.mockReturnValue(reply(null));
    await admin.deleteSubCourse('1', '5');
    expect(http.delete.mock.calls).toEqual([
      ['/api/assessments/by-module/5', { params: { course_id: '1' } }],
      ['/api/courses/1/modules/5'],
    ]);
  });
});

describe('exams', () => {
  const rawExam = {
    id: 3,
    course_id: 1,
    module_id: 5,
    title: 'Q',
    time_limit_minutes: 30,
    question_count: 10,
    position: 2,
    scheduled_start: null,
    is_published: true,
  };

  it('lists exams only for a course', async () => {
    expect(await admin.getExams()).toEqual([]);
    http.get.mockReturnValue(
      reply([rawExam, { ...rawExam, id: 4, module_id: null }])
    );
    const [a, b] = await admin.getExams('1');
    expect(a).toEqual({
      id: '3',
      course_id: '1',
      sub_course_id: '5',
      title: 'Q',
      image_url: null,
      image_public_id: null,
      description: null,
      duration_minutes: 30,
      total_questions: 10,
      price: 0,
      order_number: 2,
      scheduled_start: null,
      is_published: true,
    });
    expect(b.sub_course_id).toBeNull();
  });

  it('creates an exam, converting a local schedule to ISO', async () => {
    http.post.mockReturnValue(reply(rawExam));
    await admin.createExam({
      course_id: '1',
      sub_course_id: '5',
      title: 'Q',
      duration_minutes: 30,
      total_questions: 10,
      price: 0,
      order_number: 2,
      scheduled_start: '2026-12-01T09:00',
      is_published: false,
    });
    expect(http.post).toHaveBeenCalledWith('/api/assessments/', {
      course_id: 1,
      module_id: 5,
      title: 'Q',
      description: undefined,
      assessment_type: 'exam',
      time_limit_minutes: 30,
      image_url: null,
      image_public_id: null,
      position: 2,
      scheduled_start: new Date('2026-12-01T09:00').toISOString(),
      is_published: false,
    });
  });

  it('creates an exam outside any lesson with no schedule', async () => {
    http.post.mockReturnValue(reply(rawExam));
    await admin.createExam({
      course_id: '1',
      title: 'Q',
      duration_minutes: 30,
      total_questions: 1,
      price: 0,
      order_number: 0,
      is_published: true,
    });
    expect(http.post.mock.calls[0][1]).toMatchObject({
      module_id: null,
      scheduled_start: null,
    });
  });

  it('updates only the fields given', async () => {
    http.put.mockReturnValue(reply(rawExam));
    await admin.updateExam('3', { title: 'New' });
    expect(http.put).toHaveBeenCalledWith('/api/assessments/3', {
      title: 'New',
      description: undefined,
      time_limit_minutes: undefined,
      is_published: undefined,
      position: undefined,
    });
    await admin.updateExam('3', {
      sub_course_id: '',
      image_url: null,
      image_public_id: 'p',
      scheduled_start: '',
    });
    expect(http.put.mock.calls[1][1]).toMatchObject({
      module_id: null,
      image_url: null,
      image_public_id: 'p',
      scheduled_start: null,
    });
    await admin.updateExam('3', { sub_course_id: '6' });
    expect(http.put.mock.calls[2][1].module_id).toBe(6);
  });

  it('deletes an exam and uploads question images', async () => {
    http.delete.mockReturnValue(reply(null));
    http.post.mockReturnValue(
      reply({ applied: 2, skipped: 0, errors: [], message: 'ok' })
    );
    expect(await admin.deleteExam('3')).toEqual({ message: 'Exam deleted' });
    const zip = file('imgs.zip');
    expect((await admin.uploadQuestionImagesZip('3', zip)).applied).toBe(2);
    const [url, form, opts] = http.post.mock.calls[0];
    expect(url).toBe('/api/assessments/3/questions/images-zip');
    expect(form.get('file')).toBe(zip);
    expect(opts).toEqual(MULTIPART);
  });
});

describe('questions', () => {
  const rawQuestion = {
    id: 9,
    assessment_id: 3,
    question_text: '2+2?',
    position: 1,
    options: ['3', '4'],
    option_images: [null, { url: 'https://img/4.png', public_id: 'p4' }],
    correct_answer: '4',
    explanation: 'Basic',
  };

  it('maps questions and marks the correct option', async () => {
    http.get.mockReturnValue(
      reply([
        rawQuestion,
        {
          ...rawQuestion,
          id: 10,
          options: undefined,
          option_images: undefined,
        },
      ])
    );
    const [q, empty] = await admin.getQuestions('3');
    expect(q).toMatchObject({
      id: '9',
      exam_id: '3',
      order_number: 1,
      explanation: 'Basic',
      video_url: null,
    });
    expect(q.options).toEqual([
      {
        id: '9-0',
        option_text: '3',
        option_image_url: null,
        option_image_public_id: null,
        is_correct: false,
        order_number: 0,
      },
      {
        id: '9-1',
        option_text: '4',
        option_image_url: 'https://img/4.png',
        option_image_public_id: 'p4',
        is_correct: true,
        order_number: 1,
      },
    ]);
    expect(empty.options).toEqual([]);
  });

  it('creates an MCQ with option inputs', async () => {
    http.post.mockReturnValue(reply(rawQuestion));
    await admin.createQuestion({
      exam_id: '3',
      question_text: '2+2?',
      order_number: 1,
      options: [
        { option_text: '3', is_correct: false, order_number: 0 },
        {
          option_text: null,
          option_image_url: 'u',
          is_correct: true,
          order_number: 1,
        },
      ],
    });
    expect(http.post).toHaveBeenCalledWith('/api/assessments/3/questions', {
      question_text: '2+2?',
      question_type: 'mcq',
      options: [
        {
          option_text: '3',
          is_correct: false,
          option_image_url: null,
          option_image_public_id: null,
        },
        {
          option_text: '',
          is_correct: true,
          option_image_url: 'u',
          option_image_public_id: null,
        },
      ],
      explanation: null,
      question_image_url: null,
      question_image_public_id: null,
      marks: 1,
      position: 1,
    });
  });

  it('updates and deletes a question', async () => {
    http.put.mockReturnValue(reply(rawQuestion));
    http.delete.mockReturnValue(reply(null));
    await admin.updateQuestion('9', { question_text: 'New' });
    expect(http.put).toHaveBeenCalledWith('/api/assessments/questions/9', {
      question_text: 'New',
      options: undefined,
      explanation: undefined,
      question_image_url: undefined,
      question_image_public_id: undefined,
      position: undefined,
    });
    expect(await admin.deleteQuestion('9')).toEqual({
      message: 'Question deleted',
    });
  });

  it('imports questions from CSV and bulk-imports exams', async () => {
    http.post.mockReturnValue(reply({ questions_created: 2 }));
    const csv = file();
    await admin.importQuestionsCSV('3', csv);
    expect(http.post.mock.calls[0][0]).toBe(
      '/api/assessments/3/questions/import-csv'
    );

    await admin.bulkImportExams('1', '5', file('b.zip'));
    expect(http.post.mock.calls[1][0]).toBe('/api/assessments/bulk-import');
    expect(http.post.mock.calls[1][2]).toEqual({
      params: { course_id: 1, module_id: 5 },
      ...MULTIPART,
    });
    await admin.bulkImportExams('1', '', file('b.zip'));
    expect(http.post.mock.calls[2][2].params.module_id).toBeUndefined();
  });
});

describe('downloads', () => {
  let click: jest.SpyInstance;
  beforeEach(() => {
    (URL as any).createObjectURL = jest.fn(() => 'blob:x');
    (URL as any).revokeObjectURL = jest.fn();
    click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
  });
  afterEach(() => click.mockRestore());

  it.each([
    [
      'downloadQuestionsCSVTemplate',
      () => admin.downloadQuestionsCSVTemplate(),
      '/api/assessments/questions/csv-template',
      'questions_template.csv',
    ],
    [
      'downloadBulkImportTemplate',
      () => admin.downloadBulkImportTemplate(),
      '/api/assessments/bulk-import/template',
      'bulk_exam_template.zip',
    ],
    [
      'downloadCheckpointCSVTemplate',
      () => admin.downloadCheckpointCSVTemplate(),
      '/api/courses/checkpoints/csv-template',
      'video_checkpoints_template.csv',
    ],
  ])(
    '%s saves the file with the token-bearing request',
    async (_n, call, url, filename) => {
      http.get.mockReturnValue(reply('data'));
      let saved = '';
      click.mockImplementation(function (this: HTMLAnchorElement) {
        saved = this.download;
      });

      await call();

      expect(http.get).toHaveBeenCalledWith(url, { responseType: 'blob' });
      expect(saved).toBe(filename);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
      expect(document.querySelector('a[download]')).toBeNull(); // cleaned up
    }
  );
});

describe('uploads', () => {
  it('uploads an image and returns it under every field name callers use', async () => {
    http.post.mockReturnValue(
      reply({ secure_url: 'u', public_id: 'p', mime_type: 'image/png' })
    );
    expect(await admin.uploadImage(file('a.png'), 'courses')).toEqual({
      url: 'u',
      public_id: 'p',
      image_url: 'u',
      image_public_id: 'p',
      file_url: 'u',
      file_public_id: 'p',
      file_type: 'image/png',
    });
    expect(http.post.mock.calls[0][0]).toBe('/api/content/upload');
  });

  it('uploads a material file', async () => {
    http.post.mockReturnValue(
      reply({ secure_url: 'u', public_id: 'p', mime_type: 'application/pdf' })
    );
    expect(await admin.uploadFile(file('a.pdf'))).toEqual({
      file_url: 'u',
      file_public_id: 'p',
      file_type: 'application/pdf',
    });
    expect(http.post.mock.calls[0][0]).toBe('/api/content/upload-material');
  });

  it('deletes an asset by public id', async () => {
    http.delete.mockReturnValue(reply(null));
    expect(await admin.deleteImage('edura/uploads/a')).toEqual({
      message: 'Asset deleted',
    });
    expect(http.delete).toHaveBeenCalledWith('/api/content/assets', {
      params: { public_id: 'edura/uploads/a' },
    });
  });
});

describe('videos, materials and checkpoints', () => {
  const rawLesson = {
    id: 1,
    module_id: 5,
    title: 'Intro',
    youtube_video_id: 'yt',
    order: 2,
  };
  const rawMaterial = {
    id: 7,
    module_id: 5,
    lesson_id: 1,
    title: 'Slides',
    file_url: 'u',
    file_type: 'pdf',
    created_at: 'c',
  };

  it('maps videos and sends course_service field names', async () => {
    http.get.mockReturnValue(
      reply([rawLesson, { id: 2, module_id: 5, title: 'X' }])
    );
    http.post.mockReturnValue(reply(rawLesson));
    http.put.mockReturnValue(reply(rawLesson));
    http.delete.mockReturnValue(reply(null));

    const [intro, bare] = await admin.getVideosForModule('1', '5');
    expect(intro).toEqual({
      id: '1',
      module_id: '5',
      title: 'Intro',
      description: null,
      yt_video_id: 'yt',
      duration_seconds: 0,
      order_number: 2,
      is_published: true,
    });
    expect(bare).toMatchObject({ yt_video_id: '', order_number: 0 });

    await admin.createVideoForModule('1', {
      module_id: '5',
      title: 'Intro',
      yt_video_id: 'yt',
      duration_seconds: 60,
      order_number: 2,
      is_published: true,
    });
    expect(http.post).toHaveBeenCalledWith('/api/courses/1/modules/5/lessons', {
      title: 'Intro',
      description: null,
      youtube_video_id: 'yt',
      duration_seconds: 60,
      order: 2,
    });
    await admin.updateVideoForModule('1', '5', '1', { yt_video_id: 'new' });
    expect(http.put).toHaveBeenCalledWith(
      '/api/courses/1/modules/5/lessons/1',
      expect.objectContaining({ youtube_video_id: 'new' })
    );
    expect(await admin.deleteVideoForModule('1', '5', '1')).toEqual({
      message: 'Video deleted',
    });
  });

  it('maps materials and pins or unpins them to a video', async () => {
    http.get.mockReturnValue(reply([rawMaterial]));
    http.post.mockReturnValue(reply(rawMaterial));
    http.put.mockReturnValue(reply(rawMaterial));
    http.delete.mockReturnValue(reply(null));

    expect(await admin.getMaterials('1', '5')).toEqual([
      {
        id: '7',
        module_id: '5',
        video_id: '1',
        title: 'Slides',
        file_url: 'u',
        file_type: 'pdf',
        file_public_id: null,
        order_number: 0,
        created_at: 'c',
      },
    ]);
    await admin.getMaterialsForVideo('1', '5', '1');
    expect(http.get).toHaveBeenLastCalledWith(
      '/api/courses/1/modules/5/materials',
      { params: { lesson_id: '1' } }
    );

    await admin.createMaterial('1', {
      module_id: '5',
      title: 'S',
      file_url: 'u',
      file_type: 'pdf',
      order_number: 1,
    });
    expect(http.post.mock.calls[0][1]).toMatchObject({
      lesson_id: null,
      order: 1,
      file_public_id: null,
    });

    await admin.updateMaterial('1', '5', '7', { title: 'T' });
    expect(http.put.mock.calls[0][1]).not.toHaveProperty('lesson_id');
    await admin.updateMaterial('1', '5', '7', { video_id: null });
    expect(http.put.mock.calls[1][1].lesson_id).toBeNull();
    await admin.updateMaterial('1', '5', '7', { video_id: '2' });
    expect(http.put.mock.calls[2][1].lesson_id).toBe(2);

    expect(await admin.deleteMaterial('1', '5', '7')).toEqual({
      message: 'Material deleted',
    });
  });

  it('manages in-video checkpoints', async () => {
    http.get.mockReturnValue(reply([{ id: 1 }]));
    http.post.mockReturnValue(reply({ questions_created: 3 }));
    http.patch.mockReturnValue(reply({ id: 1 }));
    http.delete.mockReturnValue(reply(null));
    const base = '/api/courses/1/modules/5/lessons/9/checkpoints';

    expect(await admin.getVideoCheckpoints('1', '5', '9')).toEqual([{ id: 1 }]);
    expect(http.get).toHaveBeenCalledWith(base);
    await admin.importVideoCheckpointsCSV('1', '5', '9', file());
    expect(http.post.mock.calls[0][0]).toBe(`${base}/import-csv`);
    expect(await admin.clearVideoCheckpoints('1', '5', '9')).toEqual({
      message: 'Checkpoints cleared',
    });
    expect(http.delete).toHaveBeenCalledWith(base);
    expect(await admin.deleteVideoCheckpoint('4')).toEqual({
      message: 'Checkpoint deleted',
    });
    await admin.updateVideoCheckpoint('4', { timestamp_seconds: 30 });
    expect(http.patch).toHaveBeenCalledWith('/api/courses/checkpoints/4', {
      timestamp_seconds: 30,
    });
    await admin.updateCheckpointQuestion('6', { option_a: 'A' });
    expect(http.patch).toHaveBeenCalledWith(
      '/api/courses/checkpoint-questions/6',
      { option_a: 'A' }
    );
  });
});

describe('unsupported calls fail clearly', () => {
  it.each([
    ['getQuestion', () => admin.getQuestion('1'), 'list questions'],
    ['getModule', () => admin.getModule('1'), 'list modules'],
    [
      'updateModule',
      () => admin.updateModule('1', {}),
      'updateModuleForCourse',
    ],
    ['getVideos', () => admin.getVideos('1'), 'getVideosForModule'],
    ['createVideo', () => admin.createVideo({} as any), 'createVideoForModule'],
    ['updateVideo', () => admin.updateVideo('1', {}), 'updateVideoForModule'],
    ['deleteVideo', () => admin.deleteVideo('1'), 'deleteVideoForModule'],
    [
      'grantExamAccess',
      () => admin.grantExamAccess('1', ['2']),
      'not supported',
    ],
    [
      'revokeExamAccess',
      () => admin.revokeExamAccess('1', '2'),
      'not supported',
    ],
  ])('%s', async (_n, call, message) => {
    await expect(call()).rejects.toThrow(message);
    expect(Object.values(http).every((m) => m.mock.calls.length === 0)).toBe(
      true
    );
  });

  it('exam-level access lists are empty', async () => {
    expect(await admin.getEligibleStudentsForExam('1')).toEqual([]);
    expect(await admin.getEnrolledStudentsForExam('1')).toEqual([]);
  });
});

describe('course and lesson access', () => {
  it.each([
    [
      'course',
      () => admin.getEligibleStudentsForCourse('1', 'ama'),
      { course_id: 1, search: 'ama' },
    ],
    [
      'sub-course',
      () => admin.getEligibleStudentsForSubCourse('1', '5'),
      { course_id: 1, module_id: 5, search: undefined },
    ],
    [
      'video module',
      () => admin.getEligibleStudentsForVideoModule('1', '5', ''),
      { course_id: 1, module_id: 5, search: undefined },
    ],
  ])('eligible students for a %s', async (_n, call, params) => {
    http.get.mockReturnValue(reply([]));
    await call();
    expect(http.get).toHaveBeenCalledWith('/api/enrollments/admin/eligible', {
      params,
    });
  });

  it.each([
    [() => admin.getEnrolledStudentsForCourse('1'), { course_id: 1 }],
    [
      () => admin.getEnrolledStudentsForSubCourse('1', '5'),
      { course_id: 1, module_id: 5 },
    ],
    [
      () => admin.getEnrolledStudentsForVideoModule('1', '5'),
      { course_id: 1, module_id: 5 },
    ],
  ])('enrolled students %#', async (call, params) => {
    http.get.mockReturnValue(reply([]));
    await call();
    expect(http.get).toHaveBeenCalledWith('/api/enrollments/admin/enrolled', {
      params,
    });
  });

  it('grants and revokes with numeric ids', async () => {
    http.post.mockReturnValue(
      reply({ message: 'Access granted to 2 student(s)' })
    );
    http.delete.mockReturnValue(reply({ message: 'Access revoked' }));

    expect(await admin.grantCourseAccess('1', ['7', '8'])).toEqual({
      message: 'Access granted to 2 student(s)',
    });
    expect(http.post).toHaveBeenCalledWith('/api/enrollments/admin/grant', {
      course_id: 1,
      user_ids: [7, 8],
    });
    await admin.grantSubCourseAccess('1', '5', ['7']);
    await admin.grantVideoModuleAccess('1', '5', ['7']);
    expect(http.post).toHaveBeenLastCalledWith('/api/enrollments/admin/grant', {
      course_id: 1,
      module_id: 5,
      user_ids: [7],
    });

    expect(await admin.revokeCourseAccess('1', '7')).toEqual({
      message: 'Access revoked',
    });
    expect(http.delete).toHaveBeenCalledWith('/api/enrollments/admin/revoke', {
      params: { course_id: 1, user_id: 7 },
    });
    await admin.revokeSubCourseAccess('1', '5', '7');
    await admin.revokeVideoModuleAccess('1', '5', '7');
    expect(http.delete).toHaveBeenLastCalledWith(
      '/api/enrollments/admin/revoke',
      { params: { course_id: 1, module_id: 5, user_id: 7 } }
    );
  });
});

describe('admin accounts', () => {
  it('lists admins', async () => {
    http.get.mockReturnValue(
      reply({
        total: 1,
        items: [{ id: 1, name: 'Head Office', role: 'admin', created_at: 'c' }],
      })
    );
    expect(await admin.getSubAdmins()).toEqual({
      total: 1,
      admins: [
        {
          id: '1',
          user_id: '1',
          email: '',
          full_name: 'Head Office',
          role: 'admin',
          is_active: true,
          created_at: 'c',
        },
      ],
    });
    expect(http.get).toHaveBeenCalledWith('/api/users/', {
      params: { page: 1, page_size: 100, role: 'admin' },
    });
  });

  it('splits the full name when creating an admin', async () => {
    http.post.mockReturnValue(
      reply({ id: 2, email: 'b@x.lk', is_active: true })
    );
    const res = await admin.createSubAdmin({
      email: 'b@x.lk',
      full_name: ' Ama Kumari Perera ',
      password: 'pw',
    });
    expect(http.post).toHaveBeenCalledWith('/api/auth/admin/create-admin', {
      email: 'b@x.lk',
      password: 'pw',
      first_name: 'Ama',
      last_name: 'Kumari Perera',
    });
    expect(res).toMatchObject({
      id: '2',
      role: 'admin',
      full_name: ' Ama Kumari Perera ',
    });

    await admin.createSubAdmin({
      email: 'c@x.lk',
      full_name: 'Mononym',
      password: 'pw',
    });
    expect(http.post.mock.calls[1][1]).toMatchObject({
      first_name: 'Mononym',
      last_name: 'Mononym',
    });
  });

  it('deletes an admin everywhere', async () => {
    http.delete.mockImplementation((url: string) =>
      url.startsWith('/api/auth') ? httpError(500) : reply(null)
    );
    await admin.deleteSubAdmin('2');
    expect(http.delete.mock.calls.map((c) => c[0])).toEqual([
      '/api/users/2',
      '/api/auth/users/2',
    ]);
  });
});

describe('class packages', () => {
  it('drops empty filters', async () => {
    http.get.mockReturnValue(reply([]));
    await admin.getClassPackages({
      grade: 12,
      stream_id: '',
      is_active: undefined,
    });
    expect(http.get).toHaveBeenCalledWith(
      '/api/enrollments/admin/class-packages',
      { params: { grade: 12 } }
    );
    await admin.getClassPackages();
    expect(http.get).toHaveBeenLastCalledWith(
      '/api/enrollments/admin/class-packages',
      { params: {} }
    );
  });

  it('sends the stream as a number, null to clear, or omits it', async () => {
    http.post.mockReturnValue(reply({}));
    http.patch.mockReturnValue(reply({}));
    http.delete.mockReturnValue(reply(null));

    await admin.createClassPackage({
      name: 'G12 Bio',
      grade: 12,
      stream_id: '3',
      price: 0,
    });
    expect(http.post.mock.calls[0][1].stream_id).toBe(3);
    await admin.updateClassPackage('1', { stream_id: null });
    expect(http.patch.mock.calls[0][1].stream_id).toBeNull();
    await admin.updateClassPackage('1', { name: 'x' });
    expect(http.patch.mock.calls[1][1].stream_id).toBeUndefined();
    await admin.deleteClassPackage('1');
    expect(http.delete).toHaveBeenCalledWith(
      '/api/enrollments/admin/class-packages/1'
    );
  });

  it('lists, grants and revokes package holders', async () => {
    http.get.mockReturnValue(reply([]));
    http.post.mockReturnValue(reply({ id: '9' }));
    http.delete.mockReturnValue(reply(null));

    await admin.getClassEnrollments({ user_id: '7' });
    expect(http.get).toHaveBeenCalledWith(
      '/api/enrollments/admin/class-enrollments',
      { params: { user_id: '7' } }
    );
    await admin.adminGrantClassEnrollment({
      user_id: '7',
      class_package_id: '2',
      expires_at: '',
    });
    expect(http.post).toHaveBeenCalledWith(
      '/api/enrollments/admin/class-enrollments',
      {
        user_id: 7,
        class_package_id: 2,
        expires_at: undefined,
      }
    );
    await admin.adminRevokeClassEnrollment('9');
    expect(http.delete).toHaveBeenCalledWith(
      '/api/enrollments/admin/class-enrollments/9'
    );
  });
});
