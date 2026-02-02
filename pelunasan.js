const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDtb1r_QrrmkSxXPANzOPTB4Pkk-PGea9c",
    projectId: "crudmaster-61ff9",
};

let db;
let pelunasanCollection;
let supplierCollection;

const tanggalPelunasan = document.getElementById('tanggalPelunasan');
const supplierPelunasan = document.getElementById('supplierPelunasan');
const jumlahPelunasan = document.getElementById('jumlahPelunasan');
const keterangan = document.getElementById('keterangan');
const buktiPelunasan = document.getElementById('buktiPelunasan');
const btnSimpanPelunasan = document.getElementById('btnSimpanPelunasan');
const btnResetPelunasan = document.getElementById('btnResetPelunasan');
const tablePelunasanBody = document.getElementById('tablePelunasanBody');
const statusMessage = document.getElementById('statusMessage');

function initializeFirebase() {
    try {
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore(app);
        pelunasanCollection = db.collection('pelunasan');
        supplierCollection = db.collection('supplier');
        
        setupDate();
        loadSuppliers();
        loadPelunasanData();
        
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
    
    tanggalPelunasan.value = `${year}-${month}-${day}T${hours}:${minutes}`;
}

async function loadSuppliers() {
    try {
        const snapshot = await supplierCollection.orderBy('namaSupplier').get();
        supplierPelunasan.innerHTML = '<option value="">Pilih Supplier</option>';
        
        snapshot.forEach(doc => {
            const supplier = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${supplier.kodeSupplier} - ${supplier.namaSupplier}`;
            supplierPelunasan.appendChild(option);
        });
        
    } catch (error) {
        console.error("Error loading suppliers:", error);
    }
}

function loadPelunasanData() {
    pelunasanCollection.orderBy('tanggal', 'desc').onSnapshot((snapshot) => {
        tablePelunasanBody.innerHTML = '';
        
        if (snapshot.empty) {
            tablePelunasanBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 30px;">
                        Tidak ada data pelunasan.
                    </td>
                </tr>
            `;
            return;
        }
        
        snapshot.forEach((doc) => {
            const pelunasan = doc.data();
            const row = document.createElement('tr');
            
            const date = new Date(pelunasan.tanggal);
            const formattedDate = date.toLocaleDateString('id-ID') + ' ' + 
                                  date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${pelunasan.supplierName}</td>
                <td class="number-cell">${formatRupiah(pelunasan.jumlah)}</td>
                <td>${pelunasan.keterangan || '-'}</td>
                <td>${pelunasan.buktiPelunasan || '-'}</td>
            `;
            tablePelunasanBody.appendChild(row);
        });
    });
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

function setupNumberInput() {
    jumlahPelunasan.addEventListener('blur', function() {
        if (this.value.trim()) {
            this.value = formatNumber(this.value);
        }
    });
    
    jumlahPelunasan.addEventListener('input', function() {
        let cursorPosition = this.selectionStart;
        let originalLength = this.value.length;
        let formatted = formatNumber(this.value);
        this.value = formatted;
        let newLength = formatted.length;
        let cursorOffset = newLength - originalLength;
        this.setSelectionRange(cursorPosition + cursorOffset, cursorPosition + cursorOffset);
    });
    
    jumlahPelunasan.addEventListener('focus', function() {
        if (this.value) {
            this.value = this.value.replace(/[.,]/g, '');
        }
    });
}

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + type;
    setTimeout(() => statusMessage.classList.add('show'), 10);
    setTimeout(() => statusMessage.classList.remove('show'), 3000);
}

btnSimpanPelunasan.addEventListener('click', async () => {
    const supplierId = supplierPelunasan.value;
    const supplierName = supplierPelunasan.options[supplierPelunasan.selectedIndex].text;
    const jumlah = parseFormattedNumber(jumlahPelunasan.value.trim());
    
    if (!supplierId || jumlah <= 0) {
        showStatus('Harap pilih supplier dan isi jumlah dengan benar.', 'error');
        return;
    }
    
    const pelunasanData = {
        tanggal: tanggalPelunasan.value,
        supplierId: supplierId,
        supplierName: supplierName,
        jumlah: jumlah,
        keterangan: keterangan.value.trim(),
        buktiPelunasan: buktiPelunasan.value.trim(),
        type: 'pelunasan',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await pelunasanCollection.add(pelunasanData);
        showStatus('Pelunasan berhasil disimpan!', 'success');
        resetForm();
    } catch (error) {
        console.error("Error saving pelunasan:", error);
        showStatus('Gagal menyimpan pelunasan.', 'error');
    }
});

btnResetPelunasan.addEventListener('click', resetForm);

function resetForm() {
    supplierPelunasan.value = '';
    jumlahPelunasan.value = '';
    keterangan.value = '';
    buktiPelunasan.value = '';
    setupDate();
}

document.addEventListener('DOMContentLoaded', () => {
    setupNumberInput();
    initializeFirebase();
});