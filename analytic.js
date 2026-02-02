const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDtb1r_QrrmkSxXPANzOPTB4Pkk-PGea9c",
    projectId: "crudmaster-61ff9",
};

let db;
let barangCollection;
let stockChart = null;
let topStockChart = null;

const totalBarangElement = document.getElementById('totalBarang');
const totalStockElement = document.getElementById('totalStock');
const barangMinimumElement = document.getElementById('barangMinimum');
const totalNilaiElement = document.getElementById('totalNilai');
const minStockBody = document.getElementById('minStockBody');
const highValueBody = document.getElementById('highValueBody');
const filterLokasi = document.getElementById('filterLokasi');
const filterSatuan = document.getElementById('filterSatuan');
const btnApplyFilter = document.getElementById('btnApplyFilter');
const btnResetFilter = document.getElementById('btnResetFilter');

function updateFirebaseConfig() {
    if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.includes("xxxx")) {
        console.error("API Key belum diisi dengan benar");
        return false;
    }
    
    if (!FIREBASE_CONFIG.projectId || FIREBASE_CONFIG.projectId === "your-project-id") {
        console.error("Project ID belum diisi dengan benar");
        return false;
    }
    
    FIREBASE_CONFIG.authDomain = `${FIREBASE_CONFIG.projectId}.firebaseapp.com`;
    FIREBASE_CONFIG.storageBucket = `${FIREBASE_CONFIG.projectId}.appspot.com`;
    FIREBASE_CONFIG.messagingSenderId = "000000000000";
    FIREBASE_CONFIG.appId = "1:000000000000:web:0000000000000000";
    
    return true;
}

function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
}

function initializeFirebase() {
    try {
        if (!updateFirebaseConfig()) {
            console.error("Konfigurasi Firebase tidak valid");
            return;
        }
        
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore(app);
        barangCollection = db.collection('barang');
        
        loadAnalyticData();
        
    } catch (error) {
        console.error("Error initializing Firebase: ", error);
    }
}

async function loadAnalyticData() {
    try {
        const snapshot = await barangCollection.get();
        
        if (snapshot.empty) {
            console.log("Tidak ada data barang untuk dianalisis");
            return;
        }
        
        const barangData = [];
        const lokasiSet = new Set();
        const satuanSet = new Set();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            barangData.push({
                id: doc.id,
                ...data
            });
            
            if (data.lokasi) {
                lokasiSet.add(data.lokasi);
            }
            
            if (data.satuan) {
                satuanSet.add(data.satuan);
            }
        });
        
        populateFilterOptions(lokasiSet, satuanSet);
        calculateStatistics(barangData);
        createCharts(barangData);
        populateTables(barangData);
        
    } catch (error) {
        console.error("Error loading analytic data: ", error);
    }
}

function populateFilterOptions(lokasiSet, satuanSet) {
    filterLokasi.innerHTML = '<option value="">Semua Lokasi</option>';
    filterSatuan.innerHTML = '<option value="">Semua Satuan</option>';
    
    lokasiSet.forEach(lokasi => {
        if (lokasi && lokasi.trim() !== '') {
            const option = document.createElement('option');
            option.value = lokasi;
            option.textContent = lokasi;
            filterLokasi.appendChild(option);
        }
    });
    
    satuanSet.forEach(satuan => {
        if (satuan && satuan.trim() !== '') {
            const option = document.createElement('option');
            option.value = satuan;
            option.textContent = satuan;
            filterSatuan.appendChild(option);
        }
    });
}

function calculateStatistics(barangData) {
    let totalBarang = barangData.length;
    let totalStock = 0;
    let totalNilai = 0;
    let barangMinimum = 0;
    
    const MIN_STOCK_THRESHOLD = 10;
    
    barangData.forEach(barang => {
        const stock = parseInt(barang.stock) || 0;
        const harga = parseInt(barang.hargaBeli) || 0;
        
        totalStock += stock;
        totalNilai += stock * harga;
        
        if (stock < MIN_STOCK_THRESHOLD) {
            barangMinimum++;
        }
    });
    
    totalBarangElement.textContent = totalBarang;
    totalStockElement.textContent = totalStock.toLocaleString('id-ID');
    barangMinimumElement.textContent = barangMinimum;
    totalNilaiElement.textContent = formatRupiah(totalNilai);
}

