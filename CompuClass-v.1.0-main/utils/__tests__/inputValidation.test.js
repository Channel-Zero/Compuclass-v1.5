import { cleanText, cleanEmail, sanitizeFileName, escapeLikePattern, ValidationError } from '../inputValidation';

describe('cleanText', () => {
  it.each([
    '<script>alert(1)</script>',
    'Intro <img src=x onerror=alert(1)>',
    '</title><svg/onload=alert(1)>',
    'javascript:alert(1)',
    'Click me onclick=steal()',
  ])('rejects markup/script in a no-markup field: %s', (input) => {
    expect(() => cleanText(input, { field: 'Folder name', allowMarkup: false })).toThrow("Folder name can't contain HTML or script code.");
  });

  it('keeps SQL-looking text as literal text (parameterised queries make it harmless)', () => {
    expect(cleanText("Robert'); DROP TABLE students;--", { allowMarkup: false })).toBe("Robert'); DROP TABLE students;--");
  });

  it('allows code in fields where markup is allowed (e.g. quiz questions about HTML)', () => {
    expect(cleanText('What does the <p> tag do?', { multiline: true })).toBe('What does the <p> tag do?');
  });

  it('trims, collapses whitespace, and strips control / zero-width / bidi characters', () => {
    expect(cleanText('  Net\u0000work\u200B  101 \u202Egnp.exe ')).toBe('Network 101 gnp.exe');
  });

  it('keeps newlines in multiline fields', () => {
    expect(cleanText('line 1\nline 2', { multiline: true })).toBe('line 1\nline 2');
  });

  it('enforces required and max length', () => {
    expect(() => cleanText('   ', { field: 'Name', required: true })).toThrow('Name is required.');
    expect(() => cleanText('x'.repeat(101), { field: 'Name', maxLength: 100 })).toThrow('Name must be 100 characters or fewer.');
  });

  it('rejects non-string values', () => {
    expect(() => cleanText({ $ne: '' })).toThrow(ValidationError);
  });
});

describe('cleanEmail', () => {
  it('accepts and trims a normal email', () => {
    expect(cleanEmail('  student@school.ac.za ')).toBe('student@school.ac.za');
  });
  it.each(['not-an-email', 'a@b', '<script>@x.com', 'a b@c.com'])('rejects %s', (input) => {
    expect(() => cleanEmail(input)).toThrow('Please enter a valid email address.');
  });
});

describe('sanitizeFileName', () => {
  it.each([
    ['../../etc/passwd', 'passwd'],
    ['..\\..\\Windows\\win.ini', 'win.ini'],
    ['notes<script>.pdf', 'notes_script_.pdf'],
    ['my notes  v2.pdf', 'my_notes_v2.pdf'],
    ['...hidden', 'hidden'],
    ['', 'file'],
  ])('%j -> %j', (input, expected) => {
    expect(sanitizeFileName(input)).toBe(expected);
  });

  it('truncates long names but keeps the extension', () => {
    const name = sanitizeFileName(`${'a'.repeat(300)}.pdf`);
    expect(name).toHaveLength(120);
    expect(name.endsWith('.pdf')).toBe(true);
  });
});

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards so they match literally', () => {
    expect(escapeLikePattern('100%_done\\')).toBe('100\\%\\_done\\\\');
  });
});
