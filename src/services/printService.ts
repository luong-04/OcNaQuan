// File: src/services/printService.ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import TcpSocket from 'react-native-tcp-socket';
import { MenuItemWithCategory } from '../api/menuApi';
import { useSettingsStore } from '../stores/settingsStore';

export interface Calculations { subtotal: number; discountAmount: number; vatAmount: number; finalTotal: number; }

let isPrinting = false;

// Xóa dấu (cho in IP)
const removeAccents = (str: string) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}
const f = (num: number) => num.toLocaleString('vi-VN');

// ESC/POS Commands
const CMD = {
  INIT: '\x1B@', CENTER: '\x1Ba\x01', LEFT: '\x1Ba\x00', RIGHT: '\x1Ba\x02',
  BOLD_ON: '\x1BE\x01', BOLD_OFF: '\x1BE\x00', CUT: '\x1DV\x42\x00',
  TEXT_NORMAL: '\x1B!\x00', TEXT_LARGE: '\x1B!\x10',
};

const sendToPrinter = (ip: string, port: number, data: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!ip) { reject(new Error('Chưa cài đặt IP máy in')); return; }
    const client = TcpSocket.createConnection({ port, host: ip }, () => {
      client.write(data); client.end(); resolve();
    });
    client.on('error', (error) => {
      console.log('Printer Error:', error);
      Alert.alert("Kết nối", `Không tìm thấy máy in tại ${ip}`);
      resolve(); 
    });
    setTimeout(() => { client.destroy(); resolve(); }, 3000);
  });
};

