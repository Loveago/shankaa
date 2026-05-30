const prisma = require("../config/db");
const path = require("path");
const fs = require("fs");
const { createTransaction } = require("./transactionService");

class ComplaintService {
  // Create a new complaint
  async createComplaint(data) {
    try {
      const { orderId, orderItemId, mobileNumber, whatsappNumber, message, complaintDate, complaintTime } = data;
      
      let complaintDateTime = null;
      if (complaintDate) {
        if (complaintTime) {
          complaintDateTime = new Date(`${complaintDate}T${complaintTime}:00`);
        } else {
          complaintDateTime = new Date(`${complaintDate}T00:00:00`);
        }
      }
      
      const complaint = await prisma.complaint.create({
        data: {
          orderId: orderId || null,
          orderItemId: orderItemId || null,
          mobileNumber,
          whatsappNumber: whatsappNumber || null,
          message,
          complaintDate: complaintDateTime,
          complaintTime: complaintTime || null,
          status: 'pending',
          refundStatus: 'none'
        }
      });
      
      return complaint;
    } catch (error) {
      throw new Error(`Failed to create complaint: ${error.message}`);
    }
  }

  // Get all complaints (for admin)
  async getAllComplaints(status = null) {
    try {
      const whereClause = (status && status !== 'all' && status.trim() !== '') 
        ? { status: status.trim() } 
        : {};
      
      const complaints = await prisma.complaint.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      });
      
