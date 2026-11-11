const { cloudinary } = require('../config/cloudinary');

function resourceTypeFor(mime = '') {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'raw';
}

function uploadBuffer(buffer, { folder = 'syncspace', fileName = 'file', mimeType = 'application/octet-stream' } = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceTypeFor(mimeType), public_id: `${Date.now()}-${fileName}`.slice(0, 120) },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

module.exports = { uploadBuffer, resourceTypeFor };
