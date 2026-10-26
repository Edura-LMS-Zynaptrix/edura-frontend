jest.mock('@/lib/api/admin')
jest.mock('@/lib/api/student')
jest.mock('@/lib/api/payment')

import * as adminApi from '@/lib/api/admin'
import * as studentApi from '@/lib/api/student'
import * as paymentApi from '@/lib/api/payment'
import * as admin from '@/lib/redux/slices/adminSlice'
import * as dashboard from '@/lib/redux/slices/studentDashboardSlice'
import * as payment from '@/lib/redux/slices/paymentSlice'
import { logout } from '@/lib/redux/slices/authSlice'
import { makeStore } from '@/test-utils/store'

const adminMock = adminApi as jest.Mocked<typeof adminApi>
const studentMock = studentApi as jest.Mocked<typeof studentApi>
const paymentMock = paymentApi as jest.Mocked<typeof paymentApi>
const fail = (message: string) =>
  Object.assign(new Error('x'), { response: { data: { detail: { message } } } })

beforeEach(() => jest.resetAllMocks())

describe('admin slice — loading data', () => {
  it.each([
    ['fetchAdminStats', () => admin.fetchAdminStats(), 'getAdminStats', 'stats', 'statsLoading'],
    ['fetchAdminAnalytics', () => admin.fetchAdminAnalytics(), 'getAdminAnalytics', 'analytics', 'analyticsLoading'],
    ['fetchAdminRankings', () => admin.fetchAdminRankings({ exam_id: '1' }), 'getAdminRankings', 'rankings', 'rankingsLoading'],
    ['fetchStreams', () => admin.fetchStreams(), 'getStreams', 'streams', 'streamsLoading'],
    ['fetchStudentProgress', () => admin.fetchStudentProgress('7'), 'getStudentProgress', 'selectedStudentProgress', 'progressLoading'],
    ['fetchStudentAttemptReview', () => admin.fetchStudentAttemptReview({ userId: '7', attemptId: '3' }), 'fetchStudentAttemptReview', 'selectedAttemptReview', 'reviewLoading'],
    ['fetchCourseStruggleAnalysis', () => admin.fetchCourseStruggleAnalysis('10'), 'getCourseStruggleAnalysis', 'selectedCourseStruggle', 'struggleLoading'],
  ] as const)('%s stores the result, or the error', async (_n, thunk, apiName, field, loading) => {
    const data = [{ id: 'x' }]
    ;(adminMock as any)[apiName].mockResolvedValue(data)
    const store = makeStore()
    const pending = store.dispatch(thunk() as any)
    expect((store.getState().admin as any)[loading]).toBe(true)
    await pending
    expect((store.getState().admin as any)[field]).toEqual(data)
    expect((store.getState().admin as any)[loading]).toBe(false)

    ;(adminMock as any)[apiName].mockRejectedValue(fail('Down'))
    await store.dispatch(thunk() as any)
    expect(store.getState().admin).toMatchObject({ error: 'Down', [loading]: false })
    store.dispatch(admin.clearAdminError())
    expect(store.getState().admin.error).toBeNull()
  })

  it('loads public streams into the same list', async () => {
    studentMock.getStreams.mockResolvedValue([{ id: '1' }] as any)
    const store = makeStore()
    await store.dispatch(admin.fetchPublicStreams())
    expect(store.getState().admin.streams).toEqual([{ id: '1' }])
    studentMock.getStreams.mockRejectedValue(fail('x'))
    await store.dispatch(admin.fetchPublicStreams())
    expect(store.getState().admin).toMatchObject({ error: 'x', streamsLoading: false })
  })

  it('fetches students with their total', async () => {
    adminMock.getAdminStudents.mockResolvedValue({ total: 40, students: [{ user_id: '7' }] as any })
    const store = makeStore()
    await store.dispatch(admin.fetchAdminStudents({ search: 'ama' }))
    expect(adminMock.getAdminStudents).toHaveBeenCalledWith({ search: 'ama' })
    expect(store.getState().admin).toMatchObject({ studentsTotal: 40, students: [{ user_id: '7' }] })

    adminMock.getAdminStudents.mockRejectedValue(fail('No'))
    await store.dispatch(admin.fetchAdminStudents(undefined))
    expect(store.getState().admin).toMatchObject({ error: 'No', studentsLoading: false })
  })
})

