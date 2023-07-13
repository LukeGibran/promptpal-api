var multer = require('multer')
const path = require('path')

const maxAllowedSize = 200 * 1024 * 1024 //max 25mb

const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        let imgPath = './uploads';
        cb(null, imgPath)
    },
    filename: (req, file, cb) => {
      cb(null, `${file.mimetype.split("/")[0]}-${Date.now()}-${Math.floor(Math.random() * (99 - 1 + 1)) + 1}` + path.extname(file.originalname))
    },
})


exports.upload = multer({
  storage: multerStorage,
  limits: { fileSize: maxAllowedSize },
  fileFilter: function (req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|pdf|JPG|JPEG|PNG|PDF)$/)) {
      req.fileValidationError = `Upload failed ${path.extname(file.originalname)} extention is forbidden`;
      return cb(null, false, req.fileValidationError);
    }
   cb(null, true);
  }
})