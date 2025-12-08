import { Buffer } from 'buffer';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import qrcode from 'qrcode-generator';
import { Alert } from 'react-native';
import TcpSocket from 'react-native-tcp-socket';
import { MenuItemWithCategory } from '../api/menuApi';
import { useSettingsStore } from '../stores/settingsStore';

export interface Calculations { subtotal: number; discountAmount: number; vatAmount: number; finalTotal: number; }

let isPrinting = false;

// --- DANH SÁCH NGÂN HÀNG ---
const BANK_MAPPING: Record<string, string> = {
    'VCB': '970436', 'VIETCOMBANK': '970436',
    'MB': '970422', 'MBBANK': '970422',
    'TCB': '970407', 'TECHCOMBANK': '970407',
    'ACB': '970416', 'VPB': '970432', 'VPBANK': '970432',
    'ICB': '970415', 'VIETINBANK': '970415', 'BIDV': '970418',
    'TPB': '970423', 'TPBANK': '970423', 'STB': '970403', 
    'SACOMBANK': '970403', 'VIB': '970441', 'MSB': '970426', 
    'OCB': '970448', 'AGRIBANK': '970405',
};

// 1. CÁC HÀM TIỆN ÍCH
const removeAccents = (str: string) => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

const f = (num: number) => num.toLocaleString('vi-VN');

// Helper căn lề cho in nhiệt
const padLeft = (str: string, len: number) => {
    const s = String(str);
    if (s.length >= len) return s;
    return " ".repeat(len - s.length) + s;
}

const ESC = '\x1B';
const GS = '\x1D';
const CMD = {
  INIT: ESC + '@',
  CENTER: ESC + 'a' + '\x01',
  LEFT: ESC + 'a' + '\x00',
  RIGHT: ESC + 'a' + '\x02',
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  CUT: GS + 'V' + '\x42' + '\x00', 
  TEXT_DOUBLE_HEIGHT: GS + '!' + '\x01',
  TEXT_NORMAL: GS + '!' + '\x00',
};

const DIVIDER = CMD.CENTER + "--------------------------------\n" + CMD.LEFT;
const DOUBLE_DIVIDER = CMD.CENTER + "================================\n" + CMD.LEFT;

// 2. HÀM TÍNH CRC16
const crc16 = (data: string) => {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
            else crc = crc << 1;
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
};

// 3. HÀM TẠO CHUỖI VIETQR
const generateVietQR = (bankId: string, accountNo: string, amount: number, content: string) => {
    const cleanAccountNo = accountNo.replace(/[^a-zA-Z0-9]/g, ''); 
    const cleanBankId = bankId.trim().toUpperCase();
    const bin = BANK_MAPPING[cleanBankId];
    if (!bin) return null;

    const len = (str: string) => str.length.toString().padStart(2, '0');
    let qr = "000201010212";
    const bankInfo = `00069704${bin}01${len(cleanAccountNo)}${cleanAccountNo}`;
    const merchantInfo = `0010A00000072701${len(bankInfo)}${bankInfo}0208QRIBFTTA`;
    qr += `38${len(merchantInfo)}${merchantInfo}`;
    qr += "5303704";
    qr += `54${len(amount.toString())}${amount}`;
    qr += "5802VN";
    
    let cleanContent = removeAccents(content).replace(/[^a-zA-Z0-9 ]/g, "").trim();
    if (cleanContent.length > 18) cleanContent = cleanContent.substring(0, 18);
    if (cleanContent.length > 0) {
        const addData = `08${len(cleanContent)}${cleanContent}`;
        qr += `62${len(addData)}${addData}`;
    }
    qr += "6304";
    qr += crc16(qr);
    return qr;
};

// 4. HÀM TẠO ẢNH QR BITMAP
const getQRImageCommand = (content: string) => {
    const qr = qrcode(0, 'L');
    qr.addData(content);
    qr.make();
    const count = qr.getModuleCount();
    const pixelSize = 4; 
    const imgSize = count * pixelSize; 
    const widthBytes = Math.ceil(imgSize / 8); 
    const buffer = Buffer.alloc(widthBytes * imgSize + 8);

    buffer.writeUInt8(0x1D, 0); buffer.writeUInt8(0x76, 1); buffer.writeUInt8(0x30, 2); buffer.writeUInt8(0x00, 3);
    buffer.writeUInt16LE(widthBytes, 4); buffer.writeUInt16LE(imgSize, 6);

    let offset = 8;
    for (let r = 0; r < count; r++) {
        for (let p = 0; p < pixelSize; p++) {
             for (let c = 0; c < widthBytes; c++) {
                 let byte = 0;
                 for (let b = 0; b < 8; b++) {
                     const pixelIndex = c * 8 + b;
                     const moduleCol = Math.floor(pixelIndex / pixelSize);
                     if (moduleCol < count && qr.isDark(r, moduleCol)) byte |= (1 << (7 - b));
                 }
                 buffer.writeUInt8(byte, offset++);
             }
        }
    }
    return buffer;
}