describe('admin slice — managing students', () => {
  const students = [
    { user_id: '7', is_active: true },
    { user_id: '8', is_active: true },
  ] as any

  it('updates the toggled student when the ids match as strings', async () => {
    adminMock.toggleStudentActive.mockResolvedValue({ user_id: '7', is_active: false })
    const store = makeStore({ admin: { students } })
    await store.dispatch(admin.toggleStudentActiveStatus('7'))
    expect(store.getState().admin.students[0].is_active).toBe(false)
  })

  // BUG: auth_service answers PUT /users/{id}/status with a numeric user_id,
  // but the student list holds string ids, so the row is never found and the
  // admin page keeps showing the old status until it is reloaded.
  test.failing('updates the toggled student from the real (numeric) API answer', async () => {
    adminMock.toggleStudentActive.mockResolvedValue({ user_id: 7 as any, is_active: false })
    const store = makeStore({ admin: { students } })
    await store.dispatch(admin.toggleStudentActiveStatus('7'))
    expect(store.getState().admin.students[0].is_active).toBe(false)
  })

  it('records a failed toggle', async () => {
    adminMock.toggleStudentActive.mockRejectedValue(fail('Forbidden'))
    const store = makeStore({ admin: { students } })
    await store.dispatch(admin.toggleStudentActiveStatus('7'))
    expect(store.getState().admin.error).toBe('Forbidden')
  })

  it('removes a deleted student and lowers the total', async () => {
    adminMock.deleteStudent.mockResolvedValue({ message: 'ok' })
    const store = makeStore({ admin: { students, studentsTotal: 2 } })
    await store.dispatch(admin.deleteStudentAction('7'))
    expect(store.getState().admin).toMatchObject({ studentsTotal: 1, students: [{ user_id: '8' }] })

    adminMock.deleteStudent.mockRejectedValue(fail('No'))
    await store.dispatch(admin.deleteStudentAction('8'))
    expect(store.getState().admin).toMatchObject({ error: 'No', studentsTotal: 1 })
  })

  it('sends a progress report', async () => {
    adminMock.sendStudentReportDetail.mockResolvedValue({ message: 'Sent' })
    const store = makeStore()
    const pending = store.dispatch(admin.sendStudentReportAction('7'))
    expect(store.getState().admin.reportLoading).toBe(true)
    expect((await pending).payload).toEqual({ message: 'Sent' })
    expect(store.getState().admin.reportLoading).toBe(false)

    adminMock.sendStudentReportDetail.mockRejectedValue(fail('No email'))
    await store.dispatch(admin.sendStudentReportAction('7'))
    expect(store.getState().admin).toMatchObject({ reportLoading: false, error: 'No email' })
  })
})

describe('admin slice — streams and admins', () => {
  it('adds, edits and removes streams', async () => {
    adminMock.createStream.mockResolvedValue({ id: '3', name: 'New' } as any)
    adminMock.updateStream.mockResolvedValue({ id: '1', name: 'Edited' } as any)
    adminMock.deleteStream.mockResolvedValue()
    const store = makeStore({ admin: { streams: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }] as any } })

    await store.dispatch(admin.createStreamAction({ name: 'New', subjects: [] }))
    await store.dispatch(admin.updateStreamAction({ id: '1', data: { name: 'Edited' } }))
    adminMock.updateStream.mockResolvedValue({ id: '404' } as any)
    await store.dispatch(admin.updateStreamAction({ id: '404', data: {} }))
    await store.dispatch(admin.deleteStreamAction('2'))
    expect(store.getState().admin.streams.map((s) => `${s.id}:${s.name}`)).toEqual(['3:New', '1:Edited'])
  })

  it.each([
    ['createStreamAction', () => admin.createStreamAction({ name: 'x', subjects: [] }), 'createStream'],
    ['updateStreamAction', () => admin.updateStreamAction({ id: '1', data: {} }), 'updateStream'],
    ['deleteStreamAction', () => admin.deleteStreamAction('1'), 'deleteStream'],
    ['createSubAdminAction', () => admin.createSubAdminAction({ email: 'a', full_name: 'b', password: 'c' }), 'createSubAdmin'],
    ['deleteSubAdminAction', () => admin.deleteSubAdminAction('1'), 'deleteSubAdmin'],
  ] as const)('%s rejects with the server message', async (_n, thunk, apiName) => {
    ;(adminMock as any)[apiName].mockRejectedValue(fail('Nope'))
    expect((await makeStore().dispatch(thunk() as any)).payload).toBe('Nope')
  })

  it('lists, adds and removes admins', async () => {
    adminMock.getSubAdmins.mockResolvedValue({ total: 1, admins: [{ id: '1' }] as any })
    adminMock.createSubAdmin.mockResolvedValue({ id: '2' } as any)
    adminMock.deleteSubAdmin.mockResolvedValue()
    const store = makeStore()

    await store.dispatch(admin.fetchSubAdmins())
    await store.dispatch(admin.createSubAdminAction({ email: 'a', full_name: 'b', password: 'c' }))
    expect(store.getState().admin.subAdmins.map((a) => a.id)).toEqual(['2', '1'])
    await store.dispatch(admin.deleteSubAdminAction('1'))
    expect(store.getState().admin.subAdmins.map((a) => a.id)).toEqual(['2'])

    adminMock.getSubAdmins.mockRejectedValue(fail('No'))
    await store.dispatch(admin.fetchSubAdmins())
    expect(store.getState().admin).toMatchObject({ error: 'No', subAdminsLoading: false })
  })
})

