import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import TroubleshootingScreen from '../TroubleshootingScreen';
import { loadTroubleshootingProgress, saveScenarioResult } from '../../services/troubleshootingProgress';

jest.mock('../../services/troubleshootingProgress', () => ({
  loadTroubleshootingProgress: jest.fn(async () => ({ scenarios: {}, streak: 0, lastPlayed: null })),
  saveScenarioResult: jest.fn(),
}));

const FIX = 'Push the kettle lead in until it clicks, then switch the supply on.';
const CAUSE = 'The mains lead was not pushed fully into the power supply.';

describe('TroubleshootingScreen', () => {
  beforeEach(() => {
    loadTroubleshootingProgress.mockResolvedValue({ scenarios: {}, streak: 2, lastPlayed: null });
    saveScenarioResult.mockResolvedValue({
      progress: {
        scenarios: { 'desktop-no-power': { completed: true, bestScore: 80, lastPlayed: '2026-10-09T00:00:00.000Z' } },
        streak: 3,
        lastPlayed: '2026-10-09T00:00:00.000Z',
      },
      xpAwarded: 80,
    });
  });

  it('lists cases, filters them, and hides the cause until a diagnosis is committed', async () => {
    const { getByText, getByLabelText, queryByText } = render(<TroubleshootingScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => expect(getByText('Desktop will not turn on')).toBeTruthy());
    expect(queryByText(CAUSE)).toBeNull();
    expect(queryByText(FIX)).toBeNull();
    expect(getByText('2')).toBeTruthy();

    fireEvent.press(getByLabelText('No power'));
    expect(getByText('Laptop stays black on charge')).toBeTruthy();
    expect(queryByText('The printer looks offline')).toBeNull();

    fireEvent.press(getByText('Desktop will not turn on'));
    expect(getByText(/No lights on the case/)).toBeTruthy();
    expect(queryByText(CAUSE)).toBeNull();

    const commit = getByLabelText('Commit a diagnosis');
    expect(commit.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(getByLabelText('Reseat the RAM'));
    expect(getByText('Still no lights. Memory cannot light the power supply if power never arrives.')).toBeTruthy();
    fireEvent.press(getByLabelText('Show hint'));
    expect(getByText('No lights and no fan usually means power is not reaching the supply.')).toBeTruthy();

    fireEvent.press(getByLabelText('Plug a lamp into the same wall outlet'));
    fireEvent.press(getByLabelText('Commit a diagnosis'));
    expect(queryByText(FIX)).toBeNull();
    fireEvent.press(getByLabelText('The mains lead is loose at the power supply'));

    await waitFor(() => expect(getByText(FIX)).toBeTruthy());
    expect(getByText(CAUSE)).toBeTruthy();
    expect(getByText('+80 XP saved to your account')).toBeTruthy();
    expect(saveScenarioResult).toHaveBeenCalledWith(expect.objectContaining({
      scenarioId: 'desktop-no-power',
      correct: true,
    }));
  });
});