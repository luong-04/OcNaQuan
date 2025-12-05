import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import { Calendar, FileText } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { fetchOrdersHistory } from '../../src/api/orderApi';
import { Calculations, sharePaymentBill } from '../../src/services/printService';

export default function HistoryScreen() {
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const dateStr = date.toISOString().split('T')[0];

  const { data: orders, isLoading } = useQuery({
    queryKey: ['ordersHistory', dateStr],
    queryFn: () => fetchOrdersHistory(dateStr),
  });

  const onChangeDate = (event: any, selectedDate?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const f = (num: number) => num.toLocaleString('vi-VN');

  // Xử lý khi bấm vào đơn hàng -> Tạo PDF xem lại
  const handleViewBill = (order: any) => {
    if (!order.order_items || order.order_items.length === 0) return;

    // 1. Tái tạo lại danh sách món (Map & Menu Array)
    const orderItemsMap = new Map<number, number>();
    const menuArray: any[] = [];
    let subtotal = 0;

    order.order_items.forEach((item: any) => {
      if (item.menu_items) {
        const itemId = item.menu_items.id;
        const qty = item.quantity;
        const price = item.menu_items.price;

        orderItemsMap.set(itemId, qty);
        menuArray.push(item.menu_items); // Đẩy thông tin món vào mảng giả lập
        subtotal += price * qty;
      }
    });

    // 2. Tính toán lại (Do DB chưa lưu discount/vat riêng, ta hiển thị theo total_amount đã lưu)
    // Lưu ý: Đây là tính toán ngược để hiển thị
    const finalTotal = order.total_amount || subtotal;
    
    const calculations: Calculations = {
      subtotal: subtotal,
      discountAmount: 0, // Không lưu lịch sử nên để 0
      vatAmount: 0,      // Không lưu lịch sử nên để 0
      finalTotal: finalTotal 
    };

    // 3. Gọi hàm tạo PDF (Tái sử dụng logic in bill)
    sharePaymentBill(order.table_name, orderItemsMap, menuArray, calculations);
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleViewBill(item)}>
      <View style={styles.cardLeft}>
        <View style={styles.iconBox}>
          <FileText size={24} color="#fff" />
        </View>
        <View>
          <Text style={styles.tableName}>{item.table_name}</Text>
          <Text style={styles.timeText}>
            {new Date(item.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
          </Text>
        </View>
      </View>
      <View>
        <Text style={styles.amount}>{f(item.total_amount)}đ</Text>
        <Text style={styles.viewBtnText}>Xem Bill</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lịch Sử Hóa Đơn</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
          <Calendar size={20} color="#fff" />
          <Text style={styles.dateText}>{date.toLocaleDateString('vi-VN')}</Text>
        </TouchableOpacity>
      </View>

      {showPicker && (
        <DateTimePicker value={date} mode="date" display="default" onChange={onChangeDate} />
      )}

      {isLoading ? (
        <ActivityIndicator size="large" color="#FF6B35" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={orders}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.emptyText}>Không có hóa đơn nào trong ngày này</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 50 },
  header: { paddingHorizontal: 20, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FF6B35', fontFamily: 'SVN-Bold' },
  dateBtn: { flexDirection: 'row', backgroundColor: '#FF6B35', padding: 10, borderRadius: 8, alignItems: 'center' },
  dateText: { color: '#fff', fontWeight: 'bold', marginLeft: 8 },
  
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, elevation: 2 },
  cardLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#3498db', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  tableName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  timeText: { fontSize: 14, color: '#888' },
  amount: { fontSize: 18, fontWeight: 'bold', color: '#27ae60', textAlign: 'right' },
  viewBtnText: { fontSize: 12, color: '#3498db', textAlign: 'right', marginTop: 4 },
  
  emptyText: { textAlign: 'center', color: '#999', marginTop: 30, fontSize: 16 }
});