// controllers/complaintController.js
const complaintService = require('../services/complaintService');
const path = require('path');
const fs = require('fs');

class ComplaintController {
  // Create a new complaint (public - from shop)
  async createComplaint(req, res) {
    try {
      const { orderId, orderItemId, mobileNumber, whatsappNumber, message, complaintDate, complaintTime } = req.body;
      
      if (!mobileNumber || !message) {
        return res.status(400).json({ success: false, message: 'Mobile number and message are required' });
      }
      
      const complaint = await complaintService.createComplaint({ orderId, orderItemId, mobileNumber, whatsappNumber, message, complaintDate, complaintTime });
      
      try {
        const { io } = require('../index');
        io.emit('new-complaint', { complaintId: complaint.id, mobileNumber: complaint.mobileNumber });
      } catch (e) { /* socket emit is best-effort */ }

      res.status(201).json({ success: true, data: complaint, message: 'Complaint submitted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get all complaints (Admin only)
  async getAllComplaints(req, res) {
    try {
      const { status } = req.query;
      const normalizedStatus = (status && status !== 'all' && status.trim() !== '') ? status.trim() : null;
      const complaints = await complaintService.getAllComplaints(normalizedStatus);
      res.status(200).json({ success: true, data: complaints || [], message: 'Complaints fetched successfully' });
    } catch (error) {
      res.status(500).json({ success: false, data: [], message: error.message });
    }
  }

  // Get pending complaints count (Admin only)
  async getPendingCount(req, res) {
    try {
      const count = await complaintService.getPendingCount();
      res.status(200).json({ success: true, data: { count }, message: 'Pending count fetched successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get complaint by ID (Admin only)
  async getComplaintById(req, res) {
    try {
      const { id } = req.params;
      const complaint = await complaintService.getComplaintById(id);
      res.status(200).json({ success: true, data: complaint, message: 'Complaint fetched successfully' });
    } catch (error) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  // Update complaint status (Admin only)
  async updateComplaintStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;
      if (!status) return res.status(400).json({ success: false, message: 'Status is required' });
      const complaint = await complaintService.updateComplaintStatus(id, status, adminNotes);
      res.status(200).json({ success: true, data: complaint, message: 'Complaint updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Upload proof image to a complaint (Admin only)
  async uploadProofImage(req, res) {
    try {
      const { id } = req.params;
      const file = req.file;
      if (!file) return res.status(400).json({ success: false, message: 'No image file uploaded' });
      const complaint = await complaintService.uploadProofImage(id, file);
      res.status(200).json({ success: true, data: complaint, message: 'Proof image uploaded successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Refund complaint (Admin only)
  async refundComplaint(req, res) {
    try {
      const { id } = req.params;
      const complaint = await complaintService.refundComplaint(id, req.user.id);
      res.status(200).json({ success: true, data: complaint, message: 'Complaint refunded successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Delete complaint (Admin only)
  async deleteComplaint(req, res) {
    try {
      const { id } = req.params;
      const result = await complaintService.deleteComplaint(id);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get complaints by mobile number (public)
  async getComplaintsByMobile(req, res) {
    try {
      const { mobileNumber } = req.params;
      const complaints = await complaintService.getComplaintsByMobile(mobileNumber);
      res.status(200).json({ success: true, data: complaints, message: 'Complaints fetched successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get complaint status for a specific order item (auth required)
  async getComplaintStatusForItem(req, res) {
    try {
      const { orderItemId } = req.params;
      const status = await complaintService.getComplaintStatusForItem(orderItemId);
      res.status(200).json({ success: true, data: status, message: 'Complaint status fetched successfully' });
    } catch (error) {
      res.status(500).json({ success: false, data: null, message: error.message });
    }
  }

  // Get complaints for multiple order item IDs (auth required)
  async getComplaintsByOrderItemIds(req, res) {
    try {
      const { orderItemIds } = req.body;
      if (!orderItemIds || !Array.isArray(orderItemIds)) return res.status(400).json({ success: false, message: 'orderItemIds array is required' });
      const complaints = await complaintService.getComplaintsByOrderItemIds(orderItemIds);
      res.status(200).json({ success: true, data: complaints, message: 'Complaints fetched successfully' });
    } catch (error) {
      res.status(500).json({ success: false, data: [], message: error.message });
    }
  }

  // Get all complaints for the currently authenticated user (auth required)
  async getUserComplaints(req, res) {
    try {
      const userId = req.user.id;
      const complaints = await complaintService.getComplaintsByUserId(userId);
      res.status(200).json({ success: true, data: complaints, message: 'User complaints fetched successfully' });
    } catch (error) {
      res.status(500).json({ success: false, data: [], message: error.message });
    }
  }

  // Serve complaint proof images
  async getProofImage(req, res) {
    try {
      const path = require('path');
      const fs = require('fs');
      const filename = req.params.filename;
      const safeName = path.basename(filename); // prevent directory traversal
      const uploadDir = path.join(__dirname, '../uploads/complaints');
      const filePath = path.join(uploadDir, safeName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'Image not found' });
      }

      res.sendFile(filePath);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new ComplaintController();
