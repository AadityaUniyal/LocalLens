// Recipient controllers
const db = require("../config/database");

/**
 * Add a new recipient
 */
exports.addRecipient = async (req, res) => {
  try {
    const {
      name,
      blood_group,
      hospital_name,
      city,
      contact_number,
      urgency_level
    } = req.body;

    const query = `
      INSERT INTO recipients 
      (name, blood_group, hospital_name, city, contact_number, urgency_level)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db.execute(query, [
      name,
      blood_group,
      hospital_name,
      city,
      contact_number,
      urgency_level
    ]);

    res.status(201).json({ message: "Recipient added successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all recipients
 */
exports.getRecipients = async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM recipients");
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get recipients by urgency
 */
exports.getByUrgency = async (req, res) => {
  try {
    const { level } = req.params;

    const [rows] = await db.execute(
      "SELECT * FROM recipients WHERE urgency_level = ?",
      [level]
    );

    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
