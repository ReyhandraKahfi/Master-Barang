// menu.js - Kode menu untuk semua halaman
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menuToggle');
    const dropdownMenu = document.getElementById('dropdownMenu');
    
    if (menuToggle && dropdownMenu) {
        // Toggle menu dropdown
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });
        
        // Tutup menu saat klik di luar
        document.addEventListener('click', () => {
            dropdownMenu.classList.remove('show');
        });
        
        // Mencegah menu tertutup saat klik di dalam menu
        dropdownMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Set active menu berdasarkan halaman yang sedang aktif
        setActiveMenu();
    }
    
    // Fungsi untuk mengatur menu aktif
    function setActiveMenu() {
        // Dapatkan path dari URL saat ini
        const currentPath = window.location.pathname;
        const currentPage = currentPath.split('/').pop() || 'index.html';
        
        // Hapus class active dari semua menu
        const menuLinks = dropdownMenu.querySelectorAll('a');
        menuLinks.forEach(link => {
            link.classList.remove('active');
        });
        
        // Tambahkan class active ke menu yang sesuai
        switch(currentPage) {
            case 'index.html':
                document.querySelector('a[href="index.html"]')?.classList.add('active');
                break;
            case 'supplier.html':
                document.querySelector('a[href="supplier.html"]')?.classList.add('active');
                break;
            case 'transaksi.html':
                document.querySelector('a[href="transaksi.html"]')?.classList.add('active');
                break;
            case 'MasterTransaksi.html':
                document.querySelector('a[href="MasterTransaksi.html"]')?.classList.add('active');
                break;
            case 'kartu-hutang.html':
                document.querySelector('a[href="kartu-hutang.html"]')?.classList.add('active');
                break;
            case 'rekap-hutang.html':
                document.querySelector('a[href="rekap-hutang.html"]')?.classList.add('active');
                break;
            case 'analytic.html':
                document.querySelector('a[href="analytic.html"]')?.classList.add('active');
                break;
        }
        
        // Jika tidak ada yang aktif, set ke index.html
        const activeLink = dropdownMenu.querySelector('a.active');
        if (!activeLink && currentPage.includes('index')) {
            document.querySelector('a[href="index.html"]')?.classList.add('active');
        }
    }
});