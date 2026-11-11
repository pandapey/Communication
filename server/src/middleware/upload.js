const multer = require('multer');
const path = require('path');

const MAX_MB = parseInt(process.env.MAX_FILE_MB || '10', 10);
const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/csv',
  'application/zip',
  'video/mp4', 'audio/mpeg',
]);

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!ALLOWED.has(file.mimetype)) {
    return cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 5 },
  fileFilter,
});

module.exports = upload;
