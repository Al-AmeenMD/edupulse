import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import Papa from "papaparse";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";
import {
  createTeacherCore,
  TeacherValidationError,
  CreateTeacherResult,
} from "@/lib/services/teacherService";

const MAX_ROWS = 500;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// Helper to normalize field access across diverse column aliases
function getField(row: Record<string, any>, ...aliases: string[]): string {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null) {
      const val = String(row[alias]).trim();
      if (val) return val;
    }
    // Also check case-insensitive match on keys
    const matchedKey = Object.keys(row).find(
      (k) => k.trim().toLowerCase() === alias.trim().toLowerCase()
    );
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      const val = String(row[matchedKey]).trim();
      if (val) return val;
    }
  }
  return "";
}

export const POST = withAuth(
  async (req) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      let csvText = "";
      let dryRun = false;

      const { searchParams } = new URL(req.url);
      if (searchParams.get("dryRun") === "true") {
        dryRun = true;
      }

      const contentType = req.headers.get("content-type") || "";

      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = (formData.get("file") || formData.get("csv")) as File | null;
        if (!file) {
          return NextResponse.json(
            { error: "CSV file is required in form-data ('file' or 'csv')" },
            { status: 400 }
          );
        }

        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: "File exceeds the maximum limit of 2MB" },
            { status: 400 }
          );
        }

        csvText = await file.text();
        const formDryRun = formData.get("dryRun");
        if (formDryRun === "true" || formDryRun === "1") {
          dryRun = true;
        }
      } else {
        const rawBody = await req.text();
        if (!rawBody || !rawBody.trim()) {
          return NextResponse.json(
            { error: "Request body is empty" },
            { status: 400 }
          );
        }

        if (rawBody.length > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: "Payload exceeds the maximum limit of 2MB" },
            { status: 400 }
          );
        }

        try {
          const jsonBody = JSON.parse(rawBody);
          csvText = jsonBody.csvText || jsonBody.csv || "";
          if (jsonBody.dryRun !== undefined) {
            dryRun = Boolean(jsonBody.dryRun);
          }
        } catch {
          // If not valid JSON, treat raw text as CSV directly
          csvText = rawBody;
        }
      }

      if (!csvText || !csvText.trim()) {
        return NextResponse.json(
          { error: "No CSV content provided" },
          { status: 400 }
        );
      }

      // Parse with PapaParse
      const parseResult = Papa.parse<Record<string, string>>(csvText, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (header) => header.trim(),
      });

      if (parseResult.errors && parseResult.errors.length > 0) {
        const fatalError = parseResult.errors.find(
          (e) => e.type === "Quotes" || e.code === "UndetectableDelimiter"
        );
        if (fatalError) {
          return NextResponse.json(
            { error: `CSV parsing error on line ${fatalError.row || 1}: ${fatalError.message}` },
            { status: 400 }
          );
        }
      }

      const rows = parseResult.data;

      if (!rows || rows.length === 0) {
        return NextResponse.json(
          { error: "CSV file contains no data rows" },
          { status: 400 }
        );
      }

      if (rows.length > MAX_ROWS) {
        return NextResponse.json(
          { error: `CSV exceeds the maximum limit of ${MAX_ROWS} rows (received ${rows.length})` },
          { status: 400 }
        );
      }

      const created: Array<{
        rowNumber: number;
        name: string;
        email: string;
        employeeId: string | null;
        temporaryPassword?: string;
      }> = [];

      const skipped: Array<{
        rowNumber: number;
        email?: string;
        name?: string;
        reason: string;
      }> = [];

      const errors: Array<{
        rowNumber: number;
        field?: string;
        message: string;
      }> = [];

      const seenFileEmails = new Set<string>();

      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2; // 1-based, accounts for CSV header row
        const rawRow = rows[i];

        const firstName = getField(rawRow, "firstName", "first_name", "First Name");
        const lastName = getField(rawRow, "lastName", "last_name", "Last Name");
        const email = getField(rawRow, "email", "Email", "email_address", "Email Address").toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim() || `Row ${rowNumber}`;

        // Basic presence validation before DB checks
        if (!firstName || !lastName || !email) {
          errors.push({
            rowNumber,
            field: !firstName ? "firstName" : !lastName ? "lastName" : "email",
            message: "First name, last name, and email are required",
          });
          continue;
        }

        // In-file duplicate email detection
        if (seenFileEmails.has(email)) {
          skipped.push({
            rowNumber,
            email,
            name: fullName,
            reason: "Duplicate email within this CSV file",
          });
          continue;
        }
        seenFileEmails.add(email);

        const phone = getField(rawRow, "phone", "Phone", "phone_number", "mobile") || null;
        const employeeId = getField(rawRow, "employeeId", "employee_id", "staff_id", "Staff ID") || null;
        const qualification = getField(rawRow, "qualification", "Qualification", "degree") || null;
        const dob = getField(rawRow, "dob", "DOB", "dateOfBirth", "date_of_birth") || null;

        try {
          const runCore = (txClient?: Prisma.TransactionClient) =>
            createTeacherCore(
              {
                schoolId,
                firstName,
                lastName,
                email,
                phone,
                employeeId,
                qualification,
                dob,
                autoGeneratePassword: true,
                mustChangePassword: true,
                validateOnly: dryRun,
              },
              txClient
            );

          let result: CreateTeacherResult;
          if (dryRun) {
            result = await runCore();
          } else {
            result = await prisma.$transaction(async (tx) => runCore(tx));
          }

          created.push({
            rowNumber,
            name: fullName,
            email: result.teacher.user.email,
            employeeId: result.teacher.employeeId,
            temporaryPassword: result.generatedPassword,
          });
        } catch (err: any) {
          if (err instanceof TeacherValidationError) {
            if (err.statusCode === 409 && err.field === "email") {
              // Row-level DB collision: caught per-row, recorded as skip
              skipped.push({
                rowNumber,
                email,
                name: fullName,
                reason: "Email is already registered in the system",
              });
            } else {
              errors.push({
                rowNumber,
                field: err.field,
                message: err.message,
              });
            }
          } else if (err?.code === "P2002") {
            skipped.push({
              rowNumber,
              email,
              name: fullName,
              reason: "Email is already registered in the system",
            });
          } else {
            errors.push({
              rowNumber,
              message: err?.message || "Internal error creating teacher",
            });
          }
        }
      }

      return NextResponse.json(
        {
          summary: {
            totalRows: rows.length,
            createdCount: created.length,
            skippedCount: skipped.length,
            errorCount: errors.length,
          },
          created,
          skipped,
          errors,
          isDryRun: dryRun,
        },
        { status: 200 }
      );
    } catch {
      return NextResponse.json(
        { error: "Internal server error during teacher import" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);
