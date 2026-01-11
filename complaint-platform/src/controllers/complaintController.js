// Complaint controllers
const ComplaintService = require("../services/complaintService");
const RoutingService = require("../services/routingService");

// Initialize services
const complaintService = new ComplaintService();
const routingService = new RoutingService();

/**
 * Register a new complaint
 */
exports.createComplaint = async (req, res) => {
  try {
    const complaintData = req.body;

    // Create complaint
    const complaint = await complaintService.createComplaint(complaintData);

    // Route to appropriate authority
    const assignedAuthority = await routingService.routeComplaint(complaint);

    res.status(201).json({
      success: true,
      message: "Complaint registered successfully",
      data: {
        complaint,
        assigned_authority: assignedAuthority
      }
    });
  } catch (error) {
    console.error('Error creating complaint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get all complaints
 */
exports.getAllComplaints = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category, priority } = req.query;
    
    const complaints = await complaintService.getComplaints({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      category,
      priority
    });

    res.status(200).json({
      success: true,
      data: complaints.data,
      pagination: complaints.pagination
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get complaint by ID
 */
exports.getComplaintById = async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await complaintService.getComplaintById(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found"
      });
    }

    res.status(200).json({
      success: true,
      data: complaint
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Update complaint status
 */
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedComplaint = await complaintService.updateComplaintStatus(id, updateData);

    if (!updatedComplaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Complaint status updated",
      data: updatedComplaint
    });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Delete a complaint
 */
exports.deleteComplaint = async (req, res) => {
  try {
    const { id } = req.params;

    await complaintService.deleteComplaint(id);

    res.status(200).json({
      success: true,
      message: "Complaint deleted successfully"
    });
  } catch (error) {
    console.error('Error deleting complaint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get authorities
 */
exports.getAuthorities = async (req, res) => {
  try {
    const { category, type, active_only = true } = req.query;
    
    const authorities = await routingService.getAuthorities({
      category,
      type,
      active_only: active_only === 'true'
    });

    res.status(200).json({
      success: true,
      data: authorities
    });
  } catch (error) {
    console.error('Error fetching authorities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Assign complaint to authority
 */
exports.assignComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { authority_id, officer_id, assigned_by, reason } = req.body;

    const assignment = await routingService.assignComplaint(
      complaintId, 
      authority_id, 
      officer_id, 
      assigned_by, 
      reason
    );

    res.status(200).json({
      success: true,
      message: "Complaint assigned successfully",
      data: assignment
    });
  } catch (error) {
    console.error('Error assigning complaint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Escalate complaint
 */
exports.escalateComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { reason, escalated_by } = req.body;

    const escalatedComplaint = await complaintService.escalateComplaint(
      complaintId, 
      reason, 
      escalated_by
    );

    res.status(200).json({
      success: true,
      message: "Complaint escalated successfully",
      data: escalatedComplaint
    });
  } catch (error) {
    console.error('Error escalating complaint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Add comment to complaint
 */
exports.addComment = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const commentData = req.body;

    const comment = await complaintService.addComment(complaintId, commentData);

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: comment
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
