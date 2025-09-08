const { uploadFile, getFiles,mulUploadFile } = require('../services/r2Service');

/**
 * Upload a file to R2 storage
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const uploadFileToR2 = async (req, res) => {

  try {
    // Check if file exists in request
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get folder name and ID from request body
    const { name, id } = req.body;

    if (!name || !id) {
      return res.status(400).json({ message: 'Folder name and ID are required' });
    }

    // Upload file to R2
    const result = await uploadFile(req.file, name, id);

    return res.status(200).json({
      message: 'File uploaded successfully',
      file: result
    });
  } catch (error) {
    console.error('Error in uploadFileToR2:', error);
    
    // Handle specific errors
    if (error.message === 'A file with this name already exists in this folder') {
      return res.status(409).json({ message: error.message });
    }
    
    return res.status(500).json({ 
      message: 'Error uploading file', 
      error: error.message 
    });
  }
};









const mulUploadFilesToR2 = async (req, res) => {
  try {
    console.log('Received files:', req.file);
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    // Path is a single string from frontend
    let { path } = req.body;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({ success: false, message: 'Path must be a string' });
    }

    // Upload each file to the same path
    const results = await Promise.all(
      req.files.map((file) => mulUploadFile(file, path))
    );

    return res.status(200).json({
      success: true,
      message: 'Files uploaded successfully',
      files: results,
    });
  } catch (error) {
    console.error('Error in uploadFilesToR2:', error);

    if (error.message === 'A file with this name already exists in this folder') {
      return res.status(409).json({ success: false, message: error.message });
    }

    return res.status(500).json({
      success: false,
      message: 'Error uploading files',
      error: error.message,
    });
  }
};




/**
 * Get all files from a specific folder in R2
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getFilesFromR2 = async (req, res) => {
  try {
    // Get folder name and ID from request body
    const { name, id } = req.body;

    if (!name || !id) {
      return res.status(400).json({ message: 'Folder name and ID are required' });
    }

    // Get files from R2
    const files = await getFiles(name, id);

    return res.status(200).json({
      message: 'Files retrieved successfully',
      files: files
    });
  } catch (error) {
    console.error('Error in getFilesFromR2:', error);
    return res.status(500).json({ 
      message: 'Error retrieving files', 
      error: error.message 
    });
  }
};

module.exports = {
  uploadFileToR2,
  getFilesFromR2,
  mulUploadFilesToR2
};