const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDtb1r_QrrmkSxXPANzOPTB4Pkk-PGea9c",
    projectId: "crudmaster-61ff9",
};

let db;
let transaksiCollection;
let barangCollection;
let supplierCollection;

let selectedItems = [];
let currentTransaksi = {
    totalDPP: 0,
    totalPPN: 0,
    grandTotal: 0
};

const tanggalInput = document.getElementById('tanggal');
const supplierSelect = document.getElementById('supplier');
const noFakturInput = document.getElementById('noFaktur');
const barangSelect = document.getElementById('barang');
const qtyInput = document.getElementById('qty');
const hargaInput = document.getElementById('harga');

const btnTambahItem = document.getElementById('btnTambahItem');
const btnSimpanTransaksi = document.getElementById('btnSimpanTransaksi');
const btnReset = document.getElementById('btnReset');

const tableTransaksiBody = document.getElementById('tableTransaksiBody');
const totalDPP = document.getElementById('totalDPP');
const totalPPN = document.getElementById('totalPPN');
const grandTotal = document.getElementById('grandTotal');
const selectedSupplierDisplay = document.getElementById('selectedSupplier');
const selectedTanggal = document.getElementById('selectedTanggal');
const displayGrandTotal = document.getElementById('displayGrandTotal');
const statusMessage = document.getElementById('statusMessage');

// Buat modal konfirmasi
let confirmationModal;

function initializeFirebase() {
    try {
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore(app);
        transaksiCollection = db.collection('transaksi');
        barangCollection = db.collection('barang');
        supplierCollection = db.collection('supplier');
        
        createConfirmationModal();
        loadSuppliers();
        loadBarang();
        setupDate();
    } catch (error) {
        console.error("Error initializing Firebase:", error);
    }
}

function createConfirmationModal() {
    // Buat modal HTML
    confirmationModal = document.createElement('div');
    confirmationModal.className = 'modal';
    confirmationModal.id = 'confirmationModal';
    confirmationModal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <h3><i class="fas fa-exclamation-triangle"></i> Konfirmasi Transaksi</h3>
            <div id="modalMessage" style="margin: 15px 0; line-height: 1.6;">
                Apakah Anda yakin ingin menyimpan transaksi ini dan memperbarui stock barang?
            </div>
            <div id="stockUpdateDetails" style="margin: 15px 0; padding: 10px; background-color: #f8f9fa; border-radius: 4px; font-size: 14px;">
                <p style="margin-bottom: 8px; font-weight: bold;">Detail Update Stock:</p>
                <div id="stockItemsList"></div>
            </div>
            <div class="modal-buttons">
                <button class="btn btn-cancel" id="btnCancelModal">
                    <i class="fas fa-times"></i> Batal
                </button>
                <button class="btn btn-confirm" id="btnConfirmSave">
                    <i class="fas fa-check"></i> Ya, Simpan
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(confirmationModal);
    
    // Setup event listeners untuk modal
    document.getElementById('btnCancelModal').addEventListener('click', () => {
        confirmationModal.style.display = 'none';
    });
    
    document.getElementById('btnConfirmSave').addEventListener('click', () => {
        confirmationModal.style.display = 'none';
        saveTransaction();
    });
    
    // Tutup modal saat klik di luar
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) {
            confirmationModal.style.display = 'none';
        }
    });
}

function showConfirmationModal() {
    // Isi detail stock yang akan diupdate
    const stockItemsList = document.getElementById('stockItemsList');
    stockItemsList.innerHTML = '';
    
    if (selectedItems.length === 0) {
        stockItemsList.innerHTML = '<p style="color: #666;">Tidak ada item untuk diupdate.</p>';
    } else {
        selectedItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.style.padding = '5px 0';
            itemDiv.style.borderBottom = '1px solid #eee';
            itemDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span>${item.barangText}</span>
                    <span><strong>+${item.qty}</strong> unit</span>
                </div>
            `;
            stockItemsList.appendChild(itemDiv);
        });
    }
    
    // Tampilkan modal
    confirmationModal.style.display = 'flex';
}

function setupDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    tanggalInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    selectedTanggal.textContent = `${day}/${month}/${year} ${hours}:${minutes}`;
    
    tanggalInput.addEventListener('change', function() {
        const date = new Date(this.value);
        const formattedDate = date.toLocaleDateString('id-ID') + ' ' + date.toLocaleTimeString('id-ID');
        selectedTanggal.textContent = formattedDate;
    });
}

async function loadSuppliers() {
    try {
        const snapshot = await supplierCollection.orderBy('namaSupplier').get();
        supplierSelect.innerHTML = '<option value="">Pilih Supplier</option>';
        
        snapshot.forEach(doc => {
            const supplier = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${supplier.kodeSupplier} - ${supplier.namaSupplier}`;
            supplierSelect.appendChild(option);
        });
        
        supplierSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            selectedSupplierDisplay.textContent = selectedOption.textContent || '-';
        });
        
    } catch (error) {
        console.error("Error loading suppliers:", error);
    }
}

