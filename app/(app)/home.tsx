import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router'; // 1. Thêm 'useFocusEffect'
import { Plus } from 'lucide-react-native';
import React, { useCallback, useState } from 'react'; // 2. Thêm 'useCallback'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { addTable, deleteTable, fetchActiveTables, loadTables } from '../../src/api/homeApi';
import { useAuth } from '../../src/auth/AuthContext';

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [tableName, setTableName] = useState('');

  const { role } = useAuth();
  
  // Query lấy danh sách bàn (master list)
  const { data: allTables, isLoading: isLoadingAllTables } = useQuery({
    queryKey: ['tables'],
    queryFn: loadTables,
  });

  // Query lấy bàn đang MỞ (active)
  const { data: activeTables, isLoading: isLoadingActiveTables } = useQuery({
    queryKey: ['activeTables'],
    queryFn: fetchActiveTables,
  });

  // 4. FIX CẬP NHẬT BÀN:
  // Dùng 'useFocusEffect' để tự động 'refetch' (tải lại)
  // query 'activeTables' mỗi khi màn hình này được quay lại.
  useFocusEffect(
    useCallback(() => {
      // Báo cho react-query rằng dữ liệu 'activeTables' đã cũ
      // và cần được tải lại
      queryClient.invalidateQueries({ queryKey: ['activeTables'] });
      
      // Chúng ta cũng nên tải lại danh sách bàn chính,
      // phòng trường hợp admin vừa thêm/xóa bàn
      queryClient.invalidateQueries({ queryKey: ['tables'] });

    }, [queryClient])
  );

  // Đột biến (Mutation) để THÊM bàn
  const addTableMutation = useMutation({
    mutationFn: addTable,
    onSuccess: (newTableName) => {
      // Cập nhật cache 'tables'
      queryClient.setQueryData(['tables'], (oldTables: string[] | undefined) => 
        [...(oldTables || []), newTableName].sort((a, b) => (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0))
      );
      setModalVisible(false);
      setTableName('');
    },
    onError: (err: Error) => Alert.alert('Lỗi', err.message),
  });

  // Đột biến (Mutation) để XÓA bàn
  const deleteTableMutation = useMutation({
    mutationFn: deleteTable,
    onSuccess: (deletedTableName) => {
      // Cập nhật cache 'tables'
      queryClient.setQueryData(['tables'], (oldTables: string[] | undefined) => 
        (oldTables || []).filter(name => name !== deletedTableName)
      );
    },
    onError: (err: Error) => Alert.alert('Lỗi', err.message),
  });

  const handleAddTable = () => {
    if (tableName.trim()) {
      addTableMutation.mutate(tableName.trim());
    }
  };

  const handleDeleteTable = (name: string) => {
    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc muốn xóa "${name}"? Thao tác này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xóa', style: 'destructive', onPress: () => deleteTableMutation.mutate(name) },
      ]
    );
  };

  const renderTable = ({ item }: { item: string }) => {
    // 'activeTables' giờ sẽ luôn được cập nhật,
    // nên 'isActive' sẽ luôn đúng
    const isActive = activeTables?.includes(item);
    return (
      <TouchableOpacity
        style={[styles.tableBtn, isActive && styles.tableBtnActive]}
        onPress={() => router.push({ pathname: '/(app)/order', params: { tableName: item } })}
        onLongPress={() => role === 'admin' && handleDeleteTable(item)}
      >
        <Text style={[styles.tableText, isActive && styles.tableTextActive]}>
          {item}
        </Text>
      </TouchableOpacity>
    );
  };

  const isLoading = isLoadingAllTables || isLoadingActiveTables;

  return (
    <View style={styles.container}>
      {/* 5. FIX LOGO: Thay thế <Text> bằng <Image> */}
      {/* (Đảm bảo bạn đã copy file 'logo.png' [cite: luong-04/ocnaappv3/OcNaAppV3-3d1c74b77b8ce8bdbdbba313a1d631c1116ce271/assets/logo.png] vào thư mục 'assets') */}
      <Image
        source={require('../../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      
      {isLoading ? (
        <ActivityIndicator size="large" color="#FF6B35" />
      ) : (
        <FlatList
          data={allTables || []}
          renderItem={renderTable}
          keyExtractor={(item) => item}
          numColumns={3}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* (Phần FAB và Modal giữ nguyên) */}
      {role === 'admin' && (
        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
          <Plus size={28} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Thêm bàn mới</Text>
            <TextInput
              style={styles.input}
              placeholder="Tên bàn (Ví dụ: Bàn 10, VIP 1)"
              value={tableName}
              onChangeText={setTableName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.btnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnSave]}
                onPress={handleAddTable}
                disabled={addTableMutation.isPending}
              >
                {addTableMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnSaveText}>Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// 6. Sửa Styles: Thêm style 'logo'
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9', padding: 16, paddingTop: 50 },
  // Thêm style cho logo
  logo: {
    width: '80%',
    height: 100,
    alignSelf: 'center',
    marginBottom: 20,
  },
  listContainer: { paddingHorizontal: 8 },
  tableBtn: {
    flex: 1,
    margin: 8,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tableBtnActive: { backgroundColor: '#FF6B35' },
  tableText: { fontSize: 18, fontWeight: '600', color: '#333' },
  tableTextActive: { color: '#fff', fontWeight: 'bold' },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  btn: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
  btnCancel: { backgroundColor: '#f0f0f0' },
  btnCancelText: { color: '#333', fontWeight: '600' },
  btnSave: { backgroundColor: '#FF6B35' },
  btnSaveText: { color: '#fff', fontWeight: '600' },
});