      return complaints;
    } catch (error) {
      throw new Error(`Failed to fetch complaints: ${error.message}`);
    }
  }

  // Get pending complaints count
  async getPendingCount() {
    try {
      const count = await prisma.complaint.count({
        where: { status: 'pending' }
      });
      return count;
    } catch (error) {
      throw new Error(`Failed to get pending count: ${error.message}`);
    }
  }

  // Get complaint by ID
  async getComplaintById(id) {
    try {
      const complaint = await prisma.complaint.findUnique({
        where: { id: parseInt(id) }
      });
      if (!complaint) throw new Error('Complaint not found');
      return complaint;
    } catch (error) {
      throw new Error(`Failed to fetch complaint: ${error.message}`);
    }
  }

  // Update complaint status
  async updateComplaintStatus(id, status, adminNotes = null) {
    try {
      const updateData = { status };
      if (adminNotes) updateData.adminNotes = adminNotes;
      
      const complaint = await prisma.complaint.update({
        where: { id: parseInt(id) },
        data: updateData
      });
      return complaint;
    } catch (error) {
      throw new Error(`Failed to update complaint: ${error.message}`);
    }
  }

  // Upload proof image to a complaint (admin)
  async uploadProofImage(id, file) {
    try {
      if (!file) throw new Error('No file uploaded');

      // Build relative URL path for the uploaded file
      const proofImageUrl = `/uploads/complaints/${file.filename}`;

      const complaint = await prisma.complaint.update({
        where: { id: parseInt(id) },
        data: { proofImage: proofImageUrl }
      });

      return complaint;
    } catch (error) {
      throw new Error(`Failed to upload proof image: ${error.message}`);
    }
  }

  // Refund complaint
  async refundComplaint(id, adminUserId) {
    try {
      return await prisma.$transaction(async (tx) => {
        const complaint = await tx.complaint.findUnique({
          where: { id: parseInt(id) }
        });
        if (!complaint) throw new Error('Complaint not found');
        if (complaint.refundStatus === 'refunded') throw new Error('Complaint has already been refunded');

        let refundAmount = 0;
        let refundNote = '';

        if (complaint.orderItemId) {
          const orderItem = await tx.orderItem.findUnique({
            where: { id: complaint.orderItemId },
            include: { 
              order: { select: { userId: true } },
              product: { select: { name: true, price: true } }
            }
          });

          if (orderItem) {
            const existingRefund = await tx.transaction.findFirst({
              where: {
                userId: orderItem.order.userId,
                type: "ORDER_ITEM_REFUND",
                reference: `complaint_refund:${complaint.id}`
              }
            });

            if (!existingRefund) {
              refundAmount = (orderItem.productPrice != null ? orderItem.productPrice : orderItem.product.price) * orderItem.quantity;
              if (refundAmount > 0) {
                await createTransaction(
                  orderItem.order.userId,
                  refundAmount,
                  "ORDER_ITEM_REFUND",
                  `Refund via complaint #${complaint.id} for item #${complaint.orderItemId} (${orderItem.product.name})`,
                  `complaint_refund:${complaint.id}`,
                  tx
                );
                refundNote = `Refunded GHS ${refundAmount.toFixed(2)}`;
              }
            }
          }
        }

        const updatedComplaint = await tx.complaint.update({
          where: { id: parseInt(id) },
          data: {
            status: 'refunded',
            refundStatus: 'refunded',
            refundedAt: new Date(),
            adminNotes: complaint.adminNotes 
              ? `${complaint.adminNotes}\n[${new Date().toISOString()}] ${refundNote || 'Marked as refunded'}`
              : `[${new Date().toISOString()}] ${refundNote || 'Marked as refunded'}`
          }
        });

        return updatedComplaint;
      }, { timeout: 15000 });
    } catch (error) {
      throw new Error(`Failed to refund complaint: ${error.message}`);
    }
  }

  async deleteComplaint(id) {
    try {
      await prisma.complaint.delete({ where: { id: parseInt(id) } });
      return { message: 'Complaint deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete complaint: ${error.message}`);
    }
  }

  async getComplaintsByMobile(mobileNumber) {
    try {
      return await prisma.complaint.findMany({
        where: { mobileNumber },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      throw new Error(`Failed to fetch complaints: ${error.message}`);
    }
  }

  // Get complaints by order item IDs (for bulk lookups)
  async getComplaintsByOrderItemIds(orderItemIds) {
    try {
      if (!orderItemIds || orderItemIds.length === 0) return [];
      return await prisma.complaint.findMany({
        where: { orderItemId: { in: orderItemIds } },
        select: {
          id: true, orderItemId: true, status: true, refundStatus: true,
          proofImage: true, message: true, adminNotes: true, createdAt: true
        }
      });
    } catch (error) {
      return [];
    }
  }

  // Get complaint status for a specific order item
  async getComplaintStatusForItem(orderItemId) {
    try {
      return await prisma.complaint.findFirst({
        where: { orderItemId: parseInt(orderItemId) },
        select: {
          id: true, status: true, refundStatus: true, proofImage: true,
          message: true, adminNotes: true, createdAt: true, updatedAt: true
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      return null;
    }
  }

  // Get all complaints for a given user (by their order items)
  async getComplaintsByUserId(userId) {
    try {
      // Find all order items belonging to this user's orders
      const userOrderItems = await prisma.orderItem.findMany({
        where: { order: { userId: parseInt(userId) } },
        select: { id: true }
      });
      const itemIds = userOrderItems.map(oi => oi.id);
      if (itemIds.length === 0) return [];

      const complaints = await prisma.complaint.findMany({
        where: { orderItemId: { in: itemIds } },
        orderBy: { createdAt: 'desc' }
      });

      // Enrich each complaint with its associated order item details
      const enriched = [];
      for (const c of complaints) {
        let item = null;
        if (c.orderItemId) {
          item = await prisma.orderItem.findUnique({
            where: { id: c.orderItemId },
            select: {
              id: true, status: true, productName: true, productDescription: true,
              productPrice: true, mobileNumber: true, order: { select: { id: true, orderNumber: true } }
            }
          });
        }
        enriched.push({ ...c, orderItem: item || null });
      }
      return enriched;
    } catch (error) {
      throw new Error(`Failed to fetch user complaints: ${error.message}`);
    }
  }
}

module.exports = new ComplaintService();
