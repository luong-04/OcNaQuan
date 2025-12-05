// File: app/(app)/order.tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'; // THÊM IMPORT
import { Eye, Minus, Plus, Trash } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react'; // THÊM useCallback
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { fetchCategories, fetchMenuItems } from '../../src/api/menuApi';
import { createOrder, fetchOpenOrderForTable, updateOrderStatus, upsertOrderItems } from '../../src/api/orderApi';
import { Calculations, printKitchenBill, printPaymentBill, sharePaymentBill } from '../../src/services/printService';
import { useSettingsStore } from '../../src/stores/settingsStore';

type ActiveTab = 'menu' | 'cart';

export default function OrderScreen() {
  const { tableName } = useLocalSearchParams<{ tableName: string }>();
  if (!tableName) { router.back(); return null; }

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>('menu');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  
  const [cartItems, setCartItems] = useState<Map<number, number>>(new Map());
  const [printedItems, setPrintedItems] = useState<Map<number, number>>(new Map());
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [discountPercent, setDiscountPercent] = useState('0');

  const { isVatEnabled, vatPercent } = useSettingsStore(useShallow((state) => ({ isVatEnabled: state.isVatEnabled, vatPercent: state.vatPercent })));
  
  // 1. RESET KHI VÀO MÀN HÌNH
  useEffect(() => {
    setCartItems(new Map());
    setPrintedItems(new Map());
    setCurrentOrderId(null);
    setDiscountPercent('0');
    setSearch('');
    setActiveTab('menu');
    // Xóa cache để buộc tải lại
    queryClient.removeQueries({ queryKey: ['order', tableName] });
  }, [tableName]);

  const { data: menuData, isLoading: isLoadingMenu } = useQuery({ queryKey: ['menuItems'], queryFn: fetchMenuItems });
  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  
  // 2. Fetch Đơn hàng
  const { data: orderData, isLoading: isLoadingOrder, refetch } = useQuery({
    queryKey: ['order', tableName],
    queryFn: () => fetchOpenOrderForTable(tableName),
    enabled: !!tableName,
  });

  // Tải lại khi focus (để chắc chắn dữ liệu mới nhất)
  useFocusEffect(useCallback(() => { refetch(); }, []));

  // 3. ĐỒNG BỘ DỮ LIỆU
  useEffect(() => {
    if (orderData) {
      // Có đơn -> Hiển thị món
      const serverCart = new Map<number, number>();
      orderData.order_items.forEach(item => item.menu_item_id && serverCart.set(item.menu_item_id, item.quantity));
      setCartItems(serverCart);
      setPrintedItems(serverCart);
      setCurrentOrderId(orderData.id);
    } else {
      // Không có đơn -> Xóa sạch (Quan trọng để fix lỗi chuyển bàn)
      if (!isLoadingOrder) {
        setCartItems(new Map());
        setPrintedItems(new Map());
        setCurrentOrderId(null);
      }
    }
  }, [orderData, isLoadingOrder]);

  const createOrderMutation = useMutation({ mutationFn: createOrder });
  const upsertItemsMutation = useMutation({ mutationFn: upsertOrderItems, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', tableName] }) });
  
  // (SỬA) Mutation Thanh toán có gửi totalAmount
  const updateStatusMutation = useMutation({ 
    mutationFn: ({ orderId, status, totalAmount }: { orderId: number, status: 'paid' | 'cancelled', totalAmount?: number }) => 
      updateOrderStatus(orderId, status, totalAmount), 
    onSuccess: async () => {
      setCartItems(new Map()); setPrintedItems(new Map()); setCurrentOrderId(null);
      queryClient.setQueryData(['order', tableName], null);
      
      router.back(); 
      
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['order'] }),
        queryClient.invalidateQueries({ queryKey: ['activeTables'] }),
        queryClient.invalidateQueries({ queryKey: ['tables'] })
      ]);
    }, 
    onError: (e) => Alert.alert('Lỗi', e.message) 
  });
  
  const calculations = useMemo((): Calculations => {
    let subtotal = 0;
    cartItems.forEach((qty, id) => { const item = menuData?.find(m => m.id === id); subtotal += (item?.price || 0) * qty; });
    const discountAmount = subtotal * (parseFloat(discountPercent) || 0) / 100;
    const subAfter = subtotal - discountAmount;
    const vatAmount = isVatEnabled ? subAfter * (vatPercent / 100) : 0;
    return { subtotal, discountAmount, vatAmount, finalTotal: subAfter + vatAmount };
  }, [cartItems, menuData, isVatEnabled, vatPercent, discountPercent]);

  const updateQuantity = (id: number, delta: number) => {
    setCartItems(prev => { const newQty = Math.max(0, (prev.get(id) || 0) + delta); const newMap = new Map(prev); newQty === 0 ? newMap.delete(id) : newMap.set(id, newQty); return newMap; });
  };

  const saveCartToServer = async (): Promise<boolean> => {
    let orderId = currentOrderId;
    if (!orderId) {
      if (cartItems.size === 0) return false;
      try {
        const newOrder = await createOrderMutation.mutateAsync(tableName);
        orderId = newOrder.id;
        setCurrentOrderId(orderId);
        queryClient.invalidateQueries({ queryKey: ['activeTables'] }); 
      } catch (e) {
        const existing = await fetchOpenOrderForTable(tableName);
        if (existing) { orderId = existing.id; setCurrentOrderId(orderId); } else return false; 
      }
    }
    if (orderId) {
       const items_input = Array.from(cartItems.entries()).map(([id, qty]) => ({ menu_item_id_input: id, quantity_input: qty }));
       await upsertItemsMutation.mutateAsync({ order_id_input: orderId, items_input });
       return true;
    }
    return false;
  };
  
  const handlePrintKitchen = async () => {
    const itemsToPrint = new Map<number, number>();
    cartItems.forEach((qty, id) => { const diff = qty - (printedItems.get(id) || 0); if (diff > 0) itemsToPrint.set(id, diff); });

    if (itemsToPrint.size === 0) {
      Alert.alert('Thông báo', 'Hết món mới. In lại phiếu cũ?', [{ text: 'Không', style: 'cancel' }, { text: 'In lại', onPress: () => { try { printKitchenBill(tableName, cartItems, menuData || []); } catch(e){} } }]);
      return;
    }
    const saved = await saveCartToServer();
    if (!saved) return;
    try { await printKitchenBill(tableName, itemsToPrint, menuData || []); setPrintedItems(new Map(cartItems)); } catch(e) {}
  };
  
  // (SỬA) Gửi totalAmount khi thanh toán
  const handlePayment = async () => {
    if (!currentOrderId) {
        const saved = await saveCartToServer();
        if (!saved && cartItems.size === 0) { Alert.alert('Lỗi', 'Đơn trống'); return; }
    }
    
    printPaymentBill(tableName, cartItems, menuData || [], calculations, () => { 
        if (currentOrderId) {
            updateStatusMutation.mutate({ 
                orderId: currentOrderId, 
                status: 'paid',
                totalAmount: calculations.finalTotal // <-- GỬI TỔNG TIỀN VÀO DB
            }); 
        }
    });
  };

  const handlePreview = () => {
    if (cartItems.size === 0) { Alert.alert('Lỗi', 'Giỏ hàng trống'); return; }
    sharePaymentBill(tableName, cartItems, menuData || [], calculations);
  };

  const filteredMenu = useMemo(() => { if (!menuData) return []; const l = search.toLowerCase(); return menuData.filter(i => (!search || i.name.toLowerCase().includes(l)) && (selectedCategory === null || i.category_id === selectedCategory)); }, [menuData, search, selectedCategory]);
  const cartItemsList = useMemo(() => { if (!menuData) return []; return Array.from(cartItems.entries()).map(([id, q]) => { const i = menuData.find(m => m.id === id); return i ? { ...i, quantity: q } : null; }).filter(Boolean) as any[]; }, [cartItems, menuData]);
  const f = (n: number) => n.toLocaleString('vi-VN');

  if (isLoadingMenu || isLoadingCategories || isLoadingOrder) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#FF6B35" />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{tableName}</Text>
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'menu' && styles.tabActive]} onPress={() => setActiveTab('menu')}><Text style={[styles.tabText, activeTab === 'menu' && styles.tabTextActive]}>Thực Đơn</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'cart' && styles.tabActive]} onPress={() => setActiveTab('cart')}><Text style={[styles.tabText, activeTab === 'cart' && styles.tabTextActive]}>Giỏ Hàng ({cartItemsList.length})</Text></TouchableOpacity>
      </View>
      {activeTab === 'menu' ? (
        <>
          <TextInput style={styles.search} placeholder="Tìm món..." onChangeText={setSearch} value={search} />
          <View style={{height: 50, marginBottom: 8}}>
            <FlatList data={categoriesData || []} horizontal showsHorizontalScrollIndicator={false} keyExtractor={i => i.id.toString()} contentContainerStyle={styles.categoryList} renderItem={({ item }) => (
              <TouchableOpacity style={[styles.categoryBtn, selectedCategory === item.id && styles.categoryBtnActive]} onPress={() => setSelectedCategory(selectedCategory === item.id ? null : item.id)}>
                <Text style={[styles.categoryText, selectedCategory === item.id && styles.categoryTextActive]}>{item.name}</Text>
              </TouchableOpacity>
            )} />
          </View>
          <FlatList data={filteredMenu} numColumns={2} style={{ flex: 1 }} keyExtractor={i => i.id.toString()} contentContainerStyle={{ paddingBottom: 100 }} renderItem={({ item }) => {
            const qty = cartItems.get(item.id) || 0;
            return (
              <View style={styles.menuCard}>
                <Text style={styles.menuName}>{item.name}</Text><Text style={styles.menuPrice}>{f(item.price)}đ</Text>
                <View style={styles.qtyRow}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, -1)}><Minus size={18} color="#FF6B35" /></TouchableOpacity>
                  <Text style={styles.qty}>{qty}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, 1)}><Plus size={18} color="#FF6B35" /></TouchableOpacity>
                </View>
              </View>
            );
          }} />
        </>
      ) : (
        <ScrollView style={styles.cartContainer} contentContainerStyle={{ paddingBottom: 100 }}>
          {cartItemsList.length === 0 ? <Text style={styles.emptyCart}>Giỏ hàng trống</Text> : cartItemsList.map(item => (
            <View key={item.id} style={styles.cartItem}>
              <View style={styles.cartItemInfo}><Text style={styles.cartItemName}>{item.name}</Text><Text style={styles.cartItemPrice}>{f(item.price)}đ</Text></View>
              <View style={styles.cartQtyRow}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, -1)}><Minus size={18} color="#FF6B35" /></TouchableOpacity>
                <Text style={styles.qty}>{item.quantity}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, 1)}><Plus size={18} color="#FF6B35" /></TouchableOpacity>
              </View>
              <Text style={styles.cartItemTotal}>{f(item.price * item.quantity)}đ</Text>
              <TouchableOpacity onPress={() => updateQuantity(item.id, -item.quantity)}><Trash size={20} color="#e74c3c" /></TouchableOpacity>
            </View>
          ))}
          <View style={styles.calculationsContainer}>
            <View style={styles.calcRow}><Text style={styles.calcLabel}>Tạm tính:</Text><Text style={styles.calcValue}>{f(calculations.subtotal)}đ</Text></View>
            <View style={styles.calcRow}><Text style={styles.calcLabel}>Giảm giá (%):</Text><TextInput style={styles.discountInput} value={discountPercent} onChangeText={setDiscountPercent} keyboardType="numeric" placeholder="0" /></View>
            <View style={styles.calcRow}><Text style={styles.calcLabel}>Tiền giảm giá:</Text><Text style={styles.calcValue}>-{f(calculations.discountAmount)}đ</Text></View>
            {isVatEnabled && <View style={styles.calcRow}><Text style={styles.calcLabel}>VAT ({vatPercent}%):</Text><Text style={styles.calcValue}>{f(calculations.vatAmount)}đ</Text></View>}
            <View style={[styles.calcRow, styles.finalTotalRow]}><Text style={styles.finalTotalLabel}>TỔNG CỘNG:</Text><Text style={styles.finalTotalValue}>{f(calculations.finalTotal)}đ</Text></View>
          </View>
        </ScrollView>
      )}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.printBtn, { backgroundColor: '#f39c12', flex: 0.8 }]} onPress={handlePreview}><View style={{flexDirection: 'row', justifyContent: 'center'}}><Eye size={20} color="#fff" style={{marginRight:5}}/><Text style={styles.printText}>Xem</Text></View></TouchableOpacity>
        <TouchableOpacity style={styles.printBtn} onPress={handlePrintKitchen} disabled={upsertItemsMutation.isPending}><Text style={styles.printText}>In Bếp</Text></TouchableOpacity>
        <TouchableOpacity style={styles.payBtn} onPress={handlePayment} disabled={updateStatusMutation.isPending}><Text style={styles.payText}>Thanh Toán</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9', padding: 12, paddingTop: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#FF6B35', textAlign: 'center', marginBottom: 10, fontFamily: 'SVN-Bold' },
  tabContainer: { flexDirection: 'row', marginBottom: 8, backgroundColor: '#fff', borderRadius: 10, elevation: 2, overflow: 'hidden', height: 45 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }, tabActive: { backgroundColor: '#FF6B35' }, tabText: { fontSize: 15, fontWeight: '600', color: '#555' }, tabTextActive: { color: '#fff' },
  search: { backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, marginBottom: 8, fontSize: 14, elevation: 1 },
  categoryList: { paddingHorizontal: 2 }, categoryBtn: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, marginHorizontal: 4, elevation: 2, height: 36, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  categoryBtnActive: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' }, categoryText: { fontSize: 13, fontWeight: '600', color: '#555' }, categoryTextActive: { color: '#fff' },
  menuCard: { flex: 1, margin: 6, backgroundColor: '#fff', padding: 10, borderRadius: 12, elevation: 2, alignItems: 'center' }, menuName: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 4 }, menuPrice: { color: '#FF6B35', fontWeight: 'bold', fontSize: 14, marginBottom: 8 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, qtyBtn: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', borderColor: '#FF6B35', borderWidth: 1 }, qty: { marginHorizontal: 10, fontSize: 15, fontWeight: '600', minWidth: 20, textAlign: 'center' },
  cartContainer: { flex: 1 }, emptyCart: { textAlign: 'center', fontSize: 16, color: '#999', marginTop: 40 }, cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 10, marginBottom: 8, elevation: 1 }, cartItemInfo: { flex: 1 }, cartItemName: { fontSize: 15, fontWeight: '600' }, cartItemPrice: { fontSize: 13, color: '#888' },
  cartQtyRow: { flexDirection: 'row', alignItems: 'center' }, cartItemTotal: { fontSize: 15, fontWeight: 'bold', color: '#FF6B35', width: 70, textAlign: 'right', marginHorizontal: 8 },
  calculationsContainer: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginTop: 5, elevation: 1 }, calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }, calcLabel: { fontSize: 14, color: '#555' }, calcValue: { fontSize: 14, fontWeight: '600' },
  discountInput: { backgroundColor: '#f0f0f0', borderRadius: 6, padding: 4, fontSize: 14, width: 60, textAlign: 'right' }, finalTotalRow: { borderTopWidth: 1, borderColor: '#eee', paddingTop: 8, marginTop: 4 }, finalTotalLabel: { fontSize: 18, fontWeight: 'bold', color: '#FF6B35' }, finalTotalValue: { fontSize: 18, fontWeight: 'bold', color: '#FF6B35' },
  footer: { padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-around' }, printBtn: { backgroundColor: '#3498db', paddingVertical: 12, borderRadius: 10, flex: 1, marginHorizontal: 6, alignItems: 'center', justifyContent: 'center' }, payBtn: { backgroundColor: '#27ae60', paddingVertical: 12, borderRadius: 10, flex: 1, marginHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  printText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 15 }, payText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 15 },
});