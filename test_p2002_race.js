/**
 * P2002 Race Condition Test — TASK-025 Student ID Sequence
 *
 * Fires two near-simultaneous POST /api/students requests for the SAME
 * school + level, to force both requests to compute the same "next sequence"
 * value before either has committed its insert.
 *
 * Expected correct behavior:
 *   - One request succeeds: 201, with a valid unique studentId
 *   - The other request fails cleanly: 409, NOT a raw 500
 *
 * If BOTH succeed with the SAME studentId -> duplicate ID bug (bad).
 * If either returns 500 -> P2002 handler isn't catching the error (bad).
 *
 * Usage:
 *   node test_p2002_race.js
 *
 * Adjust BASE_URL, TOKEN, and the payload below to match your environment.
 */

const BASE_URL = "http://localhost:3000";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbW54Z2I1d2kwMDAwNTF1ajM5dzhxZW9lIiwicm9sZSI6IlNDSE9PTF9BRE1JTiIsInNjaG9vbElkIjoiY21udzB3aXZmMDAwMGJxdWp5ZGVua2JkaCIsImlhdCI6MTc4NjY2MTA2NCwiZXhwIjoxNzg3MjY1ODY0fQ.bS_wTVp_HE2K5po0g3cifGDIdeA6P8l1SP7NMadyG3c"; // from localStorage.getItem('edupulse_token') after logging in as admin@zenithacademy.com

// Use a level/template combo you don't mind creating test students under.
// Using "Secondary" on Zenith Academy since it already has a running sequence.
const payloadFactory = (suffix) => ({
  firstName: `RaceTest${suffix}`,
  lastName: "Concurrent",
  gender: "Male",
  guardianName: "Test Guardian",
  guardianPhone: "08000000000",
  admissionLevel: "Secondary",
});

async function createStudent(suffix) {
  const res = await fetch(`${BASE_URL}/api/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(payloadFactory(suffix)),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }

  return { suffix, status: res.status, body };
}

async function main() {
  console.log("=== Firing two concurrent POST /api/students requests ===");

  // Fire both without awaiting each other, so they race.
  const [resultA, resultB] = await Promise.all([
    createStudent("A"),
    createStudent("B"),
  ]);

  console.log("\n--- Request A ---");
  console.log("Status:", resultA.status);
  console.log("Body:", JSON.stringify(resultA.body, null, 2));

  console.log("\n--- Request B ---");
  console.log("Status:", resultB.status);
  console.log("Body:", JSON.stringify(resultB.body, null, 2));

  console.log("\n=== Verdict ===");
  const statuses = [resultA.status, resultB.status].sort();

  if (JSON.stringify(statuses) === JSON.stringify([201, 409])) {
    console.log("PASS: One request succeeded (201), the other cleanly rejected (409).");
  } else if (statuses[0] === 201 && statuses[1] === 201) {
    const idA = resultA.body?.studentId;
    const idB = resultB.body?.studentId;
    if (idA && idB && idA === idB) {
      console.log(`FAIL: BOTH requests succeeded with the SAME studentId (${idA}). Duplicate ID bug.`);
    } else {
      console.log(`Both succeeded with different IDs (${idA}, ${idB}) — no collision occurred this run. Re-run to try to force the race harder, or reduce network latency between calls.`);
    }
  } else if (statuses.includes(500)) {
    console.log("FAIL: A raw 500 occurred instead of a clean 409. P2002 handler did not catch this case.");
  } else {
    console.log(`Unexpected status combination: ${statuses.join(", ")}. Investigate manually.`);
  }

  console.log("\nRemember to clean up the RaceTestA / RaceTestB records afterward (Prisma Studio or a DELETE call).");
}

main().catch((err) => {
  console.error("Script error:", err);
});