describe('payment slice', () => {
  it.each([
    ['initiatePaymentThunk', () => payment.initiatePaymentThunk({ payment_type: 'course', course_id: '1', payment_method: 'payhere' }), 'initiatePayment'],
    ['uploadBankSlipThunk', () => payment.uploadBankSlipThunk({ payment_id: 'p', slip_image: new File([], 'a') }), 'uploadBankSlip'],
  ] as const)('%s toggles loading and records failures', async (_n, thunk, apiName) => {
    ;(paymentMock as any)[apiName].mockResolvedValue({ id: '1' })
    const store = makeStore()
    const pending = store.dispatch(thunk() as any)
    expect(store.getState().payment.isLoading).toBe(true)
    expect((await pending).payload).toEqual({ id: '1' })
    expect(store.getState().payment.isLoading).toBe(false)

    ;(paymentMock as any)[apiName].mockRejectedValue(fail('Declined'))
    await store.dispatch(thunk() as any)
    expect(store.getState().payment).toMatchObject({ isLoading: false, error: 'Declined' })
    store.dispatch(payment.clearPaymentError())
    expect(store.getState().payment.error).toBeNull()
  })

  it('stores and clears the PayHere config', async () => {
    paymentMock.getPayHereConfig.mockResolvedValue({ order_id: 'ORD-1' } as any)
    const store = makeStore()
    await store.dispatch(payment.fetchPayHereConfigThunk('ORD-1'))
    expect(store.getState().payment.currentPaymentConfig).toEqual({ order_id: 'ORD-1' })
    store.dispatch(payment.clearCurrentConfig())
    expect(store.getState().payment.currentPaymentConfig).toBeNull()

    paymentMock.getPayHereConfig.mockRejectedValue(new Error('not initiated'))
    await store.dispatch(payment.fetchPayHereConfigThunk('x'))
    expect(store.getState().payment.error).toBe('not initiated')
  })

  it('lists slips and updates one after review', async () => {
    paymentMock.getAllBankSlips.mockResolvedValue([{ id: '5', status: 'pending' }, { id: '6', status: 'pending' }] as any)
    paymentMock.verifyBankSlip.mockResolvedValue({ id: '5', status: 'verified' } as any)
    const store = makeStore()

    await store.dispatch(payment.fetchAdminBankSlipsThunk({ statusFilter: 'pending', courseId: '10' }))
    expect(paymentMock.getAllBankSlips).toHaveBeenCalledWith('pending', '10')
    await store.dispatch(payment.verifyBankSlipThunk({ slipId: '5', verification: { status: 'verified' } }))
    expect(store.getState().payment.allSlips.map((s) => s.status)).toEqual(['verified', 'pending'])

    paymentMock.verifyBankSlip.mockResolvedValue({ id: '404' } as any)
    await store.dispatch(payment.verifyBankSlipThunk({ slipId: '404', verification: { status: 'rejected' } }))
    expect(store.getState().payment.allSlips).toHaveLength(2)
  })

  it('lists all slips by default', async () => {
    paymentMock.getAllBankSlips.mockResolvedValue([])
    await makeStore().dispatch(payment.fetchAdminBankSlipsThunk(undefined as any))
    expect(paymentMock.getAllBankSlips).toHaveBeenCalledWith(undefined, undefined)
  })

  it.each([
    ['fetchAdminBankSlipsThunk', () => payment.fetchAdminBankSlipsThunk({}), 'getAllBankSlips'],
    ['verifyBankSlipThunk', () => payment.verifyBankSlipThunk({ slipId: '1', verification: { status: 'verified' } }), 'verifyBankSlip'],
    ['fetchEarningsAnalysisThunk', () => payment.fetchEarningsAnalysisThunk(undefined), 'getEarningsAnalysis'],
  ] as const)('%s records failures', async (_n, thunk, apiName) => {
    ;(paymentMock as any)[apiName].mockRejectedValue(fail('Down'))
    const store = makeStore()
    await store.dispatch(thunk() as any)
    expect(store.getState().payment).toMatchObject({ isLoading: false, error: 'Down' })
  })

  it('loads bank accounts for students or admins', async () => {
    paymentMock.getStudentBankAccounts.mockResolvedValue([{ id: 's' }] as any)
    paymentMock.getAdminBankAccounts.mockResolvedValue([{ id: 'a' }] as any)
    const store = makeStore()
    await store.dispatch(payment.fetchBankAccountsThunk(false))
    expect(store.getState().payment.bankAccounts).toEqual([{ id: 's' }])
    await store.dispatch(payment.fetchBankAccountsThunk(true))
    expect(store.getState().payment.bankAccounts).toEqual([{ id: 'a' }])

    paymentMock.getAdminBankAccounts.mockRejectedValue(fail('No'))
    await store.dispatch(payment.fetchBankAccountsThunk(true))
    expect(store.getState().payment).toMatchObject({ error: 'No', isLoading: false })
  })

  it('adds, edits and removes bank accounts', async () => {
    paymentMock.createBankAccount.mockResolvedValue({ id: '3', bank_name: 'HNB' } as any)
    paymentMock.updateBankAccount.mockResolvedValue({ id: '1', bank_name: 'BOC 2' } as any)
    paymentMock.deleteBankAccount.mockResolvedValue()
    const store = makeStore({ payment: { bankAccounts: [{ id: '1', bank_name: 'BOC' }, { id: '2', bank_name: 'NSB' }] as any } })

    await store.dispatch(payment.createBankAccountThunk({ bank_name: 'HNB', account_number: '1', account_name: 'E', branch: 'C' }))
    await store.dispatch(payment.updateBankAccountThunk({ id: '1', data: { bank_name: 'BOC 2' } }))
    paymentMock.updateBankAccount.mockResolvedValue({ id: '404' } as any)
    await store.dispatch(payment.updateBankAccountThunk({ id: '404', data: {} }))
    await store.dispatch(payment.deleteBankAccountThunk('2'))
    expect(store.getState().payment.bankAccounts.map((a) => a.bank_name)).toEqual(['BOC 2', 'HNB'])
  })

  it.each([
    ['createBankAccountThunk', () => payment.createBankAccountThunk({} as any), 'createBankAccount'],
    ['updateBankAccountThunk', () => payment.updateBankAccountThunk({ id: '1', data: {} }), 'updateBankAccount'],
    ['deleteBankAccountThunk', () => payment.deleteBankAccountThunk('1'), 'deleteBankAccount'],
  ] as const)('%s rejects with the server message', async (_n, thunk, apiName) => {
    ;(paymentMock as any)[apiName].mockRejectedValue(fail('Nope'))
    expect((await makeStore().dispatch(thunk() as any)).payload).toBe('Nope')
  })

  it('loads earnings for a course', async () => {
    paymentMock.getEarningsAnalysis.mockResolvedValue({ total_revenue: 10 } as any)
    const store = makeStore()
    await store.dispatch(payment.fetchEarningsAnalysisThunk('10'))
    expect(paymentMock.getEarningsAnalysis).toHaveBeenCalledWith('10')
    expect(store.getState().payment.earningsAnalysis).toEqual({ total_revenue: 10 })
  })
})