async function loadBarang() {
    try {
        const snapshot = await barangCollection.orderBy('namaBarang').get();
        barangSelect.innerHTML = '<option value="">Pilih Barang</option>';
        
        snapshot.forEach(doc => {
            const barang = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${barang.kodeBarang} - ${barang.namaBarang}`;
            option.setAttribute('data-harga', barang.hargaBeli || 0);
            option.setAttribute('data-stock', barang.stock || 0);
            option.setAttribute('data-satuan', barang.satuan || '');
            barangSelect.appendChild(option);
        });
        
        barangSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const harga = selectedOption.getAttribute('data-harga') || 0;
            const stock = selectedOption.getAttribute('data-stock') || 0;
            const satuan = selectedOption.getAttribute('data-satuan') || '';
            
            hargaInput.value = formatNumber(String(harga));
            
            // Tampilkan info stock
            if (stock !== undefined) {
                showStatus(`Stock tersedia: ${stock} ${satuan}`, 'success');
            }
        });
        
    } catch (error) {
        console.error("Error loading barang:", error);
    }
}

function formatNumber(input) {
    let value = input.replace(/[^\d]/g, '');
    let num = parseInt(value || 0);
    return num.toLocaleString('id-ID');
}

function parseFormattedNumber(formatted) {
    let cleanValue = formatted.replace(/[.,]/g, '');
    return parseInt(cleanValue || 0);
}

function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
}

hargaInput.addEventListener('input', function() {
    let cursorPosition = this.selectionStart;
    let originalLength = this.value.length;
    let formatted = formatNumber(this.value);
    this.value = formatted;
    let newLength = formatted.length;
    let cursorOffset = newLength - originalLength;
    this.setSelectionRange(cursorPosition + cursorOffset, cursorPosition + cursorOffset);
});

hargaInput.addEventListener('focus', function() {
    if (this.value) {
        this.value = this.value.replace(/[.,]/g, '');
    }
});

hargaInput.addEventListener('blur', function() {
    if (this.value.trim()) {
        this.value = formatNumber(this.value);
    }
});

btnTambahItem.addEventListener('click', () => {
    const barangId = barangSelect.value;
    const barangText = barangSelect.options[barangSelect.selectedIndex].text;
    const qty = parseInt(qtyInput.value) || 0;
    const harga = parseFormattedNumber(hargaInput.value) || 0;
    
    if (!barangId || qty <= 0 || harga <= 0) {
        showStatus('Harap isi barang, quantity, dan harga dengan benar.', 'error');
        return;
    }
    
    // Cek apakah barang sudah ada di daftar
    const existingItemIndex = selectedItems.findIndex(item => item.barangId === barangId);
    if (existingItemIndex !== -1) {
        // Update quantity jika barang sudah ada
        selectedItems[existingItemIndex].qty += qty;
        const updatedDPP = selectedItems[existingItemIndex].qty * selectedItems[existingItemIndex].harga;
        const updatedPPN = updatedDPP * 0.11;
        const updatedTotal = updatedDPP + updatedPPN;
        
        selectedItems[existingItemIndex].dpp = updatedDPP;
        selectedItems[existingItemIndex].ppn = updatedPPN;
        selectedItems[existingItemIndex].total = updatedTotal;
    } else {
        // Tambah barang baru
        const dpp = qty * harga;
        const ppn = dpp * 0.11;
        const total = dpp + ppn;
        
        const item = {
            id: Date.now(),
            barangId: barangId,
            barangText: barangText,
            qty: qty,
            harga: harga,
            dpp: dpp,
            ppn: ppn,
            total: total
        };
        
        selectedItems.push(item);
    }
    
    renderItems();
    calculateTotals();
    
    // Reset input
    qtyInput.value = 1;
    hargaInput.value = '';
    barangSelect.value = '';
});

function renderItems() {
    tableTransaksiBody.innerHTML = '';
    
    if (selectedItems.length === 0) {
        tableTransaksiBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 20px;">
                    Belum ada item yang ditambahkan.
                </td>
            </tr>
        `;
        return;
    }
    
    selectedItems.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.barangText}</td>
            <td>${item.qty}</td>
            <td class="number-cell">${formatRupiah(item.harga)}</td>
            <td class="number-cell">${formatRupiah(item.dpp)}</td>
            <td class="number-cell">${formatRupiah(item.ppn)}</td>
            <td class="number-cell">${formatRupiah(item.total)}</td>
            <td>
                <button class="btn-small btn-hapus" onclick="removeItem(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tableTransaksiBody.appendChild(row);
    });
}

