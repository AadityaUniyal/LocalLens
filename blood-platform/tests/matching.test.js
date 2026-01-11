// Blood matching tests
const request = require("supertest");
const app = require("../src/index");
const db = require("../src/config/database");

describe("Blood Matching Service", () => {

  beforeAll(async () => {
    // Insert mock donor
    await db.execute(
      `INSERT INTO donors (name, blood_group, phone, city, is_available)
       VALUES ('Test Donor', 'O+', '9999999999', 'Delhi', true)`
    );

    // Insert mock recipient
    await db.execute(
      `INSERT INTO recipients (name, blood_group, hospital_name, city, contact_number, urgency_level)
       VALUES ('Test Recipient', 'O+', 'AIIMS', 'Delhi', '8888888888', 'HIGH')`
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await db.execute("DELETE FROM blood_matches");
    await db.execute("DELETE FROM donors WHERE phone = '9999999999'");
    await db.execute("DELETE FROM recipients WHERE contact_number = '8888888888'");
    await db.end();
  });

  test("should create a blood match between donor and recipient", async () => {
    const response = await request(app)
      .post("/match")
      .send({
        donorBlood: "O+",
        recipientBlood: "O+",
        city: "Delhi"
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("message");
    expect(response.body.message).toMatch(/match/i);
  });

  test("should not match when blood groups are incompatible", async () => {
    const response = await request(app)
      .post("/match")
      .send({
        donorBlood: "A+",
        recipientBlood: "B+",
        city: "Delhi"
      });

    expect(response.statusCode).toBe(404);
    expect(response.body).toHaveProperty("error");
  });

});
