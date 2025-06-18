const db = require('../db/database');
const fs = require('fs');
const path = require('path');

/**
 * Read and parse the Params.json file
 * @returns {Object} Parsed JSON data
 */
const getParamsConfig = () => {
  try {
    const paramsPath = path.join(__dirname, '../Params.json');
    const paramsData = fs.readFileSync(paramsPath, 'utf8');
    return JSON.parse(paramsData);
  } catch (error) {
    console.error('Error reading Params.json:', error);
    throw new Error('Failed to load form configuration');
  }
};

/**
 * Get form configuration from Params.json
 * @param {string} formName - Name of the form to retrieve
 * @returns {Object} Form configuration
 */
const getFormConfig = (formName) => {
  const params = getParamsConfig();
  const formConfig = params[formName];
  
  if (!formConfig) {
    throw new Error(`Form configuration for "${formName}" not found`);
  }
  
  return formConfig;
};

/**
 * Format response data to match UI labels
 * @param {Array} data - Data rows from database
 * @param {Object} uiLabels - UI labels from form config
 * @param {Object} uiColumns - UI columns from form config
 * @returns {Array} Formatted data with UI labels
 */
const formatResponseData = (data, uiLabels, uiColumns) => {
  return data.map(row => {
    const formattedRow = {};
    
    // Map each database column to its UI label
    Object.entries(uiLabels).forEach(([key, label]) => {
      const dbColumn = uiColumns[key];
      formattedRow[label] = row[dbColumn];
    });
    
    return formattedRow;
  });
};

/**
 * Get all records for a specific form
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllRecords = async (req, res) => {
  const formName = req.query.formName;
  
  if (!formName) {
    return res.status(400).json({
      success: false,
      message: 'formName is required as a query parameter'
    });
  }
  
  try {
    // Get form configuration
    const formConfig = getFormConfig(formName);
    const { table_name, view_name, ui_labels, ui_columns } = formConfig;
    
    // Use view if available, otherwise use table
    const sourceTable = view_name || table_name;
    
    // Execute query
    const result = await db.query(`SELECT * FROM ${sourceTable}`);
    
    // Format response data
    const formattedData = formatResponseData(result.rows, ui_labels, ui_columns);
    
    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: formattedData
    });
  } catch (error) {
    console.error(`Error fetching ${formName} records:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Get a record by ID for a specific form
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRecordById = async (req, res) => {
  const { formName } = req.body;
  const { id } = req.params;
  
  if (!formName) {
    return res.status(400).json({
      success: false,
      message: 'formName is required in the request body'
    });
  }
  
  try {
    // Get form configuration
    const formConfig = getFormConfig(formName);
    const { table_name, view_name, ui_labels, ui_columns } = formConfig;
    
    // Use view if available, otherwise use table
    const sourceTable = view_name || table_name;
    
    // Determine primary key column (assuming it ends with _id)
    const primaryKeyColumn = Object.values(ui_columns).find(col => col.endsWith('_id'));
    
    if (!primaryKeyColumn) {
      throw new Error('Primary key column not found in form configuration');
    }
    
    // Execute query
    const result = await db.query(
      `SELECT * FROM ${sourceTable} WHERE ${primaryKeyColumn} = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }
    
    // Format response data
    const formattedData = formatResponseData(result.rows, ui_labels, ui_columns);
    
    res.status(200).json({
      success: true,
      data: formattedData[0]
    });
  } catch (error) {
    console.error(`Error fetching ${formName} record by ID:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Insert a new record for a specific form
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const insertRecord = async (req, res) => {
  const { formName, ...formData } = req.body;
  
  if (!formName) {
    return res.status(400).json({
      success: false,
      message: 'formName is required in the request body'
    });
  }
  
  try {
    // Get form configuration
    const formConfig = getFormConfig(formName);
    const { table_name, ui_columns } = formConfig;
    
    // Prepare columns and values for insertion
    const columns = [];
    const values = [];
    const placeholders = [];
    let paramIndex = 1;
    
    // Map request data to database columns
    Object.entries(ui_columns).forEach(([uiField, dbColumn]) => {
      if (formData[uiField] !== undefined) {
        columns.push(dbColumn);
        values.push(formData[uiField]);
        placeholders.push(`$${paramIndex}`);
        paramIndex++;
      }
    });
    
    if (columns.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for insertion'
      });
    }
    
    // Build and execute query
    const query = `
      INSERT INTO ${table_name} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;
    
    const result = await db.query(query, values);
    
    // Format response data
    const formattedData = formatResponseData([result.rows[0]], formConfig.ui_labels, formConfig.ui_columns);
    
    res.status(201).json({
      success: true,
      message: 'Record created successfully',
      data: formattedData[0]
    });
  } catch (error) {
    console.error(`Error inserting ${formName} record:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Delete a record by ID for a specific form
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteRecord = async (req, res) => {
  const { formName } = req.body;
  const { id } = req.params;
  
  if (!formName) {
    return res.status(400).json({
      success: false,
      message: 'formName is required in the request body'
    });
  }
  
  try {
    // Get form configuration
    const formConfig = getFormConfig(formName);
    const { table_name, ui_columns } = formConfig;
    
    // Determine primary key column (assuming it ends with _id)
    const primaryKeyColumn = Object.values(ui_columns).find(col => col.endsWith('_id'));
    
    if (!primaryKeyColumn) {
      throw new Error('Primary key column not found in form configuration');
    }
    
    // Execute query
    const result = await db.query(
      `DELETE FROM ${table_name} WHERE ${primaryKeyColumn} = $1 RETURNING *`,
      [id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Record deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting ${formName} record:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

module.exports = {
  getAllRecords,
  getRecordById,
  insertRecord,
  deleteRecord
};