// 5. GỬI LỆNH
const sendToPrinter = (ip: string, port: number, data: Buffer): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!ip) { reject(new Error('Chưa cài đặt IP máy in')); return; }
    try {
        const client = TcpSocket.createConnection({ port, host: ip }, () => {});
        const safetyTimeout = setTimeout(() => { client.destroy(); reject(new Error(`Timeout: ${ip}`)); }, 4000);

        client.on('connect', () => {
          clearTimeout(safetyTimeout);
          setTimeout(() => {
            try {
                client.write(data);
                setTimeout(() => { client.destroy(); resolve(); }, 2000); 
            } catch (err) { client.destroy(); reject(new Error("Lỗi gửi dữ liệu")); }
          }, 50); 
        });
        client.on('error', (e) => { clearTimeout(safetyTimeout); client.destroy(); reject(new Error(e.message)); });
    } catch (e: any) { reject(new Error(e.message)); }
  });
};

// 6. GENERATE HTML (XEM TRƯỚC BILL)
const generateHtml = (tableName: string, items: any[], calculations: Calculations) => {
     const { shopName, address, phone, thankYouMessage, bankId, accountNo, vatPercent } = useSettingsStore.getState();
     
     let qrSection = '';
     if (bankId && accountNo) {
        const addInfo = `TT ${tableName}`.replace(/ /g, '%20');
        const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=${calculations.finalTotal}&addInfo=${addInfo}`;
        qrSection = `
            <div class="qr-container">
                <p>QUÉT MÃ THANH TOÁN</p>
                <img src="${qrUrl}" />
                <p>${bankId} - ${accountNo}</p>
            </div>
        `;
     }

     const date = new Date();
     const billId = `HD${date.getHours()}${date.getMinutes()}`;

     return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { 
            font-family: 'Courier New', Courier, monospace; 
            background: #fff; padding: 20px; margin: 0; color: #000;
          }
          .bill-container {
            width: 100%; max-width: 400px; margin: 0 auto;
            border: 1px solid #ddd; padding: 15px; background: #fff;
          }
          .center { text-align: center; } .right { text-align: right; }
          .bold { font-weight: bold; } .uppercase { text-transform: uppercase; }
          .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
          .double-divider { border-bottom: 3px double #000; margin: 10px 0; }
          .info-row { display: flex; justify-content: space-between; font-size: 13px; }
          .item-row { margin-bottom: 5px; font-size: 14px; }
          .item-name { font-weight: bold; display: block; }
          .item-calc { display: flex; justify-content: space-between; padding-left: 10px; }
          .total-row { display: flex; justify-content: space-between; font-size: 16px; margin-top: 5px; }
          .big-total { font-size: 18px; font-weight: bold; }
          .qr-container { text-align: center; margin-top: 15px; border: 1px dashed #aaa; padding: 10px; border-radius: 8px; }
          .qr-container img { width: 150px; height: 150px; }
        </style>
      </head>
      <body>
        <div class="bill-container">
            <div class="center">
                <h2 class="uppercase">${shopName}</h2>
                <p>${address}</p>
                <p>Hotline: ${phone}</p>
            </div>
            <div class="double-divider"></div>
            <div class="center bold">PHIEU THANH TOAN</div>
            <div class="info-row" style="margin-top: 5px;">
                <span>So: ${billId}</span>
                <span>${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB')}</span>
            </div>
            <div class="info-row">
                <span>Ban: ${tableName}</span>
                <span>Thu ngan: Admin</span>
            </div>
            <div class="divider"></div>
            <div class="info-row bold">
                <span>TEN MON</span>
                <span>THANH TIEN</span>
            </div>
            <div class="divider"></div>
            ${items.map(i => `
                <div class="item-row">
                    <span class="item-name">${i.name}</span>
                    <div class="item-calc">
                        <span>${i.quantity} x ${f(i.price)}</span>
                        <span>${f(i.price * i.quantity)}</span>
                    </div>
                </div>
            `).join('')}
            <div class="divider"></div>
            <div class="total-row">
                <span>Tam tinh:</span>
                <span>${f(calculations.subtotal)}</span>
            </div>
            
            ${calculations.discountAmount > 0 ? `
            <div class="total-row">
                <span>Giam gia:</span>
                <span>-${f(calculations.discountAmount)}</span>
            </div>` : ''}

            ${calculations.vatAmount > 0 ? `
            <div class="total-row">
                <span>Thue VAT (${vatPercent}%):</span>
                <span>${f(calculations.vatAmount)}</span>
            </div>` : ''}
            
            <div class="total-row big-total" style="margin-top: 10px;">
                <span>TONG CONG:</span>
                <span>${f(calculations.finalTotal)}</span>
            </div>
            <div class="double-divider"></div>
            ${qrSection}
            <div class="center" style="margin-top: 20px;">
                <p class="bold">${thankYouMessage}</p>
                <p style="font-size: 11px; margin-top: 5px; color: #555;">Powered by OcNaQuan App</p>
            </div>
        </div>
      </body>
    </html>
  `;
};

// 7. IN BẾP
export const printKitchenBill = async (tableName: string, orderItems: Map<number, number>, menu: MenuItemWithCategory[]) => {
    if (isPrinting) return; isPrinting = true;
    const { kitchenPrinterId, printer1, printer2 } = useSettingsStore.getState();
    const targetIp = kitchenPrinterId === 'printer2' ? printer2 : printer1;
    try {
        if (!kitchenPrinterId || !targetIp) { Alert.alert("Lỗi In Bếp", "Chưa cấu hình máy in Bếp."); return; }
        
        let txt = CMD.INIT + CMD.CENTER + CMD.BOLD_ON + CMD.TEXT_DOUBLE_HEIGHT + "PHIEU CHE BIEN\n" + CMD.TEXT_NORMAL + CMD.BOLD_OFF;
        txt += `Ban: ${removeAccents(tableName)}\n`;
        txt += `${new Date().toLocaleTimeString('vi-VN')}\n`;
        txt += DOUBLE_DIVIDER + CMD.LEFT;
        orderItems.forEach((qty, id) => { 
            const i = menu.find(m => m.id === id); 
            if(i) {
                txt += CMD.BOLD_ON + CMD.TEXT_DOUBLE_HEIGHT + `${removeAccents(i.name)}\n` + CMD.TEXT_NORMAL + CMD.BOLD_OFF;
                txt += `SL: ${qty}\n` + DIVIDER;
            }
        });
        txt += "\n\n" + CMD.CUT;
        await sendToPrinter(targetIp, 9100, Buffer.from(txt));
    } catch(e: any) {
        Alert.alert("Lỗi In Bếp", `Không in được tại ${targetIp}.\n${e.message}`);
    } finally { setTimeout(() => isPrinting = false, 1000); }
};

// 8. IN HÓA ĐƠN
export const printPaymentBill = async (
  tableName: string, orderItems: Map<number, number>, menu: MenuItemWithCategory[], calculations: Calculations, onPaid?: () => void
) => {
  if (isPrinting) return; isPrinting = true;
  const { paymentPrinterId, printer1, printer2, shopName, address, phone, thankYouMessage, bankId, accountNo, rawVietQR, vatPercent } = useSettingsStore.getState();
  const targetIp = paymentPrinterId === 'printer2' ? printer2 : printer1;

  if (!paymentPrinterId || !targetIp) { 
      Alert.alert("Lỗi In", "Chưa cài đặt IP máy in hóa đơn.", [{ text: "Thanh toán luôn", onPress: () => onPaid?.() }, { text: "Hủy", style: "cancel" }]);
      isPrinting = false; return; 
  }

  try {
    const date = new Date();
    const billId = `HD${date.getHours()}${date.getMinutes()}`; 

    let txt = CMD.INIT;
    txt += CMD.CENTER + CMD.BOLD_ON + CMD.TEXT_DOUBLE_HEIGHT + removeAccents(shopName).toUpperCase() + "\n" + CMD.TEXT_NORMAL + CMD.BOLD_OFF;
    txt += removeAccents(address) + "\n";
    txt += `Hotline: ${phone}\n`;
    txt += DOUBLE_DIVIDER;
    
    txt += CMD.LEFT + "Phieu Thanh Toan\n";
    txt += `So: ${billId}   Ngay: ${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB')}\n`;
    txt += `Ban: ${removeAccents(tableName)}      Thu ngan: Admin\n`;
    txt += DIVIDER;

    txt += CMD.BOLD_ON + "TEN MON                    THANH TIEN\n" + CMD.BOLD_OFF;
    txt += DIVIDER;
    
    orderItems.forEach((qty, id) => {
      const item = menu.find(m => m.id === id);
      if (item) {
        txt += CMD.BOLD_ON + removeAccents(item.name) + CMD.BOLD_OFF + "\n";
        txt += CMD.LEFT + `${qty} x ${f(item.price)}`; 
        txt += CMD.RIGHT + f(item.price * qty) + "\n" + CMD.LEFT; 
      }
    });
    
    txt += DIVIDER + CMD.RIGHT;
    
    // --- PHẦN TỔNG KẾT TIỀN (ĐÃ THÊM VAT & GIẢM GIÁ) ---
    // 1. Tạm tính
    txt += `Tam tinh: ${padLeft(f(calculations.subtotal), 15)}\n`;
    
    // 2. Giảm giá (Nếu có) - Căn phải chuẩn
    if (calculations.discountAmount > 0) {
        txt += `Giam gia: -${padLeft(f(calculations.discountAmount), 14)}\n`; // 14 vì trừ đi dấu "-"
    }

    // 3. Thuế VAT (Nếu có) - Hiển thị % và căn phải
    if (calculations.vatAmount > 0) {
        txt += `Thue VAT (${vatPercent}%): ${padLeft(f(calculations.vatAmount), 13)}\n`;
    }
    
    // 4. Tổng cộng
    txt += CMD.BOLD_ON + CMD.TEXT_DOUBLE_HEIGHT + `THANH TOAN: ${f(calculations.finalTotal)}` + CMD.TEXT_NORMAL + CMD.BOLD_OFF + "\n";
    txt += DOUBLE_DIVIDER;

    const bufferText = Buffer.from(txt, 'utf-8');

    let bufferQR = Buffer.alloc(0);
    let bufferQRInfo = Buffer.alloc(0);
    try {
        if (rawVietQR && rawVietQR.length > 20) {
            bufferQR = Buffer.concat([
                Buffer.from(CMD.CENTER + "QUET MA THANH TOAN:\n", 'utf-8'),
                getQRImageCommand(rawVietQR), 
                Buffer.from("\n", 'utf-8'),
            ]);
            if (bankId && accountNo) bufferQRInfo = Buffer.from(`${bankId} - ${accountNo}\n(Khach hang vui long nhap so tien)\n`, 'utf-8');
        } else if (bankId && accountNo) {
             bufferQRInfo = Buffer.from(CMD.CENTER + `CK: ${bankId} - ${accountNo}\n`, 'utf-8');
        }
    } catch (e) {}

    const footerTxt = CMD.CENTER + "\n" + removeAccents(thankYouMessage) + "\n" + "Powered by OcNaQuan App\n\n\n" + CMD.CUT;
    const bufferFooter = Buffer.from(footerTxt, 'utf-8');

    await sendToPrinter(targetIp, 9100, Buffer.concat([bufferText, bufferQR, bufferQRInfo, bufferFooter]));
    onPaid?.();

  } catch (e: any) {
    Alert.alert("Kết nối máy in thất bại", `Không tìm thấy máy in tại ${targetIp}.\nĐơn hàng sẽ được thanh toán.`, [{ text: "OK", onPress: () => onPaid?.() }]);
  } finally { setTimeout(() => isPrinting = false, 2000); }
};

// 9. SHARE PDF
export const sharePaymentBill = async (tableName: string, orderItems: Map<number, number>, menu: MenuItemWithCategory[], calculations: Calculations) => {
    const itemsArr = Array.from(orderItems.entries()).map(([id, qty]) => { const item = menu.find(m => m.id === id); return item ? { ...item, quantity: qty } : null; }).filter(Boolean);
    const html = generateHtml(tableName, itemsArr, calculations);
    try { const { uri } = await Print.printToFileAsync({ html, width: 576 }); await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' }); } catch (error) {}
};