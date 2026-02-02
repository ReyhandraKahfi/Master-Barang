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

function initializeFirebase() {
    try {
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore(app);
        transaksiCollection = db.collection('transaksi');
        barangCollection = db.collection('barang');
        supplierCollection = db.collection('supplier');
        
        loadSuppliers();
        loadBarang();
        setupDate();
    } catch (error) {
        console.error("Error initializing Firebase:", error);
    }
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
            barangSelect.appendChild(option);
        });
        
        barangSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const harga = selectedOption.getAttribute('data-harga') || 0;
            hargaInput.value = formatNumber(String(harga));
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
    renderItems();
    calculateTotals();
    
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

btnSimpanTransaksi.addEventListener('click', async () => {
    if (!supplierSelect.value) {
        showStatus('Pilih supplier terlebih dahulu.', 'error');
        return;
    }
    
    if (selectedItems.length === 0) {
        showStatus('Tambahkan minimal satu item.', 'error');
        return;
    }
    
    const transaksiData = {
        tanggal: tanggalInput.value,
        supplierId: supplierSelect.value,
        supplierName: supplierSelect.options[supplierSelect.selectedIndex].text,
        noFaktur: noFakturInput.value.trim(),
        items: selectedItems,
        totalDPP: currentTransaksi.totalDPP,
        totalPPN: currentTransaksi.totalPPN,
        grandTotal: currentTransaksi.grandTotal,
        type: 'pembelian',
        status: 'belum lunas',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await transaksiCollection.add(transaksiData);
        
        // SALDO AWAL SUPPLIER TIDAK DIUPDATE DI SINI!
        // Saldo akan dihitung otomatis di kartu hutang
        
        showStatus('Transaksi berhasil disimpan!', 'success');
        resetTransaksi();
        
    } catch (error) {
        console.error("Error saving transaction:", error);
        showStatus('Gagal menyimpan transaksi.', 'error');
    }
});

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