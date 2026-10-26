jest.mock('@/lib/api/admin');
jest.mock('@/lib/api/student');

import * as adminApi from '@/lib/api/admin';
import * as studentApi from '@/lib/api/student';
import * as courses from '@/lib/redux/slices/coursesSlice';
import * as exams from '@/lib/redux/slices/examsSlice';
import * as questions from '@/lib/redux/slices/questionsSlice';
import * as video from '@/lib/redux/slices/videoClassesSlice';
import { makeStore } from '@/test-utils/store';

const admin = adminApi as jest.Mocked<typeof adminApi>;
const student = studentApi as jest.Mocked<typeof studentApi>;
const fail = (message: string) =>
  Object.assign(new Error('Request failed'), {
    response: { data: { detail: { message } } },
  });

beforeEach(() => jest.resetAllMocks());

const course = (id: string, extra = {}) => ({
  id,
  title: `C${id}`,
  subject: '',
  grade: 11,
  course_type: 'exam' as const,
  image_url: null,
  price: 0,
  stream_ids: [],
  sub_courses: [
    { id: '5', course_id: id, title: 'L', is_active: true, order_number: 1 },
  ],
  ...extra,
});

describe('courses slice — admin', () => {
  it('fetches, creates, updates and deletes courses', async () => {
    admin.getCourses.mockResolvedValue([course('1'), course('2')]);
    admin.createCourse.mockResolvedValue(course('3'));
    admin.updateCourse.mockResolvedValue(course('1', { title: 'Renamed' }));
    admin.deleteCourse.mockResolvedValue({ message: 'ok' });
    const store = makeStore();
    const ids = () => store.getState().courses.courses.map((c) => c.id);

    await store.dispatch(courses.fetchCourses());
    expect(ids()).toEqual(['1', '2']);
    await store.dispatch(
      courses.createCourse({
        title: 'x',
        subject: '',
        grade: 11,
        course_type: 'exam',
        price: 0,
      })
    );
    expect(ids()).toEqual(['3', '1', '2']); // newest first
    await store.dispatch(
      courses.updateCourse({ id: '1', data: { title: 'Renamed' } })
    );
    expect(store.getState().courses.courses[1].title).toBe('Renamed');
    await store.dispatch(courses.deleteCourse('2'));
    expect(ids()).toEqual(['3', '1']);
    expect(store.getState().courses.isLoading).toBe(false);
  });

  it('ignores an update for a course that is not listed', async () => {
    admin.updateCourse.mockResolvedValue(course('9'));
    const store = makeStore({ courses: { courses: [course('1')] } });
    await store.dispatch(courses.updateCourse({ id: '9', data: {} }));
    expect(store.getState().courses.courses.map((c) => c.id)).toEqual(['1']);
  });

  it('keeps lessons in sync with their course', async () => {
    const store = makeStore({
      courses: {
        courses: [course('1', { sub_courses: undefined }), course('2')],
      },
    });
    admin.createSubCourse.mockResolvedValue({
      id: '6',
      course_id: '1',
      title: 'New',
    });
    await store.dispatch(
      courses.createSubCourse({ course_id: '1', title: 'New', order_number: 1 })
    );
    expect(
      store.getState().courses.courses[0].sub_courses!.map((s) => s.id)
    ).toEqual(['6']);

    admin.updateSubCourse.mockResolvedValue({
      id: '5',
      course_id: '2',
      title: 'Edited',
    });
    await store.dispatch(
      courses.updateSubCourse({
        courseId: '2',
        id: '5',
        data: { title: 'Edited' },
      })
    );
    expect(store.getState().courses.courses[1].sub_courses![0].title).toBe(
      'Edited'
    );

    admin.deleteSubCourse.mockResolvedValue({ message: 'ok' });
    await store.dispatch(courses.deleteSubCourse({ courseId: '2', id: '5' }));
    expect(store.getState().courses.courses[1].sub_courses).toEqual([]);
    expect(admin.deleteSubCourse).toHaveBeenCalledWith('2', '5');
  });

  it('ignores lesson changes for courses that are not loaded', async () => {
    const store = makeStore({ courses: { courses: [course('1')] } });
    admin.createSubCourse.mockResolvedValue({ id: '6', course_id: '9' });
    await store.dispatch(
      courses.createSubCourse({ course_id: '9', title: 'x', order_number: 0 })
    );
    admin.updateSubCourse.mockResolvedValue({ id: '7', course_id: '1' });
    await store.dispatch(
      courses.updateSubCourse({ courseId: '1', id: '7', data: {} })
    );
    expect(
      store.getState().courses.courses[0].sub_courses!.map((s) => s.id)
    ).toEqual(['5']);
  });

  it.each([
    ['fetchCourses', () => courses.fetchCourses(), 'getCourses'],
    ['createCourse', () => courses.createCourse({} as any), 'createCourse'],
    [
      'updateCourse',
      () => courses.updateCourse({ id: '1', data: {} }),
      'updateCourse',
    ],
    ['deleteCourse', () => courses.deleteCourse('1'), 'deleteCourse'],
    [
      'createSubCourse',
      () => courses.createSubCourse({} as any),
      'createSubCourse',
    ],
    [
      'updateSubCourse',
      () => courses.updateSubCourse({ courseId: '1', id: '5', data: {} }),
      'updateSubCourse',
    ],
    [
      'deleteSubCourse',
      () => courses.deleteSubCourse({ courseId: '1', id: '5' }),
      'deleteSubCourse',
    ],
  ] as const)('%s records failures', async (_n, thunk, apiName) => {
    (admin as any)[apiName].mockRejectedValue(fail('Nope'));
    const store = makeStore();
    await store.dispatch(thunk() as any);
    expect(store.getState().courses).toMatchObject({
      isLoading: false,
      error: 'Nope',
    });
    store.dispatch(courses.clearError());
    expect(store.getState().courses.error).toBeNull();
  });

  it('uploads and deletes images', async () => {
    admin.uploadImage.mockResolvedValue({ url: 'u' } as any);
    admin.deleteImage.mockResolvedValue({ message: 'ok' });
    const store = makeStore();
    const file = new File(['x'], 'a.png');
    const up = await store.dispatch(
      courses.uploadImageThunk({ file, entity: 'courses' })
    );
    expect(up.payload).toEqual({ url: 'u' });
    expect(admin.uploadImage).toHaveBeenCalledWith(file, 'courses');
    await store.dispatch(courses.deleteImageThunk('pid'));
    expect(admin.deleteImage).toHaveBeenCalledWith('pid');

    admin.uploadImage.mockRejectedValue(fail('Too big'));
    expect(
      (await store.dispatch(courses.uploadImageThunk({ file, entity: 'x' })))
        .payload
    ).toBe('Too big');
    admin.deleteImage.mockRejectedValue(fail('Gone'));
    expect(
      (await store.dispatch(courses.deleteImageThunk('pid'))).payload
    ).toBe('Gone');
  });
});

