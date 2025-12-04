// File: app/(app)/home.tsx
import { Stack, router, useFocusEffect } from 'expo-router'; // THÊM useFocusEffect
import { Armchair, ArrowRightLeft, LogOut } from 'lucide-react-native';
import React, { useCallback, useState } from 'react'; // THÊM useCallback
import {
  ActivityIndicator, Alert, FlatList,
  Modal,
  Image as RNImage,
  StyleSheet, Text,
  TouchableOpacity, View
} from 'react-native';
import { moveTable } from '../../src/api/orderApi';
import { useAuth } from '../../src/auth/AuthContext';
import { supabase } from '../../src/services/supabase';

type Table = {
  id: number;
  name: string;
  status: 'empty' | 'occupied'; 
};

export default function HomeScreen() {
  const { role } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  // State cho chức năng Chuyển bàn
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [selectedSourceTable, setSelectedSourceTable] = useState<Table | null>(null);

  const fetchTables = async () => {
    try {
      // setLoading(true); // Tắt loading để tránh nháy màn hình khi focus lại
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('id', { ascending: true });

      if (error || !data || data.length === 0) {
        setTables([
          { id: 1, name: 'Bàn 1', status: 'empty' },
          { id: 2, name: 'Bàn 2', status: 'occupied' },
          { id: 3, name: 'Bàn 3', status: 'empty' },
          { id: 4, name: 'Bàn 4', status: 'empty' },
          { id: 5, name: 'Bàn 5', status: 'occupied' },
          { id: 6, name: 'Bàn 6', status: 'empty' },
        ]);
      } else {
        const mappedTables: Table[] = data.map((item: any) => ({
          id: item.id,
          name: item.name,
          // Map status nếu DB chưa có cột này
          status: item.status === 'occupied' ? 'occupied' : 'empty', 
        }));
        setTables(mappedTables); 
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  // SỬA: Dùng useFocusEffect thay vì router.addListener
  useFocusEffect(
    useCallback(() => {
      fetchTables();
    }, [])
  );

  const handleLogout = async () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất không?', [
      { text: 'Hủy', style: 'cancel' },
      { 
        text: 'Đồng ý', 
        style: 'destructive',
        onPress: async () => await supabase.auth.signOut()
      }
    ]);
  };

  const handlePressTable = (table: Table) => {
    router.push({
      pathname: '/(app)/order',
      params: { tableId: table.id, tableName: table.name }
    });
  };

  const handleLongPressTable = (table: Table) => {
    if (table.status === 'empty') return;
    setSelectedSourceTable(table);
    setMoveModalVisible(true);
  };

  const confirmMoveTable = async (targetTable: Table) => {
    if (!selectedSourceTable) return;
    
    try {
      setLoading(true);
      await moveTable(selectedSourceTable.name, targetTable.name);
      Alert.alert('Thành công', `Đã chuyển từ ${selectedSourceTable.name} sang ${targetTable.name}`);
      setMoveModalVisible(false);
      fetchTables(); 
    } catch (error: any) {
      Alert.alert('Lỗi', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Table }) => {
    const isOccupied = item.status === 'occupied';
    return (
      <TouchableOpacity 
        style={[styles.card, isOccupied ? styles.cardOccupied : styles.cardEmpty]}
        onPress={() => handlePressTable(item)}
        onLongPress={() => handleLongPressTable(item)} 
        delayLongPress={500} 
      >
        <Armchair size={32} color={isOccupied ? '#fff' : '#FF6B35'} />
        <Text style={[styles.cardText, isOccupied && styles.textOccupied]}>
          {item.name}
        </Text>
        <Text style={[styles.statusText, isOccupied && styles.textOccupied]}>
          {isOccupied ? 'Có khách' : 'Trống'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: '', 
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <RNImage 
                source={require('../../assets/logo.png')} 
                style={{ width: 38, height: 38, marginRight: 10, borderRadius: 10 }} 
                resizeMode="contain" 
              />
              <Text style={{ fontFamily: 'SVN-Bold', fontSize: 20, color: '#FF6B35' }}>
                Sơ đồ bàn
              </Text>
            </View>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout} style={{ marginRight: 10 }}>
              <LogOut color="#333" size={24} />
            </TouchableOpacity>
          ),
        }} 
      />

      {loading ? (
        <ActivityIndicator size="large" color="#FF6B35" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={tables}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2} 
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
        />
      )}

      <Modal
        visible={moveModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMoveModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>
              Chuyển {selectedSourceTable?.name} đến...
            </Text>
            <Text style={styles.modalSubtitle}>Chọn một bàn trống:</Text>
            
            <View style={styles.targetList}>
              {tables.filter(t => t.status === 'empty').map(table => (
                <TouchableOpacity 
                  key={table.id} 
                  style={styles.targetBtn}
                  onPress={() => confirmMoveTable(table)}
                >
                  <ArrowRightLeft size={20} color="#fff" style={{marginRight: 8}} />
                  <Text style={styles.targetBtnText}>{table.name}</Text>
                </TouchableOpacity>
              ))}
              
              {tables.filter(t => t.status === 'empty').length === 0 && (
                <Text style={{color: '#888', fontStyle: 'italic'}}>Không có bàn trống nào!</Text>
              )}
            </View>

            <TouchableOpacity 
              style={styles.closeBtn}
              onPress={() => setMoveModalVisible(false)}
            >
              <Text style={styles.closeBtnText}>Hủy bỏ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  listContent: { padding: 16 },
  row: { justifyContent: 'space-between', marginBottom: 16 },
  card: {
    width: '48%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardEmpty: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
  cardOccupied: { backgroundColor: '#FF6B35' },
  cardText: { marginTop: 8, fontSize: 18, fontFamily: 'SVN-Bold', color: '#333' },
  statusText: { marginTop: 4, fontSize: 14, color: '#888' },
  textOccupied: { color: '#fff' },
  
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalView: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxHeight: '80%', alignItems: 'center', elevation: 5 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#FF6B35', marginBottom: 8 },
  modalSubtitle: { fontSize: 16, color: '#555', marginBottom: 20 },
  targetList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20, gap: 10 },
  targetBtn: { flexDirection: 'row', backgroundColor: '#27ae60', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', minWidth: '40%', justifyContent: 'center', marginBottom: 10 },
  targetBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  closeBtn: { padding: 12 },
  closeBtnText: { color: '#888', fontSize: 16, fontWeight: '600' }
});