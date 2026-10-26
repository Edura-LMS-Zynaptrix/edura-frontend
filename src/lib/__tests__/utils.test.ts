import { fmtLKR, getErrorMessage, timeAgo } from '@/lib/utils';
import { getInitials } from '@/lib/utils/initials';
import {
  clearOngoingExam,
  getAllOngoingExams,
  getOngoingExam,
  getSecondsRemaining,
  saveOngoingExam,
  type OngoingExamEntry,
} from '@/lib/ongoingExam';

describe('getErrorMessage', () => {
  it('returns a string error as is', () => {
    expect(getErrorMessage('Boom')).toBe('Boom');
  });

  it('reads the message of a local Error or a raw {error, message} object', () => {
    expect(getErrorMessage(new Error('Not supported yet'))).toBe(
      'Not supported yet'
    );
    expect(getErrorMessage({ error: 'CODE', message: 'Readable' })).toBe(
      'Readable'
    );
  });

  it('prefers the Edura detail.message, then detail.msg, then a plain detail', () => {
    const axiosError = (detail: unknown) => ({
      message: 'Request failed with status code 400',
      response: { data: { detail } },
    });
    expect(
      getErrorMessage(axiosError({ error: 'X', message: 'Email exists' }))
    ).toBe('Email exists');
    expect(getErrorMessage(axiosError({ msg: 'field required' }))).toBe(
      'field required'
    );
    expect(getErrorMessage(axiosError('Not found'))).toBe('Not found');
  });

  it('joins Pydantic validation errors', () => {
    const err = {
      response: {
        data: { detail: [{ msg: 'email invalid' }, { loc: ['body', 'x'] }] },
      },
    };
    expect(getErrorMessage(err)).toBe('email invalid; {"loc":["body","x"]}');
    expect(getErrorMessage({ response: { data: { detail: [] } } })).toBe(
      'Validation error occurred'
    );
  });

  it('falls back to the axios message, then a generic one', () => {
    expect(
      getErrorMessage({ message: 'Network Error', response: { data: {} } })
    ).toBe('Network Error');
    expect(
      getErrorMessage({ response: { data: { detail: { error: 'X' } } } })
    ).toBe('An error occurred');
    expect(getErrorMessage(undefined)).toBe('An error occurred');
    expect(getErrorMessage(null)).toBe('An error occurred');
  });
});

describe('fmtLKR', () => {
  it.each([
    [0, 'Rs 0'],
    [999, 'Rs 999'],
    [1_000, 'Rs 1.0K'],
    [1_550, 'Rs 1.6K'],
    [999_999, 'Rs 1000.0K'],
    [1_000_000, 'Rs 1.0M'],
    [2_340_000, 'Rs 2.3M'],
  ])('formats %d as %s', (amount, expected) => {
    expect(fmtLKR(amount)).toBe(expected);
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-10-25T12:00:00Z').getTime();
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(now));
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [null, ''],
    ['2026-10-25T11:59:30Z', '30s ago'],
    ['2026-10-25T11:55:00Z', '5m ago'],
    ['2026-10-25T09:00:00Z', '3h ago'],
    ['2026-10-22T12:00:00Z', '3d ago'],
  ])('%s -> %s', (iso, expected) => {
    expect(timeAgo(iso)).toBe(expected);
  });
});

describe('getInitials', () => {
  it('uses up to two initials of the name', () => {
    expect(getInitials('ama perera')).toBe('AP');
    expect(getInitials('Ama Kumari Perera')).toBe('AK');
    expect(getInitials('Ama')).toBe('A');
  });

  it('falls back to the email, then "U"', () => {
    expect(getInitials(undefined, 'kamal@example.com')).toBe('KA');
    expect(getInitials('', 'kamal@example.com')).toBe('KA');
    expect(getInitials()).toBe('U');
  });
});

describe('ongoingExam storage', () => {
  const entry = (examId: string, minutesLeft: number): OngoingExamEntry => ({
    examId,
    attemptId: `att-${examId}`,
    endsAt: new Date(Date.now() + minutesLeft * 60_000).toISOString(),
    examTitle: `Exam ${examId}`,
    durationMinutes: 60,
    totalQuestions: 40,
  });

  it('saves and reads back an attempt that is still running', () => {
    const e = entry('1', 10);
    saveOngoingExam(e);
    expect(getOngoingExam('1')).toEqual(e);
    expect(getOngoingExam('2')).toBeNull();
  });

  it('drops an attempt whose time is up', () => {
    saveOngoingExam(entry('1', -1));
    expect(getOngoingExam('1')).toBeNull();
    expect(localStorage.getItem('edura_ongoing_1')).toBeNull();
  });

  it('ignores corrupted entries', () => {
    localStorage.setItem('edura_ongoing_9', '{not json');
    expect(getOngoingExam('9')).toBeNull();
  });

  it('lists only running attempts and ignores other keys', () => {
    saveOngoingExam(entry('1', 10));
    saveOngoingExam(entry('2', -5));
    localStorage.setItem('accessToken', 'abc');
    expect(getAllOngoingExams().map((e) => e.examId)).toEqual(['1']);
  });

  it('clears an attempt on submit', () => {
    saveOngoingExam(entry('1', 10));
    clearOngoingExam('1');
    expect(getOngoingExam('1')).toBeNull();
  });

  it('counts seconds remaining, never below zero', () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-10-25T12:00:00Z').getTime());
    const base = { ...entry('1', 0) };
    expect(
      getSecondsRemaining({ ...base, endsAt: '2026-10-25T12:01:30Z' })
    ).toBe(90);
    expect(
      getSecondsRemaining({ ...base, endsAt: '2026-10-25T11:00:00Z' })
    ).toBe(0);
    jest.restoreAllMocks();
  });
});
