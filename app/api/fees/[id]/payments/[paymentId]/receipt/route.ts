import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
    paymentId: string;
  }>;
};

function formatNairaPlain(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0.00";
  return `NGN ${num.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ---------------------------------------------------------------------------
// GET /api/fees/:id/payments/:paymentId/receipt — Generate PDF Receipt
// ---------------------------------------------------------------------------
export const GET = withAuth(
  async (req, context) => {
    try {
      const schoolId = req.user.schoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "Forbidden: No school associated with your account" },
          { status: 403 }
        );
      }

      const params = await context.params;
      const feeId = params?.id;
      const paymentId = params?.paymentId;

      if (!feeId || !paymentId) {
        return NextResponse.json(
          { error: "Fee ID and Payment ID are required" },
          { status: 400 }
        );
      }

      // --- Verify payment exists, belongs to fee and current school tenant ---
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          school: true,
          fee: {
            include: {
              student: {
                include: {
                  classEnrollments: {
                    include: {
                      class: true,
                    },
                  },
                },
              },
              feeStructure: true,
              payments: {
                orderBy: { paidAt: "asc" },
                select: {
                  id: true,
                  amount: true,
                  paidAt: true,
                },
              },
            },
          },
        },
      });

      if (
        !payment ||
        payment.feeId !== feeId ||
        payment.schoolId !== schoolId ||
        payment.fee.schoolId !== schoolId
      ) {
        return NextResponse.json(
          { error: "Payment record not found" },
          { status: 404 }
        );
      }

      // --- Generate PDF with pdf-lib ---
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // Standard A4
      const { height, width } = page.getSize();

      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const schoolName = payment.school.name || "EduPulse Academy";
      const student = payment.fee.student;
      const studentName = `${student.firstName} ${student.lastName}`;
      const studentId = student.studentId;
      const enrolledClass =
        student.classEnrollments?.[0]?.class?.name || "General";
      const feeStructure = payment.fee.feeStructure;
      const feeName = feeStructure.name;
      const academicPeriod = `${feeStructure.academicYear}${
        feeStructure.term ? ` - ${feeStructure.term}` : ""
      }`;
      const receiptNumber = payment.receiptNumber;
      const paymentDate = new Date(payment.paidAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const paymentMethod = payment.method.toUpperCase().replace("_", " ");
      const reference = payment.reference || "N/A";

      // Use Prisma.Decimal arithmetic for point-in-time accuracy
      const amountDue = new Prisma.Decimal(payment.fee.amountDue);
      const amountPaidThis = new Prisma.Decimal(payment.amount);

      // Compute point-in-time cumulative total paid up to and including THIS payment
      let cumulativePaid = new Prisma.Decimal(0);
      for (const p of payment.fee.payments) {
        const pDate = new Date(p.paidAt).getTime();
        const targetDate = new Date(payment.paidAt).getTime();
        if (pDate < targetDate || (pDate === targetDate && p.id <= payment.id)) {
          cumulativePaid = cumulativePaid.add(new Prisma.Decimal(p.amount));
        }
      }

      const remainingBalance = amountDue.greaterThan(cumulativePaid)
        ? amountDue.sub(cumulativePaid)
        : new Prisma.Decimal(0);
      const hasRemainingBalance = remainingBalance.greaterThan(0);

      // --- Palette ---
      const primaryColor = rgb(0.08, 0.18, 0.36); // #142e5c Deep Navy
      const darkSlate = rgb(0.12, 0.16, 0.22); // #1f2937
      const mutedSlate = rgb(0.4, 0.45, 0.52); // #64748b
      const lightBg = rgb(0.96, 0.97, 0.99); // #f8fafc
      const borderColor = rgb(0.85, 0.88, 0.92); // #dbe2ea
      const emeraldText = rgb(0.05, 0.48, 0.32);

      // 1. Header Banner
      page.drawRectangle({
        x: 40,
        y: height - 120,
        width: width - 80,
        height: 80,
        color: primaryColor,
      });

      page.drawText(schoolName.toUpperCase(), {
        x: 60,
        y: height - 70,
        size: 18,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      page.drawText("OFFICIAL PAYMENT RECEIPT", {
        x: 60,
        y: height - 92,
        size: 11,
        font: fontRegular,
        color: rgb(0.8, 0.88, 1),
      });

      // 2. Receipt Meta Box
      page.drawRectangle({
        x: 40,
        y: height - 190,
        width: width - 80,
        height: 55,
        color: lightBg,
        borderColor: borderColor,
        borderWidth: 1,
      });

      page.drawText("RECEIPT NUMBER", {
        x: 55,
        y: height - 152,
        size: 8,
        font: fontBold,
        color: mutedSlate,
      });
      page.drawText(receiptNumber, {
        x: 55,
        y: height - 172,
        size: 12,
        font: fontBold,
        color: primaryColor,
      });

      page.drawText("DATE OF PAYMENT", {
        x: 235,
        y: height - 152,
        size: 8,
        font: fontBold,
        color: mutedSlate,
      });
      page.drawText(paymentDate, {
        x: 235,
        y: height - 172,
        size: 10,
        font: fontRegular,
        color: darkSlate,
      });

      page.drawText("PAYMENT METHOD", {
        x: 400,
        y: height - 152,
        size: 8,
        font: fontBold,
        color: mutedSlate,
      });
      page.drawText(paymentMethod, {
        x: 400,
        y: height - 172,
        size: 10,
        font: fontBold,
        color: darkSlate,
      });

      // 3. Student Details Section
      let currentY = height - 225;
      page.drawText("STUDENT INFORMATION", {
        x: 40,
        y: currentY,
        size: 10,
        font: fontBold,
        color: primaryColor,
      });

      page.drawLine({
        start: { x: 40, y: currentY - 6 },
        end: { x: width - 40, y: currentY - 6 },
        color: borderColor,
        thickness: 1,
      });

      currentY -= 28;
      page.drawText("Student Name:", {
        x: 40,
        y: currentY,
        size: 9,
        font: fontBold,
        color: mutedSlate,
      });
      page.drawText(studentName, {
        x: 130,
        y: currentY,
        size: 9,
        font: fontBold,
        color: darkSlate,
      });

      page.drawText("Student ID:", {
        x: 340,
        y: currentY,
        size: 9,
        font: fontBold,
        color: mutedSlate,
      });
      page.drawText(studentId, {
        x: 410,
        y: currentY,
        size: 9,
        font: fontRegular,
        color: darkSlate,
      });

      currentY -= 20;
      page.drawText("Class / Level:", {
        x: 40,
        y: currentY,
        size: 9,
        font: fontBold,
        color: mutedSlate,
      });
      page.drawText(enrolledClass, {
        x: 130,
        y: currentY,
        size: 9,
        font: fontRegular,
        color: darkSlate,
      });

      page.drawText("Reference:", {
        x: 340,
        y: currentY,
        size: 9,
        font: fontBold,
        color: mutedSlate,
      });
      page.drawText(reference, {
        x: 410,
        y: currentY,
        size: 9,
        font: fontRegular,
        color: darkSlate,
      });

      // 4. Payment Breakdown Table
      currentY -= 35;
      page.drawText("FEE BREAKDOWN & PAYMENT DETAILS", {
        x: 40,
        y: currentY,
        size: 10,
        font: fontBold,
        color: primaryColor,
      });

      page.drawLine({
        start: { x: 40, y: currentY - 6 },
        end: { x: width - 40, y: currentY - 6 },
        color: borderColor,
        thickness: 1,
      });

      currentY -= 30;
      // Table Header Row
      page.drawRectangle({
        x: 40,
        y: currentY - 8,
        width: width - 80,
        height: 24,
        color: lightBg,
      });

      page.drawText("ITEM DESCRIPTION", {
        x: 50,
        y: currentY,
        size: 8,
        font: fontBold,
        color: mutedSlate,
      });
      page.drawText("PERIOD", {
        x: 270,
        y: currentY,
        size: 8,
        font: fontBold,
        color: mutedSlate,
      });
      page.drawText("AMOUNT PAID", {
        x: 430,
        y: currentY,
        size: 8,
        font: fontBold,
        color: mutedSlate,
      });

      currentY -= 26;
      // Item Row
      page.drawText(feeName, {
        x: 50,
        y: currentY,
        size: 9,
        font: fontBold,
        color: darkSlate,
      });
      page.drawText(academicPeriod, {
        x: 270,
        y: currentY,
        size: 9,
        font: fontRegular,
        color: darkSlate,
      });
      page.drawText(formatNairaPlain(amountPaidThis.toFixed(2)), {
        x: 430,
        y: currentY,
        size: 9,
        font: fontBold,
        color: darkSlate,
      });

      currentY -= 15;
      page.drawLine({
        start: { x: 40, y: currentY },
        end: { x: width - 40, y: currentY },
        color: borderColor,
        thickness: 1,
      });

      // Summary Totals
      currentY -= 25;
      page.drawText("Total Fee Amount Due:", {
        x: 290,
        y: currentY,
        size: 9,
        font: fontRegular,
        color: mutedSlate,
      });
      page.drawText(formatNairaPlain(amountDue.toFixed(2)), {
        x: 440,
        y: currentY,
        size: 9,
        font: fontRegular,
        color: darkSlate,
      });

      currentY -= 20;
      page.drawText("Amount Paid (This Transaction):", {
        x: 250,
        y: currentY,
        size: 9,
        font: fontBold,
        color: emeraldText,
      });
      page.drawText(formatNairaPlain(amountPaidThis.toFixed(2)), {
        x: 440,
        y: currentY,
        size: 9,
        font: fontBold,
        color: emeraldText,
      });

      currentY -= 20;
      page.drawText("Cumulative Total Paid:", {
        x: 290,
        y: currentY,
        size: 9,
        font: fontRegular,
        color: darkSlate,
      });
      page.drawText(formatNairaPlain(cumulativePaid.toFixed(2)), {
        x: 440,
        y: currentY,
        size: 9,
        font: fontBold,
        color: darkSlate,
      });

      currentY -= 20;
      page.drawText("Remaining Outstanding Balance:", {
        x: 245,
        y: currentY,
        size: 9,
        font: fontBold,
        color: hasRemainingBalance ? rgb(0.7, 0.15, 0.15) : darkSlate,
      });
      page.drawText(formatNairaPlain(remainingBalance.toFixed(2)), {
        x: 440,
        y: currentY,
        size: 9,
        font: fontBold,
        color: hasRemainingBalance ? rgb(0.7, 0.15, 0.15) : darkSlate,
      });

      // 5. Footer & Verification Seal
      const footerY = 80;
      page.drawLine({
        start: { x: 40, y: footerY + 30 },
        end: { x: width - 40, y: footerY + 30 },
        color: borderColor,
        thickness: 1,
      });

      page.drawText("EduPulse School Management System - Verified Payment Receipt", {
        x: 40,
        y: footerY + 14,
        size: 8,
        font: fontBold,
        color: primaryColor,
      });

      page.drawText(
        `Recorded By: ${payment.recordedBy} | Generated: ${new Date().toUTCString()}`,
        {
          x: 40,
          y: footerY,
          size: 7,
          font: fontRegular,
          color: mutedSlate,
        }
      );

      page.drawText("This is an official computer-generated receipt.", {
        x: 350,
        y: footerY,
        size: 7,
        font: fontRegular,
        color: mutedSlate,
      });

      // --- Serialize PDF ---
      const pdfBytes = await pdfDoc.save();
      const filename = `receipt-${receiptNumber.replace(/\//g, "-")}.pdf`;

      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } catch (err: any) {
      console.error("GET /api/fees/[id]/payments/[paymentId]/receipt error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
