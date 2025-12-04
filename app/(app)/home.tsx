// File: app/(app)/home.tsx
import { Stack, router } from 'expo-router';
import { Armchair, LogOut } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image as RNImage, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { supabase } from '../../src/services/supabase';

// Định nghĩa kiểu dữ liệu Bàn
type Table = {
  id: number;
  name: string;
  status: 'empty' | 'occupied'; 
};

export default function HomeScreen() {
  const { role } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  // Hàm lấy danh sách bàn từ Supabase
  const fetchTables = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('id', { ascending: true });

      if (error || !data || data.length === 0) {
        // Dữ liệu mẫu
        setTables([
          { id: 1, name: 'Bàn 1', status: 'empty' },
          { id: 2, name: 'Bàn 2', status: 'occupied' },
          { id: 3, name: 'Bàn 3', status: 'empty' },
          { id: 4, name: 'Bàn 4', status: 'empty' },
          { id: 5, name: 'Bàn 5', status: 'occupied' },
          { id: 6, name: 'Bàn 6', status: 'empty' },
        ]);
      } else {
        // --- SỬA Ở ĐÂY ---
        const mappedTables: Table[] = data.map((item: any) => ({
          id: item.id,
          name: item.name,
          // Map status, mặc định là empty nếu DB chưa có
          status: item.status === 'occupied' ? 'occupied' : 'empty', 
        }));
        
        // THÊM DÒNG NÀY ĐỂ CẬP NHẬT GIAO DIỆN
        setTables(mappedTables); 
        // ------------------
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleLogout = async () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất không?', [
      { text: 'Hủy', style: 'cancel' },
      { 
        text: 'Đồng ý', 
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        }
      }
    ]);
  };

  const handlePressTable = (table: Table) => {
    router.push({
      pathname: '/(app)/order',
      params: { tableId: table.id, tableName: table.name }
    });
  };

  const renderItem = ({ item }: { item: Table }) => {
    const isOccupied = item.status === 'occupied';
    return (
      <TouchableOpacity 
        style={[styles.card, isOccupied ? styles.cardOccupied : styles.cardEmpty]}
        onPress={() => handlePressTable(item)}
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
              {/* SỬA 2: Dùng thẻ RNImage thay vì Image */}
              <RNImage 
                source={require('../../assets/logo.png')} 
                style={{ width: 38, height: 38, marginRight: 10, borderRadius: 10 }} 
                resizeMode="contain" 
              />
              <Text style={{ fontFamily: 'SVN-Bold', fontSize: 20, color: '#FF6B35' }}>
                ỐC NA
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
  cardEmpty: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardOccupied: {
    backgroundColor: '#FF6B35', 
  },
  cardText: {
    marginTop: 8,
    fontSize: 18,
    fontFamily: 'SVN-Bold',
    color: '#333',
  },
  statusText: {
    marginTop: 4,
    fontSize: 14,
    color: '#888',
  },
  textOccupied: {
    color: '#fff',
  }
});