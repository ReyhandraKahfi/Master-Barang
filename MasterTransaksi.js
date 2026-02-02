const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDtb1r_QrrmkSxXPANzOPTB4Pkk-PGea9c",
    projectId: "crudmaster-61ff9",
};

let db;
let transaksiCollection;
let barangCollection;
let supplierCollection;

let allTransaksi = [];
let filteredTransaksi = [];
let allBarang = [];
let allSuppliers = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentTransaksiId = null;
let editItems = [];
let originalTransaksiItems = []; // Untuk menyimpan data asli sebelum edit

// DOM Elements
const loadingIndicator = document.getElementById('loadingIndicator');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const tableMasterTransaksi = document.getElementById('tableMasterTransaksi');
const tableMasterTransaksiBody = document.getElementById('tableMasterTransaksiBody');
const btnRefresh = document.getElementById('btnRefresh');
const btnResetFilter = document.getElementById('btnResetFilter');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const pageInfo = document.getElementById('pageInfo');

// Filter Elements
const filterTanggalDari = document.getElementById('filterTanggalDari');
const filterTanggalSampai = document.getElementById('filterTanggalSampai');
const filterSupplier = document.getElementById('filterSupplier');
const filterSearch = document.getElementById('filterSearch');

// Summary Elements
const totalTransaksi = document.getElementById('totalTransaksi');
const totalPembelian = document.getElementById('totalPembelian');
const totalBarang = document.getElementById('totalBarang');
const totalSupplier = document.getElementById('totalSupplier');

// Modals
const detailModal = document.getElementById('detailModal');
const editModal = document.getElementById('editModal');
const deleteModal = document.getElementById('deleteModal');

// Edit Modal Elements
const editItemsContainer = document.getElementById('editItemsContainer');
const btnTambahItemEdit = document.getElementById('btnTambahItemEdit');

// Status Message
const statusMessage = document.getElementById('statusMessage');

function initializeFirebase() {
    try {
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore(app);
        transaksiCollection = db.collection('transaksi');
        barangCollection = db.collection('barang');
        supplierCollection = db.collection('supplier');
        
        loadSuppliersForFilter();
        loadBarangData();
        loadTransaksi();
        setupEventListeners();
        setupDateFilters();
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        showError("Gagal menginisialisasi database");
    }
}

function setupDateFilters() {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    filterTanggalDari.valueAsDate = firstDayOfMonth;
    filterTanggalSampai.valueAsDate = today;
}