describe('courses slice — student', () => {
  it("fetches the catalogue for the signed-in student's grade and stream", async () => {
    student.getAvailableCourses.mockResolvedValue([{ id: '1' } as any]);
    const store = makeStore({
      auth: { user: { profile: { grade: 12, stream_id: 3 } } as any },
    });
    await store.dispatch(courses.fetchAvailableCourses());
    expect(student.getAvailableCourses).toHaveBeenCalledWith(12, 3);
    expect(store.getState().courses.availableCourses).toEqual([{ id: '1' }]);
  });

  it('browses without a grade when signed out', async () => {
    student.getAvailableCourses.mockResolvedValue([]);
    await makeStore().dispatch(courses.fetchAvailableCourses());
    expect(student.getAvailableCourses).toHaveBeenCalledWith(
      undefined,
      undefined
    );
  });

  it('loads a course overview, clearing the previous one first', async () => {
    let resolve!: (v: any) => void;
    student.getCourseOverview.mockReturnValue(
      new Promise((r) => (resolve = r))
    );
    const store = makeStore({
      courses: {
        currentCourse: { id: 'old' } as any,
        currentCourseExams: [{ id: 'e' } as any],
      },
    });
    const pending = store.dispatch(courses.fetchCourseOverview('1'));
    expect(store.getState().courses).toMatchObject({
      currentCourse: null,
      currentCourseExams: [],
      studentLoading: true,
    });
    resolve({ id: '1' });
    await pending;
    expect(store.getState().courses.currentCourse).toEqual({ id: '1' });
  });

  it.each([
    ['fetchCourseExams', () => courses.fetchCourseExams('1'), 'getCourseExams'],
    [
      'fetchSubCourseExams',
      () => courses.fetchSubCourseExams('5'),
      'getSubCourseExams',
    ],
  ] as const)('%s stores the exams', async (_n, thunk, apiName) => {
    (student as any)[apiName].mockResolvedValue([{ id: 'e1' }]);
    const store = makeStore();
    await store.dispatch(thunk() as any);
    expect(store.getState().courses.currentCourseExams).toEqual([{ id: 'e1' }]);
  });

  it.each([
    [
      'fetchAvailableCourses',
      () => courses.fetchAvailableCourses(),
      'getAvailableCourses',
      'Failed to load courses.',
    ],
    [
      'fetchCourseOverview',
      () => courses.fetchCourseOverview('1'),
      'getCourseOverview',
      'Failed to load course details.',
    ],
    [
      'fetchCourseExams',
      () => courses.fetchCourseExams('1'),
      'getCourseExams',
      'Failed to load exams.',
    ],
    [
      'fetchSubCourseExams',
      () => courses.fetchSubCourseExams('1'),
      'getSubCourseExams',
      'Failed to load module exams.',
    ],
    [
      'enrollFreeCourseThunk',
      () => courses.enrollFreeCourseThunk('1'),
      'enrollFreeCourse',
      'Failed to enroll in the course.',
    ],
  ] as const)(
    '%s shows the server message, or a fallback',
    async (_n, thunk, apiName, fallback) => {
      (student as any)[apiName].mockRejectedValue(fail('Server says no'));
      const store = makeStore();
      await store.dispatch(thunk() as any);
      expect(store.getState().courses).toMatchObject({
        studentLoading: false,
        studentError: 'Server says no',
      });

      // A rejection without a string payload falls back to a readable message.
      const store2 = makeStore();
      store2.dispatch({
        type: (courses as any)[_n].rejected.type,
        payload: { weird: true },
      });
      expect(store2.getState().courses.studentError).toBe(fallback);
    }
  );

  it.each([
    [
      'enrollFreeCourseThunk',
      courses.enrollFreeCourseThunk,
      'enrollFreeCourse',
    ],
    [
      'enrollFreeVideoCourseThunk',
      courses.enrollFreeVideoCourseThunk,
      'enrollFreeVideoCourse',
    ],
  ] as const)(
    '%s marks the open course as enrolled',
    async (_n, thunk, apiName) => {
      (student as any)[apiName].mockResolvedValue({ message: 'Enrolled' });
      const store = makeStore({
        courses: { currentCourse: { id: '1', is_enrolled: false } as any },
      });
      const res = await store.dispatch(thunk('1'));
      expect(res.payload).toEqual({ courseId: '1', message: 'Enrolled' });
      expect(store.getState().courses.currentCourse!.is_enrolled).toBe(true);

      const none = makeStore();
      await none.dispatch(thunk('1'));
      expect(none.getState().courses.currentCourse).toBeNull();
    }
  );

  it('reports a failed free video enrollment', async () => {
    student.enrollFreeVideoCourse.mockRejectedValue(fail('Not free'));
    const store = makeStore();
    await store.dispatch(courses.enrollFreeVideoCourseThunk('1'));
    expect(store.getState().courses.studentError).toBe('Not free');
  });

  it('marks an exam attempted after submitting', () => {
    const store = makeStore({
      courses: {
        currentCourseExams: [
          {
            id: 'e1',
            already_attempted: false,
            last_score: null,
            last_total: null,
          } as any,
        ],
      },
    });
    store.dispatch(
      courses.markExamAttempted({ examId: 'e1', score: 8, total: 10 })
    );
    store.dispatch(
      courses.markExamAttempted({ examId: 'missing', score: 1, total: 1 })
    );
    expect(store.getState().courses.currentCourseExams[0]).toMatchObject({
      already_attempted: true,
      last_score: 8,
      last_total: 10,
    });
  });
});

