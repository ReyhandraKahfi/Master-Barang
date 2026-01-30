// =============================================
// KONFIGURASI FIREBASE - ISI DENGAN DATA ANDA
// =============================================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDtb1r_QrrmkSxXPANzOPTB4Pkk-PGea9c", // Ganti dengan API Key Anda
    authDomain: "crudmaster-61ff9.firebaseapp.com",     // Ganti dengan Project ID Anda
    projectId: "crudmaster-61ff9",                      // Ganti dengan Project ID Anda
    storageBucket: "crudmaster-61ff9.firebasestorage.app",      // Akan otomatis terisi
    messagingSenderId: "925021563124",                 // Opsional
    appId: "1:925021563124:web:1f69d223e6e661cf7f16a1"           // Opsional
};
// =============================================

// Variabel global
let db;
let barangCollection;
let selectedBarangId = null;
let isEditing = false;
let isAddingNew = true; // Default mode adalah tambah baru
let selectedTableRow = null; // Untuk menyimpan baris yang dipilih
let statusTimeout = null; // Untuk mengatur timeout status message

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

// Menu Button
const menuToggle = document.getElementById('menuToggle');
const dropdownMenu = document.getElementById('dropdownMenu');

// Toggle dropdown menu
if (menuToggle && dropdownMenu) {
    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
    });
    
    // Tutup dropdown saat klik di luar
    document.addEventListener('click', () => {
        dropdownMenu.classList.remove('show');
    });
    
    // Jangan tutup dropdown saat klik di dalam
    dropdownMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Format angka dengan pemisah ribuan (1.000 atau 1,000)
function formatNumber(input) {
    // Hapus semua karakter non-digit
    let value = input.replace(/[^\d]/g, '');
    
    // Konversi ke number
    let num = parseInt(value || 0);
    
    // Format dengan pemisah ribuan
    return num.toLocaleString('id-ID');
}

// Parse angka dari format dengan pemisah
function parseFormattedNumber(formatted) {
    // Hapus semua titik atau koma (pemisah ribuan)
    let cleanValue = formatted.replace(/[.,]/g, '');
    
    // Konversi ke integer
    return parseInt(cleanValue || 0);
}

// Format ke Rupiah
function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
}

// Fungsi untuk kapitalisasi huruf pertama setiap kata
function capitalizeWords(text) {
    if (!text) return '';
    
    return text
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Event listener untuk kapitalisasi otomatis
function setupCapitalization() {
    [namaBarangInput, lokasiInput].forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value.trim()) {
                this.value = capitalizeWords(this.value);
            }
        });
        
        // Juga kapitalisasi saat input selesai
        input.addEventListener('change', function() {
            if (this.value.trim()) {
                this.value = capitalizeWords(this.value);
            }
        });
    });
}

// Cek apakah kode barang sudah ada di database
async function isKodeBarangExists(kodeBarang, excludeId = null) {
    try {
        const snapshot = await barangCollection.where('kodeBarang', '==', kodeBarang).get();
        
        if (snapshot.empty) {
            return false; // Kode belum ada
        }
        
        // Jika ada excludeId (saat edit), cek apakah dokumen yang ditemukan adalah dokumen yang sama
        if (excludeId) {
            let existsInOtherDoc = false;
            snapshot.forEach(doc => {
                if (doc.id !== excludeId) {
                    existsInOtherDoc = true;
                }
            });
            return existsInOtherDoc;
        }
        
        return true; // Kode sudah ada
    } catch (error) {
        console.error("Error checking kode barang:", error);
        return false; // Default to false jika error
    }
}

// Event listener untuk input angka dengan format otomatis
function setupNumberInputs() {
    [stockInput, hargaBeliInput].forEach(input => {
        // Format saat input kehilangan fokus
        input.addEventListener('blur', function() {
            if (this.value.trim()) {
                this.value = formatNumber(this.value);
            }
        });
        
        // Format saat pengguna mengetik
        input.addEventListener('input', function() {
            // Simpan posisi kursor
            let cursorPosition = this.selectionStart;
            let originalLength = this.value.length;
            
            // Format angka
            let formatted = formatNumber(this.value);
            this.value = formatted;
            
            // Atur ulang posisi kursor
            let newLength = formatted.length;
            let cursorOffset = newLength - originalLength;
            this.setSelectionRange(cursorPosition + cursorOffset, cursorPosition + cursorOffset);
            
            // Update status tombol
            updateButtonStatus();
        });
        
        // Saat input mendapatkan fokus, hapus format untuk memudahkan editing
        input.addEventListener('focus', function() {
            if (this.value) {
                this.value = this.value.replace(/[.,]/g, '');
            }
        });
    });
}