function createCharts(barangData) {
    if (stockChart) {
        stockChart.destroy();
    }
    if (topStockChart) {
        topStockChart.destroy();
    }
    
    const stockByLocation = {};
    barangData.forEach(barang => {
        const lokasi = barang.lokasi || 'Tidak Diketahui';
        const stock = parseInt(barang.stock) || 0;
        
        if (!stockByLocation[lokasi]) {
            stockByLocation[lokasi] = 0;
        }
        stockByLocation[lokasi] += stock;
    });
    
    const locationLabels = Object.keys(stockByLocation);
    const locationData = Object.values(stockByLocation);
    
    const backgroundColors = [
        '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
        '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#d35400'
    ];
    
    const ctx1 = document.getElementById('stockChart').getContext('2d');
    stockChart = new Chart(ctx1, {
        type: 'pie',
        data: {
            labels: locationLabels,
            datasets: [{
                data: locationData,
                backgroundColor: backgroundColors.slice(0, locationLabels.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value.toLocaleString('id-ID')} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    const sortedByStock = [...barangData]
        .sort((a, b) => (parseInt(b.stock) || 0) - (parseInt(a.stock) || 0))
        .slice(0, 10);
    
    const topStockLabels = sortedByStock.map(b => b.namaBarang.substring(0, 20) + (b.namaBarang.length > 20 ? '...' : ''));
    const topStockData = sortedByStock.map(b => parseInt(b.stock) || 0);
    
    const ctx2 = document.getElementById('topStockChart').getContext('2d');
    topStockChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: topStockLabels,
            datasets: [{
                label: 'Stock',
                data: topStockData,
                backgroundColor: '#3498db',
                borderColor: '#2980b9',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString('id-ID');
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Stock: ${context.raw.toLocaleString('id-ID')}`;
                        }
                    }
                }
            }
        }
    });
}

function populateTables(barangData) {
    const MIN_STOCK_THRESHOLD = 10;
    const minStockItems = barangData
        .filter(barang => (parseInt(barang.stock) || 0) < MIN_STOCK_THRESHOLD)
        .sort((a, b) => (parseInt(a.stock) || 0) - (parseInt(b.stock) || 0));
    
    minStockBody.innerHTML = '';
    
    if (minStockItems.length === 0) {
        minStockBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px;">
                    Tidak ada barang dengan stock minimum.
                </td>
            </tr>
        `;
    } else {
        minStockItems.forEach(barang => {
            const stock = parseInt(barang.stock) || 0;
            let status = 'Aman';
            let statusClass = 'status-aman';
            
            if (stock === 0) {
                status = 'Habis';
                statusClass = 'status-habis';
            } else if (stock < 5) {
                status = 'Kritis';
                statusClass = 'status-kritis';
            } else {
                status = 'Rendah';
                statusClass = 'status-rendah';
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${barang.kodeBarang}</td>
                <td>${barang.namaBarang}</td>
                <td>${barang.lokasi}</td>
                <td>${stock.toLocaleString('id-ID')}</td>
                <td><span class="${statusClass}">${status}</span></td>
            `;
            minStockBody.appendChild(row);
        });
    }
    
    const highValueItems = [...barangData]
        .map(barang => ({
            ...barang,
            totalNilai: (parseInt(barang.stock) || 0) * (parseInt(barang.hargaBeli) || 0)
        }))
        .sort((a, b) => b.totalNilai - a.totalNilai)
        .slice(0, 10);
    
    highValueBody.innerHTML = '';
    
    if (highValueItems.length === 0) {
        highValueBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px;">
                    Tidak ada data barang.
                </td>
            </tr>
        `;
    } else {
        highValueItems.forEach(barang => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${barang.kodeBarang}</td>
                <td>${barang.namaBarang}</td>
                <td>${(parseInt(barang.stock) || 0).toLocaleString('id-ID')}</td>
                <td>${formatRupiah(parseInt(barang.hargaBeli) || 0)}</td>
                <td>${formatRupiah(barang.totalNilai)}</td>
            `;
            highValueBody.appendChild(row);
        });
    }
}

btnApplyFilter.addEventListener('click', async () => {
    const selectedLokasi = filterLokasi.value;
    const selectedSatuan = filterSatuan.value;
    
    try {
        let query = barangCollection;
        
        if (selectedLokasi) {
            query = query.where('lokasi', '==', selectedLokasi);
        }
        
        if (selectedSatuan) {
            query = query.where('satuan', '==', selectedSatuan);
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            console.log("Tidak ada data dengan filter yang dipilih");
            return;
        }
        
        const filteredData = [];
        snapshot.forEach(doc => {
            filteredData.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        calculateStatistics(filteredData);
        createCharts(filteredData);
        populateTables(filteredData);
        
    } catch (error) {
        console.error("Error applying filter:", error);
    }
});

btnResetFilter.addEventListener('click', () => {
    filterLokasi.value = '';
    filterSatuan.value = '';
    loadAnalyticData();
});

document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
});