describe('exams slice — admin', () => {
  it('fetches, creates, updates and deletes exams', async () => {
    admin.getExams.mockResolvedValue([{ id: '1' }, { id: '2' }]);
    admin.createExam.mockResolvedValue({ id: '3' });
    admin.updateExam.mockResolvedValue({ id: '1', title: 'New' });
    admin.deleteExam.mockResolvedValue({ message: 'ok' });
    const store = makeStore();
    const ids = () => store.getState().exams.exams.map((e) => e.id);

    await store.dispatch(exams.fetchExams('10'));
    expect(admin.getExams).toHaveBeenCalledWith('10');
    await store.dispatch(exams.createExam({}));
    expect(ids()).toEqual(['3', '1', '2']);
    await store.dispatch(exams.updateExam({ id: '1', data: {} }));
    expect(store.getState().exams.exams[1].title).toBe('New');
    admin.updateExam.mockResolvedValue({ id: '404' });
    await store.dispatch(exams.updateExam({ id: '404', data: {} }));
    await store.dispatch(exams.deleteExam('2'));
    expect(ids()).toEqual(['3', '1']);
  });

  it.each([
    ['fetchExams', () => exams.fetchExams('1'), 'getExams'],
    ['createExam', () => exams.createExam({}), 'createExam'],
    ['updateExam', () => exams.updateExam({ id: '1', data: {} }), 'updateExam'],
    ['deleteExam', () => exams.deleteExam('1'), 'deleteExam'],
  ] as const)('%s records failures', async (_n, thunk, apiName) => {
    (admin as any)[apiName].mockRejectedValue(fail('Nope'));
    const store = makeStore();
    await store.dispatch(thunk() as any);
    expect(store.getState().exams).toMatchObject({
      isLoading: false,
      error: 'Nope',
    });
    store.dispatch(exams.clearExamsError());
    expect(store.getState().exams.error).toBeNull();
  });
});

