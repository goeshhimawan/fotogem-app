const fs = require('fs');
const path = require('path');

console.log('Memulai proses build...');

const sourcePath = path.join(__dirname, 'index.html');
const distDir = path.join(__dirname, 'dist');
const destPath = path.join(distDir, 'index.html');

// Buat folder 'dist' jika belum ada
if (!fs.existsSync(distDir)){
    fs.mkdirSync(distDir);
    console.log("Folder 'dist' berhasil dibuat.");
}

// Baca file HTML asli
let htmlContent = fs.readFileSync(sourcePath, 'utf8');
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

// Lakukan penggantian untuk setiap variabel
variables.forEach(varName => {
  const placeholder = `%${varName}%`;
  const value = process.env[varName];

  if (value) {
    // Gunakan RegExp untuk mengganti semua placeholder
    htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), value);
    console.log(`Berhasil mengganti ${placeholder}.`);
  } else {
    // Beri peringatan jika variabel tidak ditemukan
    console.warn(`Peringatan: Environment variable ${varName} tidak ditemukan.`);
  }
});

// Tulis konten yang sudah dimodifikasi ke folder 'dist'
fs.writeFileSync(destPath, htmlContent, 'utf8');
console.log("Berhasil menulis index.html yang sudah dimodifikasi ke folder dist.");
console.log('Proses build selesai.');
