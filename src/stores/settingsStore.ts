import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type PrinterId = 'printer1' | 'printer2' | null;

export interface SettingsState {
  shopName: string;
  address: string;
  phone: string;
  thankYouMessage: string;
  
  bankId: string;
  accountNo: string;

  // === Cấu hình máy in IP ===
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
      bankId: 'MB', 
      accountNo: '',

      printer1: '192.168.1.200', // Mặc định
      printer2: '',
      kitchenPrinterId: 'printer1',
      paymentPrinterId: 'printer1',

      isVatEnabled: true,
      vatPercent: 10,
      
      setSettings: (settings) =>
        set((state) => ({ ...state, ...settings })),
    }),
    {
      name: 'ocna-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);