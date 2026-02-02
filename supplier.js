// supplier.js - Perbaikan tampilan tanpa minus dan keterangan
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDtb1r_QrrmkSxXPANzOPTB4Pkk-PGea9c",
    projectId: "crudmaster-61ff9",
};

let db;
let supplierCollection;
let transaksiCollection;
let pelunasanCollection;
let selectedSupplierId = null;

const kodeSupplierInput = document.getElementById('kodeSupplier');
const namaSupplierInput = document.getElementById('namaSupplier');
const teleponInput = document.getElementById('telepon');
const alamatInput = document.getElementById('alamat');
const emailInput = document.getElementById('email');
const saldoAwalInput = document.getElementById('saldoAwal');

const btnTambahSupplier = document.getElementById('btnTambahSupplier');
const btnSimpanSupplier = document.getElementById('btnSimpanSupplier');
const btnEditSupplier = document.getElementById('btnEditSupplier');
const btnHapusSupplier = document.getElementById('btnHapusSupplier');

const tableSupplierBody = document.getElementById('tableSupplierBody');
const statusMessage = document.getElementById('statusMessage');

const deleteModalSupplier = document.getElementById('deleteModalSupplier');
const btnCancelDeleteSupplier = document.getElementById('btnCancelDeleteSupplier');
const btnConfirmDeleteSupplier = document.getElementById('btnConfirmDeleteSupplier');

function formatNumber(input) {
    let value = input.replace(/[^\d]/g, '');
    let num = parseInt(value || 0);
    return num.toLocaleString('id-ID');
}

function parseFormattedNumber(formatted) {
    let cleanValue = formatted.replace(/[.,]/g, '');
    return parseInt(cleanValue || 0);
}

function formatRupiahTanpaMinus(angka) {
    // Format angka tanpa minus
    const nilaiAbsolut = Math.abs(angka);
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(nilaiAbsolut);
}

function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
}

function setupNumberInputs() {
    saldoAwalInput.addEventListener('blur', function() {
        if (this.value.trim()) {
            this.value = formatNumber(this.value);
        }
    });
    
    saldoAwalInput.addEventListener('input', function() {
        let cursorPosition = this.selectionStart;
        let originalLength = this.value.length;
        let formatted = formatNumber(this.value);
        this.value = formatted;
        let newLength = formatted.length;
        let cursorOffset = newLength - originalLength;
        this.setSelectionRange(cursorPosition + cursorOffset, cursorPosition + cursorOffset);
        updateButtonStatus();
    });
    
    saldoAwalInput.addEventListener('focus', function() {
        if (this.value) {
            this.value = this.value.replace(/[.,]/g, '');
        }
    });
}

async function initializeFirebase() {
    try {
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore(app);
        supplierCollection = db.collection('supplier');
        transaksiCollection = db.collection('transaksi');
        pelunasanCollection = db.collection('pelunasan');
        loadSupplierData();
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        showStatus('Gagal menghubungkan Firebase.', 'error');
    }
}

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + type;
    setTimeout(() => statusMessage.classList.add('show'), 10);
    setTimeout(() => statusMessage.classList.remove('show'), 3000);
}

// Fungsi untuk menghitung total hutang supplier dengan RUMUS YANG BENAR:
// Saldo Akhir = Saldo Awal - Total Pembelian + Total Pelunasan
async function calculateTotalHutang(supplierId, saldoAwal) {
    try {
        // Hitung total pembelian (semua transaksi pembelian)
        const transaksiSnapshot = await transaksiCollection
            .where('supplierId', '==', supplierId)
            .where('type', '==', 'pembelian')
            .get();
        
        let totalPembelian = 0;
        transaksiSnapshot.forEach(doc => {
            const data = doc.data();
            totalPembelian += data.grandTotal || 0;
        });
        
        // Hitung total pelunasan (semua transaksi pelunasan)
        const pelunasanSnapshot = await pelunasanCollection
            .where('supplierId', '==', supplierId)
            .where('type', '==', 'pelunasan')
            .get();
        
        let totalPelunasan = 0;
        pelunasanSnapshot.forEach(doc => {
            const data = doc.data();
            totalPelunasan += data.jumlah || 0;
        });
        
        // PERHITUNGAN YANG BENAR:
        // Saldo Akhir Hutang = Saldo Awal - Total Pembelian + Total Pelunasan
        const saldoAkhir = (saldoAwal || 0) - totalPembelian + totalPelunasan;
        
        console.log(`Supplier ${supplierId}:`);
        console.log(`- Saldo Awal: ${formatRupiah(saldoAwal || 0)}`);
        console.log(`- Total Pembelian: ${formatRupiah(totalPembelian)}`);
        console.log(`- Total Pelunasan: ${formatRupiah(totalPelunasan)}`);
        console.log(`- Saldo Akhir: ${formatRupiah(saldoAkhir)}`);
        console.log(`- Rumus: ${saldoAwal} - ${totalPembelian} + ${totalPelunasan} = ${saldoAkhir}`);
        
        return {
            totalPembelian: totalPembelian,
            totalPelunasan: totalPelunasan,
            saldoAkhir: saldoAkhir
        };
    } catch (error) {
        console.error("Error calculating total hutang:", error);
        return {
            totalPembelian: 0,
            totalPelunasan: 0,
            saldoAkhir: saldoAwal || 0
        };
    }
}

