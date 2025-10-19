const express  = require('express');
const router = express.Router();



const { getAllProductsByVendorId,updateVendorActiveStatus,getAllVendor,getVendorByStatus,getVendorById,updateVendorStatus,getAllmatrixByVendorId,getAllOrderMatrixByVendorId,getAllOrderByVendorId } = require('../controller/posController');

// Route to get all products by vendor ID
router.get('/getAllProductsByVendorId/:vendorId', getAllProductsByVendorId);
router.get('/getAllVendor', getAllVendor);
router.get('/getVendorByStatus/:status', getVendorByStatus);
router.get('/getVendorById/:vendorId', getVendorById);
router.put("/updateVendorActiveStatus", updateVendorActiveStatus);
router.put("/updateVendorStatus", updateVendorStatus);
router.get("/getAllmatrixByVendorId/:vendorId", getAllmatrixByVendorId);
router.get('/getAllOrderMatrixByVendorId/:vendorId', getAllOrderMatrixByVendorId);
router.get('/getAllOrderByVendorId/:vendorId', getAllOrderByVendorId);

// Get order statistics by vendor ID
router.get('/getAllOrderMatrixByVendorId/:vendorId', getAllOrderMatrixByVendorId);

// Get single order details
router.get('/getOrderById/:orderId', getOrderById);

// Update single order status
router.put('/updateOrderStatus', updateOrderStatus);

// Bulk update order status
router.put('/bulkUpdateOrderStatus', bulkUpdateOrderStatus);

// Export orders
router.post('/exportOrders', exportOrders);

// Delete orders
router.delete('/deleteOrders', deleteOrders);



module.exports = router;