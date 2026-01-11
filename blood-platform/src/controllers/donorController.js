// Donor controllers
const db = require("../config/database");

/**
 * Add a new donor
 */
exports.addDonor = async (req, res) => {
  try {
    const {
      name,
      blood_group,
      phone,
      email,
      city,
      last_donation_date
    } = req.body;

    const query = `
      INSERT INTO donors 
      (name, blood_group, phone, email, city, last_donation_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db.execute(query, [
      name,
      blood_group,
      phone,
      email,
      city,
      last_donation_date
    ]);

    res.status(201).json({ message: "Donor added successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all available donors
 */
exports.getDonors = async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM donors WHERE is_available = true"
    );

    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update donor availability
 */
exports.updateAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_available } = req.body;

    await db.execute(
      "UPDATE donors SET is_available = ? WHERE id = ?",
      [is_available, id]
    );

    res.status(200).json({ message: "Availability updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
