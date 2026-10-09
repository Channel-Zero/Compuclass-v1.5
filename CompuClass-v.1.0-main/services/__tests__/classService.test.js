import { classService } from '../classService';
import { supabase } from '../../config/supabase';
import { limiters } from '../../utils/rateLimiter';

jest.mock('../../config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'student-1' } } })) },
    from: jest.fn(),
  },
}));

describe('classService.joinClassByCode', () => {
  beforeEach(async () => {
    supabase.rpc.mockReset();
    await limiters.classJoin.reset('device');
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('rejects a bad code before calling the database', async () => {
    await expect(classService.joinClassByCode('IO01')).rejects.toThrow(/6 letters/);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('sends the normalised code and keeps a missing class generic', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Class code not found' } });
    await expect(classService.joinClassByCode('ab23cd')).rejects.toThrow('Class code not found');
    expect(supabase.rpc).toHaveBeenCalledWith('join_class_by_code', { p_code: 'AB23CD' });
  });

  it('returns the joined class', async () => {
    supabase.rpc.mockResolvedValue({ data: { class_id: 'c1', name: 'Hardware' }, error: null });
    await expect(classService.joinClassByCode('AB23CD')).resolves.toEqual({ class_id: 'c1', name: 'Hardware' });
  });
});
