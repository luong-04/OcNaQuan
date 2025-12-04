// src/stores/settingsStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type PrinterId = 'printer1' | 'printer2' | null;

// Định nghĩa kiểu dữ liệu
export interface SettingsState {
  shopName: string;
  address: string;
  phone: string;
  thankYouMessage: string;
  qrCodeData: string;
  printer1: string;
  printer2: string;
  kitchenPrinterId: PrinterId;
  paymentPrinterId: PrinterId;
  isVatEnabled: boolean;
  vatPercent: number;
  // Hàm cập nhật
  setSettings: (settings: Partial<SettingsState>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Giá trị mặc định
      shopName: 'Ốc Na Quán',
      address: '123 Đường ABC, Quận 1, TP. HCM',
      phone: '0901 234 567',
      thankYouMessage: 'Cảm ơn quý khách. Hẹn gặp lại!',
      qrCodeData: '',
      printer1: '',
      printer2: '',
      kitchenPrinterId: null,
      paymentPrinterId: null,
      isVatEnabled: true,
      vatPercent: 10,
      // Hàm set
      setSettings: (settings) =>
        set((state) => ({
          ...state,
          ...settings,
        })),
    }),
    {
      name: 'ocna-settings-storage', // Tên key trong AsyncStorage
      storage: createJSONStorage(() => AsyncStorage), // Dùng AsyncStorage
    }
  )
);