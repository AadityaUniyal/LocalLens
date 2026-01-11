// Complaint controllers
const complaintService = require("../services/complaintService");

/**
 * Register a new complaint
 */
exports.createComplaint = async (req, res) => {
  try {
    const complaintData = req.body;

    const complaint = await complaintService.createComplaint(complaintData);

    res.status(201).json({
      success: true,
      message: "Complaint registered successfully",
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
 * Get all complaints
 */
exports.getAllComplaints = async (req, res) => {
  try {
    const complaints = await complaintService.getAllComplaints();

    res.status(200).json({
      success: true,
      data: complaints
    });
  } catch (error) {
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
    const { status } = req.body;

    const updatedComplaint =
      await complaintService.updateComplaintStatus(id, status);

    res.status(200).json({
      success: true,
      message: "Complaint status updated",
      data: updatedComplaint
    });
  } catch (error) {
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
