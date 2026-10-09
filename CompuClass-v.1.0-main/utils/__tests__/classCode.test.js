import { classCodeError, normalizeClassCode } from '../classCode';

describe('class codes', () => {
  it('ignores spaces and letter case', () => {
    expect(normalizeClassCode(' ab23 cd ')).toBe('AB23CD');
    expect(classCodeError('ab23cd')).toBeNull();
  });

  it('rejects a short code and the ambiguous characters', () => {
    expect(classCodeError('')).toMatch(/Enter the class code/);
    expect(classCodeError('ABC')).toMatch(/6 letters/);
    expect(classCodeError('ABIO01')).toMatch(/6 letters/);
  });
});
