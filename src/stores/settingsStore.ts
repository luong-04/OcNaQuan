// src/stores/settingsStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type PrinterId = 'printer1' | 'printer2' | null;

export interface SettingsState {
  shopName: string;
  address: string;
  phone: string;
  thankYouMessage: string;
  
  // SỬA: Thay qrCodeData bằng 2 trường này
  bankId: string;    // Ví dụ: MB, VCB
  accountNo: string; // Ví dụ: 0901234567

  printer1: string;
  printer2: string;
  kitchenPrinterId: PrinterId;
  paymentPrinterId: PrinterId;
  isVatEnabled: boolean;
  vatPercent: number;
  
  setSettings: (settings: Partial<SettingsState>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      shopName: 'Ốc Na Quán',
      address: '123 Đường ABC, Quận 1, TP. HCM',
      phone: '0901 234 567',
      thankYouMessage: 'Cảm ơn quý khách. Hẹn gặp lại!',
      
      // Giá trị mặc định
      bankId: 'MB', 
      accountNo: '',

      printer1: '',
      printer2: '',
      kitchenPrinterId: null,
      paymentPrinterId: null,
      isVatEnabled: true,
      vatPercent: 10,
      
      setSettings: (settings) =>
        set((state) => ({
          ...state,
          ...settings,
        })),
    }),
    {
      name: 'ocna-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);