describe('exams slice — taking an exam', () => {
  const statusError = (status: number, detail: unknown) =>
    Object.assign(new Error('x'), { response: { status, data: { detail } } });

  it('starts an attempt', async () => {
    student.startExam.mockResolvedValue({ attempt_id: '1:s' } as any);
    const store = makeStore({
      exams: { currentAttempt: { attempt_id: 'old' } as any },
    });
    await store.dispatch(exams.startExam('1'));
    expect(store.getState().exams).toMatchObject({
      currentAttempt: { attempt_id: '1:s' },
      studentLoading: false,
    });
  });

  it.each([
    [
      409,
      { already_attempted: true, attempt_id: 'a' },
      { alreadyAttempted: true, already_attempted: true, attempt_id: 'a' },
      'Failed to start exam',
    ],
    [
      403,
      { not_started_yet: true, message: 'Opens at 9', scheduled_start: 'x' },
      { notStartedYet: true, message: 'Opens at 9', scheduledStart: 'x' },
      'Opens at 9',
    ],
    [
      403,
      {
        is_locked: true,
        lock_message: 'Finish lesson 1',
        lock_reason: 'sequential',
      },
      { isLocked: true, message: 'Finish lesson 1', reason: 'sequential' },
      'Finish lesson 1',
    ],
    [
      403,
      { error: 'NOT_ENROLLED', message: 'Enroll first' },
      'Enroll first',
      'Enroll first',
    ],
  ])(
    'a %d start error becomes a structured rejection',
    async (status, detail, payload, shown) => {
      student.startExam.mockRejectedValue(statusError(status, detail));
      const store = makeStore();
      const res = await store.dispatch(exams.startExam('1'));
      expect(res.payload).toEqual(payload);
      expect(store.getState().exams.studentError).toBe(shown);
    }
  );

  it('announces new badges when a submit earns them', async () => {
    const badge = { id: '3', name: 'First Step' };
    student.submitExamAttempt.mockResolvedValue({ new_badges: [badge] } as any);
    const store = makeStore();
    await store.dispatch(
      exams.submitExamAttempt({ attemptId: '1:s', payload: { answers: [] } })
    );
    expect(student.submitExamAttempt).toHaveBeenCalledWith('1:s', {
      answers: [],
    });
    expect(store.getState().badges.newlyEarned).toEqual([badge]);

    student.submitExamAttempt.mockResolvedValue({ new_badges: [] } as any);
    const quiet = makeStore();
    await quiet.dispatch(
      exams.submitExamAttempt({ attemptId: '1:s', payload: { answers: [] } })
    );
    expect(quiet.getState().badges.newlyEarned).toEqual([]);
  });

  it('reports a failed submit', async () => {
    student.submitExamAttempt.mockRejectedValue(fail('Session expired'));
    const store = makeStore();
    await store.dispatch(
      exams.submitExamAttempt({ attemptId: '1:s', payload: { answers: [] } })
    );
    expect(store.getState().exams.studentError).toBe('Session expired');
    store.dispatch({
      type: exams.submitExamAttempt.rejected.type,
      payload: undefined,
    });
    expect(store.getState().exams.studentError).toBe(
      'Auto-submit failed. Please try again.'
    );
  });

  it('loads the last attempt and the access check', async () => {
    student.getLastAttempt.mockResolvedValue({ marks_obtained: 3 } as any);
    student.checkExamAccess.mockResolvedValue({ has_access: true } as any);
    const store = makeStore();
    await store.dispatch(exams.fetchLastAttempt('1'));
    await store.dispatch(exams.checkExamAccess('1'));
    expect(store.getState().exams).toMatchObject({
      lastAttempt: { marks_obtained: 3 },
      examAccess: { has_access: true },
    });
  });

  it.each([
    [exams.fetchLastAttempt, 'getLastAttempt', 'Failed to load results.'],
    [exams.checkExamAccess, 'checkExamAccess', 'Access check failed.'],
  ] as const)(
    '%p failures use the message or a fallback',
    async (thunk, apiName, fallback) => {
      (student as any)[apiName].mockRejectedValue(fail('Down'));
      const store = makeStore();
      await store.dispatch((thunk as any)('1'));
      expect(store.getState().exams.studentError).toBe('Down');
      store.dispatch({ type: thunk.rejected.type, payload: null });
      expect(store.getState().exams.studentError).toBe(fallback);
    }
  );
});

