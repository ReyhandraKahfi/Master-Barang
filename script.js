// =============================================
// KONFIGURASI FIREBASE
// =============================================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDtb1r_QrrmkSxXPANzOPTB4Pkk-PGea9c",
    authDomain: "crudmaster-61ff9.firebaseapp.com",
    projectId: "crudmaster-61ff9",
    storageBucket: "crudmaster-61ff9.firebasestorage.app",
    messagingSenderId: "925021563124",
    appId: "1:925021563124:web:1f69d223e6e661cf7f16a1"
};

let db;
let barangCollection;
let selectedBarangId = null;
let isEditing = false;
let isAddingNew = true;
let selectedTableRow = null;
let statusTimeout = null;

// Elemen DOM
const kodeBarangInput = document.getElementById('kodeBarang');
const namaBarangInput = document.getElementById('namaBarang');
const lokasiInput = document.getElementById('lokasi');
const stockInput = document.getElementById('stock');
const satuanInput = document.getElementById('satuan');
const hargaBeliInput = document.getElementById('hargaBeli');

const btnTambah = document.getElementById('btnTambah');
const btnSimpan = document.getElementById('btnSimpan');
const btnEdit = document.getElementById('btnEdit');
const btnHapus = document.getElementById('btnHapus');

const tableBody = document.getElementById('tableBody');
const statusMessage = document.getElementById('statusMessage');

const deleteModal = document.getElementById('deleteModal');
const btnCancelDelete = document.getElementById('btnCancelDelete');
const btnConfirmDelete = document.getElementById('btnConfirmDelete');

// Format angka
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

function capitalizeWords(text) {
    if (!text) return '';
    return text.toLowerCase().split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function setupCapitalization() {
    [namaBarangInput, lokasiInput].forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value.trim()) {
                this.value = capitalizeWords(this.value);
            }
        });
    });
}

async function isKodeBarangExists(kodeBarang, excludeId = null) {
    try {
        const snapshot = await barangCollection.where('kodeBarang', '==', kodeBarang).get();
        if (snapshot.empty) return false;
        if (excludeId) {
            let existsInOtherDoc = false;
            snapshot.forEach(doc => {
                if (doc.id !== excludeId) existsInOtherDoc = true;
            });
            return existsInOtherDoc;
        }
        return true;
    } catch (error) {
        console.error("Error checking kode barang:", error);
        return false;
    }
}

function setupNumberInputs() {
    [stockInput, hargaBeliInput].forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value.trim()) {
                this.value = formatNumber(this.value);
            }
        });
        
        input.addEventListener('input', function() {
            let cursorPosition = this.selectionStart;
            let originalLength = this.value.length;
            let formatted = formatNumber(this.value);
            this.value = formatted;
            let newLength = formatted.length;
            let cursorOffset = newLength - originalLength;
            this.setSelectionRange(cursorPosition + cursorOffset, cursorPosition + cursorOffset);
            updateButtonStatus();
        });
        
        input.addEventListener('focus', function() {
            if (this.value) {
                this.value = this.value.replace(/[.,]/g, '');
            }
        });
    });
}

function initializeFirebase() {
    try {
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore(app);
        barangCollection = db.collection('barang');
        loadBarangData();
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        showStatus('Gagal menghubungkan Firebase.', 'error');
    }
}

function showStatus(message, type) {
    if (statusTimeout) clearTimeout(statusTimeout);
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + type;
    setTimeout(() => statusMessage.classList.add('show'), 10);
    statusTimeout = setTimeout(() => {
        statusMessage.classList.remove('show');
        statusTimeout = null;
    }, 3000);
}