describe('student dashboard slice', () => {
  it.each([
    ['fetchMyEnrollments', () => dashboard.fetchMyEnrollments({ offset: 5, limit: 10 }), 'getMyEnrollments', 'enrollments', 'loadingEnrollments', [5, 10]],
    ['fetchMyAttempts', () => dashboard.fetchMyAttempts(3), 'getMyAttempts', 'attempts', 'loadingAttempts', [3]],
    ['fetchLeaderboard', () => dashboard.fetchLeaderboard({ exam_id: '1', district: 'Colombo', limit: 5, offset: 0 }), 'getRankingsLeaderboard', 'leaderboard', 'loadingRankings', ['1', 'Colombo', 5, 0]],
    ['fetchExamRank', () => dashboard.fetchExamRank('1'), 'getExamRanking', 'examRank', 'loadingRankings', ['1']],
    ['fetchMyProgress', () => dashboard.fetchMyProgress(), 'getMyProgress', 'progress', 'loadingProgress', []],
    ['fetchAttemptReview', () => dashboard.fetchAttemptReview('9'), 'fetchAttemptReview', 'selectedAttemptReview', 'loadingReview', ['9']],
  ] as const)('%s stores the result, or the error', async (_n, thunk, apiName, field, loading, args) => {
    const data = { ok: true }
    ;(studentMock as any)[apiName].mockResolvedValue(data)
    const store = makeStore()
    const pending = store.dispatch(thunk() as any)
    expect((store.getState().studentDashboard as any)[loading]).toBe(true)
    await pending
    expect((studentMock as any)[apiName]).toHaveBeenCalledWith(...args)
    expect((store.getState().studentDashboard as any)[field]).toEqual(data)

    ;(studentMock as any)[apiName].mockRejectedValue(fail('Down'))
    await store.dispatch(thunk() as any)
    expect(store.getState().studentDashboard).toMatchObject({ error: 'Down', [loading]: false })
    store.dispatch(dashboard.clearDashboardError())
    expect(store.getState().studentDashboard.error).toBeNull()
  })

  it('defaults enrollment paging and attempt limits', async () => {
    studentMock.getMyEnrollments.mockResolvedValue({} as any)
    studentMock.getMyAttempts.mockResolvedValue([])
    const store = makeStore()
    await store.dispatch(dashboard.fetchMyEnrollments(undefined))
    await store.dispatch(dashboard.fetchMyAttempts(undefined as any))
    expect(studentMock.getMyEnrollments).toHaveBeenCalledWith(0, 50)
    expect(studentMock.getMyAttempts).toHaveBeenCalledWith(10)
  })

  it('fetches platform stats once', async () => {
    studentMock.getPlatformStats.mockResolvedValue({ total_students: 5 } as any)
    const store = makeStore()
    await Promise.all([
      store.dispatch(dashboard.fetchPlatformStats()),
      store.dispatch(dashboard.fetchPlatformStats()), // skipped while loading
    ])
    await store.dispatch(dashboard.fetchPlatformStats()) // skipped once loaded
    expect(studentMock.getPlatformStats).toHaveBeenCalledTimes(1)
    expect(store.getState().studentDashboard.platformStats).toEqual({ total_students: 5 })
  })

  it('records a failed stats load', async () => {
    studentMock.getPlatformStats.mockRejectedValue(fail('Down'))
    const store = makeStore()
    await store.dispatch(dashboard.fetchPlatformStats())
    expect(store.getState().studentDashboard).toMatchObject({ error: 'Down', loadingStats: false })
  })

  it('fetches ranking exams once', async () => {
    studentMock.getRankingExams.mockResolvedValue([{ exam_id: '1' }] as any)
    const store = makeStore()
    await store.dispatch(dashboard.fetchRankingExams())
    await store.dispatch(dashboard.fetchRankingExams())
    expect(studentMock.getRankingExams).toHaveBeenCalledTimes(1)

    const busy = makeStore({ studentDashboard: { loadingRankings: true } })
    await busy.dispatch(dashboard.fetchRankingExams())
    expect(studentMock.getRankingExams).toHaveBeenCalledTimes(1)

    studentMock.getRankingExams.mockRejectedValue(fail('Down'))
    const failing = makeStore()
    await failing.dispatch(dashboard.fetchRankingExams())
    expect(failing.getState().studentDashboard.error).toBe('Down')
  })

  it.each([
    ['logout', () => logout()],
    ['a new login', () => ({ type: 'auth/login/fulfilled', payload: {} })],
    ['a Google login', () => ({ type: 'auth/googleLogin/fulfilled', payload: {} })],
  ])('forgets the previous user\'s data on %s', (_n, action) => {
    const store = makeStore({
      studentDashboard: { attempts: [{ attempt_id: '1' }] as any, platformStats: { total_students: 1 } as any },
    })
    store.dispatch(action() as any)
    expect(store.getState().studentDashboard).toMatchObject({ attempts: [], platformStats: null })
  })
})