function loadSupplierData() {
    supplierCollection.orderBy('kodeSupplier').onSnapshot(async (snapshot) => {
        tableSupplierBody.innerHTML = '';
        
        if (snapshot.empty) {
            tableSupplierBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 30px;">
                        Tidak ada data supplier.
                    </td>
                </tr>
            `;
            return;
        }
        
        // Gunakan Promise.all untuk menghitung semua hutang secara paralel
        const supplierPromises = [];
        const supplierData = [];
        
        snapshot.forEach((doc) => {
            const supplier = doc.data();
            supplierData.push({
                id: doc.id,
                ...supplier
            });
            
            // Tambahkan promise untuk menghitung hutang
            supplierPromises.push(calculateTotalHutang(doc.id, supplier.saldoAwal));
        });
        
        // Tunggu semua perhitungan selesai
        const hutangDataList = await Promise.all(supplierPromises);
        
        // Tampilkan data
        supplierData.forEach((supplier, index) => {
            const row = document.createElement('tr');
            row.setAttribute('data-id', supplier.id);
            row.className = 'clickable-row';
            
            const hutangData = hutangDataList[index];
            const saldoAkhir = hutangData.saldoAkhir;
            
            // Tentukan kelas CSS berdasarkan nilai saldo
            let hutangClass = '';
            
            if (saldoAkhir > 0) {
                hutangClass = 'saldo-positif';
            } else if (saldoAkhir < 0) {
                hutangClass = 'saldo-negatif';
            } else {
                hutangClass = 'saldo-nol';
            }
            
            // Tampilkan saldo akhir TANPA minus dan TANPA keterangan
            row.innerHTML = `
                <td>${supplier.kodeSupplier}</td>
                <td>${supplier.namaSupplier}</td>
                <td>${supplier.telepon || '-'}</td>
                <td>${supplier.alamat || '-'}</td>
                <td>${supplier.email || '-'}</td>
                <td class="number-cell">${formatRupiahTanpaMinus(supplier.saldoAwal || 0)}</td>
                <td class="number-cell ${hutangClass}">
                    ${formatRupiahTanpaMinus(saldoAkhir)}
                </td>
            `;
            
            // Tambahkan tooltip dengan detail perhitungan
            row.title = `Detail Perhitungan:
Saldo Awal: ${formatRupiah(supplier.saldoAwal || 0)}
Total Pembelian: ${formatRupiah(hutangData.totalPembelian)}
Total Pelunasan: ${formatRupiah(hutangData.totalPelunasan)}
--------------------------------
Saldo Akhir: ${formatRupiah(saldoAkhir)}
(Saldo Awal - Pembelian + Pelunasan)`;
            
            row.addEventListener('click', () => selectSupplierFromTable(supplier.id, row));
            tableSupplierBody.appendChild(row);
        });
    });
}

function selectSupplierFromTable(docId, rowElement) {
    if (selectedSupplierId) {
        const prevRow = document.querySelector(`tr[data-id="${selectedSupplierId}"]`);
        if (prevRow) prevRow.classList.remove('selected');
    }
    rowElement.classList.add('selected');
    selectedSupplierId = docId;
    editSupplier(docId);
}

function resetForm() {
    kodeSupplierInput.value = '';
    namaSupplierInput.value = '';
    teleponInput.value = '';
    alamatInput.value = '';
    emailInput.value = '';
    saldoAwalInput.value = '';
    
    kodeSupplierInput.disabled = false;
    selectedSupplierId = null;
    
    updateButtonStatus();
}

function validateForm() {
    return kodeSupplierInput.value.trim() && 
           namaSupplierInput.value.trim();
}

function updateButtonStatus() {
    const isValid = validateForm();
    btnSimpanSupplier.disabled = !isValid;
    btnEditSupplier.disabled = !isValid || !selectedSupplierId;
    btnHapusSupplier.disabled = !selectedSupplierId;
}

function editSupplier(id) {
    supplierCollection.doc(id).get().then((doc) => {
        if (doc.exists) {
            const supplier = doc.data();
            kodeSupplierInput.value = supplier.kodeSupplier;
            namaSupplierInput.value = supplier.namaSupplier;
            teleponInput.value = supplier.telepon || '';
            alamatInput.value = supplier.alamat || '';
            emailInput.value = supplier.email || '';
            saldoAwalInput.value = formatNumber(String(supplier.saldoAwal || 0));
            
            kodeSupplierInput.disabled = true;
            selectedSupplierId = id;
            updateButtonStatus();
        }
    });
}

btnTambahSupplier.addEventListener('click', resetForm);

btnSimpanSupplier.addEventListener('click', async () => {
    if (!validateForm()) {
        showStatus('Harap isi semua field yang wajib.', 'error');
        return;
    }
    
    const kodeSupplier = kodeSupplierInput.value.trim();
    const namaSupplier = namaSupplierInput.value.trim();
    
    const snapshot = await supplierCollection.where('kodeSupplier', '==', kodeSupplier).get();
    if (!snapshot.empty) {
        showStatus('Kode supplier sudah ada.', 'error');
        return;
    }
    
    const supplierData = {
        kodeSupplier: kodeSupplier,
        namaSupplier: namaSupplier,
        telepon: teleponInput.value.trim(),
        alamat: alamatInput.value.trim(),
        email: emailInput.value.trim(),
        saldoAwal: parseFormattedNumber(saldoAwalInput.value.trim()) || 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await supplierCollection.add(supplierData);
        showStatus('Supplier berhasil ditambahkan!', 'success');
        resetForm();
    } catch (error) {
        console.error("Error adding supplier:", error);
        showStatus('Gagal menambahkan supplier.', 'error');
    }
});

btnEditSupplier.addEventListener('click', async () => {
    if (!validateForm() || !selectedSupplierId) {
        showStatus('Harap lengkapi data.', 'error');
        return;
    }
    
    const updatedData = {
        namaSupplier: namaSupplierInput.value.trim(),
        telepon: teleponInput.value.trim(),
        alamat: alamatInput.value.trim(),
        email: emailInput.value.trim(),
        saldoAwal: parseFormattedNumber(saldoAwalInput.value.trim()) || 0,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await supplierCollection.doc(selectedSupplierId).update(updatedData);
        showStatus('Supplier berhasil diperbarui!', 'success');
        resetForm();
    } catch (error) {
        console.error("Error updating supplier:", error);
        showStatus('Gagal memperbarui supplier.', 'error');
    }
});

btnHapusSupplier.addEventListener('click', () => {
    if (!selectedSupplierId) return;
    deleteModalSupplier.style.display = 'flex';
});

btnConfirmDeleteSupplier.addEventListener('click', async () => {
    if (!selectedSupplierId) return;
    
    try {
        // Cek apakah supplier memiliki transaksi
        const transaksiSnapshot = await transaksiCollection
            .where('supplierId', '==', selectedSupplierId)
            .get();
        
        if (!transaksiSnapshot.empty) {
            showStatus('Tidak dapat menghapus supplier yang memiliki transaksi.', 'error');
            deleteModalSupplier.style.display = 'none';
            return;
        }
        
        await supplierCollection.doc(selectedSupplierId).delete();
        showStatus('Supplier berhasil dihapus!', 'success');
        resetForm();
        deleteModalSupplier.style.display = 'none';
    } catch (error) {
        console.error("Error deleting supplier:", error);
        showStatus('Gagal menghapus supplier.', 'error');
        deleteModalSupplier.style.display = 'none';
    }
});

btnCancelDeleteSupplier.addEventListener('click', () => {
    deleteModalSupplier.style.display = 'none';
});

document.addEventListener('DOMContentLoaded', () => {
    setupNumberInputs();
    initializeFirebase();
    
    const inputs = [kodeSupplierInput, namaSupplierInput, saldoAwalInput];
    inputs.forEach(input => input.addEventListener('input', updateButtonStatus));
});