// File: src/stores/settingsStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { supabase } from '../services/supabase';

export type PrinterId = 'printer1' | 'printer2' | null;

export interface SettingsState {
  // Các cài đặt riêng của máy (Local)
  shopName: string;
  address: string;
  phone: string;
  thankYouMessage: string;
  bankId: string;
  accountNo: string;
  
  // --- [MỚI] THÊM BIẾN NÀY ĐỂ FIX LỖI ---
  rawVietQR: string; 

  isVatEnabled: boolean;
  vatPercent: number;

  // Các cài đặt đồng bộ qua Server (IP Máy in)
  printer1: string; 
  printer2: string;
  kitchenPrinterId: PrinterId;
  paymentPrinterId: PrinterId;
  
  // Hàm cập nhật local (nhanh)
  setSettings: (settings: Partial<SettingsState>) => void;

  // Hàm cập nhật lên Server (cho Admin)
  updateServerSettings: (settings: Partial<SettingsState>) => Promise<void>;
  
  // Hàm tải từ Server về (cho Nhân viên)
  syncWithServer: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      shopName: 'Ốc Na Quán',
      address: '123 Đường ABC, Quận 1, TP. HCM',
      phone: '0901 234 567',
      thankYouMessage: 'Cảm ơn quý khách. Hẹn gặp lại!',
      bankId: 'MB', 
      accountNo: '',

      // --- [MỚI] KHỞI TẠO GIÁ TRỊ RỖNG ---
      rawVietQR: '', 

      printer1: '192.168.1.200',
      printer2: '',
      kitchenPrinterId: 'printer1',
      paymentPrinterId: 'printer1',

      isVatEnabled: true,
      vatPercent: 10,
      
      // 1. Cập nhật Local
      setSettings: (settings) => set((state) => ({ ...state, ...settings })),

      // 2. Tải từ Server về (Đồng bộ)
      syncWithServer: async () => {
        try {
          // Lấy dòng cài đặt có id=1
          const { data, error } = await supabase
            .from('restaurant_settings')
            .select('*')
            .eq('id', 1)
            .single();
            
          if (data) {
            set({
              printer1: data.printer1 || '',
              printer2: data.printer2 || '',
              kitchenPrinterId: data.kitchen_printer_id as PrinterId,
              paymentPrinterId: data.payment_printer_id as PrinterId,
              // Nếu bạn muốn đồng bộ rawVietQR từ server thì cần thêm cột trong DB và map ở đây
              // Hiện tại chỉ lưu local trên máy
            });
          }
        } catch (e) {
          console.log("Lỗi sync settings:", e);
        }
      },

      // 3. Lưu lên Server (Chỉ Admin dùng)
      updateServerSettings: async (newSettings) => {
        // Cập nhật local trước cho mượt
        set((state) => ({ ...state, ...newSettings }));
        
        try {
          // Gửi lên Supabase
          await supabase.from('restaurant_settings').upsert({
            id: 1, // Luôn lưu vào dòng ID=1
            printer1: newSettings.printer1 !== undefined ? newSettings.printer1 : get().printer1,
            printer2: newSettings.printer2 !== undefined ? newSettings.printer2 : get().printer2,
            kitchen_printer_id: newSettings.kitchenPrinterId !== undefined ? newSettings.kitchenPrinterId : get().kitchenPrinterId,
            payment_printer_id: newSettings.paymentPrinterId !== undefined ? newSettings.paymentPrinterId : get().paymentPrinterId,
          });
        } catch (e) {
          console.log("Lỗi lưu settings server:", e);
        }
      }
    }),
    {
      name: 'ocna-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);