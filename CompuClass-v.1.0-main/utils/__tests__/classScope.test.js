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
