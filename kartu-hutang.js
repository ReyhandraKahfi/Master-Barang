// kartu-hutang.js - Menampilkan nama barang dari barangText
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDtb1r_QrrmkSxXPANzOPTB4Pkk-PGea9c",
    projectId: "crudmaster-61ff9",
};

let db;
let transaksiCollection;
let supplierCollection;
let pelunasanCollection;

const filterSupplier = document.getElementById('filterSupplier');
const startDate = document.getElementById('startDate');
const endDate = document.getElementById('endDate');
const btnFilter = document.getElementById('btnFilter');
const excelContainer = document.getElementById('excelContainer');

function initializeFirebase() {
    try {
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore(app);
        transaksiCollection = db.collection('transaksi');
        supplierCollection = db.collection('supplier');
        pelunasanCollection = db.collection('pelunasan');
        
        loadSuppliers();
        setupDefaultDates();
        loadKartuHutang();
        
        btnFilter.addEventListener('click', loadKartuHutang);
        
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        showStatus('Error menginisialisasi Firebase', 'error');
    }
}

function setupDefaultDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    startDate.value = firstDay.toISOString().split('T')[0];
    endDate.value = lastDay.toISOString().split('T')[0];
}

async function loadSuppliers() {
    try {
        const snapshot = await supplierCollection.orderBy('namaSupplier').get();
        
        snapshot.forEach(doc => {
            const supplier = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${supplier.kodeSupplier} - ${supplier.namaSupplier}`;
            filterSupplier.appendChild(option);
        });
        
    } catch (error) {
        console.error("Error loading suppliers:", error);
        showStatus('Error memuat data supplier', 'error');
    }
}

function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
}

function formatRupiahTanpaMinus(angka) {
    const nilaiAbsolut = Math.abs(angka);
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(nilaiAbsolut);
}

function formatTanggalExcel(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function formatAngka(angka) {
    return angka.toLocaleString('id-ID');
}

async function loadKartuHutang() {
    try {
        console.log('Memulai load kartu hutang...');
        console.log('Supplier filter:', filterSupplier.value);
        console.log('Periode:', startDate.value, 's.d', endDate.value);
        
        excelContainer.innerHTML = '<div class="loading">Memuat data kartu hutang...</div>';
        
        // Ambil semua supplier atau supplier tertentu
        let supplierQuery = supplierCollection;
        if (filterSupplier.value) {
            supplierQuery = supplierQuery.where(firebase.firestore.FieldPath.documentId(), '==', filterSupplier.value);
        }
        
        const supplierSnapshot = await supplierQuery.get();
        
        console.log('Jumlah supplier ditemukan:', supplierSnapshot.size);
        
        if (supplierSnapshot.empty) {
            excelContainer.innerHTML = '<div class="empty-state">Tidak ada data supplier.</div>';
            return;
        }
        
        // Buat kartu hutang untuk setiap supplier
        excelContainer.innerHTML = '';
        
        for (const supplierDoc of supplierSnapshot.docs) {
            const supplier = supplierDoc.data();
            const supplierId = supplierDoc.id;
            
            console.log(`Memproses supplier: ${supplier.namaSupplier} (${supplierId})`);
            
            // Buat query untuk transaksi pembelian
            let transaksiQuery = transaksiCollection
                .where('supplierId', '==', supplierId)
                .where('type', '==', 'pembelian');
            
            if (startDate.value && endDate.value) {
                const startTimestamp = new Date(startDate.value + 'T00:00:00');
                const endTimestamp = new Date(endDate.value + 'T23:59:59');
                
                transaksiQuery = transaksiQuery.where('tanggal', '>=', startTimestamp.toISOString())
                    .where('tanggal', '<=', endTimestamp.toISOString());
            }
            
            let transaksiSnapshot;
            try {
                transaksiSnapshot = await transaksiQuery.orderBy('tanggal').get();
                console.log(`Jumlah transaksi pembelian untuk ${supplier.namaSupplier}:`, transaksiSnapshot.size);
            } catch (error) {
                console.error(`Error query transaksi untuk supplier ${supplier.namaSupplier}:`, error);
                const allTransaksi = await transaksiCollection
                    .where('type', '==', 'pembelian')
                    .orderBy('tanggal')
                    .get();
                
                transaksiSnapshot = {
                    docs: allTransaksi.docs.filter(doc => {
                        const data = doc.data();
                        return data.supplierId === supplierId;
                    }),
                    forEach: function(callback) {
                        this.docs.forEach(callback);
                    },
                    empty: this.docs.length === 0
                };
            }
            
            // Buat query untuk pelunasan
            let pelunasanQuery = pelunasanCollection
                .where('supplierId', '==', supplierId);
            
            if (startDate.value && endDate.value) {
                const startTimestamp = new Date(startDate.value + 'T00:00:00');
                const endTimestamp = new Date(endDate.value + 'T23:59:59');
                
                pelunasanQuery = pelunasanQuery.where('tanggal', '>=', startTimestamp.toISOString())
                    .where('tanggal', '<=', endTimestamp.toISOString());
            }
            
            let pelunasanSnapshot;
            try {
                pelunasanSnapshot = await pelunasanQuery.orderBy('tanggal').get();
                console.log(`Jumlah pelunasan untuk ${supplier.namaSupplier}:`, pelunasanSnapshot.size);
            } catch (error) {
                console.error(`Error query pelunasan untuk supplier ${supplier.namaSupplier}:`, error);
                const allPelunasan = await pelunasanCollection.orderBy('tanggal').get();
                
                pelunasanSnapshot = {
                    docs: allPelunasan.docs.filter(doc => {
                        const data = doc.data();
                        return data.supplierId === supplierId;
                    }),
                    forEach: function(callback) {
                        this.docs.forEach(callback);
                    },
                    empty: this.docs.length === 0
                };
            }
            
            // Gabungkan dan sortir transaksi
            const semuaTransaksi = [];
            
            transaksiSnapshot.forEach(doc => {
                const data = doc.data();
                console.log('Transaksi ditemukan:', data);
                
                const items = data.items || [];
                
                semuaTransaksi.push({
                    id: doc.id,
                    tanggal: data.tanggal,
                    type: 'pembelian',
                    noFaktur: data.noFaktur || '',
                    items: items,
                    totalDPP: data.totalDPP || 0,
                    totalPPN: data.totalPPN || 0,
                    grandTotal: data.grandTotal || 0,
                    saldo: 0
                });
            });
            
            pelunasanSnapshot.forEach(doc => {
                const data = doc.data();
                console.log('Pelunasan ditemukan:', data);
                
                semuaTransaksi.push({
                    id: doc.id,
                    tanggal: data.tanggal,
                    type: 'pelunasan',
                    keterangan: data.keterangan || 'Pelunasan Hutang',
                    jumlah: data.jumlah || 0,
                    saldo: 0
                });
            });
            
            // Sortir berdasarkan tanggal
            semuaTransaksi.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
            
            console.log(`Total transaksi untuk ${supplier.namaSupplier}:`, semuaTransaksi.length);
            
            // Buat kartu hutang untuk supplier ini
            const kartuHutang = createKartuHutangExcel(supplier, semuaTransaksi);
            excelContainer.appendChild(kartuHutang);
        }
        
        if (excelContainer.innerHTML === '') {
            excelContainer.innerHTML = '<div class="empty-state">Tidak ada data transaksi untuk periode dan supplier yang dipilih.</div>';
        }
        
    } catch (error) {
        console.error("Error loading kartu hutang:", error);
        excelContainer.innerHTML = '<div class="error">Gagal memuat data kartu hutang. Error: ' + error.message + '</div>';
    }
}

function createKartuHutangExcel(supplier, transaksiList) {
    const container = document.createElement('div');
    container.className = 'excel-kartu-container';
    
    console.log('Membuat kartu hutang untuk:', supplier.namaSupplier);
    console.log('Jumlah transaksi:', transaksiList.length);
    
    // PERHITUNGAN SALDO
    const saldoAwal = supplier.saldoAwal || 0;
    let totalPembelian = 0;
    let totalPelunasan = 0;
    let totalDPP = 0;
    let totalPPN = 0;
    let totalUnit = 0;
    
    const saldoPerBaris = [saldoAwal];
    
    // Urutkan transaksi berdasarkan tanggal
    transaksiList.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
    
    // Hitung saldo untuk setiap transaksi
    transaksiList.forEach((transaksi, index) => {
        if (transaksi.type === 'pembelian') {
            totalPembelian += transaksi.grandTotal || 0;
            totalDPP += (transaksi.totalDPP || 0);
            totalPPN += (transaksi.totalPPN || 0);
            
            // Hitung saldo setelah pembelian
            const saldoSebelum = saldoPerBaris[saldoPerBaris.length - 1];
            const saldoSetelah = saldoSebelum - (transaksi.grandTotal || 0);
            saldoPerBaris.push(saldoSetelah);
            
            // Simpan saldo di transaksi untuk ditampilkan
            transaksi.saldo = saldoSetelah;
            
            // Hitung total unit
            if (transaksi.items && Array.isArray(transaksi.items)) {
                transaksi.items.forEach(item => {
                    totalUnit += (item.qty || 0);
                });
            }
        } else if (transaksi.type === 'pelunasan') {
            totalPelunasan += transaksi.jumlah || 0;
            
            // Hitung saldo setelah pelunasan
            const saldoSebelum = saldoPerBaris[saldoPerBaris.length - 1];
            const saldoSetelah = saldoSebelum + (transaksi.jumlah || 0);
            saldoPerBaris.push(saldoSetelah);
            
            // Simpan saldo di transaksi untuk ditampilkan
            transaksi.saldo = saldoSetelah;
        }
    });
    
    // Saldo akhir adalah nilai terakhir di array
    const saldoAkhir = saldoPerBaris[saldoPerBaris.length - 1];
    
    console.log('=== PERHITUNGAN SALDO ===');
    console.log('Supplier:', supplier.namaSupplier);
    console.log('Saldo Awal:', formatRupiah(saldoAwal));
    console.log('Total Pembelian:', formatRupiah(totalPembelian));
    console.log('Total Pelunasan:', formatRupiah(totalPelunasan));
    console.log('Saldo Akhir:', formatRupiah(saldoAkhir));
    console.log('Rumus:', saldoAwal, '-', totalPembelian, '+', totalPelunasan, '=', saldoAkhir);
    console.log('==================');
    
    // Header Kartu Hutang
    const header = document.createElement('div');
    header.className = 'excel-header';
    header.innerHTML = `
        <div class="excel-title">HALAMAN KARTU HUTANG</div>
        <div class="excel-supplier">${supplier.namaSupplier} (${supplier.kodeSupplier})</div>
        <div class="excel-periode">PERIODE: ${formatTanggalExcel(startDate.value)} s.d ${formatTanggalExcel(endDate.value)}</div>
    `;
    
    // Tabel Detail Transaksi (Bagian Kiri)
    const tableLeft = document.createElement('table');
    tableLeft.className = 'excel-table left-table';
    tableLeft.innerHTML = `
        <thead>
            <tr>
                <th colspan="9" class="table-title">DETAIL TRANSAKSI</th>
            </tr>
            <tr class="column-headers">
                <th rowspan="2">TANGGAL</th>
                <th rowspan="2">KETERANGAN</th>
                <th colspan="3">PEMBELIAN</th>
                <th rowspan="2">PELUNASAN</th>
                <th rowspan="2">SALDO</th>
            </tr>
            <tr class="sub-headers">
                <th>UNIT</th>
                <th>@HARGA</th>
                <th>DPP</th>
                <th>PPN</th>
                <th>TOTAL</th>
            </tr>
        </thead>
        <tbody id="detailBody">
            <!-- Baris saldo awal -->
            <tr class="saldo-awal-row">
                <td>${formatTanggalExcel(startDate.value)}</td>
                <td><strong>SALDO AWAL</strong></td>
                <td class="number-cell"></td>
                <td class="number-cell"></td>
                <td class="number-cell"></td>
                <td class="number-cell"></td>
                <td class="number-cell"></td>
                <td class="number-cell"></td>
                <td class="number-cell"><strong>${formatRupiahTanpaMinus(saldoAwal)}</strong></td>
            </tr>
        </tbody>
        <tfoot>
            <tr class="total-row">
                <td colspan="2"><strong>TOTAL</strong></td>
                <td class="number-cell"><strong>${formatAngka(totalUnit)}</strong></td>
                <td class="number-cell"></td>
                <td class="number-cell"><strong>${formatRupiahTanpaMinus(totalDPP)}</strong></td>
                <td class="number-cell"><strong>${formatRupiahTanpaMinus(totalPPN)}</strong></td>
                <td class="number-cell"><strong>${formatRupiahTanpaMinus(totalPembelian)}</strong></td>
                <td class="number-cell"><strong>${formatRupiahTanpaMinus(totalPelunasan)}</strong></td>
                <td id="saldoAkhir" class="number-cell"><strong>${formatRupiahTanpaMinus(saldoAkhir)}</strong></td>
            </tr>
        </tfoot>
    `;
    
    const detailBody = tableLeft.querySelector('#detailBody');
    
    // Tambahkan transaksi ke tabel
    transaksiList.forEach(transaksi => {
        if (transaksi.type === 'pembelian') {
            const items = transaksi.items || [];
            
            items.forEach((item, index) => {
                const row = document.createElement('tr');
                row.className = 'transaksi-row pembelian-row';
                
                const tanggalCell = index === 0 ? formatTanggalExcel(transaksi.tanggal) : '';
                
                // PERUBAHAN: Gunakan barangText jika ada, jika tidak gunakan fallback
                let keteranganCell = '';
                if (index === 0) {
                    // Baris pertama: Tampilkan "PEMBELIAN - [NO FAKTUR]" dengan nama barang pertama
                    const firstItemName = items.length > 0 && items[0].barangText ? 
                        items[0].barangText.split(' - ')[1] || items[0].barangText : 
                        'Barang';
                    keteranganCell = `PEMBELIAN - ${transaksi.noFaktur || 'Tanpa Faktur'} (${firstItemName})`;
                } else {
                    // Baris selanjutnya: Tampilkan nama barang dari barangText
                    keteranganCell = item.barangText || `Barang ${index + 1}`;
                }
                
                // Format nama barang: ambil hanya nama jika format "000001 - Besi Baja"
                if (item.barangText && item.barangText.includes(' - ')) {
                    const parts = item.barangText.split(' - ');
                    if (parts.length > 1) {
                        keteranganCell = parts[1]; // Ambil "Besi Baja"
                    }
                }
                
                row.innerHTML = `
                    <td>${tanggalCell}</td>
                    <td>${keteranganCell}</td>
                    <td class="number-cell">${formatAngka(item.qty || 0)}</td>
                    <td class="number-cell">${formatRupiahTanpaMinus(item.harga || 0)}</td>
                    <td class="number-cell">${formatRupiahTanpaMinus(item.dpp || 0)}</td>
                    <td class="number-cell">${formatRupiahTanpaMinus(item.ppn || 0)}</td>
                    <td class="number-cell">${formatRupiahTanpaMinus(item.total || 0)}</td>
                    <td class="number-cell"></td>
                    <td class="number-cell">${formatRupiahTanpaMinus(transaksi.saldo || 0)}</td>
                `;
                detailBody.appendChild(row);
            });
            
            // Jika tidak ada items, tampilkan summary saja
            if (items.length === 0) {
                const row = document.createElement('tr');
                row.className = 'transaksi-row pembelian-row';
                
                row.innerHTML = `
                    <td>${formatTanggalExcel(transaksi.tanggal)}</td>
                    <td>PEMBELIAN - ${transaksi.noFaktur || 'Tanpa Faktur'}</td>
                    <td class="number-cell"></td>
                    <td class="number-cell"></td>
                    <td class="number-cell">${formatRupiahTanpaMinus(transaksi.totalDPP || 0)}</td>
                    <td class="number-cell">${formatRupiahTanpaMinus(transaksi.totalPPN || 0)}</td>
                    <td class="number-cell">${formatRupiahTanpaMinus(transaksi.grandTotal || 0)}</td>
                    <td class="number-cell"></td>
                    <td class="number-cell">${formatRupiahTanpaMinus(transaksi.saldo || 0)}</td>
                `;
                detailBody.appendChild(row);
            }
            
        } else if (transaksi.type === 'pelunasan') {
            const row = document.createElement('tr');
            row.className = 'transaksi-row pelunasan-row';
            
            row.innerHTML = `
                <td>${formatTanggalExcel(transaksi.tanggal)}</td>
                <td>PELUNASAN - ${transaksi.keterangan || ''}</td>
                <td class="number-cell"></td>
                <td class="number-cell"></td>
                <td class="number-cell"></td>
                <td class="number-cell"></td>
                <td class="number-cell"></td>
                <td class="number-cell">${formatRupiahTanpaMinus(transaksi.jumlah)}</td>
                <td class="number-cell">${formatRupiahTanpaMinus(transaksi.saldo || 0)}</td>
            `;
            detailBody.appendChild(row);
        }
    });
    
    // Update saldo akhir
    tableLeft.querySelector('#saldoAkhir').textContent = formatRupiahTanpaMinus(saldoAkhir);
    
    // Container untuk tabel
    const tablesContainer = document.createElement('div');
    tablesContainer.className = 'excel-tables-container';
    
    const leftContainer = document.createElement('div');
    leftContainer.className = 'excel-left-container';
    leftContainer.appendChild(tableLeft);
    
    tablesContainer.appendChild(leftContainer);
    
    // Tombol aksi dengan urutan yang benar
    const actionButtons = document.createElement('div');
    actionButtons.className = 'excel-action-buttons';
    actionButtons.innerHTML = `
        <button class="btn btn-export-excel" onclick="exportToExcel()">
            <i class="fas fa-file-excel"></i> Export ke Excel
        </button>
        <button class="btn btn-print-excel" onclick="printExcelKartuHutang()">
            <i class="fas fa-print"></i> Cetak Kartu Hutang
        </button>
    `;
    
    container.appendChild(header);
    container.appendChild(tablesContainer);
    container.appendChild(actionButtons);
    
    return container;
}

// Fungsi untuk export ke Excel
window.exportToExcel = function() {
    const supplierName = filterSupplier.options[filterSupplier.selectedIndex]?.text || 'SemuaSupplier';
    const fileName = `Kartu-Hutang-${supplierName}-${startDate.value}-${endDate.value}`.replace(/[^a-zA-Z0-9-]/g, '_');
    
    const kartuElements = excelContainer.querySelectorAll('.excel-kartu-container');
    
    let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${fileName}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .excel-kartu-container { margin-bottom: 30px; page-break-after: always; }
                .excel-header { text-align: center; margin-bottom: 20px; }
                .excel-title { font-size: 16px; font-weight: bold; text-decoration: underline; }
                .excel-supplier { font-size: 14px; font-weight: bold; }
                .excel-periode { font-size: 12px; color: #666; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 15px; }
                th, td { border: 1px solid #000; padding: 4px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
                .number-cell { text-align: right; font-family: 'Courier New', monospace; }
                .table-title { background-color: #d9e1f2; color: #000; }
                .total-row { background-color: #f2f2f2; font-weight: bold; }
                .pelunasan-row { background-color: #e8f5e8; }
                .saldo-awal-row { background-color: #f0f0f0; }
                @media print {
                    .excel-kartu-container { page-break-inside: avoid; }
                    @page { size: landscape; }
                }
            </style>
        </head>
        <body>
            <h1>KARTU HUTANG</h1>
            <h3>Periode: ${startDate.value} s.d ${endDate.value}</h3>
    `;
    
    kartuElements.forEach((kartu, index) => {
        htmlContent += kartu.outerHTML;
    });
    
    htmlContent += '</body></html>';
    
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Fungsi untuk mencetak kartu hutang
window.printExcelKartuHutang = function() {
    const printContent = excelContainer.innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Cetak Kartu Hutang</title>
            <style>
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }
                    
                    body {
                        font-family: Arial, sans-serif;
                        padding: 0;
                        margin: 0;
                        font-size: 11px;
                    }
                    
                    .menu-button, 
                    .container header, 
                    .filter-section, 
                    .excel-action-buttons,
                    .btn {
                        display: none !important;
                    }
                    
                    .excel-kartu-container {
                        page-break-inside: avoid;
                        margin: 0;
                        padding: 0;
                    }
                    
                    .excel-header {
                        text-align: center;
                        margin-bottom: 15px;
                        padding-bottom: 10px;
                        border-bottom: 2px solid #000;
                    }
                    
                    .excel-title {
                        font-size: 14px;
                        font-weight: bold;
                        text-decoration: underline;
                        margin-bottom: 5px;
                    }
                    
                    .excel-supplier {
                        font-size: 12px;
                        font-weight: bold;
                    }
                    
                    .excel-periode {
                        font-size: 11px;
                        font-style: italic;
                    }
                    
                    .excel-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 15px;
                        font-size: 9px;
                    }
                    
                    .excel-table th,
                    .excel-table td {
                        border: 1px solid #000;
                        padding: 3px;
                        text-align: left;
                        vertical-align: top;
                    }
                    
                    .excel-table th {
                        background-color: #f2f2f2 !important;
                        font-weight: bold;
                        text-align: center;
                    }
                    
                    .table-title {
                        background-color: #d9e1f2 !important;
                        color: #000;
                    }
                    
                    .column-headers {
                        background-color: #e6e6e6 !important;
                    }
                    
                    .sub-headers {
                        background-color: #f2f2f2 !important;
                    }
                    
                    .number-cell {
                        text-align: right;
                        font-family: 'Courier New', monospace;
                    }
                    
                    .saldo-awal-row {
                        background-color: #f0f0f0;
                    }
                    
                    .pembelian-row {
                        background-color: #ffffff;
                    }
                    
                    .pelunasan-row {
                        background-color: #e8f5e8;
                    }
                    
                    .total-row {
                        background-color: #f2f2f2;
                        font-weight: bold;
                    }
                    
                    strong {
                        font-weight: bold;
                    }
                }
                
                /* Untuk preview di layar */
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                }
                
                .excel-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 15px;
                }
                
                .excel-table th,
                .excel-table td {
                    border: 1px solid #ddd;
                    padding: 4px;
                }
            </style>
        </head>
        <body>
            <div class="excel-kartu-container">
                ${printContent}
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() {
                        window.close();
                    }, 100);
                };
            <\/script>
        </body>
        </html>
    `;
    
    window.print();
    setTimeout(() => {
        location.reload();
    }, 500);
};

function showStatus(message, type) {
    console.log(`${type}: ${message}`);
}

document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
});