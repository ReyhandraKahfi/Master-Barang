// rekap-hutang.js - Tanpa kolom STATUS dan tanpa rumus perhitungan
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDtb1r_QrrmkSxXPANzOPTB4Pkk-PGea9c",
    projectId: "crudmaster-61ff9",
};

let db;
let supplierCollection;
let transaksiCollection;
let pelunasanCollection;

const rekapDate = document.getElementById('rekapDate');
const btnGenerate = document.getElementById('btnGenerate');
const totalSupplier = document.getElementById('totalSupplier');
const totalHutang = document.getElementById('totalHutang');
const totalTransaksi = document.getElementById('totalTransaksi');
const totalLunas = document.getElementById('totalLunas');
const btnExportExcel = document.getElementById('btnExportExcel');
const btnPrint = document.getElementById('btnPrint');
const excelContainer = document.getElementById('excelContainer');

function initializeFirebase() {
    try {
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore(app);
        supplierCollection = db.collection('supplier');
        transaksiCollection = db.collection('transaksi');
        pelunasanCollection = db.collection('pelunasan');
        
        setupDefaultDate();
        generateRekap();
        
        btnGenerate.addEventListener('click', generateRekap);
        btnExportExcel.addEventListener('click', exportToExcel);
        btnPrint.addEventListener('click', printReport);
        
    } catch (error) {
        console.error("Error initializing Firebase:", error);
    }
}

