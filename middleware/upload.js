import multer from 'multer';
import path from 'path';

// Change diskStorage to memoryStorage for Vercel deployment
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Images only (jpeg, jpg, png)!'));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

export default upload;