// Inisialisasi Firebase
function initializeFirebase() {
    try {
        // Perbarui konfigurasi otomatis
        if (!updateFirebaseConfig()) {
            showStatus('Silakan isi konfigurasi Firebase di file script.js', 'error');
            console.error("Konfigurasi Firebase tidak valid");
            return;
        }
        
        // Initialize Firebase
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore(app);
        barangCollection = db.collection('barang');
        
        // Muat data barang
        loadBarangData();
        
    } catch (error) {
        console.error("Error initializing Firebase: ", error);
        
        showStatus('Gagal menghubungkan Firebase. Periksa konfigurasi dan console untuk detail.', 'error');
    }
}

// Tampilkan status (FIXED - tidak menggeser konten)
function showStatus(message, type) {
    // Hapus timeout sebelumnya jika ada
    if (statusTimeout) {
        clearTimeout(statusTimeout);
    }
    
    // Update pesan dan tipe
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + type;
    
    // Tampilkan dengan animasi
    setTimeout(() => {
        statusMessage.classList.add('show');
    }, 10);
    
    // Sembunyikan setelah 3 detik
    statusTimeout = setTimeout(() => {
        statusMessage.classList.remove('show');
        statusTimeout = null;
    }, 3000);
}

// Muat data barang dari Firebase
function loadBarangData() {
    barangCollection.orderBy('kodeBarang').onSnapshot((snapshot) => {
        tableBody.innerHTML = '';
        
        if (snapshot.empty) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="7" style="text-align: center; padding: 30px;">
                    <i class="fas fa-box-open" style="font-size: 28px; color: #ccc; margin-bottom: 10px; display: block;"></i>
                    Tidak ada data barang.<br>
                    <small style="color: #666;">Klik "Tambah Barang" untuk menambah data baru</small>
                </td>
            `;
            tableBody.appendChild(row);
            return;
        }
        
        snapshot.forEach((doc) => {
            const barang = doc.data();
            const row = document.createElement('tr');
            row.setAttribute('data-id', doc.id);
            row.className = 'clickable-row';
            
            // Hitung total per barang (stock × harga)
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
            
            // Tambahkan event listener untuk klik baris
            row.addEventListener('click', () => {
                selectBarangFromTable(doc.id, row);
            });
            
            tableBody.appendChild(row);
        });
        
    }, (error) => {
        console.error("Error loading barang data: ", error);
        showStatus('Gagal memuat data barang: ' + error.message, 'error');
    });
}

// Pilih barang dari tabel
function selectBarangFromTable(docId, rowElement) {
    // Hapus seleksi dari baris sebelumnya
    if (selectedTableRow) {
        selectedTableRow.classList.remove('selected');
    }
    
    // Tambahkan seleksi ke baris yang diklik
    rowElement.classList.add('selected');
    selectedTableRow = rowElement;
    
    // Muat data barang ke form
    editBarang(docId);
}

// Reset form untuk mode tambah baru
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
    
    // Hapus seleksi dari tabel
    if (selectedTableRow) {
        selectedTableRow.classList.remove('selected');
        selectedTableRow = null;
    }
    
    // Update status tombol
    updateButtonStatus();
    
}

// Reset form untuk mode edit
function resetFormForEdit() {
    kodeBarangInput.disabled = false;
    
    selectedBarangId = null;
    isEditing = false;
    isAddingNew = false;
    
    // Hapus seleksi dari tabel
    if (selectedTableRow) {
        selectedTableRow.classList.remove('selected');
        selectedTableRow = null;
    }
    
    // Update status tombol
    updateButtonStatus();
}

// Validasi form
function validateForm() {
    const kodeBarang = kodeBarangInput.value.trim();
    const namaBarang = namaBarangInput.value.trim();
    const lokasi = lokasiInput.value.trim();
    const stock = parseFormattedNumber(stockInput.value.trim());
    const satuan = satuanInput.value.trim();
    const hargaBeli = parseFormattedNumber(hargaBeliInput.value.trim());
    
    return kodeBarang && namaBarang && lokasi && stock > 0 && satuan && hargaBeli > 0;
}

// Update status tombol berdasarkan validasi form
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

// Tambah barang baru (tombol Tambah Barang)
btnTambah.addEventListener('click', () => {
    resetFormForAdd();
});

// Simpan barang baru
btnSimpan.addEventListener('click', async () => {
    if (!validateForm()) {
        showStatus('Harap isi semua field dengan benar.', 'error');
        return;
    }
    
    if (!barangCollection) {
        showStatus('Firebase belum terhubung.', 'error');
        return;
    }
    
    const kodeBarang = kodeBarangInput.value.trim();
    const namaBarang = capitalizeWords(namaBarangInput.value.trim());
    const lokasi = capitalizeWords(lokasiInput.value.trim());
    
    // Cek kode barang hanya jika mode tambah baru
    if (isAddingNew) {
        const kodeExists = await isKodeBarangExists(kodeBarang);
        
        if (kodeExists) {
            showStatus('Kode barang sudah ada. Klik pada baris tabel untuk mengedit data.', 'error');
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
        // Tambahkan barang baru
        await barangCollection.add(barangData);
        
        showStatus('Barang berhasil ditambahkan!', 'success');
        resetFormForAdd();
        
    } catch (error) {
        console.error("Error adding barang: ", error);
        
        let errorMessage = 'Gagal menambahkan barang.';
        if (error.code === 'permission-denied') {
            errorMessage = 'Izin ditolak. Periksa aturan Firestore di Firebase Console.';
        }
        
        showStatus(errorMessage, 'error');
    }
});

// Edit barang yang dipilih
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
            
            kodeBarangInput.disabled = true; // Kode barang tidak bisa diubah saat edit
            selectedBarangId = id;
            isEditing = true;
            isAddingNew = false; // Bukan mode tambah baru
            
            // Update status tombol
            updateButtonStatus();
            
            showStatus('Barang dipilih. Klik Edit untuk mengubah atau Hapus untuk menghapus.', 'success');
        }
    }).catch((error) => {
        console.error("Error getting barang: ", error);
        showStatus('Gagal mengambil data barang.', 'error');
    });
}

// Simpan perubahan edit
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
        console.error("Error updating barang: ", error);
        showStatus('Gagal memperbarui barang.', 'error');
    }
});

// Tampilkan modal konfirmasi hapus
btnHapus.addEventListener('click', () => {
    if (!selectedBarangId) {
        showStatus('Pilih barang terlebih dahulu dengan mengklik baris di tabel.', 'error');
        return;
    }
    
    showDeleteModal(selectedBarangId);
});

// Sembunyikan modal konfirmasi hapus
function hideDeleteModal() {
    deleteModal.style.display = 'none';
    selectedBarangId = null;
}

// Hapus barang
btnConfirmDelete.addEventListener('click', async () => {
    if (!selectedBarangId) {
        hideDeleteModal();
        return;
    }
    
    try {
        await barangCollection.doc(selectedBarangId).delete();
        
        showStatus('Barang berhasil dihapus!', 'success');
        resetFormForEdit();
        hideDeleteModal();
    } catch (error) {
        console.error("Error deleting barang: ", error);
        showStatus('Gagal menghapus barang.', 'error');
        hideDeleteModal();
    }
});

// Batalkan hapus
btnCancelDelete.addEventListener('click', hideDeleteModal);

// Event listener untuk input form
const formInputs = [kodeBarangInput, namaBarangInput, lokasiInput, satuanInput];
formInputs.forEach(input => {
    input.addEventListener('input', updateButtonStatus);
});

// Event listener khusus untuk input angka (stock dan harga)
[stockInput, hargaBeliInput].forEach(input => {
    input.addEventListener('input', updateButtonStatus);
});

// Tutup modal jika klik di luar
window.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
        hideDeleteModal();
    }
});

// Inisialisasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    // Setup input angka dengan format otomatis
    setupNumberInputs();
    
    // Setup kapitalisasi otomatis
    setupCapitalization();
    
    // Inisialisasi Firebase
    initializeFirebase();
    
    // Reset form untuk mode tambah
    resetFormForAdd();
    
    // Tampilkan petunjuk jika konfigurasi masih default
    if (FIREBASE_CONFIG.apiKey.includes("xxxx") || FIREBASE_CONFIG.projectId === "your-project-id") {
        console.log("=============================================");
        console.log("PERHATIAN: Konfigurasi Firebase belum diisi!");
        console.log("Langkah-langkah:");
        console.log("1. Buka file script.js");
        console.log("2. Ganti apiKey dan projectId dengan data dari Firebase Console");
        console.log("3. Simpan file dan refresh halaman");
        console.log("=============================================");
    }
});

// Fungsi untuk menampilkan modal hapus (tetap ada untuk consistency)
function showDeleteModal(id) {
    selectedBarangId = id;
    deleteModal.style.display = 'flex';
}

// Fungsi untuk memperbarui konfigurasi otomatis
function updateFirebaseConfig() {
    if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.includes("xxxx")) {
        console.error("API Key belum diisi dengan benar");
        return false;
    }
    
    if (!FIREBASE_CONFIG.projectId || FIREBASE_CONFIG.projectId === "your-project-id") {
        console.error("Project ID belum diisi dengan benar");
        return false;
    }
    
    // Update konfigurasi lainnya secara otomatis
    FIREBASE_CONFIG.authDomain = `${FIREBASE_CONFIG.projectId}.firebaseapp.com`;
    FIREBASE_CONFIG.storageBucket = `${FIREBASE_CONFIG.projectId}.appspot.com`;
    FIREBASE_CONFIG.messagingSenderId = "000000000000";
    FIREBASE_CONFIG.appId = "1:000000000000:web:0000000000000000";
    
    return true;
}