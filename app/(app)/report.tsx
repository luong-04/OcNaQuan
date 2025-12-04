// app/(app)/report.tsx
import RNDateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchReport } from '../../src/api/reportApi';

type ShowPicker = 'start' | 'end' | null;

export default function ReportScreen() {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState<ShowPicker>(null);

  const { data: report, isLoading } = useQuery({
    // Chạy lại query khi 'startDate' hoặc 'endDate' thay đổi
    queryKey: ['report', startDate, endDate], 
    queryFn: () => fetchReport(startDate, endDate),
  });

  const onChangeDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPicker(null); // Ẩn picker
    if (event.type === 'set' && selectedDate) {
      if (showPicker === 'start') {
        setStartDate(selectedDate);
      } else if (showPicker === 'end') {
        setEndDate(selectedDate);
      }
    }
  };

  // Helper format ngày
  const formatDate = (date: Date) => date.toLocaleDateString('vi-VN');

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Báo cáo doanh thu</Text>

      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowPicker('start')}>
          <Text style={styles.pickerLabel}>Từ ngày</Text>
          <Text style={styles.dateText}>{formatDate(startDate)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowPicker('end')}>
          <Text style={styles.pickerLabel}>Đến ngày</Text>
          <Text style={styles.dateText}>{formatDate(endDate)}</Text>
        </TouchableOpacity>
      </View>

      {/* Hiển thị Lịch (Date Picker) */}
      {showPicker && (
        <RNDateTimePicker
          value={showPicker === 'start' ? startDate : endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onChangeDate}
        />
      )}

      {isLoading ? (
        <ActivityIndicator size="large" color="#FF6B35" style={{ marginVertical: 40 }} />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>Tổng doanh thu</Text>
            <Text style={styles.amount}>
              {(report?.total_revenue || 0).toLocaleString()}đ
            </Text>
          </View>

          <Text style={styles.subtitle}>Top 10 món bán chạy</Text>
          {!report?.top_items || report.top_items.length === 0 ? (
            <Text style={styles.noData}>Chưa có dữ liệu</Text>
          ) : (
            report.top_items.map((item, i) => (
              <View key={i} style={styles.topItem}>
                <Text style={styles.rank}>#{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.revenue}>
                    Doanh thu: {item.total_revenue.toLocaleString()}đ (SL: {item.total_qty})
                  </Text>
                </View>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9', padding: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#FF6B35', textAlign: 'center', marginBottom: 20, fontFamily: 'SVN-Bold' },
  dateRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  datePickerBtn: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    elevation: 3,
    alignItems: 'center',
    width: '45%',
  },
  pickerLabel: { fontSize: 14, color: '#666', fontFamily: 'SVN-Bold' },
  dateText: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 4 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 20, elevation: 3, alignItems: 'center' },
  label: { fontSize: 16, color: '#666', fontFamily: 'SVN-Bold' },
  amount: { fontSize: 28, fontWeight: 'bold', color: '#FF6B35', marginTop: 8, fontFamily: 'SVN-Bold' },
  subtitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 12, fontFamily: 'SVN-Bold' },
  noData: { textAlign: 'center', color: '#999', fontStyle: 'italic', marginVertical: 20 },
  topItem: { flexDirection: 'row', backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8, elevation: 2 },
  rank: { fontSize: 18, fontWeight: 'bold', color: '#FF6B35', marginRight: 12, width: 40, fontFamily: 'SVN-Bold' },
  itemName: { fontSize: 16, fontWeight: '600', color: '#333', fontFamily: 'SVN-Bold' },
  revenue: { fontSize: 14, fontWeight: 'bold', color: '#27ae60', fontFamily: 'SVN-Bold' },
});