function setupDefaultDate() {
    const today = new Date();
    rekapDate.value = today.toISOString().split('T')[0];
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

async function generateRekap() {
    try {
        const supplierSnapshot = await supplierCollection.orderBy('namaSupplier').get();
        
        if (supplierSnapshot.empty) {
            console.log("Tidak ada data supplier");
            updateSummary([], 0, 0, 0);
            excelContainer.innerHTML = '<div class="empty-state">Tidak ada data supplier.</div>';
            return;
        }
        
        // Inisialisasi total
        let totalSupplierCount = 0;
        let totalTransaksiCount = 0;
        let totalLunasCount = 0;
        let totalHutangValue = 0;
        
        const supplierData = [];
        
        // Hitung untuk setiap supplier
        for (const doc of supplierSnapshot.docs) {
            const supplier = doc.data();
            const supplierId = doc.id;
            
            console.log(`Memproses supplier: ${supplier.namaSupplier}`);
            
            // Hitung transaksi pembelian untuk semua waktu
            let transaksiQuery = transaksiCollection
                .where('supplierId', '==', supplierId)
                .where('type', '==', 'pembelian');
            
            const transaksiSnapshot = await transaksiQuery.get();
            
            // Hitung total pembelian (semua waktu)
            let totalDPP = 0;
            let totalPPN = 0;
            let totalPembelianSupplier = 0;
            let transaksiCount = 0;
            
            transaksiSnapshot.forEach(transaksiDoc => {
                const transaksi = transaksiDoc.data();
                totalDPP += transaksi.totalDPP || 0;
                totalPPN += transaksi.totalPPN || 0;
                totalPembelianSupplier += transaksi.grandTotal || 0;
                transaksiCount++;
            });
            
            // Hitung total pelunasan (semua waktu)
            let pelunasanQuery = pelunasanCollection
                .where('supplierId', '==', supplierId);
            
            const pelunasanSnapshot = await pelunasanQuery.get();
            
            let totalPelunasanSupplier = 0;
            pelunasanSnapshot.forEach(pelunasanDoc => {
                const pelunasan = pelunasanDoc.data();
                totalPelunasanSupplier += pelunasan.jumlah || 0;
            });
            
            // Hitung saldo akhir dengan rumus: Saldo Awal - Pembelian + Pelunasan
            const saldoAwalSupplier = supplier.saldoAwal || 0;
            const saldoAkhirSupplier = saldoAwalSupplier - totalPembelianSupplier + totalPelunasanSupplier;
            
            // Tambahkan ke array supplier data (TANPA STATUS)
            supplierData.push({
                id: supplierId,
                kode: supplier.kodeSupplier,
                nama: supplier.namaSupplier,
                saldoAwal: saldoAwalSupplier,
                dpp: totalDPP,
                ppn: totalPPN,
                pembelian: totalPembelianSupplier,
                pelunasan: totalPelunasanSupplier,
                saldoAkhir: saldoAkhirSupplier
            });
            
            totalSupplierCount++;
            totalTransaksiCount += transaksiCount;
        }
        
        // Update summary
        updateSummary(totalSupplierCount, totalHutangValue, totalTransaksiCount, totalLunasCount);
        
        // Buat tabel rekap Excel-like
        createRekapExcelTable(supplierData);
        
    } catch (error) {
        console.error("Error generating rekap:", error);
        excelContainer.innerHTML = '<div class="error">Gagal memuat data rekap hutang. Error: ' + error.message + '</div>';
    }
}

function updateSummary(supplierCount, totalHutangValue, transaksiCount, lunasCount) {
    totalSupplier.textContent = supplierCount;
    totalHutang.textContent = formatRupiahTanpaMinus(totalHutangValue);
    totalTransaksi.textContent = transaksiCount;
    totalLunas.textContent = lunasCount;
}

function createRekapExcelTable(supplierData) {
    excelContainer.innerHTML = '';
    
    if (supplierData.length === 0) {
        excelContainer.innerHTML = '<div class="empty-state">Tidak ada data supplier.</div>';
        return;
    }
    
    // Sort by nama supplier
    supplierData.sort((a, b) => a.nama.localeCompare(b.nama));
    
    // Hitung grand totals
    let grandTotalSaldoAwal = 0;
    let grandTotalDPP = 0;
    let grandTotalPPN = 0;
    let grandTotalPembelian = 0;
    let grandTotalPelunasan = 0;
    let grandTotalSaldoAkhir = 0;
    
    supplierData.forEach(supplier => {
        grandTotalSaldoAwal += supplier.saldoAwal;
        grandTotalDPP += supplier.dpp;
        grandTotalPPN += supplier.ppn;
        grandTotalPembelian += supplier.pembelian;
        grandTotalPelunasan += supplier.pelunasan;
        grandTotalSaldoAkhir += supplier.saldoAkhir;
    });
    
    // Buat container untuk rekap
    const container = document.createElement('div');
    container.className = 'excel-kartu-container';
    
    // Header
    const header = document.createElement('div');
    header.className = 'excel-header';
    header.innerHTML = `
        <div class="excel-title">REKAP HUTANG</div>
        <div class="excel-periode">TANGGAL: ${formatTanggalExcel(rekapDate.value)}</div>
    `;
    
    // Buat tabel rekap sesuai dengan gambar (TANPA KOLOM STATUS)
    const table = document.createElement('table');
    table.className = 'excel-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th rowspan="2">SUPPLIER</th>
                <th rowspan="2">SALDO AWAL</th>
                <th colspan="3">PEMBELIAN</th>
                <th rowspan="2">PELUNASAN</th>
                <th rowspan="2">SALDO AKHIR</th>
            </tr>
            <tr class="sub-headers">
                <th>DPP</th>
                <th>PPN</th>
                <th>TOTAL</th>
            </tr>
        </thead>
        <tbody id="rekapBody">
        </tbody>
        <tfoot>
            <tr class="total-row">
                <td><strong>TOTAL</strong></td>
                <td class="number-cell"><strong>${formatRupiahTanpaMinus(grandTotalSaldoAwal)}</strong></td>
                <td class="number-cell"><strong>${formatRupiahTanpaMinus(grandTotalDPP)}</strong></td>
                <td class="number-cell"><strong>${formatRupiahTanpaMinus(grandTotalPPN)}</strong></td>
                <td class="number-cell"><strong>${formatRupiahTanpaMinus(grandTotalPembelian)}</strong></td>
                <td class="number-cell"><strong>${formatRupiahTanpaMinus(grandTotalPelunasan)}</strong></td>
                <td class="number-cell"><strong>${formatRupiahTanpaMinus(grandTotalSaldoAkhir)}</strong></td>
            </tr>
        </tfoot>
    `;
    
    const rekapBody = table.querySelector('#rekapBody');
    
    // Tambahkan setiap supplier ke tabel (TANPA STATUS)
    supplierData.forEach(supplier => {
        const row = document.createElement('tr');
        
        // Tentukan class untuk saldo akhir
        let saldoClass = '';
        if (supplier.saldoAkhir < 0) {
            saldoClass = 'saldo-hutang';
        } else if (supplier.saldoAkhir > 0) {
            saldoClass = 'saldo-positif';
        } else {
            saldoClass = 'saldo-lunas';
        }
        
        row.innerHTML = `
            <td>
                <strong>${supplier.nama}</strong><br>
                <small>${supplier.kode}</small>
            </td>
            <td class="number-cell">${formatRupiahTanpaMinus(supplier.saldoAwal)}</td>
            <td class="number-cell">${formatRupiahTanpaMinus(supplier.dpp)}</td>
            <td class="number-cell">${formatRupiahTanpaMinus(supplier.ppn)}</td>
            <td class="number-cell">${formatRupiahTanpaMinus(supplier.pembelian)}</td>
            <td class="number-cell">${formatRupiahTanpaMinus(supplier.pelunasan)}</td>
            <td class="number-cell ${saldoClass}">
                <strong>${formatRupiahTanpaMinus(supplier.saldoAkhir)}</strong>
            </td>
        `;
        
        rekapBody.appendChild(row);
    });
    
    // HAPUS RUMUS PERHITUNGAN (tidak ada notes row lagi)
    
    container.appendChild(header);
    container.appendChild(table);
    
    excelContainer.appendChild(container);
}

function exportToExcel() {
    const supplierName = 'Rekap-Hutang';
    const fileName = `Rekap-Hutang-${rekapDate.value}`.replace(/[^a-zA-Z0-9-]/g, '_');
    
    // Ambil semua kartu hutang
    const kartuElements = excelContainer.querySelectorAll('.excel-kartu-container');
    
    let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${fileName}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .excel-kartu-container { margin-bottom: 30px; }
                .excel-header { text-align: center; margin-bottom: 20px; }
                .excel-title { font-size: 16px; font-weight: bold; text-decoration: underline; }
                .excel-periode { font-size: 12px; color: #666; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 15px; }
                th, td { border: 1px solid #000; padding: 4px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
                .number-cell { text-align: right; font-family: 'Courier New', monospace; }
                .table-title { background-color: #d9e1f2; color: #000; }
                .saldo-akhir { font-weight: bold; }
                .total-row { background-color: #f2f2f2; font-weight: bold; }
                @media print {
                    @page { size: landscape; }
                }
            </style>
        </head>
        <body>
            <h1>REKAP HUTANG DAGANG</h1>
            <h3>Tanggal: ${rekapDate.value}</h3>
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
}

function printReport() {
    const printContent = excelContainer.innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Cetak Rekap Hutang</title>
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
                    .export-section,
                    .summary-cards,
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
                    
                    .sub-headers {
                        background-color: #f2f2f2 !important;
                    }
                    
                    .number-cell {
                        text-align: right;
                        font-family: 'Courier New', monospace;
                    }
                    
                    .total-row {
                        background-color: #f2f2f2;
                        font-weight: bold;
                    }
                    
                    .saldo-positif {
                        color: #2ecc71;
                        font-weight: bold;
                    }
                    
                    .saldo-hutang {
                        color: #e74c3c;
                        font-weight: bold;
                    }
                    
                    .saldo-lunas {
                        color: #7f8c8d;
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
}

// Tambahkan style untuk status di CSS
document.addEventListener('DOMContentLoaded', () => {
    // Tambahkan style dinamis
    const style = document.createElement('style');
    style.textContent = `
        .saldo-positif {
            color: #2ecc71;
            font-weight: bold;
        }
        
        .saldo-hutang {
            color: #e74c3c;
            font-weight: bold;
        }
        
        .saldo-lunas {
            color: #7f8c8d;
            font-weight: bold;
        }
        
        .number-cell {
            text-align: right;
            font-family: 'Courier New', monospace;
            font-weight: 600;
        }
        
        .total-cell {
            font-weight: bold;
            background-color: #f8f9fa;
        }
        
        /* Style untuk Excel-like table */
        .excel-style-container {
            background-color: white;
            padding: 20px;
            border-radius: 4px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            margin-top: 20px;
        }
        
        .excel-kartu-container {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        
        .excel-header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #2c3e50;
        }
        
        .excel-title {
            font-size: 16px;
            font-weight: bold;
            text-decoration: underline;
            color: #2c3e50;
            margin-bottom: 5px;
        }
        
        .excel-periode {
            font-size: 12px;
            color: #666;
            font-style: italic;
        }
        
        .excel-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 15px;
        }
        
        .excel-table th,
        .excel-table td {
            border: 1px solid #ddd;
            padding: 6px;
            text-align: left;
            vertical-align: top;
        }
        
        .excel-table th {
            background-color: #f8f9fa;
            font-weight: bold;
            text-align: center;
        }
        
        .sub-headers {
            background-color: #f2f2f2;
            font-size: 10px;
        }
        
        .total-row {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        
        @media (max-width: 768px) {
            .excel-table {
                font-size: 10px;
            }
            
            .excel-table th,
            .excel-table td {
                padding: 4px;
            }
        }
    `;
    document.head.appendChild(style);
    
    initializeFirebase();
});