// File: app/(app)/settings.tsx
// (SỬA: Đã thêm các import bị thiếu)

import { Picker } from '@react-native-picker/picker';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from '../../src/auth/AuthContext';
import { supabase } from '../../src/services/supabase';

// 1. ĐÃ THÊM IMPORT BỊ THIẾU
import { SettingsState, useSettingsStore } from '../../src/stores/settingsStore';


// --- Component mới cho mục ĐÓNG/MỞ ---
type CollapsibleSectionProps = {
  title: string;
  children: React.ReactNode;
  startOpen?: boolean;
};

const CollapsibleSection = ({ title, children, startOpen = false }: CollapsibleSectionProps) => {
  const [isOpen, setIsOpen] = useState(startOpen);
  return (
    <View style={styles.section}>
      <Pressable style={styles.collapsibleHeader} onPress={() => setIsOpen(!isOpen)}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {isOpen ? <ChevronDown color="#555" /> : <ChevronRight color="#555" />}
      </Pressable>
      
      {isOpen && (
        <View style={styles.collapsibleContent}>
          {children}
        </View>
      )}
    </View>
  );
};
// --- Kết thúc component mới ---


export default function SettingsScreen() {
  const [isLoading, setIsLoading] = useState(false);

  // 2. Dòng này bây giờ sẽ chạy đúng
  const {
    shopName, address, phone,
    printer1, printer2, kitchenPrinterId, paymentPrinterId,
    thankYouMessage, qrCodeData,
    isVatEnabled, vatPercent,
    setSettings,
  } = useSettingsStore(useShallow((state) => state));

  // useAuth() đã được import nhưng chưa dùng,
  // không sao, nó fix lỗi crash
  const { session } = useAuth(); 

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut(); 
      // KHÔNG ĐƯỢC CÓ DÒNG NÀY: router.replace('/'); 
      // KHÔNG ĐƯỢC CÓ DÒNG NÀY: router.replace('/(auth)/login');
      // Hook useAuthProtection sẽ tự động phát hiện session = null và đá về Login
    } catch (error) {
      console.log(error);
    }
  };

  // 3. Dòng này bây giờ sẽ chạy đúng
  const updateSetting = (key: keyof SettingsState, value: any) => {
    setSettings({ [key as string]: value } as Partial<SettingsState>);
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }} // Chống che nút
    >
      <Text style={styles.header}>Cài Đặt</Text>

      <CollapsibleSection title="Thông tin quán & Hóa đơn" startOpen={true}>
        <Text style={styles.label}>Tên cửa hàng</Text>
        <TextInput
          style={styles.input}
          value={shopName} // OK: string
          onChangeText={(val) => updateSetting('shopName', val)}
        />
        <Text style={styles.label}>Địa chỉ</Text>
        <TextInput
          style={styles.input}
          value={address} // OK: string
          onChangeText={(val) => updateSetting('address', val)}
        />
        <Text style={styles.label}>Số điện thoại</Text>
        <TextInput
          style={styles.input}
          value={phone} // OK: string
          onChangeText={(val) => updateSetting('phone', val)}
          keyboardType="phone-pad"
        />
        <Text style={styles.label}>Lời cảm ơn (trên bill)</Text>
        <TextInput
          style={styles.input}
          value={thankYouMessage} // OK: string
          onChangeText={(val) => updateSetting('thankYouMessage', val)}
        />
        <Text style={styles.label}>Nội dung QR Code (Link trên bill)</Text>
        <TextInput
          style={styles.input}
          value={qrCodeData} // OK: string
          onChangeText={(val) => updateSetting('qrCodeData', val)}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Cài đặt máy in">
        <Text style={styles.label}>Máy in 1 (IP:PORT)</Text>
        <TextInput
          style={styles.input}
          value={printer1}
          onChangeText={(val) => updateSetting('printer1', val)}
          autoCapitalize="none"
          placeholder="192.168.1.100:9100"
        />
        <Text style={styles.label}>Máy in 2 (IP:PORT)</Text>
        <TextInput
          style={styles.input}
          value={printer2}
          onChangeText={(val) => updateSetting('printer2', val)}
          autoCapitalize="none"
          placeholder="192.168.1.101:9100"
        />
        <Text style={styles.label}>Chọn máy in Bếp</Text>
        <Picker
          selectedValue={kitchenPrinterId}
          onValueChange={(itemValue) => updateSetting('kitchenPrinterId', itemValue)}
        >
          <Picker.Item label="Chưa chọn" value={null} />
          <Picker.Item label="Dùng máy in 1" value="printer1" />
          <Picker.Item label="Dùng máy in 2" value="printer2" />
        </Picker>
        <Text style={styles.label}>Chọn máy in Thanh toán</Text>
        <Picker
          selectedValue={paymentPrinterId}
          onValueChange={(itemValue) => updateSetting('paymentPrinterId', itemValue)}
        >
          <Picker.Item label="Chưa chọn" value={null} />
          <Picker.Item label="Dùng máy in 1" value="printer1" />
          <Picker.Item label="Dùng máy in 2" value="printer2" />
        </Picker>
      </CollapsibleSection>

      <CollapsibleSection title="Cài đặt VAT">
        <View style={styles.switchRow}>
          <Text style={styles.label}>Bật VAT</Text>
          <Switch
            value={isVatEnabled}
            onValueChange={(val) => updateSetting('isVatEnabled', val)}
          />
        </View>
        {isVatEnabled && (
          <>
            <Text style={styles.label}>Phần trăm VAT (%)</Text>
            <TextInput
              style={styles.input}
              value={String(vatPercent)} // SỬA: TextInput value phải là string
              onChangeText={(val) => updateSetting('vatPercent', Number(val) || 0)} 
              keyboardType="numeric"
            />
          </>
        )}
      </CollapsibleSection>

      <View style={styles.logoutSection}>
        <Button
          title={isLoading ? 'Đang đăng xuất...' : 'Đăng Xuất'}
          onPress={handleLogout}
          color="#e74c3c"
          disabled={isLoading}
        />
      </View>
    </ScrollView>
  );
}

// (Styles của bạn đã rất tốt, giữ nguyên)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 20,
    backgroundColor: '#f9f9f9',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF6B35',
    textAlign: 'center',
    marginBottom: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  collapsibleContent: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  label: {
    fontSize: 16,
    color: '#555',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  logoutSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
  },
});