// src/api/reportApi.ts
import { supabase } from '../services/supabase';

export interface TopItem {
  name: string;
  total_qty: number;
  total_revenue: number;
}
export interface ReportData {
  total_revenue: number;
  top_items: TopItem[];
}

export const fetchReport = async (startDate: Date, endDate: Date): Promise<ReportData> => {
  // Đặt giờ/phút/giây để đảm bảo lấy trọn ngày
  startDate.setHours(0, 0, 0, 0); // Bắt đầu ngày
  endDate.setHours(23, 59, 59, 999); // Kết thúc ngày

  const { data, error } = await supabase.rpc('get_sales_report', {
    // Gửi đi dưới dạng chuỗi ISO (UTC)
    start_date_input: startDate.toISOString(),
    end_date_input: endDate.toISOString(),
  });

  if (error) throw new Error(error.message);
  return data as unknown as ReportData;
};