describe('exams slice — access management', () => {
  const people = [{ user_id: '7' }, { user_id: '8' }] as any;

  it.each([
    [
      'exam',
      exams.fetchEnrolledStudents('1'),
      'getEnrolledStudentsForExam',
      ['1'],
    ],
    [
      'course',
      exams.fetchCourseEnrolledStudents('10'),
      'getEnrolledStudentsForCourse',
      ['10'],
    ],
    [
      'sub-course',
      exams.fetchSubCourseEnrolledStudents({
        courseId: '10',
        subCourseId: '5',
      }),
      'getEnrolledStudentsForSubCourse',
      ['10', '5'],
    ],
    [
      'video module',
      exams.fetchVideoModuleEnrolledStudents({ courseId: '10', moduleId: '5' }),
      'getEnrolledStudentsForVideoModule',
      ['10', '5'],
    ],
  ] as const)(
    'lists students enrolled in a %s',
    async (_n, action, apiName, args) => {
      (admin as any)[apiName].mockResolvedValue(people);
      const store = makeStore();
      await store.dispatch(action as any);
      expect((admin as any)[apiName]).toHaveBeenCalledWith(...args);
      expect(store.getState().exams).toMatchObject({
        enrolledStudents: people,
        accessLoading: false,
      });
    }
  );

  it.each([
    [
      'exam',
      exams.fetchEligibleStudents({ examId: '1', search: 'a' }),
      'getEligibleStudentsForExam',
      ['1', 'a'],
    ],
    [
      'course',
      exams.fetchCourseEligibleStudents({ courseId: '10', search: 'a' }),
      'getEligibleStudentsForCourse',
      ['10', 'a'],
    ],
    [
      'sub-course',
      exams.fetchSubCourseEligibleStudents({
        courseId: '10',
        subCourseId: '5',
      }),
      'getEligibleStudentsForSubCourse',
      ['10', '5', undefined],
    ],
    [
      'video module',
      exams.fetchVideoModuleEligibleStudents({
        courseId: '10',
        moduleId: '5',
        search: 'b',
      }),
      'getEligibleStudentsForVideoModule',
      ['10', '5', 'b'],
    ],
  ] as const)(
    'lists students eligible for a %s',
    async (_n, action, apiName, args) => {
      (admin as any)[apiName].mockResolvedValue(people);
      const store = makeStore();
      await store.dispatch(action as any);
      expect((admin as any)[apiName]).toHaveBeenCalledWith(...args);
      expect(store.getState().exams.eligibleStudents).toEqual(people);
    }
  );

  it.each([
    [
      'exam',
      () => exams.revokeExamAccessAction({ examId: '1', userId: '7' }),
      'revokeExamAccess',
    ],
    [
      'course',
      () => exams.revokeCourseAccessAction({ courseId: '10', userId: '7' }),
      'revokeCourseAccess',
    ],
    [
      'sub-course',
      () =>
        exams.revokeSubCourseAccessAction({
          courseId: '10',
          subCourseId: '5',
          userId: '7',
        }),
      'revokeSubCourseAccess',
    ],
    [
      'video module',
      () =>
        exams.revokeVideoModuleAccessAction({
          courseId: '10',
          moduleId: '5',
          userId: '7',
        }),
      'revokeVideoModuleAccess',
    ],
  ] as const)(
    'revoking %s access removes the student from the list',
    async (_n, thunk, apiName) => {
      (admin as any)[apiName].mockResolvedValue({ message: 'ok' });
      const store = makeStore({ exams: { enrolledStudents: people } });
      await store.dispatch(thunk() as any);
      expect(
        store.getState().exams.enrolledStudents.map((s) => s.user_id)
      ).toEqual(['8']);
    }
  );

  it.each([
    [
      'exam',
      () => exams.grantExamAccessAction({ examId: '1', userIds: ['7'] }),
      'grantExamAccess',
      { examId: '1', userIds: ['7'] },
    ],
    [
      'course',
      () => exams.grantCourseAccessAction({ courseId: '10', userIds: ['7'] }),
      'grantCourseAccess',
      { courseId: '10', userIds: ['7'] },
    ],
    [
      'sub-course',
      () =>
        exams.grantSubCourseAccessAction({
          courseId: '10',
          subCourseId: '5',
          userIds: ['7'],
        }),
      'grantSubCourseAccess',
      { subCourseId: '5', userIds: ['7'] },
    ],
    [
      'video module',
      () =>
        exams.grantVideoModuleAccessAction({
          courseId: '10',
          moduleId: '5',
          userIds: ['7'],
        }),
      'grantVideoModuleAccess',
      { moduleId: '5', userIds: ['7'] },
    ],
  ] as const)('grants %s access', async (_n, thunk, apiName, payload) => {
    (admin as any)[apiName].mockResolvedValue({ message: 'ok' });
    const res = await makeStore().dispatch(thunk() as any);
    expect(res.payload).toEqual(payload);
  });

  it.each([
    [
      'fetchEnrolledStudents',
      () => exams.fetchEnrolledStudents('1'),
      'getEnrolledStudentsForExam',
    ],
    [
      'fetchEligibleStudents',
      () => exams.fetchEligibleStudents({ examId: '1' }),
      'getEligibleStudentsForExam',
    ],
    [
      'grantExamAccessAction',
      () => exams.grantExamAccessAction({ examId: '1', userIds: [] }),
      'grantExamAccess',
    ],
    [
      'revokeExamAccessAction',
      () => exams.revokeExamAccessAction({ examId: '1', userId: '7' }),
      'revokeExamAccess',
    ],
    [
      'fetchCourseEnrolledStudents',
      () => exams.fetchCourseEnrolledStudents('1'),
      'getEnrolledStudentsForCourse',
    ],
    [
      'fetchSubCourseEnrolledStudents',
      () =>
        exams.fetchSubCourseEnrolledStudents({
          courseId: '1',
          subCourseId: '5',
        }),
      'getEnrolledStudentsForSubCourse',
    ],
    [
      'fetchVideoModuleEnrolledStudents',
      () =>
        exams.fetchVideoModuleEnrolledStudents({
          courseId: '1',
          moduleId: '5',
        }),
      'getEnrolledStudentsForVideoModule',
    ],
  ] as const)('%s records access errors', async (_n, thunk, apiName) => {
    (admin as any)[apiName].mockRejectedValue(fail('Forbidden'));
    const store = makeStore();
    await store.dispatch(thunk() as any);
    expect(store.getState().exams).toMatchObject({
      accessLoading: false,
      accessError: 'Forbidden',
    });
  });

  it.each([
    [
      'fetchCourseEligibleStudents',
      () => exams.fetchCourseEligibleStudents({ courseId: '1' }),
      'getEligibleStudentsForCourse',
    ],
    [
      'grantCourseAccessAction',
      () => exams.grantCourseAccessAction({ courseId: '1', userIds: [] }),
      'grantCourseAccess',
    ],
    [
      'revokeCourseAccessAction',
      () => exams.revokeCourseAccessAction({ courseId: '1', userId: '7' }),
      'revokeCourseAccess',
    ],
    [
      'fetchSubCourseEligibleStudents',
      () =>
        exams.fetchSubCourseEligibleStudents({
          courseId: '1',
          subCourseId: '5',
        }),
      'getEligibleStudentsForSubCourse',
    ],
    [
      'grantSubCourseAccessAction',
      () =>
        exams.grantSubCourseAccessAction({
          courseId: '1',
          subCourseId: '5',
          userIds: [],
        }),
      'grantSubCourseAccess',
    ],
    [
      'revokeSubCourseAccessAction',
      () =>
        exams.revokeSubCourseAccessAction({
          courseId: '1',
          subCourseId: '5',
          userId: '7',
        }),
      'revokeSubCourseAccess',
    ],
    [
      'fetchVideoModuleEligibleStudents',
      () =>
        exams.fetchVideoModuleEligibleStudents({
          courseId: '1',
          moduleId: '5',
        }),
      'getEligibleStudentsForVideoModule',
    ],
    [
      'grantVideoModuleAccessAction',
      () =>
        exams.grantVideoModuleAccessAction({
          courseId: '1',
          moduleId: '5',
          userIds: [],
        }),
      'grantVideoModuleAccess',
    ],
    [
      'revokeVideoModuleAccessAction',
      () =>
        exams.revokeVideoModuleAccessAction({
          courseId: '1',
          moduleId: '5',
          userId: '7',
        }),
      'revokeVideoModuleAccess',
    ],
  ] as const)(
    '%s rejects with the server message',
    async (_n, thunk, apiName) => {
      (admin as any)[apiName].mockRejectedValue(fail('Forbidden'));
      const res = await makeStore().dispatch(thunk() as any);
      expect(res.payload).toBe('Forbidden');
    }
  );
});

