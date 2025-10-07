const fs = require('fs');
const path = require('path');

console.log('Memulai proses build (in-place)...');

const filePath = path.join(__dirname, 'index.html');

try {
    // Baca file HTML asli
    let htmlContent = fs.readFileSync(filePath, 'utf8');
    console.log('Berhasil membaca index.html.');

    // Daftar variabel yang akan diganti
    const variables = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID'
    ];

    let replacementsCount = 0;

    // Lakukan penggantian untuk setiap variabel
    variables.forEach(varName => {
      const placeholder = `%${varName}%`;
      const value = process.env[varName];

      if (value) {
        if (htmlContent.includes(placeholder)) {
            // Gunakan RegExp global untuk mengganti semua placeholder
            htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), value);
            console.log(`Berhasil mengganti ${placeholder}.`);
            replacementsCount++;
        }
      } else {
        // Beri peringatan jika variabel tidak ditemukan
        console.warn(`Peringatan: Environment variable ${varName} tidak ditemukan.`);
      }
    });

    if (replacementsCount > 0) {
        // Tulis konten yang sudah dimodifikasi kembali ke file asli
        fs.writeFileSync(filePath, htmlContent, 'utf8');
        console.log("Berhasil menulis ulang index.html yang sudah dimodifikasi.");
    } else {
        console.log("Tidak ada placeholder yang diganti. File tidak diubah.");
    }

    console.log('Proses build selesai.');

} catch (error) {
    console.error("Terjadi error saat build:", error);
    process.exit(1); // Hentikan proses build jika ada error
}

