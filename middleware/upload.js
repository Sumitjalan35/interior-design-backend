const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

cloudinary.config({
  cloud_name: 'BB',
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

const uploadfile = async (localfilepath) => {
  try {
    if (!localfilepath) return null;
    const responsefromcloud = await cloudinary.uploader.upload(localfilepath, {
      resource_type: 'auto',
    });
    console.log(responsefromcloud);
    fs.unlinkSync(localfilepath);
    return responsefromcloud;
  } catch (err) {
    console.log(err);
    fs.unlinkSync(localfilepath);
    return null;
  }
};

const deletefile = async (publicId) => {
  try {
    if (!publicId) {
      throw new Error('the file path is missing');
    }
    const response = await cloudinary.uploader.destroy(publicId);
    console.log(response);
    return response;
  } catch (err) {
    console.log(err);
    return null;
  }
};

module.exports = {
  upload,
  uploadfile,
  deletefile
}; 