describe('questions slice', () => {
  const q = (id: string, text = 'Q') => ({ id, question_text: text }) as any;

  it('loads, adds, edits and removes questions', async () => {
    admin.getQuestions.mockResolvedValue([q('1'), q('2')]);
    admin.createQuestion.mockResolvedValue(q('3'));
    admin.updateQuestion.mockResolvedValue(q('1', 'Edited'));
    admin.deleteQuestion.mockResolvedValue({ message: 'ok' });
    const store = makeStore();
    const texts = () =>
      store
        .getState()
        .questions.questions.map((x) => `${x.id}:${x.question_text}`);

    await store.dispatch(questions.fetchQuestions('9'));
    await store.dispatch(questions.createQuestion({}));
    await store.dispatch(questions.updateQuestion({ id: '1', data: {} }));
    admin.updateQuestion.mockResolvedValue(q('404'));
    await store.dispatch(questions.updateQuestion({ id: '404', data: {} }));
    await store.dispatch(questions.deleteQuestion('2'));
    expect(texts()).toEqual(['1:Edited', '3:Q']);

    store.dispatch(questions.clearQuestions());
    expect(store.getState().questions.questions).toEqual([]);
  });

  it('imports a CSV without touching the list', async () => {
    admin.importQuestionsCSV.mockResolvedValue({
      message: 'ok',
      questions_created: 2,
      errors: [],
    });
    const store = makeStore({ questions: { questions: [q('1')] } });
    const file = new File(['x'], 'q.csv');
    const res = await store.dispatch(
      questions.importQuestionsCSV({ examId: '9', file })
    );
    expect(admin.importQuestionsCSV).toHaveBeenCalledWith('9', file);
    expect(res.payload).toMatchObject({ questions_created: 2 });
    expect(store.getState().questions).toMatchObject({
      isLoading: false,
      questions: [q('1')],
    });
  });

  it.each([
    ['fetchQuestions', () => questions.fetchQuestions('1'), 'getQuestions'],
    ['createQuestion', () => questions.createQuestion({}), 'createQuestion'],
    [
      'updateQuestion',
      () => questions.updateQuestion({ id: '1', data: {} }),
      'updateQuestion',
    ],
    ['deleteQuestion', () => questions.deleteQuestion('1'), 'deleteQuestion'],
    [
      'importQuestionsCSV',
      () =>
        questions.importQuestionsCSV({ examId: '1', file: new File([], 'a') }),
      'importQuestionsCSV',
    ],
  ] as const)('%s records failures', async (_n, thunk, apiName) => {
    (admin as any)[apiName].mockRejectedValue(fail('Bad'));
    const store = makeStore();
    await store.dispatch(thunk() as any);
    expect(store.getState().questions).toMatchObject({
      isLoading: false,
      error: 'Bad',
    });
    store.dispatch(questions.clearQuestionsError());
    expect(store.getState().questions.error).toBeNull();
  });
});

