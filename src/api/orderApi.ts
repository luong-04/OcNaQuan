import { supabase } from '../services/supabase';

export interface OrderItemInput {
  menu_item_id_input: number;
  quantity_input: number;
}

// 1. Tạo đơn hàng & Cập nhật bàn -> Có khách
export const createOrder = async (tableName: string) => {
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

  // Update trạng thái bàn
  await supabase.from('tables').update({ status: 'occupied' } as any).eq('name', tableName);

  return data;
};

// 2. Lấy đơn hàng (Kèm items)
export const fetchOpenOrderForTable = async (tableName: string) => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      table_name,
      status,
      total_amount,
      order_items (
        id,
        menu_item_id,
        quantity
      )
    `)
    .eq('table_name', tableName)
    .eq('status', 'served')
    .order('created_at', { ascending: false }) // Lấy đơn mới nhất
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

// 3. Upsert món (Vẫn dùng RPC này vì nó tiện)
export const upsertOrderItems = async ({ order_id_input, items_input }: { order_id_input: number, items_input: OrderItemInput[] }) => {
  const { data, error } = await supabase.rpc('upsert_order_items', {
    order_id_input,
    items_input
  });
  if (error) throw error;
  return data;
};

// 4. Thanh toán
export const updateOrderStatus = async (orderId: number, status: 'paid' | 'cancelled') => {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  if (data) {
    await supabase.from('tables').update({ status: 'empty' } as any).eq('name', data.table_name);
  }
  return data;
};

// 5. Chuyển bàn
export const moveTable = async (fromTableName: string, toTableName: string) => {
  // Check bàn đích
  const { data: targetOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('table_name', toTableName)
    .eq('status', 'served')
    .maybeSingle();

  if (targetOrder) throw new Error(`Bàn ${toTableName} đang có khách!`);

  // Lấy đơn bàn cũ
  const { data: sourceOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('table_name', fromTableName)
    .eq('status', 'served')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sourceOrder) throw new Error(`Bàn ${fromTableName} không có đơn.`);

  // Update
  const { error } = await supabase.from('orders').update({ table_name: toTableName }).eq('id', sourceOrder.id);
  if (error) throw error;

  await supabase.from('tables').update({ status: 'empty' } as any).eq('name', fromTableName);
  await supabase.from('tables').update({ status: 'occupied' } as any).eq('name', toTableName);

  return true;
};