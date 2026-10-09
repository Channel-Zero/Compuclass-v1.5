import { filterByClassScope, visibleInClassScope } from '../classScope';

const scope = {
  ready: true,
  userId: 'lecturer-1',
  enrolledClassIds: ['class-a'],
  teachingClassIds: ['class-b'],
};

describe('class scope filtering', () => {
  it('keeps rows that are for every class', () => {
    expect(visibleInClassScope({ id: '1', class_id: null }, scope)).toBe(true);
    expect(visibleInClassScope({ id: '2' }, scope)).toBe(true);
  });

  it('keeps a class row for an enrolled student, the class lecturer, or the owner', () => {
    expect(visibleInClassScope({ class_id: 'class-a' }, scope)).toBe(true);
    expect(visibleInClassScope({ class_id: 'class-b' }, scope)).toBe(true);
    expect(visibleInClassScope({ class_id: 'class-c', lecturer_id: 'lecturer-1' }, scope)).toBe(true);
  });

  it('hides a class row the user does not belong to', () => {
    expect(visibleInClassScope({ class_id: 'class-c', lecturer_id: 'other' }, scope)).toBe(false);
  });

  it('filters a list and leaves the list alone when membership could not be loaded', () => {
    const rows = [{ id: 'all', class_id: null }, { id: 'mine', class_id: 'class-a' }, { id: 'other', class_id: 'class-c' }];
    expect(filterByClassScope(rows, scope).map((row) => row.id)).toEqual(['all', 'mine']);
    expect(filterByClassScope(rows, { ready: false })).toBe(rows);
  });
});

describe('class-scoped documents, folders, and announcements', () => {
  const documents = [
    { id: 'handout', class_id: null, lecturer_id: 'lecturer-9' },
    { id: 'enrolled', class_id: 'class-a', lecturer_id: 'lecturer-9' },
    { id: 'teaching', class_id: 'class-b', lecturer_id: 'lecturer-9' },
    { id: 'owned', class_id: 'class-c', lecturer_id: 'lecturer-1' },
    { id: 'hidden', class_id: 'class-c', lecturer_id: 'lecturer-9' },
  ];
  const folders = documents.map((row) => ({ ...row, id: `folder-${row.id}` }));
  const announcements = [
    { id: 'everyone', class_id: null },
    { id: 'enrolled', class_id: 'class-a' },
    { id: 'teaching', class_id: 'class-b' },
    { id: 'other-class', class_id: 'class-c' },
  ];

  it('keeps materials for every class, an enrolled class, a taught class, or the owner', () => {
    expect(filterByClassScope(documents, scope).map((row) => row.id)).toEqual(['handout', 'enrolled', 'teaching', 'owned']);
    expect(filterByClassScope(folders, scope).map((row) => row.id)).toEqual(['folder-handout', 'folder-enrolled', 'folder-teaching', 'folder-owned']);
  });

  it('hides an announcement for another class because announcements have no owner', () => {
    expect(filterByClassScope(announcements, scope).map((row) => row.id)).toEqual(['everyone', 'enrolled', 'teaching']);
    expect(visibleInClassScope({ id: 'other-class', class_id: 'class-c' }, scope)).toBe(false);
  });

  it('leaves documents and announcements unfiltered when membership could not be loaded', () => {
    expect(filterByClassScope(documents, { ready: false })).toBe(documents);
    expect(filterByClassScope(announcements, { ready: false })).toBe(announcements);
  });
});
