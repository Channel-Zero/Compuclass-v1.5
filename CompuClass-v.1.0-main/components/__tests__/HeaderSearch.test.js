import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import HeaderSearch from '../HeaderSearch';

describe('HeaderSearch', () => {
  it('accepts typed text and submits it', () => {
    const onSubmit = jest.fn();
    const { getByLabelText } = render(<HeaderSearch onSubmit={onSubmit} />);
    const input = getByLabelText('Search lessons, quizzes, games');

    expect(input.props.editable).not.toBe(false);
    fireEvent.changeText(input, 'RAM');
    expect(input.props.value).toBe('RAM');
    fireEvent(input, 'submitEditing');

    expect(onSubmit).toHaveBeenCalledWith('RAM');
  });

  it('does not submit an empty query', () => {
    const onSubmit = jest.fn();
    const { getByLabelText } = render(<HeaderSearch onSubmit={onSubmit} />);
    fireEvent(getByLabelText('Search lessons, quizzes, games'), 'submitEditing');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
