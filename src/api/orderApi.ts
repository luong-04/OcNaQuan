// File: src/api/orderApi.ts
import { supabase } from '../services/supabase';

export interface OrderItemInput {
  menu_item_id_input: number;
  quantity_input: number;
}

// 1. Tạo đơn hàng
export const createOrder = async (tableName: string) => {
  // Update status bàn thành 'occupied' (Có khách)
  await supabase
    .from('tables')
    .update({ status: 'occupied' } as any)
    .eq('name', tableName);

  // Tạo đơn hàng mới
  const { data, error } = await supabase
    .from('orders')
    .insert({
      table_name: tableName,
      status: 'served',
      total_amount: 0
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// 2. Lấy đơn hàng
export const fetchOpenOrderForTable = async (tableName: string) => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, table_name, status, total_amount,
      order_items ( id, menu_item_id, quantity )
    `)
    .eq('table_name', tableName)
    .eq('status', 'served')
    .order('created_at', { ascending: false }) // Lấy đơn mới nhất
    .limit(1)
    .maybeSingle(); // Không báo lỗi nếu null

  if (error) throw error;
  return data;
};

// 3. Upsert món
export const upsertOrderItems = async ({ order_id_input, items_input }: { order_id_input: number, items_input: OrderItemInput[] }) => {
  const { data, error } = await supabase.rpc('upsert_order_items', {
    order_id_input,
    items_input
  });
  if (error) throw error;
  return data;
};

// 4. THANH TOÁN (SỬA: Thêm totalAmount để lưu doanh thu)
export const updateOrderStatus = async (orderId: number, status: 'paid' | 'cancelled', totalAmount?: number) => {
  const updatePayload: any = { status };
  
  // Lưu tổng tiền khi thanh toán
  if (status === 'paid' && totalAmount !== undefined) {
    updatePayload.total_amount = totalAmount;
  }

  const { data, error } = await supabase
    .from('orders')
    .update(updatePayload)
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  // Trả bàn về trạng thái empty
  if (data) {
    await supabase
      .from('tables')
      .update({ status: 'empty' } as any)
      .eq('name', data.table_name);
  }
  return data;
};

// 5. Chuyển bàn
export const moveTable = async (fromTableName: string, toTableName: string) => {
  // Check bàn đích
  const { data: targetOrder } = await supabase.from('orders').select('id').eq('table_name', toTableName).eq('status', 'served').maybeSingle();
  if (targetOrder) throw new Error(`Bàn ${toTableName} đang có khách!`);

  // Lấy đơn cũ
  const { data: sourceOrder } = await supabase.from('orders').select('id').eq('table_name', fromTableName).eq('status', 'served').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!sourceOrder) throw new Error(`Bàn ${fromTableName} không có đơn.`);

  // Update đơn hàng sang bàn mới
  const { error } = await supabase.from('orders').update({ table_name: toTableName }).eq('id', sourceOrder.id);
  if (error) throw error;

  // Cập nhật trạng thái 2 bàn
  await supabase.from('tables').update({ status: 'empty' } as any).eq('name', fromTableName);
  await supabase.from('tables').update({ status: 'occupied' } as any).eq('name', toTableName);

  return true;
};