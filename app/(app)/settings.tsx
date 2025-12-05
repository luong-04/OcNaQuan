import { Picker } from '@react-native-picker/picker';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from '../../src/auth/AuthContext';
import { supabase } from '../../src/services/supabase';
import { SettingsState, useSettingsStore } from '../../src/stores/settingsStore';

const BANK_LIST = [
  { label: 'MB Bank (Quân Đội)', value: 'MB' },
  { label: 'Vietcombank', value: 'VCB' },
  { label: 'VietinBank', value: 'ICB' },
  { label: 'BIDV', value: 'BIDV' },
  { label: 'Agribank', value: 'VBA' },
  { label: 'Techcombank', value: 'TCB' },
  { label: 'VPBank', value: 'VPB' },
  { label: 'ACB', value: 'ACB' },
  { label: 'Sacombank', value: 'STB' },
  { label: 'TPBank', value: 'TPB' },
];

type CollapsibleSectionProps = { title: string; children: React.ReactNode; startOpen?: boolean };

const CollapsibleSection = ({ title, children, startOpen = false }: CollapsibleSectionProps) => {
  const [isOpen, setIsOpen] = useState(startOpen);
  return (
    <View style={styles.section}>
      <Pressable style={styles.collapsibleHeader} onPress={() => setIsOpen(!isOpen)}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {isOpen ? <ChevronDown color="#555" /> : <ChevronRight color="#555" />}
      </Pressable>
      {isOpen && <View style={styles.collapsibleContent}>{children}</View>}
    </View>
  );
};

export default function SettingsScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const { role } = useAuth(); 

  const {
    shopName, address, phone, thankYouMessage, bankId, accountNo,
    printer1, printer2, kitchenPrinterId, paymentPrinterId,
    isVatEnabled, vatPercent,
    setSettings,
  } = useSettingsStore(useShallow((state) => state));

  const handleLogout = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setIsLoading(false);
  };

  const updateSetting = (key: keyof SettingsState, value: any) => {
    setSettings({ [key as string]: value } as Partial<SettingsState>);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.header}>Cài Đặt</Text>

      {role === 'admin' && (
        <>
          <CollapsibleSection title="Thông tin quán & Hóa đơn" startOpen={true}>
            <Text style={styles.label}>Tên cửa hàng</Text>
            <TextInput style={styles.input} value={shopName} onChangeText={(val) => updateSetting('shopName', val)} />
            <Text style={styles.label}>Địa chỉ</Text>
            <TextInput style={styles.input} value={address} onChangeText={(val) => updateSetting('address', val)} />
            <Text style={styles.label}>Số điện thoại</Text>
            <TextInput style={styles.input} value={phone} onChangeText={(val) => updateSetting('phone', val)} keyboardType="phone-pad" />
            <Text style={styles.label}>Lời cảm ơn</Text>
            <TextInput style={styles.input} value={thankYouMessage} onChangeText={(val) => updateSetting('thankYouMessage', val)} />
          </CollapsibleSection>

          <CollapsibleSection title="Cài đặt Máy in">
            <Text style={styles.label}>IP Máy in 1 (Chính)</Text>
            <TextInput style={styles.input} value={printer1} onChangeText={(val) => updateSetting('printer1', val)} placeholder="VD: 192.168.1.200" keyboardType="numeric" />
            <Text style={styles.label}>IP Máy in 2 (Phụ)</Text>
            <TextInput style={styles.input} value={printer2} onChangeText={(val) => updateSetting('printer2', val)} placeholder="VD: 192.168.1.201" keyboardType="numeric" />
            
            <Text style={styles.label}>Máy in BẾP dùng:</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={kitchenPrinterId} onValueChange={(val) => updateSetting('kitchenPrinterId', val)}>
                <Picker.Item label="Không in" value={null} />
                <Picker.Item label="Máy in 1" value="printer1" />
                <Picker.Item label="Máy in 2" value="printer2" />
              </Picker>
            </View>

            <Text style={styles.label}>Máy in HÓA ĐƠN dùng:</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={paymentPrinterId} onValueChange={(val) => updateSetting('paymentPrinterId', val)}>
                <Picker.Item label="Không in" value={null} />
                <Picker.Item label="Máy in 1" value="printer1" />
                <Picker.Item label="Máy in 2" value="printer2" />
              </Picker>
            </View>
          </CollapsibleSection>

          <CollapsibleSection title="Thanh toán QR">
            <Text style={styles.label}>Ngân hàng</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={bankId} onValueChange={(val) => updateSetting('bankId', val)}>
                {BANK_LIST.map(b => <Picker.Item key={b.value} label={b.label} value={b.value} />)}
              </Picker>
            </View>
            <Text style={styles.label}>Số tài khoản</Text>
            <TextInput style={styles.input} value={accountNo} onChangeText={(val) => updateSetting('accountNo', val)} keyboardType="numeric" placeholder="Nhập số tài khoản..." />
          </CollapsibleSection>

          <CollapsibleSection title="Cài đặt VAT">
            <View style={styles.switchRow}>
              <Text style={styles.label}>Bật VAT</Text>
              <Switch value={isVatEnabled} onValueChange={(val) => updateSetting('isVatEnabled', val)} />
            </View>
            {isVatEnabled && (
              <>
                <Text style={styles.label}>Phần trăm VAT (%)</Text>
                <TextInput style={styles.input} value={String(vatPercent)} onChangeText={(val) => updateSetting('vatPercent', Number(val) || 0)} keyboardType="numeric" />
              </>
            )}
          </CollapsibleSection>
        </>
      )}

      <View style={styles.logoutSection}>
        <Button title={isLoading ? 'Đang đăng xuất...' : 'Đăng Xuất'} onPress={handleLogout} color="#e74c3c" disabled={isLoading} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50, paddingHorizontal: 20, backgroundColor: '#f9f9f9' },
  header: { fontSize: 28, fontWeight: 'bold', color: '#FF6B35', textAlign: 'center', marginBottom: 20 },
  section: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 20, elevation: 2, overflow: 'hidden' },
  collapsibleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  collapsibleContent: { padding: 16, paddingTop: 0 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#333' },
  label: { fontSize: 16, color: '#555', marginBottom: 8, marginTop: 8 },
  input: { backgroundColor: '#f0f0f0', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 4 },
  pickerContainer: { backgroundColor: '#f0f0f0', borderRadius: 8, marginBottom: 4 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  logoutSection: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, elevation: 2 },
});