// D:/OcNaAppV2/src/api/homeApi.ts
import { supabase } from '../services/supabase';

/**
 * Lấy danh sách bàn ĐANG HOẠT ĐỘNG (có đơn 'open') từ Supabase.
 */
export const fetchActiveTables = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('table_name')
    .eq('status', 'open');
    
  if (error) throw new Error(error.message);

  // Dùng Set để loại bỏ các tên bàn trùng lặp
  const activeTableSet = new Set(data.map(order => order.table_name));
  return Array.from(activeTableSet);
};

/**
 * Lấy danh sách bàn CHÍNH (master list) từ Supabase.
 */
export const loadTables = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('tables')
    .select('name');
    // (SỬA) Bỏ .order('name') ở đây để sort thủ công

  if (error) {
    console.error('Lỗi loadTables:', error);
    throw new Error(error.message);
  }

  const names = data.map(table => table.name);

  // (SỬA) Thêm Sắp xếp Tự nhiên (Natural Sort)
  const naturalSort = (a: string, b: string) => {
    // Trích xuất số từ tên bàn (ví dụ: 'Bàn 10' -> 10)
    // Nếu không phải số (VD: 'VIP 1'), nó sẽ dùng 0
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
    
    return numA - numB;
  };
  
  return names.sort(naturalSort);
};

/**
 * Thêm một bàn mới vào Supabase.
 */
export const addTable = async (tableName: string): Promise<string> => {
  const { data, error } = await supabase
    .from('tables')
    .insert({ name: tableName })
    .select()
    .single(); 

  if (error) {
    console.error('Lỗi addTable:', error);
    throw new Error(error.message);
  }
  return data.name;
};

/**
 * Xóa một bàn khỏi Supabase.
 */
export const deleteTable = async (tableName: string): Promise<string> => {
  const { error } = await supabase
    .from('tables')
    .delete()
    .eq('name', tableName);

  if (error) {
    console.error('Lỗi deleteTable:', error);
    throw new Error(error.message);
  }
  return tableName;
};