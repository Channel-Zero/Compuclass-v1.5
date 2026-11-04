import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
  };
});

import QuizCreationScreen from '../QuizCreationScreen';
import { lecturerService } from '../../services/lecturerService';
import { AppError } from '../../utils/errorMessages';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('../../services/lecturerService', () => ({
  lecturerService: {
    getFolders: jest.fn(),
    createFolder: jest.fn(),
    getQuizzes: jest.fn(),
    getClasses: jest.fn(),
    generateAIQuiz: jest.fn(),
  },
}));

const navigation = {
  goBack: jest.fn(),
  canGoBack: () => false,
  navigate: jest.fn(),
  getState: () => ({ routeNames: ['Lecturer'] }),
};

describe('QuizCreationScreen generate dialog', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    lecturerService.getFolders.mockResolvedValue([{ id: 'folder-1' }]);
    lecturerService.getQuizzes.mockResolvedValue([]);
    lecturerService.getClasses.mockResolvedValue([]);
    lecturerService.generateAIQuiz.mockReset();
    DocumentPicker.getDocumentAsync.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function openDialog(size = 2048) {
    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ name: 'notes.txt', size, mimeType: 'text/plain', uri: 'file://notes.txt' }],
    });
    const view = render(<QuizCreationScreen navigation={navigation} route={{ params: {} }} />);
    await waitFor(() => expect(view.getByText('No quizzes created yet')).toBeTruthy());
    fireEvent.press(view.getByText('AI Generate Quiz'));
    await waitFor(() => expect(view.getByText('notes.txt')).toBeTruthy());
    return view;
  }

  it('shows kilobytes for a small file in the generate dialog', async () => {
    const view = await openDialog(2048);
    expect(view.getByText('2 KB')).toBeTruthy();
    expect(view.queryByText('0.00 MB')).toBeNull();
  });

  it('shows a spinner while generating and the server error in the dialog', async () => {
    let rejectGenerate;
    lecturerService.generateAIQuiz.mockImplementation(() => new Promise((_, reject) => {
      rejectGenerate = reject;
    }));
    const view = await openDialog();
    fireEvent.changeText(view.getByPlaceholderText('Quiz Title'), 'Hardware');
    fireEvent.press(view.getByLabelText('Generate quiz'));

    await waitFor(() => expect(view.getByText(/Generating quiz\.\.\./)).toBeTruthy());
    expect(view.getByLabelText('Generating quiz')).toBeTruthy();

    rejectGenerate(new AppError('The AI service is unavailable right now. Please try again later.'));

    await waitFor(() => expect(
      view.getByText('The AI service is unavailable right now. Please try again later.')
    ).toBeTruthy());
    expect(view.queryByText(/Generating quiz\.\.\./)).toBeNull();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
