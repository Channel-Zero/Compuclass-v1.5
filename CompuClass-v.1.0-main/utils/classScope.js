// A material with no class is for every signed-in user. A class id is visible
// to students in that class, the lecturer of that class, and the lecturer who
// owns the row. Announcements have no lecturer_id, so ownership is the
// teaching list only.

export function visibleInClassScope(row, scope) {
  if (!row || row.class_id == null || row.class_id === '') return true;
  const userId = scope?.userId;
  if (userId && row.lecturer_id && row.lecturer_id === userId) return true;
  if ((scope?.enrolledClassIds || []).includes(row.class_id)) return true;
  if ((scope?.teachingClassIds || []).includes(row.class_id)) return true;
  return false;
}

export function filterByClassScope(rows, scope) {
  if (!scope?.ready) return rows || [];
  return (rows || []).filter((row) => visibleInClassScope(row, scope));
}