function loadBarangData() {
    barangCollection.orderBy('kodeBarang').onSnapshot((snapshot) => {
        tableBody.innerHTML = '';
        
        if (snapshot.empty) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 30px;">
                        Tidak ada data barang.
                    </td>
                </tr>
            `;
            return;
        }
        
        snapshot.forEach((doc) => {
            const barang = doc.data();
            const row = document.createElement('tr');
            row.setAttribute('data-id', doc.id);
            row.className = 'clickable-row';
            
            const stock = parseInt(barang.stock) || 0;
            const harga = parseInt(barang.hargaBeli) || 0;
            const totalPerBarang = stock * harga;
            
            row.innerHTML = `
                <td>${barang.kodeBarang}</td>
                <td>${barang.namaBarang}</td>
                <td>${barang.lokasi}</td>
                <td class="number-cell">${stock.toLocaleString('id-ID')}</td>
                <td>${barang.satuan}</td>
                <td class="number-cell">${formatRupiah(harga)}</td>
                <td class="total-cell">${formatRupiah(totalPerBarang)}</td>
            `;
            
            row.addEventListener('click', () => selectBarangFromTable(doc.id, row));
            tableBody.appendChild(row);
        });
    }, (error) => {
        console.error("Error loading barang data:", error);
        showStatus('Gagal memuat data barang.', 'error');
    });
}

function selectBarangFromTable(docId, rowElement) {
    if (selectedTableRow) selectedTableRow.classList.remove('selected');
    rowElement.classList.add('selected');
    selectedTableRow = rowElement;
    editBarang(docId);
}

function resetFormForAdd() {
    kodeBarangInput.value = '';
    namaBarangInput.value = '';
    lokasiInput.value = '';
    stockInput.value = '';
    satuanInput.value = '';
    hargaBeliInput.value = '';
    
    kodeBarangInput.disabled = false;
    kodeBarangInput.focus();
    
    selectedBarangId = null;
    isEditing = false;
    isAddingNew = true;
    
    if (selectedTableRow) {
        selectedTableRow.classList.remove('selected');
        selectedTableRow = null;
    }
    
    updateButtonStatus();
}

function resetFormForEdit() {
    kodeBarangInput.disabled = false;
    selectedBarangId = null;
    isEditing = false;
    isAddingNew = false;
    
    if (selectedTableRow) {
        selectedTableRow.classList.remove('selected');
        selectedTableRow = null;
    }
    
    updateButtonStatus();
}

function validateForm() {
    const kodeBarang = kodeBarangInput.value.trim();
    const namaBarang = namaBarangInput.value.trim();
    const lokasi = lokasiInput.value.trim();
    const stock = parseFormattedNumber(stockInput.value.trim());
    const satuan = satuanInput.value.trim();
    const hargaBeli = parseFormattedNumber(hargaBeliInput.value.trim());
    
    return kodeBarang && namaBarang && lokasi && stock >= 0 && satuan && hargaBeli >= 0;
}

function updateButtonStatus() {
    const isValid = validateForm();
    
    if (isEditing) {
        btnTambah.disabled = false;
        btnSimpan.disabled = true;
        btnEdit.disabled = !isValid;
        btnHapus.disabled = false;
    } else {
        btnTambah.disabled = false;
        btnSimpan.disabled = !isValid;
        btnEdit.disabled = true;
        btnHapus.disabled = true;
    }
}

btnTambah.addEventListener('click', resetFormForAdd);

btnSimpan.addEventListener('click', async () => {
    if (!validateForm()) {
        showStatus('Harap isi semua field dengan benar.', 'error');
        return;
    }
    
    const kodeBarang = kodeBarangInput.value.trim();
    const namaBarang = capitalizeWords(namaBarangInput.value.trim());
    const lokasi = capitalizeWords(lokasiInput.value.trim());
    
    if (isAddingNew) {
        const kodeExists = await isKodeBarangExists(kodeBarang);
        if (kodeExists) {
            showStatus('Kode barang sudah ada.', 'error');
            return;
        }
    }
    
    const barangData = {
        kodeBarang: kodeBarang,
        namaBarang: namaBarang,
        lokasi: lokasi,
        stock: parseFormattedNumber(stockInput.value.trim()),
        satuan: satuanInput.value.trim(),
        hargaBeli: parseFormattedNumber(hargaBeliInput.value.trim()),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await barangCollection.add(barangData);
        showStatus('Barang berhasil ditambahkan!', 'success');
        resetFormForAdd();
    } catch (error) {
        console.error("Error adding barang:", error);
        showStatus('Gagal menambahkan barang.', 'error');
    }
});

function editBarang(id) {
    barangCollection.doc(id).get().then((doc) => {
        if (doc.exists) {
            const barang = doc.data();
            kodeBarangInput.value = barang.kodeBarang;
            namaBarangInput.value = barang.namaBarang;
            lokasiInput.value = barang.lokasi;
            stockInput.value = barang.stock.toLocaleString('id-ID');
            satuanInput.value = barang.satuan;
            hargaBeliInput.value = barang.hargaBeli.toLocaleString('id-ID');
            
            kodeBarangInput.disabled = true;
            selectedBarangId = id;
            isEditing = true;
            isAddingNew = false;
            
            updateButtonStatus();
            showStatus('Barang dipilih. Klik Edit untuk mengubah.', 'success');
        }
    }).catch((error) => {
        console.error("Error getting barang:", error);
        showStatus('Gagal mengambil data barang.', 'error');
    });
}

btnEdit.addEventListener('click', async () => {
    if (!validateForm() || !selectedBarangId) {
        showStatus('Harap isi semua field dengan benar.', 'error');
        return;
    }
    
    const updatedData = {
        namaBarang: capitalizeWords(namaBarangInput.value.trim()),
        lokasi: capitalizeWords(lokasiInput.value.trim()),
        stock: parseFormattedNumber(stockInput.value.trim()),
        satuan: satuanInput.value.trim(),
        hargaBeli: parseFormattedNumber(hargaBeliInput.value.trim()),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await barangCollection.doc(selectedBarangId).update(updatedData);
        showStatus('Barang berhasil diperbarui!', 'success');
        resetFormForEdit();
    } catch (error) {
        console.error("Error updating barang:", error);
        showStatus('Gagal memperbarui barang.', 'error');
    }
});

btnHapus.addEventListener('click', () => {
    if (!selectedBarangId) {
        showStatus('Pilih barang terlebih dahulu.', 'error');
        return;
    }
    deleteModal.style.display = 'flex';
});

btnConfirmDelete.addEventListener('click', async () => {
    if (!selectedBarangId) return;
    
    try {
        await barangCollection.doc(selectedBarangId).delete();
        showStatus('Barang berhasil dihapus!', 'success');
        resetFormForEdit();
        deleteModal.style.display = 'none';
    } catch (error) {
        console.error("Error deleting barang:", error);
        showStatus('Gagal menghapus barang.', 'error');
        deleteModal.style.display = 'none';
    }
});

btnCancelDelete.addEventListener('click', () => {
    deleteModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
        deleteModal.style.display = 'none';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    setupNumberInputs();
    setupCapitalization();
    initializeFirebase();
    resetFormForAdd();
    
    const formInputs = [kodeBarangInput, namaBarangInput, lokasiInput, satuanInput];
    formInputs.forEach(input => input.addEventListener('input', updateButtonStatus));
    
    [stockInput, hargaBeliInput].forEach(input => input.addEventListener('input', updateButtonStatus));
});