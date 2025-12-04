import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MenuItemWithCategory } from '../api/menuApi';
import { useSettingsStore } from '../stores/settingsStore';

export interface Calculations { subtotal: number; discountAmount: number; vatAmount: number; finalTotal: number; }

let isPrinting = false; // Khóa chống spam

const f = (num: number) => num.toLocaleString('vi-VN');

const generateBillHtml = (tableName: string, orderItems: Map<number, number>, menu: MenuItemWithCategory[], calculations: Calculations) => {
  const { shopName, address, phone, thankYouMessage, bankId, accountNo, isVatEnabled, vatPercent } = useSettingsStore.getState();
  
  const items = Array.from(orderItems.entries())
    .map(([id, qty]) => {
      const item = menu.find(m => m.id === id);
      return item ? { ...item, quantity: qty } : null;
    })
    .filter((item): item is MenuItemWithCategory & { quantity: number } => Boolean(item)); 

  let qrSection = '';
  if (bankId && accountNo && accountNo.length > 5) {
    const addInfo = `TT ${tableName}`.replace(/ /g, '%20');
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=${calculations.finalTotal}&addInfo=${addInfo}`;
    qrSection = `<div style="text-align:center;margin-top:15px;border:1px solid #ddd;padding:10px;border-radius:8px;"><p style="font-size:12px;margin-bottom:5px;">Quét mã thanh toán:</p><img src="${qrUrl}" style="width:180px;height:auto;"/><p style="font-size:10px;margin-top:5px;">${bankId} - ${accountNo}</p></div>`;
  }

  return `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"/><style>body{font-family:Arial,sans-serif;padding:10px;font-size:12px}.center{text-align:center}.right{text-align:right}table{width:100%;border-collapse:collapse;margin:10px 0}th{border-bottom:1px solid #000;text-align:left}td{padding:4px 0}</style></head><body><div class="center"><h1 style="margin:0;font-size:20px">${shopName}</h1><p>${address}</p><p>Hotline: ${phone}</p></div><hr style="border-top:1px dashed #000;margin:10px 0"/><p>Bàn: <b>${tableName}</b> - ${new Date().toLocaleString('vi-VN')}</p><hr style="border-top:1px dashed #000"/><table><thead><tr><th width="50%">Món</th><th width="15%" class="center">SL</th><th width="35%" class="right">Tiền</th></tr></thead><tbody>${items.map(i => `<tr><td>${i.name}</td><td class="center">${i.quantity}</td><td class="right">${f(i.price * i.quantity)}</td></tr>`).join('')}</tbody></table><hr style="border-top:1px dashed #000"/><div style="font-size:13px"><div style="display:flex;justify-content:space-between"><span>Tạm tính:</span><span>${f(calculations.subtotal)}</span></div>${calculations.discountAmount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Giảm giá:</span><span>-${f(calculations.discountAmount)}</span></div>` : ''}${isVatEnabled ? `<div style="display:flex;justify-content:space-between"><span>VAT (${vatPercent}%):</span><span>${f(calculations.vatAmount)}</span></div>` : ''}<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:18px;margin-top:5px"><span>TỔNG:</span><span>${f(calculations.finalTotal)} đ</span></div></div>${qrSection}<hr style="border-top:1px dashed #000;margin:15px 0"/><p class="center" style="font-style:italic">${thankYouMessage}</p></body></html>`;
};

export const printKitchenBill = async (tableName: string, orderItems: Map<number, number>, menu: MenuItemWithCategory[]) => {
  if (isPrinting) return;
  const items = Array.from(orderItems.entries()).map(([id, qty]) => {
      const item = menu.find(m => m.id === id);
      return item ? `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:5px 0"><span style="font-weight:bold;font-size:18px">${item.name}</span><span style="font-size:24px;font-weight:bold">x${qty}</span></div>` : '';
    }).filter(Boolean);
  if (items.length === 0) return;
  const html = `<html><body style="font-family:monospace;padding:20px"><h2 style="text-align:center;border-bottom:2px dashed #000">BẾP - MÓN MỚI</h2><div style="font-size:18px;margin:10px 0">Bàn: <b>${tableName}</b> - ${new Date().toLocaleTimeString('vi-VN')}</div><hr/>${items.join('')}</body></html>`;
  try { isPrinting = true; await Print.printAsync({ html, width: 576 }); } catch (e) {} finally { setTimeout(() => isPrinting = false, 1500); }
};

export const printPaymentBill = async (tableName: string, orderItems: Map<number, number>, menu: MenuItemWithCategory[], calculations: Calculations, onPaid?: () => void) => {
  if (isPrinting) return;
  const html = generateBillHtml(tableName, orderItems, menu, calculations);
  try { isPrinting = true; await Print.printAsync({ html, width: 576 }); onPaid?.(); } catch (e) {} finally { setTimeout(() => isPrinting = false, 1500); }
};

export const sharePaymentBill = async (tableName: string, orderItems: Map<number, number>, menu: MenuItemWithCategory[], calculations: Calculations) => {
  const html = generateBillHtml(tableName, orderItems, menu, calculations);
  try { const { uri } = await Print.printToFileAsync({ html, width: 576 }); await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' }); } catch (e) {}
};