// --- HÀM TẠO HTML BILL ĐẸP (ĐẦY ĐỦ THÔNG TIN) ---
const generateHtml = (tableName: string, items: any[], calculations: Calculations) => {
  // Lấy toàn bộ thông tin từ Cài đặt
  const { shopName, address, phone, thankYouMessage, bankId, accountNo, isVatEnabled, vatPercent } = useSettingsStore.getState();
  
  // Phần QR Code
  let qrSection = '';
  if (bankId && accountNo) {
    const addInfo = `TT ${tableName}`.replace(/ /g, '%20');
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=${calculations.finalTotal}&addInfo=${addInfo}`;
    qrSection = `
      <div style="text-align:center; margin-top:15px; border:2px solid #000; padding:10px; border-radius: 8px;">
        <p style="font-size:14px; font-weight:bold; margin:0 0 5px 0;">QUÉT MÃ THANH TOÁN</p>
        <img src="${qrUrl}" style="width:160px; height:160px;" />
        <p style="font-size:12px; margin:5px 0 0 0; font-weight:bold;">${bankId} - ${accountNo}</p>
        <p style="font-size:10px; margin:2px 0 0 0;">(Vui lòng nhập đúng số tiền)</p>
      </div>
    `;
  }

  // HTML chi tiết
  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; margin: 0; background: #fff; width: 576px; font-size: 16px; color: #000; }
          .header { text-align: center; margin-bottom: 10px; }
          .shop-name { font-size: 28px; font-weight: bold; margin: 0 0 5px 0; text-transform: uppercase; }
          .shop-info { font-size: 16px; margin: 3px 0; }
          .line { border-bottom: 1px dashed #000; margin: 15px 0; }
          .bold { font-weight: bold; }
          .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .table-header { font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; }
          td { vertical-align: top; padding: 5px 0; }
          .col-name { width: 50%; text-align: left; }
          .col-qty { width: 15%; text-align: center; }
          .col-price { width: 35%; text-align: right; }
          .total-row { font-size: 18px; margin-top: 5px; }
          .final-total { font-size: 26px; font-weight: bold; margin-top: 10px; }
          .footer { text-align: center; margin-top: 20px; font-style: italic; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="shop-name">${shopName || 'HÓA ĐƠN'}</h1>
          ${address ? `<p class="shop-info">Đ/c: ${address}</p>` : ''}
          ${phone ? `<p class="shop-info">Hotline: <b>${phone}</b></p>` : ''}
        </div>

        <div class="line"></div>

        <div class="row">
          <span>Bàn: <b style="font-size: 20px;">${tableName}</b></span>
          <span>${new Date().toLocaleString('vi-VN')}</span>
        </div>

        <div class="line"></div>
        
        <div class="row table-header">
          <span style="width:50%">Món</span>
          <span style="width:15%; text-align:center">SL</span>
          <span style="width:35%; text-align:right">Thành tiền</span>
        </div>

        <table>
          ${items.map(i => `
            <tr>
              <td class="col-name"><b>${i.name}</b></td>
              <td class="col-qty">${i.quantity}</td>
              <td class="col-price">${f(i.price * i.quantity)}</td>
            </tr>
          `).join('')}
        </table>
        
        <div class="line"></div>
        
        <div class="row total-row"><span>Tạm tính:</span><span>${f(calculations.subtotal)}</span></div>
        ${calculations.discountAmount > 0 ? `<div class="row total-row"><span>Giảm giá:</span><span>-${f(calculations.discountAmount)}</span></div>` : ''}
        ${(isVatEnabled && calculations.vatAmount > 0) ? `<div class="row total-row"><span>VAT (${vatPercent}%):</span><span>${f(calculations.vatAmount)}</span></div>` : ''}
        
        <div class="row final-total">
          <span>TỔNG CỘNG:</span>
          <span>${f(calculations.finalTotal)} đ</span>
        </div>

        ${qrSection}

        <div class="line"></div>
        
        <p class="footer">${thankYouMessage}</p>
        <p class="footer" style="font-size:10px; color:#555;">Powered by OcNaQuan</p>
      </body>
    </html>
  `;
};

// --- CÁC HÀM IN ẤN (GIỮ NGUYÊN LOGIC CŨ) ---

export const printKitchenBill = async (tableName: string, orderItems: Map<number, number>, menu: MenuItemWithCategory[]) => {
  if (isPrinting) return;
  isPrinting = true;
  try {
    const { kitchenPrinterId, printer1, printer2 } = useSettingsStore.getState();
    const targetIp = kitchenPrinterId === 'printer2' ? printer2 : printer1;
    if (!kitchenPrinterId) { Alert.alert("Lỗi", "Chưa cài máy in Bếp"); return; }

    let bill = CMD.INIT + CMD.CENTER + CMD.BOLD_ON + CMD.TEXT_LARGE + "BEP - MON MOI" + CMD.TEXT_NORMAL + CMD.BOLD_OFF + "\n";
    bill += `Ban: ${removeAccents(tableName)}\n${new Date().toLocaleTimeString()}\n` + "--------------------------------\n" + CMD.LEFT;
    
    let hasItem = false;
    orderItems.forEach((qty, id) => {
      const item = menu.find(m => m.id === id);
      if (item) {
        hasItem = true;
        bill += CMD.BOLD_ON + removeAccents(item.name) + CMD.BOLD_OFF + "\n" + `SL: ${qty}\n` + "- - - - - - - - - - - - - - - -\n";
      }
    });
    bill += "\n\n" + CMD.CUT;

    if (hasItem) await sendToPrinter(targetIp, 9100, bill);
  } catch (e: any) { Alert.alert("Lỗi", e.message); } finally { setTimeout(() => isPrinting = false, 1000); }
};

export const printPaymentBill = async (tableName: string, orderItems: Map<number, number>, menu: MenuItemWithCategory[], calculations: Calculations, onPaid?: () => void) => {
  if (isPrinting) return;
  isPrinting = true;
  try {
    const { paymentPrinterId, printer1, printer2, shopName, address, phone, thankYouMessage, bankId, accountNo } = useSettingsStore.getState();
    const targetIp = paymentPrinterId === 'printer2' ? printer2 : printer1;
    if (!paymentPrinterId) { onPaid?.(); return; }

    // Bill in IP (Không dấu)
    let bill = CMD.INIT + CMD.CENTER + CMD.BOLD_ON + CMD.TEXT_LARGE + removeAccents(shopName).toUpperCase() + CMD.TEXT_NORMAL + CMD.BOLD_OFF + "\n";
    bill += removeAccents(address) + "\n" + `Hotline: ${phone}\n--------------------------------\n`;
    bill += CMD.LEFT + `Ban: ${removeAccents(tableName)}\n` + `Gio: ${new Date().toLocaleString('en-GB')}\n--------------------------------\n`;
    
    orderItems.forEach((qty, id) => {
      const item = menu.find(m => m.id === id);
      if (item) {
        bill += removeAccents(item.name) + "\n" + `SL: ${qty}      x ${f(item.price)}     = ${f(item.price * qty)}\n`;
      }
    });
    
    bill += "--------------------------------\n" + CMD.RIGHT;
    bill += `Tam tinh: ${f(calculations.subtotal)}\n`;
    if (calculations.discountAmount > 0) bill += `Giam gia: -${f(calculations.discountAmount)}\n`;
    if (calculations.vatAmount > 0) bill += `VAT: ${f(calculations.vatAmount)}\n`;
    bill += CMD.BOLD_ON + `TONG CONG: ${f(calculations.finalTotal)}` + CMD.BOLD_OFF + "\n--------------------------------\n";
    
    if (bankId && accountNo) {
      bill += CMD.CENTER + "CHUYEN KHOAN:\n" + `${bankId} - ${accountNo}\n` + "--------------------------------\n";
    }
    bill += CMD.CENTER + removeAccents(thankYouMessage) + "\n\n\n" + CMD.CUT;

    await sendToPrinter(targetIp, 9100, bill);
    onPaid?.();
  } catch (e: any) { Alert.alert("Lỗi", e.message); onPaid?.(); } finally { setTimeout(() => isPrinting = false, 1000); }
};

// --- HÀM XEM TRƯỚC (Dùng HTML đẹp ở trên) ---
export const sharePaymentBill = async (tableName: string, orderItems: Map<number, number>, menu: MenuItemWithCategory[], calculations: Calculations) => {
  // Chuyển Map sang Mảng để tạo HTML
  const itemsArr = Array.from(orderItems.entries()).map(([id, qty]) => {
    const item = menu.find(m => m.id === id);
    return item ? { ...item, quantity: qty } : null;
  }).filter(Boolean);

  const html = generateHtml(tableName, itemsArr, calculations);

  try {
    const { uri } = await Print.printToFileAsync({ html, width: 576 });
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    console.log('Lỗi xem trước:', error);
    Alert.alert("Lỗi", "Không thể tạo file PDF.");
  }
};