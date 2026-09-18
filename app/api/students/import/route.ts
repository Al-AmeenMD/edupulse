import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import Papa from "papaparse";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";
import {
  createStudentCore,
  StudentValidationError,
  CreateStudentResult,
} from "@/lib/services/studentService";

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
      let batchSessionInput = "";
      let batchTermInput = "";

      const { searchParams } = new URL(req.url);
      if (searchParams.get("dryRun") === "true") {
        dryRun = true;
      }
      batchSessionInput = searchParams.get("sessionId")?.trim() || searchParams.get("academicYear")?.trim() || "";
      batchTermInput = searchParams.get("termId")?.trim() || searchParams.get("term")?.trim() || "";

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
        const formSession = formData.get("sessionId") || formData.get("academicYear");
        if (typeof formSession === "string" && formSession.trim()) {
          batchSessionInput = formSession.trim();
        }
        const formTerm = formData.get("termId") || formData.get("term");
        if (typeof formTerm === "string" && formTerm.trim()) {
          batchTermInput = formTerm.trim();
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
          if (jsonBody.sessionId || jsonBody.academicYear) {
            batchSessionInput = String(jsonBody.sessionId || jsonBody.academicYear).trim();
          }
          if (jsonBody.termId || jsonBody.term) {
            batchTermInput = String(jsonBody.termId || jsonBody.term).trim();
          }
        } catch {
          // If not valid JSON, treat raw text as CSV directly
          csvText = rawBody;
        }
      }

      const schoolSessions = await prisma.academicSession.findMany({
        where: { schoolId },
        include: { terms: true },
      });

      let defaultSession = batchSessionInput
        ? schoolSessions.find(
            (s) => s.id === batchSessionInput || s.name.toLowerCase() === batchSessionInput.toLowerCase()
          )
        : schoolSessions.find((s) => s.isCurrent);

      if (!defaultSession) {
        return NextResponse.json(
          { error: "Valid target academic session is required for student import. No active session found." },
          { status: 400 }
        );
      }

      let defaultTermId: string | undefined = undefined;
      if (batchTermInput) {
        const foundTerm = defaultSession.terms.find(
          (t) =>
            t.id === batchTermInput ||
            t.name.toLowerCase() === batchTermInput.toLowerCase() ||
            (batchTermInput === "1" && t.name.includes("First")) ||
            (batchTermInput === "2" && t.name.includes("Second")) ||
            (batchTermInput === "3" && t.name.includes("Third"))
        );
        defaultTermId = foundTerm?.id;
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
          {
            error: `File exceeds the maximum limit of ${MAX_ROWS} rows per import (received ${rows.length} rows). Please split your file into smaller batches.`,
          },
          { status: 400 }
        );
      }

      // 1. Pre-fetch School Classes
      const schoolClasses = await prisma.class.findMany({
        where: { schoolId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

      const classMap = new Map<string, { id: string; name: string }>();
      for (const cls of schoolClasses) {
        classMap.set(cls.name.trim().toLowerCase(), cls);
      }

      // Tracking containers
      const created: Array<{
        rowNumber: number;
        studentId: string;
        name: string;
        className: string;
      }> = [];

      const skipped: Array<{
        rowNumber: number;
        studentId: string | null;
        name: string;
        reason: string;
      }> = [];

      const errors: Array<{
        rowNumber: number;
        field?: string;
        message: string;
      }> = [];

      const seenFileStudentIds = new Set<string>();

      // 2. Process rows sequentially
      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2; // Row 1 is header
        const rawRow = rows[i];

        const firstName = getField(rawRow, "firstName", "first_name", "First Name");
        const lastName = getField(rawRow, "lastName", "last_name", "Last Name");
        const className = getField(rawRow, "className", "class_name", "class", "Class");
        const studentId = getField(rawRow, "studentId", "student_id", "admission_number", "Admission Number") || null;
        const admissionLevel = getField(rawRow, "admissionLevel", "admission_level", "Admission Level", "level", "Level") || null;
        const dateOfBirth = getField(rawRow, "dateOfBirth", "date_of_birth", "dob", "DOB", "Date of Birth") || null;
        const gender = getField(rawRow, "gender", "Gender") || null;
        const address = getField(rawRow, "address", "Address") || null;
        const guardianName = getField(rawRow, "guardianName", "guardian_name", "Guardian Name") || null;
        const guardianPhone = getField(rawRow, "guardianPhone", "guardian_phone", "Guardian Phone") || null;
        const guardianEmail = getField(rawRow, "guardianEmail", "guardian_email", "Guardian Email") || null;

        const fullName = `${firstName} ${lastName}`.trim() || `Row ${rowNumber}`;

        // Route-level check 1: Required Class Name
        if (!className) {
          errors.push({
            rowNumber,
            field: "className",
            message: "Class name is required",
          });
          continue;
        }

        // Route-level check 2: Class Name Resolution via classMap
        const resolvedClass = classMap.get(className.toLowerCase());
        if (!resolvedClass) {
          errors.push({
            rowNumber,
            field: "className",
            message: `Class '${className}' does not exist in your school`,
          });
          continue;
        }

        // Route-level check 3: In-file duplicate detection for manual studentId
        if (studentId) {
          const idKey = studentId.toLowerCase();
          if (seenFileStudentIds.has(idKey)) {
            skipped.push({
              rowNumber,
              studentId,
              name: fullName,
              reason: "Duplicate studentId within this CSV file",
            });
            continue;
          }
          seenFileStudentIds.add(idKey);
        }

        const rowSessionVal =
          getField(rawRow, "sessionId", "academicYear", "academic_year", "session", "Session", "Academic Year");
        const resolvedSession = rowSessionVal
          ? schoolSessions.find(
              (s) => s.id === rowSessionVal || s.name.toLowerCase() === rowSessionVal.toLowerCase()
            ) || defaultSession
          : defaultSession;

        const rowTermVal = getField(rawRow, "termId", "term", "Term");
        let resolvedTermId = defaultTermId;
        if (rowTermVal && resolvedSession) {
          const matchedTerm = resolvedSession.terms.find(
            (t) =>
              t.id === rowTermVal ||
              t.name.toLowerCase() === rowTermVal.toLowerCase() ||
              (rowTermVal === "1" && t.name.includes("First")) ||
              (rowTermVal === "2" && t.name.includes("Second")) ||
              (rowTermVal === "3" && t.name.includes("Third"))
          );
          if (matchedTerm) resolvedTermId = matchedTerm.id;
        }

        // Both dryRun and live execution delegate core validation to createStudentCore
        try {
          const runCore = (txClient?: Prisma.TransactionClient) =>
            createStudentCore(
              {
                schoolId,
                studentId,
                firstName,
                lastName,
                dateOfBirth,
                gender,
                address,
                admissionLevel,
                guardianName,
                guardianPhone,
                guardianEmail,
                classId: resolvedClass.id,
                sessionId: resolvedSession.id,
                termId: resolvedTermId,
                validateOnly: dryRun,
              },
              txClient
            );

          let result: CreateStudentResult;
          if (dryRun) {
            result = await runCore();
          } else {
            result = await prisma.$transaction(async (tx) => runCore(tx));
          }

          created.push({
            rowNumber,
            studentId: result.student.studentId,
            name: fullName,
            className: resolvedClass.name,
          });
        } catch (err: any) {
          if (err instanceof StudentValidationError) {
            if (err.statusCode === 409 && err.field === "studentId") {
              skipped.push({
                rowNumber,
                studentId,
                name: fullName,
                reason: "Student ID already exists in school",
              });
            } else {
              errors.push({
                rowNumber,
                field: err.field,
                message: err.message,
              });
            }
          } else if (err?.code === "P2002") {
            errors.push({
              rowNumber,
              field: "studentId",
              message: "Student ID conflict during creation",
            });
          } else {
            errors.push({
              rowNumber,
              message: err?.message || "Internal error creating student",
            });
          }
        }
      }

      return NextResponse.json(
        {
          data: {
            summary: {
              totalRows: rows.length,
              createdCount: created.length,
              skippedCount: skipped.length,
              errorCount: errors.length,
              dryRun,
            },
            created,
            skipped,
            errors,
          },
        },
        { status: dryRun || created.length === 0 ? 200 : 201 }
      );
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message || "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN]
);
