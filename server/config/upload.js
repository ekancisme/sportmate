const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function createStorage(prefix) {
  return multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const unique = Date.now().toString(36);
      const ext = path.extname(file.originalname || '.jpg');
      cb(null, `${prefix}_${unique}${ext}`);
    },
  });
}

const upload = multer({ storage: createStorage('avatar') });
const courtUpload = multer({ storage: createStorage('court') });

function setupUploadStatic(app) {
  app.use('/uploads', express.static(uploadDir));
}

module.exports = {
  courtUpload,
  upload,
  uploadDir,
  setupUploadStatic,
};
