function errorHandler(err, req, res, next) {
  console.error('[API ERROR]', err);
  // Multer / file validation → 400, not 500
  if (err && (err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FILE_COUNT' || /File type not allowed/.test(err.message || ''))) {
    return res.status(400).json({ success: false, message: err.message || 'Invalid file upload' });
  }
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Server error',
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
  });
}

function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
}

module.exports = { errorHandler, notFound };