describe('video classes slice', () => {
  it('loads a video class', async () => {
    student.getVideoClassDetails.mockResolvedValue({ id: '10' } as any);
    const store = makeStore();
    await store.dispatch(video.fetchVideoClassDetails('10'));
    expect(store.getState().videoClasses).toMatchObject({
      currentVideoClass: { id: '10' },
      isLoading: false,
    });

    student.getVideoClassDetails.mockRejectedValue(fail('Not enrolled'));
    await store.dispatch(video.fetchVideoClassDetails('10'));
    expect(store.getState().videoClasses.error).toBe('Not enrolled');
  });

  it('creates a module and tracks admin errors', async () => {
    admin.createModule.mockResolvedValue({ id: '5' });
    const store = makeStore();
    await store.dispatch(
      video.createModuleAction({ course_id: '1', title: 'L', order_number: 1 })
    );
    expect(store.getState().videoClasses.adminLoading).toBe(false);

    admin.createModule.mockRejectedValue(fail('Not owner'));
    await store.dispatch(
      video.createModuleAction({ course_id: '1', title: 'L', order_number: 1 })
    );
    expect(store.getState().videoClasses.adminError).toBe('Not owner');
    store.dispatch(video.clearVideoErrors());
    expect(store.getState().videoClasses).toMatchObject({
      error: null,
      adminError: null,
    });
  });

  it('updateProgress marks a video watched when the payload names it', async () => {
    const course = {
      id: '10',
      modules: [
        {
          id: '5',
          videos: [{ id: '1', is_completed: false, watched_percentage: 0 }],
        },
      ],
    } as any;
    student.updateVideoProgress.mockResolvedValue({
      video_id: '1',
      is_completed: true,
      watched_percentage: 100,
    });
    const store = makeStore({ videoClasses: { currentVideoClass: course } });
    await store.dispatch(
      video.updateProgress({ course_id: '10', video_id: '1' })
    );
    expect(
      store.getState().videoClasses.currentVideoClass!.modules![0].videos[0]
    ).toMatchObject({
      is_completed: true,
      watched_percentage: 100,
    });

    student.updateVideoProgress.mockRejectedValue(fail('x'));
    expect(
      (
        await store.dispatch(
          video.updateProgress({ course_id: '10', video_id: '1' })
        )
      ).payload
    ).toBe('x');
    // Nothing to update without a loaded class.
    student.updateVideoProgress.mockResolvedValue({ video_id: '1' });
    await makeStore().dispatch(
      video.updateProgress({ course_id: '10', video_id: '1' })
    );
  });

  it('createVideoAction surfaces the API error', async () => {
    admin.createVideo.mockRejectedValue(new Error('Use createVideoForModule'));
    const res = await makeStore().dispatch(video.createVideoAction({} as any));
    expect(res.payload).toBe('Use createVideoForModule');
    admin.createVideo.mockResolvedValue({ id: '1' });
    expect(
      (await makeStore().dispatch(video.createVideoAction({} as any))).payload
    ).toEqual({ id: '1' });
  });
});
