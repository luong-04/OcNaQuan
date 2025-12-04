import * as Print from 'expo-print';
import { MenuItemWithCategory } from '../api/menuApi';

// 1. Định nghĩa kiểu dữ liệu cho tính toán
export interface Calculations {
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  finalTotal: number;
}

// 2. printKitchenBill (Giữ nguyên, bếp không cần giá)
export const printKitchenBill = async (
  tableName: string, 
  orderItems: Map<number, number>, 
  menu: MenuItemWithCategory[]
) => {
  const items = Array.from(orderItems.entries())
    .map(([id, qty]) => {
      const item = menu.find(m => m.id === id);
      return item ? `${item.name} x${qty}` : '';
    })
    .filter(Boolean);

  if (items.length === 0) return;

  const html = `
    <div style="padding:20px; font-family:Arial;">
      <h2 style="text-align:center; color:#FF6B35;">ỐC NA - BẾP</h2>
      <p><strong>Bàn:</strong> ${tableName}</p>
      <p><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
      <hr>
      ${items.map(i => `<p style="font-size:18px; margin:8px 0;">${i}</p>`).join('')}
    </div>
  `;
  await Print.printAsync({ html, width: 300 });
};

// 3. printPaymentBill (NÂNG CẤP)
export const printPaymentBill = async (
  tableName: string, 
  orderItems: Map<number, number>, 
  menu: MenuItemWithCategory[], 
  // Thêm calculations
  calculations: Calculations, 
  onPaid?: () => void
) => {
  const items = Array.from(orderItems.entries())
    .map(([id, qty]) => {
      const item = menu.find(m => m.id === id);
      return item ? { ...item, quantity: qty } : null;
    })
    .filter((item): item is MenuItemWithCategory & { quantity: number } => Boolean(item)); 

  // Format tiền
  const f = (num: number) => num.toLocaleString('vi-VN');

  const html = `
    <div style="padding:20px; font-family:Arial; max-width:300px; margin:auto;">
      <h2 style="text-align:center; color:#FF6B35;">ỐC NA</h2>
      <p><strong>Bàn:</strong> ${tableName}</p>
      <p><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
      <hr>
      <table width="100%" style="font-size:14px;">
        ${items.map(i => `
          <tr>
            <td style="padding:2px 0;">${i.name}</td>
            <td style="padding:2px 0; text-align:right;">x${i.quantity}</td>
            <td style="padding:2px 0; text-align:right;">${f(i.price * i.quantity)}đ</td>
          </tr>
        `).join('')}
      </table>
      <hr>
      
      <!-- PHẦN MỚI: TÍNH TOÁN -->
      <table width="100%" style="font-size:14px;">
        <tr>
          <td>Tạm tính:</td>
          <td style="text-align:right;">${f(calculations.subtotal)}đ</td>
        </tr>
        ${calculations.discountAmount > 0 ? `
          <tr>
            <td>Giảm giá:</td>
            <td style="text-align:right;">-${f(calculations.discountAmount)}đ</td>
          </tr>
        ` : ''}
        ${calculations.vatAmount > 0 ? `
          <tr>
            <td>VAT:</td>
            <td style="text-align:right;">${f(calculations.vatAmount)}đ</td>
          </tr>
        ` : ''}
        <tr style="font-size:18px; font-weight:bold;">
          <td>TỔNG CỘNG:</td>
          <td style="text-align:right;">${f(calculations.finalTotal)}đ</td>
        </tr>
      </table>
      
      <p style="text-align:center; margin-top:20px; color:#7f8c8d;">Cảm ơn quý khách!</p>
    </div>
  `;

  await Print.printAsync({ html, width: 300 });
  onPaid?.();
};