const AWS = require('aws-sdk');
const mime = require('mime-types');
const path = require('path');

// Configure AWS SDK to use Cloudflare R2


const s3 = new AWS.S3({
  endpoint: "https://8b22bbe360edacd5c4351c60c8c04b39.r2.cloudflarestorage.com",
  accessKeyId: "07b7dc2e3ebb4e5fc720a6cd927f6b28",
  secretAccessKey: "915b24dc64681d7baae3ebc1241d9862841e905ef72463081384f73280f5adaf",
  signatureVersion: 'v4',
  region: 'auto', // Cloudflare R2 uses 'auto' as the region
});

const bucketName = "salesbid";

/**
 * Upload a file to R2 bucket
 * @param {Object} file - File object from multer
 * @param {string} name - Folder name
 * @param {string} id - ID to create subfolder
 * @returns {Promise<Object>} - Upload result with file URL
 */
const uploadFile = async (file, name, id) => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    // Create folder path: name/id/
    const folderPath = `${name}/${id}/`;
    
    // Generate a unique filename to avoid duplicates
    const fileExtension = mime.extension(file.mimetype) || path.extname(file.originalname).substring(1);
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.originalname.replace(/\s+/g, '-')}`;
    
    // Full path in the bucket
    const fullPath = `${folderPath}${fileName}`;
    
    // Check if folder exists, if not it will be created automatically when uploading
    try {
      const listParams = {
        Bucket: bucketName,
        Prefix: folderPath,
        MaxKeys: 1
      };
      
      await s3.listObjectsV2(listParams).promise();
    } catch (error) {
      console.log('Folder does not exist, will be created automatically');
    }
    
    // Check for duplicate filenames
    try {
      const headParams = {
        Bucket: "salesbid",
        Key: fullPath
      };
      
      await s3.headObject(headParams).promise();
      // If we reach here, the file exists
      throw new Error('A file with this name already exists in this folder');
    } catch (error) {
      // If error code is 404, file doesn't exist which is what we want
      if (error.code !== 'NotFound') {
        throw error;
      }
    }
    
    // Upload parameters
    const uploadParams = {
      Bucket: bucketName,
      Key: fullPath,
      Body: file.buffer,
      ContentType: file.mimetype,
    };
    
    // Upload to R2
    const result = await s3.upload(uploadParams).promise();
    
    return {
      success: true,
      url: result.Location || `${"https://8b22bbe360edacd5c4351c60c8c04b39.r2.cloudflarestorage.com"}/${bucketName}/${fullPath}`,
      key: result.Key,
      fileName: fileName,
    };
  } catch (error) {
    console.error('Error uploading file to R2:', error);
    throw error;
  }
};

const mulUploadFile = async (file, folderPath) => {
  try {
    if (!file) throw new Error('No file provided');

    // Ensure folder path ends with /
    const cleanPath = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;

    // Unique filename
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.originalname.replace(/\s+/g, '-')}`;
    const fullPath = `${cleanPath}${fileName}`;

    // Check for duplicate
    try {
      await s3.headObject({ Bucket: bucketName, Key: fullPath }).promise();
      throw new Error('A file with this name already exists in this folder');
    } catch (error) {
      if (error.code !== 'NotFound') throw error;
    }

    // Upload to R2
    const result = await s3
      .upload({
        Bucket: bucketName,
        Key: fullPath,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
      .promise();

    return {
      success: true,
      url:
        result.Location ||
        `https://<your-r2-endpoint>/${bucketName}/${fullPath}`,
      key: result.Key,
      fileName,
    };
  } catch (error) {
    console.error('Error uploading file to R2:', error);
    throw error;
  }
};


/**
 * Get all files from a specific folder in R2 bucket
 * @param {string} name - Folder name
 * @param {string} id - Subfolder ID
 * @returns {Promise<Array>} - Array of file objects with URLs
 */
const getFiles = async (name, id) => {
  try {
    // Create folder path: name/id/
    const folderPath = `${name}/${id}/`;
    
    // List parameters
    const listParams = {
      Bucket: bucketName,
      Prefix: folderPath,
    };
    
    // List objects in the folder
    const listedObjects = await s3.listObjectsV2(listParams).promise();
    
    // If no objects found, return empty array
    if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
      return [];
    }
    
    // Map objects to file information
    const files = listedObjects.Contents.map(obj => {
      const fileName = obj.Key.split('/').pop();
      return {
        key: obj.Key,
        fileName: fileName,
        size: obj.Size,
        lastModified: obj.LastModified,
        url: `${process.env.R2_ENDPOINT}/${bucketName}/${obj.Key}`,
      };
    });
    
    return files;
  } catch (error) {
    console.error('Error getting files from R2:', error);
    throw error;
  }
};

module.exports = {
  uploadFile,
  mulUploadFile,
  getFiles
};