import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Minus, Plus, Trash } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useShallow } from 'zustand/react/shallow';

// 1. Import API (V3)
import { fetchCategories, fetchMenuItems, MenuItemWithCategory } from '../../src/api/menuApi';
import {
  createOrder,
  fetchOpenOrderForTable,
  OrderItemInput,
  updateOrderStatus,
  upsertOrderItems
} from '../../src/api/orderApi';

// 2. Import hàm in PDF (MỚI) và Calculations
import { Calculations, printKitchenBill, printPaymentBill } from '../../src/services/printService';

// 3. Import Store Cài đặt (V3)
import { useSettingsStore } from '../../src/stores/settingsStore';

type ActiveTab = 'menu' | 'cart';

export default function OrderScreen() {
  const { tableName } = useLocalSearchParams<{ tableName: string }>();
  if (!tableName) {
    router.back();
    return null;
  }

  // === State ===
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>('menu');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [cartItems, setCartItems] = useState<Map<number, number>>(new Map());
  const [printedItems, setPrintedItems] = useState<Map<number, number>>(new Map());
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  
  // 4. State cho Giảm giá (V3)
  const [discountPercent, setDiscountPercent] = useState('0'); // Dùng string cho TextInput

  // 5. Lấy cài đặt VAT từ Store (V3)
  const { isVatEnabled, vatPercent } = useSettingsStore(
    useShallow((state) => ({
      isVatEnabled: state.isVatEnabled,
      vatPercent: state.vatPercent,
    }))
  );
  
  // === Data Fetching (V3) ===
  const { data: menuData, isLoading: isLoadingMenu } = useQuery({
    queryKey: ['menuItems'],
    queryFn: fetchMenuItems,
  });

  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const { data: orderData, isLoading: isLoadingOrder } = useQuery({
    queryKey: ['order', tableName],
    queryFn: () => fetchOpenOrderForTable(tableName),
    enabled: !!tableName,
  });

  // Đồng bộ giỏ hàng (Giữ nguyên)
  useEffect(() => {
    if (orderData) {
      const serverCart = new Map<number, number>();
      orderData.order_items.forEach(item => {
        if (item.menu_item_id) {
          serverCart.set(item.menu_item_id, item.quantity);
        }
      });
      setCartItems(serverCart);
      setPrintedItems(serverCart);
      setCurrentOrderId(orderData.id);
    } else {
      setCartItems(new Map());
      setPrintedItems(new Map());
      setCurrentOrderId(null);
    }
  }, [orderData]);

  // === Mutations (Giữ nguyên) ===
  const createOrderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (newOrder) => {
      setCurrentOrderId(newOrder.id);
      queryClient.invalidateQueries({ queryKey: ['order', tableName] });
      return newOrder.id;
    },
    onError: (err: Error) => Alert.alert('Lỗi', 'Không thể tạo đơn hàng mới: ' + err.message)
  });
  
  const upsertItemsMutation = useMutation({
    mutationFn: upsertOrderItems,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', tableName] });
    },
    onError: (err: Error) => Alert.alert('Lỗi', 'Không thể cập nhật món: ' + err.message)
  });
  
  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number, status: 'paid' | 'cancelled' }) => 
      updateOrderStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', tableName] });
      queryClient.invalidateQueries({ queryKey: ['activeTables'] });
      router.back();
    },
    onError: (err: Error) => Alert.alert('Lỗi', 'Không thể thanh toán: ' + err.message)
  });
  
  // === Logic tính toán (MỚI) ===
  const calculations = useMemo((): Calculations => {
    let subtotal = 0;
    cartItems.forEach((qty, id) => {
      const item = menuData?.find(m => m.id === id);
      subtotal += (item?.price || 0) * qty;
    });

    const discountNum = parseFloat(discountPercent) || 0;
    const discountAmount = subtotal * (discountNum / 100);
    const subtotalAfterDiscount = subtotal - discountAmount;
    const vatAmount = isVatEnabled ? subtotalAfterDiscount * (vatPercent / 100) : 0;
    const finalTotal = subtotalAfterDiscount + vatAmount;

    return { subtotal, discountAmount, vatAmount, finalTotal };
  }, [cartItems, menuData, isVatEnabled, vatPercent, discountPercent]);

  // === Handlers (Cập nhật) ===
  
  const updateQuantity = (id: number, delta: number) => {
    setCartItems(prev => {
      const current = prev.get(id) || 0;
      const newQty = Math.max(0, current + delta);
      const newMap = new Map(prev);
      if (newQty === 0) newMap.delete(id);
      else newMap.set(id, newQty);
      return newMap;
    });
  };

  const saveCartToServer = async () => {
    let orderId = currentOrderId;
    if (!orderId) {
      if (cartItems.size === 0) return;
      try {
        const newOrder = await createOrderMutation.mutateAsync(tableName);
        orderId = newOrder.id;
      } catch (e) { return; }
    }
    const items_input: OrderItemInput[] = Array.from(cartItems.entries()).map(([id, qty]) => ({
      menu_item_id_input: id,
      quantity_input: qty,
    }));
    upsertItemsMutation.mutate({ order_id_input: orderId, items_input: items_input });
  };
  
  // In Bếp (Sửa - dùng logic V1)
  const handlePrintKitchen = async () => {
    await saveCartToServer();
    
    const itemsToPrint = new Map<number, number>();
    cartItems.forEach((currentQty, id) => {
      const printedQty = printedItems.get(id) || 0;
      const diff = currentQty - printedQty;
      if (diff > 0) itemsToPrint.set(id, diff);
    });

    if (itemsToPrint.size === 0) {
      Alert.alert('Thông báo', 'Không có món mới để in bếp.');
      return;
    }
    // Gọi in PDF V1
    printKitchenBill(tableName, itemsToPrint, menuData || []);
    setPrintedItems(new Map(cartItems));
  };
  
  // Thanh toán (Sửa - dùng logic V1 + Gửi calculations)
  const handlePayment = () => {
    if (!currentOrderId || cartItems.size === 0) {
      Alert.alert('Lỗi', 'Không có đơn hàng để thanh toán');
      return;
    }
    
    // Gọi in PDF V1 (Đã nâng cấp)
    printPaymentBill(tableName, cartItems, menuData || [], calculations, () => {
      // Callback: Cập nhật status
      if (currentOrderId) {
        updateStatusMutation.mutate({ orderId: currentOrderId, status: 'paid' });
      }
    });
  };

  // === Lọc (Giữ nguyên) ===
  const filteredMenu = useMemo(() => {
    if (!menuData) return [];
    const lower = search.toLowerCase();
    return menuData.filter(item => {
      const matchesSearch = !search || item.name.toLowerCase().includes(lower);
      const matchesCategory = selectedCategory === null || item.category_id === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuData, search, selectedCategory]);
  
  // === Get items trong giỏ (Mới) ===
  const cartItemsList = useMemo(() => {
    if (!menuData) return [];
    return Array.from(cartItems.entries())
      .map(([id, quantity]) => {
        const item = menuData.find(m => m.id === id);
        return item ? { ...item, quantity } : null;
      })
      .filter((item): item is MenuItemWithCategory & { quantity: number } => Boolean(item));
  }, [cartItems, menuData]);

  // === Render ===
  const isLoading = isLoadingMenu || isLoadingCategories || isLoadingOrder;

  if (isLoading) {
    return <ActivityIndicator style={{ flex: 1, justifyContent: 'center' }} size="large" color="#FF6B35" />
  }

  // Format tiền
  const f = (num: number) => num.toLocaleString('vi-VN');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{tableName}</Text>
      
      {/* 6. Giao diện Tabs (V3) */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'menu' && styles.tabActive]}
          onPress={() => setActiveTab('menu')}
        >
          <Text style={[styles.tabText, activeTab === 'menu' && styles.tabTextActive]}>Thực Đơn</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'cart' && styles.tabActive]}
          onPress={() => setActiveTab('cart')}
        >
          <Text style={[styles.tabText, activeTab === 'cart' && styles.tabTextActive]}>
            Giỏ Hàng ({cartItemsList.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 7. Nội dung Tab */}
      {activeTab === 'menu' ? (
        // === TAB THỰC ĐƠN ===
        <>
          <TextInput
            style={styles.search}
            placeholder="Tìm món..."
            onChangeText={setSearch}
          />
          <FlatList
            data={categoriesData || []}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.categoryList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.categoryBtn, selectedCategory === item.id && styles.categoryBtnActive]}
                onPress={() => setSelectedCategory(selectedCategory === item.id ? null : item.id)}
              >
                <Text style={[styles.categoryText, selectedCategory === item.id && styles.categoryTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
          <FlatList
            data={filteredMenu}
            numColumns={2}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => {
              const qty = cartItems.get(item.id) || 0;
              return (
                <View style={styles.menuCard}>
                  <Text style={styles.menuName}>{item.name}</Text>
                  <Text style={styles.menuPrice}>{f(item.price)}đ</Text>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, -1)}>
                      <Minus size={18} color="#FF6B35" />
                    </TouchableOpacity>
                    <Text style={styles.qty}>{qty}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, 1)}>
                      <Plus size={18} color="#FF6B35" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        </>
      ) : (
        // === TAB GIỎ HÀNG ===
        <ScrollView style={styles.cartContainer}>
          {cartItemsList.length === 0 ? (
            <Text style={styles.emptyCart}>Giỏ hàng trống</Text>
          ) : (
            cartItemsList.map(item => (
              <View key={item.id} style={styles.cartItem}>
                <View style={styles.cartItemInfo}>
                  <Text style={styles.cartItemName}>{item.name}</Text>
                  <Text style={styles.cartItemPrice}>{f(item.price)}đ</Text>
                </View>
                <View style={styles.cartQtyRow}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, -1)}>
                    <Minus size={18} color="#FF6B35" />
                  </TouchableOpacity>
                  <Text style={styles.qty}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, 1)}>
                    <Plus size={18} color="#FF6B35" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.cartItemTotal}>{f(item.price * item.quantity)}đ</Text>
                <TouchableOpacity onPress={() => updateQuantity(item.id, -item.quantity)}>
                  <Trash size={20} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            ))
          )}

          {/* 8. Phần Tính toán (V3) */}
          <View style={styles.calculationsContainer}>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Tạm tính:</Text>
              <Text style={styles.calcValue}>{f(calculations.subtotal)}đ</Text>
            </View>
            
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Giảm giá (%):</Text>
              <TextInput
                style={styles.discountInput}
                value={discountPercent}
                onChangeText={setDiscountPercent}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Tiền giảm giá:</Text>
              <Text style={styles.calcValue}>-{f(calculations.discountAmount)}đ</Text>
            </View>

            {isVatEnabled && (
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>VAT ({vatPercent}%):</Text>
                <Text style={styles.calcValue}>{f(calculations.vatAmount)}đ</Text>
              </View>
            )}

            <View style={[styles.calcRow, styles.finalTotalRow]}>
              <Text style={styles.finalTotalLabel}>TỔNG CỘNG:</Text>
              <Text style={styles.finalTotalValue}>{f(calculations.finalTotal)}đ</Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* 9. Footer (Giữ nguyên) */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.printBtn} 
          onPress={handlePrintKitchen} 
          disabled={upsertItemsMutation.isPending}
        >
          <Text style={styles.printText}>In Bếp</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.payBtn} 
          onPress={handlePayment} 
          disabled={updateStatusMutation.isPending}
        >
          <Text style={styles.payText}>Thanh Toán</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// 10. Styles (Kết hợp V1 và V3)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9', padding: 16, paddingTop: 50 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#FF6B35', textAlign: 'center', marginBottom: 16, fontFamily: 'SVN-Bold' },
  
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  tabActive: {
    backgroundColor: '#FF6B35',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
  },
  tabTextActive: {
    color: '#fff',
  },
  
  // Menu tab styles
  search: { backgroundColor: '#fff', padding: 14, borderRadius: 16, marginBottom: 12, fontSize: 16, elevation: 2 },
  
  // SỬA: Tăng chiều cao danh sách danh mục để tránh bị cắt bóng đổ
  categoryList: { 
    paddingVertical: 10, // Tăng padding dọc
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  
  // SỬA: Nút danh mục linh hoạt hơn
  categoryBtn: { 
    backgroundColor: '#fff', 
    paddingHorizontal: 20, // Giảm padding ngang một chút
    paddingVertical: 10,   // Padding dọc vừa phải
    borderRadius: 20, 
    marginHorizontal: 6, 
    elevation: 3, 
    // minWidth: 90, // BỎ minWidth cứng để nút co giãn theo text
    alignItems: 'center',
    justifyContent: 'center',
    height: 44, // Chiều cao nút cố định để đồng đều
  },
  
  categoryBtnActive: { backgroundColor: '#FF6B35' },
  
  categoryText: { 
    fontSize: 15, // Giảm font size xíu nếu tên dài
    fontWeight: '600', 
    color: '#555',
    textAlign: 'center', // Canh giữa text
  },
  
  categoryTextActive: { color: '#fff', fontWeight: '700' },
  
  menuCard: { flex: 1, margin: 10, backgroundColor: '#fff', padding: 16, borderRadius: 16, elevation: 3, alignItems: 'center' },
  menuName: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  menuPrice: { color: '#FF6B35', fontWeight: 'bold', marginVertical: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  qtyBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#fff',
    borderColor: '#FF6B35',
    borderWidth: 1,
  },
  qty: { marginHorizontal: 14, fontSize: 16, fontWeight: '600', minWidth: 20, textAlign: 'center' },

  // Cart tab styles
  cartContainer: {
    flex: 1,
  },
  emptyCart: {
    textAlign: 'center',
    fontSize: 18,
    color: '#999',
    marginTop: 40,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  cartItemPrice: {
    fontSize: 14,
    color: '#888',
  },
  cartQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartItemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B35',
    width: 80,
    textAlign: 'right',
    marginHorizontal: 10,
  },
  calculationsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    elevation: 2,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calcLabel: {
    fontSize: 16,
    color: '#555',
  },
  calcValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  discountInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
    width: 80,
    textAlign: 'right',
  },
  finalTotalRow: {
    borderTopWidth: 1,
    borderColor: '#eee',
    paddingTop: 10,
    marginTop: 10,
  },
  finalTotalLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  finalTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  
  // Footer styles
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-around' },
  printBtn: { backgroundColor: '#3498db', padding: 14, borderRadius: 12, flex: 1, marginHorizontal: 8, alignItems: 'center' },
  payBtn: { backgroundColor: '#27ae60', padding: 14, borderRadius: 12, flex: 1, marginHorizontal: 8, alignItems: 'center' },
  printText: { color: '#fff', textAlign: 'center', fontWeight: '600', fontSize: 16 },
  payText: { color: '#fff', textAlign: 'center', fontWeight: '600', fontSize: 16 },
});