async function loadSuppliersForFilter() {
    try {
        const snapshot = await supplierCollection.orderBy('namaSupplier').get();
        filterSupplier.innerHTML = '<option value="">Semua Supplier</option>';
        
        allSuppliers = [];
        snapshot.forEach(doc => {
            const supplier = { id: doc.id, ...doc.data() };
            allSuppliers.push(supplier);
            
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${supplier.kodeSupplier} - ${supplier.namaSupplier}`;
            filterSupplier.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading suppliers:", error);
    }
}

async function loadBarangData() {
    try {
        const snapshot = await barangCollection.orderBy('namaBarang').get();
        allBarang = [];
        snapshot.forEach(doc => {
            const barang = { id: doc.id, ...doc.data() };
            allBarang.push(barang);
        });
    } catch (error) {
        console.error("Error loading barang data:", error);
    }
}

async function loadTransaksi() {
    try {
        showLoading(true);
        
        const snapshot = await transaksiCollection
            .orderBy('createdAt', 'desc')
            .get();
        
        allTransaksi = [];
        snapshot.forEach(doc => {
            const transaksi = {
                id: doc.id,
                ...doc.data()
            };
            allTransaksi.push(transaksi);
        });
        
        applyFilters();
        
    } catch (error) {
        console.error("Error loading transactions:", error);
        showError("Gagal memuat data transaksi");
    } finally {
        showLoading(false);
    }
}

function applyFilters() {
    const tanggalDari = filterTanggalDari.value ? new Date(filterTanggalDari.value) : null;
    const tanggalSampai = filterTanggalSampai.value ? new Date(filterTanggalSampai.value) : null;
    const supplierId = filterSupplier.value;
    const searchText = filterSearch.value.toLowerCase().trim();
    
    filteredTransaksi = allTransaksi.filter(transaksi => {
        // Filter tanggal
        if (tanggalDari || tanggalSampai) {
            const transaksiDate = new Date(transaksi.tanggal);
            
            if (tanggalDari && transaksiDate < tanggalDari) return false;
            if (tanggalSampai) {
                const endOfDay = new Date(tanggalSampai);
                endOfDay.setHours(23, 59, 59, 999);
                if (transaksiDate > endOfDay) return false;
            }
        }
        
        // Filter supplier
        if (supplierId && transaksi.supplierId !== supplierId) return false;
        
        // Search by invoice number
        if (searchText) {
            const invoiceNo = (transaksi.noFaktur || '').toLowerCase();
            if (!invoiceNo.includes(searchText)) return false;
        }
        
        return true;
    });
    
    updateSummary();
    renderTable();
}

function updateSummary() {
    const total = filteredTransaksi.length;
    
    let totalPembelianValue = 0;
    let totalBarangValue = 0;
    const uniqueSuppliers = new Set();
    
    filteredTransaksi.forEach(transaksi => {
        totalPembelianValue += transaksi.grandTotal || 0;
        
        if (transaksi.items) {
            totalBarangValue += transaksi.items.reduce((sum, item) => sum + item.qty, 0);
        }
        
        if (transaksi.supplierId) {
            uniqueSuppliers.add(transaksi.supplierId);
        }
    });
    
    totalTransaksi.textContent = total;
    totalPembelian.textContent = formatRupiah(totalPembelianValue);
    totalBarang.textContent = totalBarangValue;
    totalSupplier.textContent = uniqueSuppliers.size;
}

function renderTable() {
    if (filteredTransaksi.length === 0) {
        tableMasterTransaksi.style.display = 'none';
        emptyState.style.display = 'block';
        errorState.style.display = 'none';
        document.getElementById('pagination').style.display = 'none';
        return;
    }
    
    tableMasterTransaksi.style.display = 'table';
    emptyState.style.display = 'none';
    errorState.style.display = 'none';
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredTransaksi.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredTransaksi.length);
    const pageTransaksi = filteredTransaksi.slice(startIndex, endIndex);
    
    // Render table rows
    tableMasterTransaksiBody.innerHTML = '';
    
    pageTransaksi.forEach((transaksi, index) => {
        const rowIndex = startIndex + index + 1;
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${rowIndex}</td>
            <td>${formatDateTime(transaksi.tanggal)}</td>
            <td><strong>${transaksi.noFaktur || '-'}</strong></td>
            <td>${transaksi.supplierName || getSupplierName(transaksi.supplierId)}</td>
            <td>${transaksi.items ? transaksi.items.length : 0} item</td>
            <td class="number-cell">${formatRupiah(transaksi.totalDPP || 0)}</td>
            <td class="number-cell">${formatRupiah(transaksi.totalPPN || 0)}</td>
            <td class="number-cell"><strong>${formatRupiah(transaksi.grandTotal || 0)}</strong></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-view" onclick="showDetail('${transaksi.id}')" title="Lihat Detail">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-action btn-edit" onclick="showEditModal('${transaksi.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="showDeleteModal('${transaksi.id}')" title="Hapus">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tableMasterTransaksiBody.appendChild(row);
    });
    
    // Update pagination
    updatePagination(totalPages);
}

function updatePagination(totalPages) {
    const pagination = document.getElementById('pagination');
    pagination.style.display = 'flex';
    
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages;
    
    pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages}`;
}

function getSupplierName(supplierId) {
    const supplier = allSuppliers.find(s => s.id === supplierId);
    return supplier ? `${supplier.kodeSupplier} - ${supplier.namaSupplier}` : 'Supplier tidak ditemukan';
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID');
}

function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
}

function showLoading(show) {
    if (show) {
        loadingIndicator.style.display = 'block';
        tableMasterTransaksi.style.display = 'none';
        emptyState.style.display = 'none';
        errorState.style.display = 'none';
    } else {
        loadingIndicator.style.display = 'none';
    }
}

function showError(message) {
    loadingIndicator.style.display = 'none';
    tableMasterTransaksi.style.display = 'none';
    emptyState.style.display = 'none';
    errorState.style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + type;
    setTimeout(() => statusMessage.classList.add('show'), 10);
    setTimeout(() => statusMessage.classList.remove('show'), 3000);
}

// Modal Functions
async function showDetail(transaksiId) {
    try {
        const transaksiDoc = await transaksiCollection.doc(transaksiId).get();
        if (!transaksiDoc.exists) {
            showStatus('Transaksi tidak ditemukan', 'error');
            return;
        }
        
        const transaksi = transaksiDoc.data();
        
        // Update modal content
        document.getElementById('detailNoFaktur').textContent = transaksi.noFaktur || '-';
        document.getElementById('detailTanggal').textContent = formatDateTime(transaksi.tanggal);
        document.getElementById('detailSupplier').textContent = transaksi.supplierName;
        document.getElementById('detailTotalDPP').textContent = formatRupiah(transaksi.totalDPP || 0);
        document.getElementById('detailTotalPPN').textContent = formatRupiah(transaksi.totalPPN || 0);
        document.getElementById('detailGrandTotal').textContent = formatRupiah(transaksi.grandTotal || 0);
        
        // Render items
        const detailItemsBody = document.getElementById('detailItemsBody');
        detailItemsBody.innerHTML = '';
        
        let totalDPP = 0;
        let totalPPN = 0;
        let totalGrand = 0;
        
        if (transaksi.items && transaksi.items.length > 0) {
            transaksi.items.forEach((item, index) => {
                totalDPP += item.dpp || 0;
                totalPPN += item.ppn || 0;
                totalGrand += item.total || 0;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${item.barangText}</td>
                    <td>${item.qty}</td>
                    <td class="number-cell">${formatRupiah(item.harga)}</td>
                    <td class="number-cell">${formatRupiah(item.dpp)}</td>
                    <td class="number-cell">${formatRupiah(item.ppn)}</td>
                    <td class="number-cell">${formatRupiah(item.total)}</td>
                `;
                detailItemsBody.appendChild(row);
            });
        }
        
        // Update footer totals
        document.getElementById('detailFooterDPP').textContent = formatRupiah(totalDPP);
        document.getElementById('detailFooterPPN').textContent = formatRupiah(totalPPN);
        document.getElementById('detailFooterTotal').textContent = formatRupiah(totalGrand);
        
        detailModal.style.display = 'flex';
        
    } catch (error) {
        console.error("Error loading transaction detail:", error);
        showStatus('Gagal memuat detail transaksi', 'error');
    }
}

async function showEditModal(transaksiId) {
    try {
        const transaksiDoc = await transaksiCollection.doc(transaksiId).get();
        if (!transaksiDoc.exists) {
            showStatus('Transaksi tidak ditemukan', 'error');
            return;
        }
        
        const transaksi = transaksiDoc.data();
        currentTransaksiId = transaksiId;
        
        // Simpan data asli sebelum edit
        originalTransaksiItems = JSON.parse(JSON.stringify(transaksi.items || []));
        editItems = JSON.parse(JSON.stringify(transaksi.items || []));
        
        // Set modal fields
        document.getElementById('editNoFaktur').value = transaksi.noFaktur || '';
        
        // Format datetime for input
        const date = new Date(transaksi.tanggal);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        document.getElementById('editTanggal').value = `${year}-${month}-${day}T${hours}:${minutes}`;
        
        // Load suppliers dropdown
        const editSupplierSelect = document.getElementById('editSupplier');
        editSupplierSelect.innerHTML = '<option value="">Pilih Supplier</option>';
        allSuppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.id;
            option.textContent = `${supplier.kodeSupplier} - ${supplier.namaSupplier}`;
            if (supplier.id === transaksi.supplierId) {
                option.selected = true;
            }
            editSupplierSelect.appendChild(option);
        });
        
        // Render edit items
        renderEditItems();
        
        editModal.style.display = 'flex';
        
    } catch (error) {
        console.error("Error loading transaction for edit:", error);
        showStatus('Gagal memuat data transaksi', 'error');
    }
}

function renderEditItems() {
    editItemsContainer.innerHTML = '';
    
    editItems.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'edit-item';
        itemDiv.innerHTML = `
            <div class="form-group edit-item-select">
                <select class="edit-barang-select" data-index="${index}" required>
                    <option value="">Pilih Barang</option>
                </select>
            </div>
            <div class="form-group edit-item-qty">
                <input type="number" class="edit-barang-qty" data-index="${index}" 
                       value="${item.qty}" min="1" required placeholder="Qty">
            </div>
            <div class="form-group edit-item-harga">
                <input type="text" class="edit-barang-harga number-input" 
                       data-index="${index}" value="${formatRupiahInput(item.harga)}" 
                       placeholder="Harga" required>
            </div>
            <div class="edit-item-remove">
                <button type="button" class="btn-remove-item" onclick="removeEditItem(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        editItemsContainer.appendChild(itemDiv);
        
        // Populate barang dropdown
        const select = itemDiv.querySelector('.edit-barang-select');
        populateBarangDropdown(select, item.barangId, item.qty);
    });
    
    // Setup event listeners for new items
    setupEditItemListeners();
}

function populateBarangDropdown(select, selectedBarangId = '', currentQty = 0) {
    allBarang.forEach(barang => {
        const option = document.createElement('option');
        option.value = barang.id;
        
        // Cek apakah barang ini sedang diedit
        const isCurrentlySelected = barang.id === selectedBarangId;
        const stock = barang.stock || 0;
        
        // Tampilkan stock yang benar: stock saat ini - jumlah yang sedang diedit (karena masih di stock)
        // Saat edit, item sudah ada di stock, jadi untuk validasi kita kurangi
        let availableStock = stock;
        if (isCurrentlySelected) {
            availableStock = stock - currentQty; // Karena currentQty sudah ada di stock
        }
        
        option.textContent = `${barang.kodeBarang} - ${barang.namaBarang} (Stock: ${stock})`;
        option.setAttribute('data-harga', barang.hargaBeli || 0);
        option.setAttribute('data-stock', stock);
        
        if (barang.id === selectedBarangId) {
            option.selected = true;
        }
        select.appendChild(option);
    });
    
    // Add change listener for harga auto-fill
    select.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        const harga = selectedOption.getAttribute('data-harga') || 0;
        const index = this.getAttribute('data-index');
        const hargaInput = document.querySelector(`.edit-barang-harga[data-index="${index}"]`);
        if (hargaInput) {
            hargaInput.value = formatNumber(String(harga));
        }
    });
}

function formatRupiahInput(angka) {
    return formatNumber(String(angka));
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

function addEditItem() {
    const newItem = {
        barangId: '',
        barangText: '',
        qty: 1,
        harga: 0,
        dpp: 0,
        ppn: 0,
        total: 0
    };
    
    editItems.push(newItem);
    renderEditItems();
}

function removeEditItem(index) {
    if (editItems.length <= 1) {
        showStatus('Transaksi harus memiliki minimal 1 item', 'error');
        return;
    }
    
    editItems.splice(index, 1);
    renderEditItems();
}

function setupEditItemListeners() {
    // Setup number formatting for harga inputs
    document.querySelectorAll('.edit-barang-harga').forEach(input => {
        input.addEventListener('input', function() {
            let cursorPosition = this.selectionStart;
            let originalLength = this.value.length;
            let formatted = formatNumber(this.value);
            this.value = formatted;
            let newLength = formatted.length;
            let cursorOffset = newLength - originalLength;
            this.setSelectionRange(cursorPosition + cursorOffset, cursorPosition + cursorOffset);
        });
    });
}

async function calculateStockDifference(originalItems, newItems) {
    const stockUpdates = [];
    
    // Analisis perubahan per barang
    const itemMap = new Map();
    
    // Hitung total dari original items
    originalItems.forEach(item => {
        if (item.barangId) {
            if (!itemMap.has(item.barangId)) {
                itemMap.set(item.barangId, { originalQty: 0, newQty: 0 });
            }
            itemMap.get(item.barangId).originalQty += item.qty;
        }
    });
    
    // Hitung total dari new items
    newItems.forEach(item => {
        if (item.barangId) {
            if (!itemMap.has(item.barangId)) {
                itemMap.set(item.barangId, { originalQty: 0, newQty: 0 });
            }
            itemMap.get(item.barangId).newQty += item.qty;
        }
    });
    
    // Hitung perbedaan stock
    itemMap.forEach((value, barangId) => {
        const difference = value.newQty - value.originalQty;
        if (difference !== 0) {
            stockUpdates.push({
                barangId: barangId,
                difference: difference, // positif = tambah stock, negatif = kurangi stock
                originalQty: value.originalQty,
                newQty: value.newQty
            });
        }
    });
    
    return stockUpdates;
}

async function saveEdit() {
    try {
        const noFaktur = document.getElementById('editNoFaktur').value.trim();
        const tanggal = document.getElementById('editTanggal').value;
        const supplierId = document.getElementById('editSupplier').value;
        
        // Validasi input
        if (!noFaktur) {
            showStatus('No. Faktur harus diisi', 'error');
            return;
        }
        
        if (!tanggal) {
            showStatus('Tanggal harus diisi', 'error');
            return;
        }
        
        if (!supplierId) {
            showStatus('Supplier harus dipilih', 'error');
            return;
        }
        
        // Validasi items
        const validItems = [];
        let totalDPP = 0;
        let totalPPN = 0;
        let grandTotal = 0;
        
        for (let i = 0; i < editItems.length; i++) {
            const select = document.querySelector(`.edit-barang-select[data-index="${i}"]`);
            const qtyInput = document.querySelector(`.edit-barang-qty[data-index="${i}"]`);
            const hargaInput = document.querySelector(`.edit-barang-harga[data-index="${i}"]`);
            
            const barangId = select.value;
            const qty = parseInt(qtyInput.value) || 0;
            const harga = parseFormattedNumber(hargaInput.value) || 0;
            
            if (!barangId || qty <= 0 || harga <= 0) {
                showStatus(`Item ${i + 1} tidak valid. Harap periksa barang, qty, dan harga`, 'error');
                return;
            }
            
            const barang = allBarang.find(b => b.id === barangId);
            if (!barang) {
                showStatus(`Barang pada item ${i + 1} tidak ditemukan`, 'error');
                return;
            }
            
            const dpp = qty * harga;
            const ppn = dpp * 0.11;
            const total = dpp + ppn;
            
            validItems.push({
                barangId: barangId,
                barangText: `${barang.kodeBarang} - ${barang.namaBarang}`,
                qty: qty,
                harga: harga,
                dpp: dpp,
                ppn: ppn,
                total: total
            });
            
            totalDPP += dpp;
            totalPPN += ppn;
            grandTotal += total;
        }
        
        if (validItems.length === 0) {
            showStatus('Transaksi harus memiliki minimal 1 item', 'error');
            return;
        }
        
        // Get supplier name
        const supplier = allSuppliers.find(s => s.id === supplierId);
        const supplierName = supplier ? `${supplier.kodeSupplier} - ${supplier.namaSupplier}` : '';
        
        // Prepare update data
        const updateData = {
            noFaktur: noFaktur,
            tanggal: tanggal,
            supplierId: supplierId,
            supplierName: supplierName,
            items: validItems,
            totalDPP: totalDPP,
            totalPPN: totalPPN,
            grandTotal: grandTotal,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Hitung perbedaan stock antara data lama dan baru
        const stockDifferences = await calculateStockDifference(originalTransaksiItems, validItems);
        
        // Mulai batch transaction untuk update stock
        const batch = db.batch();
        
        // Update transaksi
        const transaksiRef = transaksiCollection.doc(currentTransaksiId);
        batch.update(transaksiRef, updateData);
        
        // Update stock untuk setiap barang yang berubah
        for (const diff of stockDifferences) {
            const barangRef = barangCollection.doc(diff.barangId);
            
            // Ambil data barang terbaru
            const barangDoc = await barangRef.get();
            if (barangDoc.exists) {
                const barangData = barangDoc.data();
                const currentStock = barangData.stock || 0;
                
                // Update stock: currentStock + difference
                // Jika difference positif (newQty > oldQty): stock bertambah
                // Jika difference negatif (newQty < oldQty): stock berkurang
                const newStock = currentStock + diff.difference;
                
                if (newStock < 0) {
                    const barang = allBarang.find(b => b.id === diff.barangId);
                    const barangName = barang ? barang.namaBarang : diff.barangId;
                    showStatus(`Stock tidak mencukupi untuk ${barangName}. Stock saat ini: ${currentStock}, pengurangan: ${Math.abs(diff.difference)}`, 'error');
                    return;
                }
                
                batch.update(barangRef, {
                    stock: newStock,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                console.log(`Update stock barang: ${barangData.namaBarang}`);
                console.log(`Current stock: ${currentStock}`);
                console.log(`Difference: ${diff.difference} (old: ${diff.originalQty}, new: ${diff.newQty})`);
                console.log(`New stock: ${newStock}`);
            }
        }
        
        // Commit batch transaction
        await batch.commit();
        
        showStatus('Transaksi berhasil diperbarui', 'success');
        editModal.style.display = 'none';
        
        // Refresh data barang dan transaksi
        await loadBarangData();
        await loadTransaksi();
        
    } catch (error) {
        console.error("Error updating transaction:", error);
        showStatus('Gagal memperbarui transaksi: ' + error.message, 'error');
    }
}

async function showDeleteModal(transaksiId) {
    try {
        const transaksiDoc = await transaksiCollection.doc(transaksiId).get();
        if (!transaksiDoc.exists) {
            showStatus('Transaksi tidak ditemukan', 'error');
            return;
        }
        
        const transaksi = transaksiDoc.data();
        currentTransaksiId = transaksiId;
        
        // Update modal content
        document.getElementById('deleteNoFaktur').textContent = transaksi.noFaktur || '-';
        document.getElementById('deleteSupplier').textContent = transaksi.supplierName;
        document.getElementById('deleteGrandTotal').textContent = formatRupiah(transaksi.grandTotal || 0);
        
        deleteModal.style.display = 'flex';
        
    } catch (error) {
        console.error("Error loading transaction for delete:", error);
        showStatus('Gagal memuat data transaksi', 'error');
    }
}

async function deleteTransaksi() {
    try {
        // Get transaction data first
        const transaksiDoc = await transaksiCollection.doc(currentTransaksiId).get();
        if (!transaksiDoc.exists) {
            showStatus('Transaksi tidak ditemukan', 'error');
            return;
        }
        
        const transaksi = transaksiDoc.data();
        
        // Start batch transaction
        const batch = db.batch();
        
        // Delete the transaction
        batch.delete(transaksiCollection.doc(currentTransaksiId));
        
        // Update stock for each item (kurangi stock karena menghapus transaksi pembelian)
        if (transaksi.items && transaksi.items.length > 0) {
            for (const item of transaksi.items) {
                const barangRef = barangCollection.doc(item.barangId);
                const barangDoc = await barangRef.get();
                
                if (barangDoc.exists) {
                    const barangData = barangDoc.data();
                    const currentStock = barangData.stock || 0;
                    const newStock = Math.max(0, currentStock - item.qty); // Kurangi karena menghapus pembelian
                    
                    batch.update(barangRef, {
                        stock: newStock,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    console.log(`Kurangi stock barang: ${barangData.namaBarang}`);
                    console.log(`Current stock: ${currentStock}, Kurangi: ${item.qty}, New stock: ${newStock}`);
                }
            }
        }
        
        // Commit batch transaction
        await batch.commit();
        
        showStatus('Transaksi berhasil dihapus dan stock barang diperbarui', 'success');
        deleteModal.style.display = 'none';
        
        // Refresh data
        await loadBarangData();
        await loadTransaksi();
        
    } catch (error) {
        console.error("Error deleting transaction:", error);
        showStatus('Gagal menghapus transaksi', 'error');
    }
}

function setupEventListeners() {
    // Refresh button
    btnRefresh.addEventListener('click', () => {
        loadBarangData();
        loadTransaksi();
    });
    
    // Filter otomatis saat input berubah
    filterTanggalDari.addEventListener('change', () => {
        currentPage = 1;
        applyFilters();
    });
    
    filterTanggalSampai.addEventListener('change', () => {
        currentPage = 1;
        applyFilters();
    });
    
    filterSupplier.addEventListener('change', () => {
        currentPage = 1;
        applyFilters();
    });
    
    btnResetFilter.addEventListener('click', () => {
        filterSupplier.value = '';
        filterSearch.value = '';
        setupDateFilters();
        currentPage = 1;
        applyFilters();
    });
    
    // Real-time search
    filterSearch.addEventListener('input', () => {
        currentPage = 1;
        applyFilters();
    });
    
    // Pagination
    btnPrev.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });
    
    btnNext.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredTransaksi.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });
    
    // Add item button in edit modal
    btnTambahItemEdit.addEventListener('click', addEditItem);
    
    // Modal close buttons
    document.getElementById('btnCloseDetail').addEventListener('click', () => {
        detailModal.style.display = 'none';
    });
    
    document.getElementById('btnCloseModalDetail').addEventListener('click', () => {
        detailModal.style.display = 'none';
    });
    
    document.getElementById('btnCloseEdit').addEventListener('click', () => {
        editModal.style.display = 'none';
    });
    
    document.getElementById('btnCancelEdit').addEventListener('click', () => {
        editModal.style.display = 'none';
    });
    
    document.getElementById('btnSaveEdit').addEventListener('click', saveEdit);
    
    document.getElementById('btnCloseDelete').addEventListener('click', () => {
        deleteModal.style.display = 'none';
    });
    
    document.getElementById('btnCancelDelete').addEventListener('click', () => {
        deleteModal.style.display = 'none';
    });
    
    document.getElementById('btnConfirmDelete').addEventListener('click', deleteTransaksi);
    
    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === detailModal) {
            detailModal.style.display = 'none';
        }
        if (event.target === editModal) {
            editModal.style.display = 'none';
        }
        if (event.target === deleteModal) {
            deleteModal.style.display = 'none';
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            detailModal.style.display = 'none';
            editModal.style.display = 'none';
            deleteModal.style.display = 'none';
        }
    });
}

// Make functions available globally
window.showDetail = showDetail;
window.showEditModal = showEditModal;
window.showDeleteModal = showDeleteModal;
window.removeEditItem = removeEditItem;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeFirebase);