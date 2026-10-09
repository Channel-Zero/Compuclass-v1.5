import { supabase } from '../config/supabase';
import { AppError } from '../utils/errorMessages';
import { classCodeError, normalizeClassCode } from '../utils/classCode';
import { limiters } from '../utils/rateLimiter';

function joinError(error) {
  const message = error?.message || '';
  if (/only students can join/i.test(message)) return new AppError('Only students can join a class.');
  if (/class code not found/i.test(message)) return new AppError('Class code not found');
  return new AppError('Class code not found');
}

export const classService = {
  async joinClassByCode(rawCode) {
    const formatError = classCodeError(rawCode);
    if (formatError) throw new AppError(formatError);
    await limiters.classJoin.consume('device');
    const { data, error } = await supabase.rpc('join_class_by_code', {
      p_code: normalizeClassCode(rawCode),
    });
    if (error) throw joinError(error);
    return data;
  },

  async leaveClass(classId) {
    const { data, error } = await supabase.rpc('leave_class', { p_class_id: classId });
    if (error) throw new AppError('Could not leave this class. Please try again.');
    return data;
  },

  async regenerateClassCode(classId) {
    const { data, error } = await supabase.rpc('regenerate_class_code', { p_class_id: classId });
    if (error) throw new AppError('Could not make a new class code. Please try again.');
    return data;
  },

  async myClasses() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('class_students')
      .select('class_id, classes(name)')
      .eq('student_id', user.id);
    if (error) return [];
    return (data || [])
      .filter((row) => row.classes)
      .map((row) => ({ id: row.class_id, name: row.classes.name }));
  },
};
