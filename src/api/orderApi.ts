// src/api/orderApi.ts
import { Database } from '../../types/supabase';
import { supabase } from '../services/supabase';

// Định nghĩa kiểu dữ liệu trả về từ RPC
export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type OrderDetails = Database['public']['Tables']['orders']['Row'] & {
  order_items: OrderItem[];
};
// Kiểu dữ liệu cho hàm RPC mới
export type OrderItemInput = {
  menu_item_id_input: number;
  quantity_input: number;
}

/**
 * (ĐÚNG) Gọi RPC 'get_open_order_for_table'
 * CHỈ LẤY đơn hàng 'open' nếu có, không tự động tạo
 */
export const fetchOpenOrderForTable = async (tableName: string): Promise<OrderDetails | null> => {
  const { data, error } = await supabase.rpc('get_open_order_for_table', {
    table_name_input: tableName,
  });

  if (error) throw new Error(error.message);
  return data as unknown as OrderDetails | null; // Sẽ là null nếu không có đơn
};

/**
 * (ĐÚNG) Tạo một đơn hàng 'open' mới
 */
export const createOrder = async (tableName: string): Promise<OrderDetails> => {
  const { data, error } = await supabase
    .from('orders')
    .insert({ table_name: tableName, status: 'open' })
    .select()
    .single(); // .single() để lấy về 1 object

  if (error) throw new Error(error.message);
  return { ...data, order_items: [] }; // Trả về cấu trúc giống OrderDetails
}

/**
 * (ĐÚNG) Gọi RPC 'upsert_order_items'
 * Gửi toàn bộ giỏ hàng lên 1 lần
 */
export const upsertOrderItems = async (params: {
  order_id_input: number;
  items_input: OrderItemInput[];
}) => {
  const { error } = await supabase.rpc('upsert_order_items', params);
  if (error) throw new Error(error.message);
};

/**
 * (ĐÚNG) Cập nhật trạng thái đơn hàng (ví dụ: 'paid')
 */
export const updateOrderStatus = async (orderId: number, status: 'paid' | 'open' | 'cancelled') => {
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId);

  if (error) throw new Error(error.message);
};