window.removeItem = function(id) {
    selectedItems = selectedItems.filter(item => item.id !== id);
    renderItems();
    calculateTotals();
};

function calculateTotals() {
    let totalDPPValue = 0;
    let totalPPNValue = 0;
    let grandTotalValue = 0;
    
    selectedItems.forEach(item => {
        totalDPPValue += item.dpp;
        totalPPNValue += item.ppn;
        grandTotalValue += item.total;
    });
    
    totalDPP.textContent = formatRupiah(totalDPPValue);
    totalPPN.textContent = formatRupiah(totalPPNValue);
    grandTotal.textContent = formatRupiah(grandTotalValue);
    displayGrandTotal.textContent = formatRupiah(grandTotalValue);
    
    currentTransaksi.totalDPP = totalDPPValue;
    currentTransaksi.totalPPN = totalPPNValue;
    currentTransaksi.grandTotal = grandTotalValue;
}

// Fungsi untuk update stock barang
async function updateBarangStock(barangId, qty) {
    try {
        const barangRef = barangCollection.doc(barangId);
        const barangDoc = await barangRef.get();
        
        if (!barangDoc.exists) {
            console.error(`Barang dengan ID ${barangId} tidak ditemukan`);
            return false;
        }
        
        const barangData = barangDoc.data();
        const currentStock = barangData.stock || 0;
        const newStock = currentStock + qty;
        
        // Update stock di database
        await barangRef.update({
            stock: newStock,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Stock barang ${barangData.namaBarang} berhasil diupdate: ${currentStock} + ${qty} = ${newStock}`);
        return true;
        
    } catch (error) {
        console.error(`Error updating stock for barang ${barangId}:`, error);
        return false;
    }
}

btnSimpanTransaksi.addEventListener('click', async () => {
    if (!supplierSelect.value) {
        showStatus('Pilih supplier terlebih dahulu.', 'error');
        return;
    }
    
    if (selectedItems.length === 0) {
        showStatus('Tambahkan minimal satu item.', 'error');
        return;
    }
    
    // Tampilkan modal konfirmasi (popup)
    showConfirmationModal();
});

// Fungsi untuk menyimpan transaksi (dipanggil dari modal)
async function saveTransaction() {
    const transaksiData = {
        tanggal: tanggalInput.value,
        supplierId: supplierSelect.value,
        supplierName: supplierSelect.options[supplierSelect.selectedIndex].text,
        noFaktur: noFakturInput.value.trim(),
        items: selectedItems.map(item => ({
            barangId: item.barangId,
            barangText: item.barangText,
            qty: item.qty,
            harga: item.harga,
            dpp: item.dpp,
            ppn: item.ppn,
            total: item.total
        })),
        totalDPP: currentTransaksi.totalDPP,
        totalPPN: currentTransaksi.totalPPN,
        grandTotal: currentTransaksi.grandTotal,
        type: 'pembelian',
        status: 'belum lunas',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        // Mulai batch transaction
        const batch = db.batch();
        
        // Simpan transaksi
        const transaksiRef = transaksiCollection.doc();
        batch.set(transaksiRef, transaksiData);
        
        // Update stock untuk setiap barang yang dibeli
        const stockUpdates = [];
        for (const item of selectedItems) {
            const barangRef = barangCollection.doc(item.barangId);
            const barangDoc = await barangRef.get();
            
            if (barangDoc.exists) {
                const barangData = barangDoc.data();
                const currentStock = barangData.stock || 0;
                const newStock = currentStock + item.qty;
                
                batch.update(barangRef, {
                    stock: newStock,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                stockUpdates.push({
                    namaBarang: barangData.namaBarang,
                    qty: item.qty,
                    from: currentStock,
                    to: newStock
                });
            }
        }
        
        // Commit batch transaction
        await batch.commit();
        
        // Tampilkan status sukses
        showStatus('Transaksi berhasil disimpan dan stock barang diperbarui!', 'success');
        
        // Tampilkan detail update stock di console
        console.log('=== STOCK BARANG DIUPDATE ===');
        stockUpdates.forEach(update => {
            console.log(`${update.namaBarang}: ${update.from} + ${update.qty} = ${update.to}`);
        });
        console.log('==========================');
        
        resetTransaksi();
        
    } catch (error) {
        console.error("Error saving transaction:", error);
        showStatus('Gagal menyimpan transaksi.', 'error');
    }
}

btnReset.addEventListener('click', resetTransaksi);

function resetTransaksi() {
    selectedItems = [];
    renderItems();
    calculateTotals();
    supplierSelect.value = '';
    noFakturInput.value = '';
    selectedSupplierDisplay.textContent = '-';
    setupDate();
}

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + type;
    setTimeout(() => statusMessage.classList.add('show'), 10);
    setTimeout(() => statusMessage.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
});