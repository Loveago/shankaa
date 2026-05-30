const prisma = require("../config/db");
const { createTransaction } = require("./transactionService");

class ComplaintService {
  // Create a new complaint
  async createComplaint(data) {
    try {
      const { orderId, orderItemId, mobileNumber, whatsappNumber, message, complaintDate, complaintTime } = data;
      
      // Convert date string to ISO DateTime if provided
      let complaintDateTime = null;
      if (complaintDate) {
        if (complaintTime) {
          // Combine date and time into ISO DateTime
          complaintDateTime = new Date(`${complaintDate}T${complaintTime}:00`);
        } else {
          // Use date with default time
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
      // Only add status filter if it's a valid non-empty string
      const whereClause = (status && status !== 'all' && status.trim() !== '') 
        ? { status: status.trim() } 
        : {};
      
      console.log('[ComplaintService] Fetching with whereClause:', JSON.stringify(whereClause));
      
      const complaints = await prisma.complaint.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      });
      
      console.log('[ComplaintService] Found', complaints.length, 'complaints');
      return complaints;
    } catch (error) {
      console.error('[ComplaintService] Error fetching complaints:', error);
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
      
      if (!complaint) {
        throw new Error('Complaint not found');
      }
      
      return complaint;
    } catch (error) {
      throw new Error(`Failed to fetch complaint: ${error.message}`);
    }
  }

  // Update complaint status
  async updateComplaintStatus(id, status, adminNotes = null) {
    try {
      const updateData = { status };
      if (adminNotes) {
        updateData.adminNotes = adminNotes;
      }
      
      const complaint = await prisma.complaint.update({
        where: { id: parseInt(id) },
        data: updateData
      });
      
      return complaint;
    } catch (error) {
      throw new Error(`Failed to update complaint: ${error.message}`);
    }
  }

  // Refund complaint - marks complaint as refunded and refunds the order item
  async refundComplaint(id, adminUserId) {
    try {
      return await prisma.$transaction(async (tx) => {
        const complaint = await tx.complaint.findUnique({
          where: { id: parseInt(id) }
        });

        if (!complaint) {
          throw new Error('Complaint not found');
        }

        if (complaint.refundStatus === 'refunded') {
          throw new Error('Complaint has already been refunded');
        }

        // If there's an orderItemId, find and refund the order item
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
            // Check if already refunded
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

        // Update complaint status and refund fields
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

  // Delete complaint
  async deleteComplaint(id) {
    try {
      await prisma.complaint.delete({
        where: { id: parseInt(id) }
      });
      
      return { message: 'Complaint deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete complaint: ${error.message}`);
    }
  }

  // Get complaints by mobile number
  async getComplaintsByMobile(mobileNumber) {
    try {
      const complaints = await prisma.complaint.findMany({
        where: { mobileNumber },
        orderBy: { createdAt: 'desc' }
      });
      
      return complaints;
    } catch (error) {
      throw new Error(`Failed to fetch complaints: ${error.message}`);
    }
  }

  // Get complaints by order item IDs (for bulk lookups)
  async getComplaintsByOrderItemIds(orderItemIds) {
    try {
      if (!orderItemIds || orderItemIds.length === 0) return [];
      
      const complaints = await prisma.complaint.findMany({
        where: { 
          orderItemId: { in: orderItemIds },
          status: { not: 'deleted' }
        },
        select: {
          id: true,
          orderItemId: true,
          status: true,
          refundStatus: true,
          message: true,
          createdAt: true
        }
      });
      
      return complaints;
    } catch (error) {
      console.error('[ComplaintService] Error fetching complaints by orderItemIds:', error);
      return [];
    }
  }

  // Get complaint status for a specific order item (for user visibility)
  async getComplaintStatusForItem(orderItemId) {
    try {
      const complaint = await prisma.complaint.findFirst({
        where: { orderItemId: parseInt(orderItemId) },
        select: {
          id: true,
          status: true,
          refundStatus: true,
          message: true,
          adminNotes: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
      return complaint;
    } catch (error) {
      return null;
    }
  }
}

module.exports = new ComplaintService();
