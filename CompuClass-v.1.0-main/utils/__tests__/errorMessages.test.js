import React from 'react';
import { Alert, Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { getErrorMessage, AppError, GENERIC_ERROR, __resetErrorTrackingForTests } from '../errorMessages';
import ErrorBoundary from '../../components/ErrorBoundary';
import ClassManagementScreen from '../../screens/ClassManagementScreen';
import { lecturerService } from '../../services/lecturerService';

jest.mock('../../services/lecturerService', () => ({
  lecturerService: { getClasses: jest.fn(async () => []), getStudents: jest.fn(async () => []), createClass: jest.fn() },
}));

const LEAKY_PATTERN = /row-level|policy|constraint|relation|column|stack|\/services\/|\.js:\d+|at [A-Za-z]+ \(|PGRST|23505|key=|Gemini|googleapis|SELECT|supabase/i;

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  __resetErrorTrackingForTests();
});

describe('getErrorMessage', () => {
  const leakyErrors = [
    ['PostgREST RLS violation', { code: '42501', message: 'new row violates row-level security policy for table "folders"', details: null, hint: null }],
    ['unique constraint with details', { code: '23505', message: 'duplicate key value violates unique constraint "classes_pkey"', details: 'Key (id)=(2f1c...) already exists.' }],
    ['unknown DB error', { code: '42P01', message: 'relation "public.quiz_attempts_v2" does not exist' }],
    ['JS crash with stack', Object.assign(new TypeError("Cannot read properties of undefined (reading 'id')"), { stack: 'TypeError: ...\n    at createFolder (/app/services/lecturerService.js:42:17)' })],
    ['Gemini error body', new Error('Gemini API error: 400 - {"error":{"message":"API key not valid","status":"INVALID_ARGUMENT"}}')],
    ['raw string', 'ERROR: column "passwd" does not exist SELECT passwd FROM users'],
  ];

  it.each(leakyErrors)('never leaks internals for: %s', (_, error) => {
    const message = getErrorMessage(error, { context: 'test' });
    expect(message).not.toMatch(LEAKY_PATTERN);
  });

  it('maps known DB codes to friendly text and falls back to a generic message', () => {
    expect(getErrorMessage(leakyErrors[0][1])).toBe("You don't have permission to do that.");
    expect(getErrorMessage(leakyErrors[1][1])).toBe('That item already exists.');
    expect(getErrorMessage(leakyErrors[2][1])).toBe(GENERIC_ERROR);
    expect(getErrorMessage(leakyErrors[3][1])).toBe(GENERIC_ERROR);
  });

  it('keeps useful, safe auth and network messages', () => {
    expect(getErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('Invalid login credentials');
    expect(getErrorMessage({ code: 'email_not_confirmed' })).toMatch(/verify your email/);
    expect(getErrorMessage(new TypeError('Network request failed'))).toMatch(/internet connection/);
  });

  it('shows intentional app messages as-is', () => {
    expect(getErrorMessage(new AppError('Room not found or already started'))).toBe('Room not found or already started');
  });

  it('logs the full error detail to the console only', () => {
    const error = leakyErrors[0][1];
    getErrorMessage(error, { context: 'createFolder' });
    expect(console.error).toHaveBeenCalledWith('[createFolder]', error);
  });
});

describe('screens show generic errors', () => {
  beforeEach(() => jest.spyOn(Alert, 'alert').mockImplementation(() => {}));

  it('ClassManagement shows a friendly message when the DB rejects the insert', async () => {
    lecturerService.createClass.mockRejectedValue({ code: '42501', message: 'new row violates row-level security policy for table "classes"' });
    const utils = render(<ClassManagementScreen navigation={{ navigate: jest.fn() }} />);

    fireEvent.press(utils.getByLabelText('Create class'));
    fireEvent.changeText(utils.getByPlaceholderText('Class Name'), 'Networking 101');
    fireEvent.press(utils.getAllByText('Create').pop());

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', "You don't have permission to do that."));
    expect(JSON.stringify(Alert.alert.mock.calls)).not.toMatch(/row-level|policy/);
  });
});

describe('ErrorBoundary', () => {
  it('shows a generic message instead of a crash or stack trace', () => {
    const Boom = () => { throw new Error('secret internal detail at /app/screens/Dashboard.js:12'); };
    const utils = render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(utils.getByText('Something went wrong')).toBeTruthy();
    expect(utils.queryByText(/secret internal detail/)).toBeNull();
  });

  it('renders children normally when nothing throws', () => {
    const utils = render(<ErrorBoundary><Text>All good</Text></ErrorBoundary>);
    expect(utils.getByText('All good')).toBeTruthy();
  });
});
