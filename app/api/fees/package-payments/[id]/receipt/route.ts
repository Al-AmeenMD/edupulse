import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { withAuth } from "@/lib/middleware/withAuth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function formatNairaPlain(amount: number | string | Prisma.Decimal): string {
  const num = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (isNaN(num)) return "0.00";
  return `NGN ${num.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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

      const { id: packagePaymentId } = await context.params;

      if (!packagePaymentId) {
        return NextResponse.json(
          { error: "Package Payment ID is required" },
          { status: 400 }
        );
      }

      const packagePayment = await prisma.packagePayment.findUnique({
        where: { id: packagePaymentId },
        include: {
          school: true,
          package: {
            include: {
              items: {
                include: { feeStructure: true },
              },
            },
          },
          student: {
            include: {
              classEnrollments: {
                include: { class: true },
                orderBy: { enrolledAt: "desc" },
                take: 1,
              },
            },
          },
          payments: {
            include: {
              fee: {
                include: { feeStructure: true },
              },
            },
          },
        },
      });

      // Strict tenant check
      if (!packagePayment || packagePayment.schoolId !== schoolId) {
        return NextResponse.json(
          { error: "Package payment record not found" },
          { status: 404 }
        );
      }

      // Fetch all assigned Fee records for this student matching bundled package structures with all payments for historical point-in-time calculation
      const bundledStructureIds = packagePayment.package?.items.map((it) => it.feeStructureId) || [];
      const studentPackageFees = await prisma.fee.findMany({
        where: {
          schoolId,
          studentId: packagePayment.studentId,
          feeStructureId: { in: bundledStructureIds },
        },
        include: {
          feeStructure: true,
          payments: {
            orderBy: { paidAt: "asc" },
            select: {
              id: true,
              amount: true,
              paidAt: true,
              packagePaymentId: true,
            },
          },
        },
      });

      // 1. Total Package Cost (bundled package face value)
      let totalPackageCost = new Prisma.Decimal(0);
      if (packagePayment.package?.items) {
        for (const it of packagePayment.package.items) {
          if (it.feeStructure?.amount) {
            totalPackageCost = totalPackageCost.add(new Prisma.Decimal(it.feeStructure.amount));
          }
        }
      }

      // 2. Total Paid This Transaction
      const totalPaidThisTransaction = new Prisma.Decimal(packagePayment.amount);

      // 3. Point-in-time Net Remaining Package Balance (accounting for all bundled components up to this transaction)
      const targetTransactionTime = new Date(packagePayment.paidAt).getTime();
      let netRemainingPackageBalance = new Prisma.Decimal(0);

      for (const item of packagePayment.package?.items || []) {
        const matchingFee = studentPackageFees.find((f) => f.feeStructureId === item.feeStructureId);
        if (!matchingFee || matchingFee.status === "WAIVED") {
          // Unassigned or waived components contribute 0 to outstanding balance unconditionally
          continue;
        }

        const feeAmountDue = new Prisma.Decimal(matchingFee.amountDue);
        const currentAmountPaid = new Prisma.Decimal(matchingFee.amountPaid);
        let paymentsAfterThisTx = new Prisma.Decimal(0);
        const thisFeePayment = packagePayment.payments.find((p) => p.feeId === matchingFee.id);
        const refIdForTiebreak = thisFeePayment?.id || packagePayment.id;

        for (const p of matchingFee.payments) {
          const pTime = new Date(p.paidAt).getTime();
          // Exclude payments that belong to this packagePayment
          if (p.packagePaymentId === packagePayment.id || p.id === thisFeePayment?.id) {
            continue;
          }
          // A payment occurred strictly after this transaction if its timestamp is greater,
          // or if same timestamp and cuid is greater (cuid tiebreak)
          const isStrictlyAfter =
            pTime > targetTransactionTime ||
            (pTime === targetTransactionTime && p.id > refIdForTiebreak);

          if (isStrictlyAfter) {
            paymentsAfterThisTx = paymentsAfterThisTx.add(new Prisma.Decimal(p.amount));
          }
        }

        // Point-in-time paid as of this transaction
        const pointInTimePaid = currentAmountPaid.sub(paymentsAfterThisTx);
        const feeRemaining = feeAmountDue.greaterThan(pointInTimePaid)
          ? feeAmountDue.sub(pointInTimePaid)
          : new Prisma.Decimal(0);

        netRemainingPackageBalance = netRemainingPackageBalance.add(feeRemaining);
      }

      // Look up recorder user
      const recorder = await prisma.user.findFirst({
        where: { id: packagePayment.recordedBy, schoolId },
        select: { firstName: true, lastName: true },
      });
      const recordedByName = recorder
        ? `${recorder.firstName} ${recorder.lastName}`.trim()
        : "School Administrator";

      // Build PDF document with pdf-lib
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
      const { width, height } = page.getSize();

      // Brand Colors
      const colorNavy = rgb(0.08, 0.18, 0.36); // #142e5c
      const colorEmerald = rgb(0.02, 0.59, 0.41); // #059669
      const colorMuted = rgb(0.39, 0.45, 0.55); // #64748b
      const colorBorder = rgb(0.88, 0.91, 0.94); // #e2e8f0
      const colorCardBg = rgb(0.97, 0.98, 0.99); // #f8fafc
      const colorDarkText = rgb(0.06, 0.09, 0.16); // #0f172a

      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let y = height - 50;

      // 1. Header Banner
      page.drawRectangle({
        x: 40,
        y: y - 55,
        width: width - 80,
        height: 65,
        color: colorNavy,
      });

      // School Name
      const schoolName = packagePayment.school.name.toUpperCase();
      page.drawText(schoolName, {
        x: 55,
        y: y - 20,
        size: 15,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      page.drawText("OFFICIAL FEE PACKAGE PAYMENT RECEIPT", {
        x: 55,
        y: y - 38,
        size: 9,
        font: fontRegular,
        color: rgb(0.8, 0.88, 0.98),
      });

      // 2. Receipt Number & Badge Box
      y = y - 80;
      page.drawRectangle({
        x: 40,
        y: y - 35,
        width: width - 80,
        height: 38,
        color: colorCardBg,
        borderColor: colorBorder,
        borderWidth: 1,
      });

      page.drawText("RECEIPT NUMBER", {
        x: 55,
        y: y - 14,
        size: 7.5,
        font: fontBold,
        color: colorMuted,
      });

      page.drawText(packagePayment.receiptNumber, {
        x: 55,
        y: y - 28,
        size: 11,
        font: fontBold,
        color: colorNavy,
      });

      // Verification Badge Right
      page.drawRectangle({
        x: width - 150,
        y: y - 28,
        width: 95,
        height: 20,
        color: rgb(0.9, 0.98, 0.94),
        borderColor: colorEmerald,
        borderWidth: 1,
      });

      page.drawText("VERIFIED PAID", {
        x: width - 135,
        y: y - 21,
        size: 8,
        font: fontBold,
        color: colorEmerald,
      });

      // 3. Metadata Grid (3 Rows)
      y = y - 55;
      page.drawRectangle({
        x: 40,
        y: y - 55,
        width: width - 80,
        height: 60,
        color: rgb(1, 1, 1),
        borderColor: colorBorder,
        borderWidth: 1,
      });

      // Row 1 Metadata
      page.drawText("Academic Term:", { x: 55, y: y - 12, size: 9, font: fontRegular, color: colorMuted });
      page.drawText(`${packagePayment.package?.academicYear || "N/A"} | ${packagePayment.package?.term || "N/A"}`, {
        x: 145,
        y: y - 12,
        size: 9,
        font: fontBold,
        color: colorDarkText,
      });

      page.drawText("Date Paid:", { x: 330, y: y - 12, size: 9, font: fontRegular, color: colorMuted });
      page.drawText(
        new Date(packagePayment.paidAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        { x: 400, y: y - 12, size: 9, font: fontBold, color: colorDarkText }
      );

      // Row 2 Metadata
      page.drawText("Payment Method:", { x: 55, y: y - 30, size: 9, font: fontRegular, color: colorMuted });
      page.drawText(packagePayment.method.toUpperCase().replace("_", " "), {
        x: 145,
        y: y - 30,
        size: 9,
        font: fontBold,
        color: colorDarkText,
      });

      page.drawText("Reference:", { x: 330, y: y - 30, size: 9, font: fontRegular, color: colorMuted });
      page.drawText(packagePayment.reference || "N/A", { x: 400, y: y - 30, size: 9, font: fontRegular, color: colorDarkText });

      // Row 3 Metadata
      page.drawText("Recorded By:", { x: 55, y: y - 48, size: 9, font: fontRegular, color: colorMuted });
      page.drawText(recordedByName, { x: 145, y: y - 48, size: 9, font: fontRegular, color: colorDarkText });

      // 4. Student & Package Details
      y = y - 75;
      page.drawText("STUDENT & PACKAGE INFORMATION", {
        x: 40,
        y,
        size: 10,
        font: fontBold,
        color: colorNavy,
      });

      y -= 8;
      page.drawRectangle({
        x: 40,
        y: y - 48,
        width: width - 80,
        height: 50,
        color: rgb(1, 1, 1),
        borderColor: colorBorder,
        borderWidth: 1,
      });

      const studentName = `${packagePayment.student.firstName} ${packagePayment.student.lastName}`;
      const className = packagePayment.student.classEnrollments[0]?.class?.name || "N/A";
      const pkgName = packagePayment.package?.name || "Fee Package";

      page.drawText("Student Name:", { x: 55, y: y - 16, size: 9, font: fontRegular, color: colorMuted });
      page.drawText(studentName, { x: 135, y: y - 16, size: 9, font: fontBold, color: colorDarkText });

      page.drawText("Student ID:", { x: 330, y: y - 16, size: 9, font: fontRegular, color: colorMuted });
      page.drawText(packagePayment.student.studentId, { x: 400, y: y - 16, size: 9, font: fontBold, color: colorNavy });

      page.drawText("Class:", { x: 55, y: y - 36, size: 9, font: fontRegular, color: colorMuted });
      page.drawText(className, { x: 135, y: y - 36, size: 9, font: fontRegular, color: colorDarkText });

      page.drawText("Package:", { x: 330, y: y - 36, size: 9, font: fontRegular, color: colorMuted });
      page.drawText(pkgName, { x: 400, y: y - 36, size: 9, font: fontBold, color: colorDarkText });

      // 5. Itemized Breakdown Table
      y = y - 70;
      page.drawText("ITEMIZED COMPONENT ALLOCATION", {
        x: 40,
        y,
        size: 10,
        font: fontBold,
        color: colorNavy,
      });

      y -= 12;
      // Table Header
      page.drawRectangle({
        x: 40,
        y: y - 18,
        width: width - 80,
        height: 20,
        color: colorCardBg,
        borderColor: colorBorder,
        borderWidth: 1,
      });

      page.drawText("Fee Component", { x: 50, y: y - 12, size: 8, font: fontBold, color: colorNavy });
      page.drawText("Type", { x: 205, y: y - 12, size: 8, font: fontBold, color: colorNavy });
      page.drawText("Component Receipt", { x: 270, y: y - 12, size: 8, font: fontBold, color: colorNavy });
      page.drawText("Status / Note", { x: 380, y: y - 12, size: 8, font: fontBold, color: colorNavy });
      page.drawText("Allocated (NGN)", { x: 480, y: y - 12, size: 8, font: fontBold, color: colorNavy });

      y -= 20;

      // Render payments
      for (const p of packagePayment.payments) {
        const structName = p.fee.feeStructure.name;
        const structType = p.fee.feeStructure.type;
        const compReceipt = p.receiptNumber;
        const compAmount = formatNairaPlain(p.amount);

        page.drawRectangle({
          x: 40,
          y: y - 18,
          width: width - 80,
          height: 20,
          color: rgb(1, 1, 1),
          borderColor: colorBorder,
          borderWidth: 0.5,
        });

        page.drawText(structName.substring(0, 24), { x: 50, y: y - 13, size: 8, font: fontRegular, color: colorDarkText });
        page.drawText(structType, { x: 205, y: y - 13, size: 8, font: fontRegular, color: colorMuted });
        page.drawText(compReceipt, { x: 270, y: y - 13, size: 8, font: fontBold, color: colorDarkText });
        page.drawText("Payment Allocated", { x: 380, y: y - 13, size: 8, font: fontRegular, color: colorEmerald });
        page.drawText(compAmount, { x: 480, y: y - 13, size: 8, font: fontBold, color: colorEmerald });

        y -= 20;
      }

      // Check if package had other items not in this payment (e.g. 0-allocated or already settled or unassigned)
      const paidFeeIds = new Set(packagePayment.payments.map((p) => p.fee.feeStructureId));
      if (packagePayment.package?.items) {
        for (const item of packagePayment.package.items) {
          if (!paidFeeIds.has(item.feeStructureId) && item.feeStructure) {
            page.drawRectangle({
              x: 40,
              y: y - 18,
              width: width - 80,
              height: 20,
              color: rgb(0.99, 0.99, 0.99),
              borderColor: colorBorder,
              borderWidth: 0.5,
            });

            const matchingFee = studentPackageFees.find((f) => f.feeStructureId === item.feeStructureId);
            const statusNote = !matchingFee
              ? "Unassigned"
              : matchingFee.status === "WAIVED"
              ? "Waived"
              : "Previously Settled";

            page.drawText(item.feeStructure.name.substring(0, 24), { x: 50, y: y - 13, size: 8, font: fontRegular, color: colorMuted });
            page.drawText(item.feeStructure.type, { x: 205, y: y - 13, size: 8, font: fontRegular, color: colorMuted });
            page.drawText("N/A", { x: 270, y: y - 13, size: 8, font: fontRegular, color: colorMuted });
            page.drawText(statusNote, { x: 380, y: y - 13, size: 8, font: fontRegular, color: colorMuted });
            page.drawText("NGN 0.00", { x: 480, y: y - 13, size: 8, font: fontRegular, color: colorMuted });

            y -= 20;
          }
        }
      }

      // 6. Comprehensive Financial Summary Box (All 3 Figures)
      y -= 12;
      page.drawRectangle({
        x: 40,
        y: y - 72,
        width: width - 80,
        height: 72,
        color: colorCardBg,
        borderColor: colorBorder,
        borderWidth: 1,
      });

      // Row 1: Total Package Cost
      page.drawText("Total Package Cost:", {
        x: 55,
        y: y - 18,
        size: 9,
        font: fontRegular,
        color: colorMuted,
      });
      page.drawText(formatNairaPlain(totalPackageCost.toFixed(2)), {
        x: 210,
        y: y - 18,
        size: 9,
        font: fontBold,
        color: colorDarkText,
      });

      // Row 2: Total Paid This Transaction
      page.drawText("Total Paid This Transaction:", {
        x: 55,
        y: y - 38,
        size: 9,
        font: fontBold,
        color: colorEmerald,
      });
      page.drawText(formatNairaPlain(totalPaidThisTransaction.toFixed(2)), {
        x: 210,
        y: y - 38,
        size: 10,
        font: fontBold,
        color: colorEmerald,
      });

      // Row 3: Net Remaining Package Balance (Point-in-Time)
      const hasPackageRemaining = netRemainingPackageBalance.greaterThan(0);
      page.drawText("Net Remaining Package Balance:", {
        x: 55,
        y: y - 58,
        size: 9,
        font: fontBold,
        color: hasPackageRemaining ? rgb(0.7, 0.15, 0.15) : colorNavy,
      });
      page.drawText(formatNairaPlain(netRemainingPackageBalance.toFixed(2)), {
        x: 210,
        y: y - 58,
        size: 10,
        font: fontBold,
        color: hasPackageRemaining ? rgb(0.7, 0.15, 0.15) : colorNavy,
      });

      // 7. Standardized Official Footer Seal (Unified with Single Fee Receipt)
      const footerY = 70;
      page.drawLine({
        start: { x: 40, y: footerY + 28 },
        end: { x: width - 40, y: footerY + 28 },
        thickness: 1,
        color: colorBorder,
      });

      page.drawText("EduPulse School Management System - Verified Payment Receipt", {
        x: 40,
        y: footerY + 12,
        size: 8,
        font: fontBold,
        color: colorNavy,
      });

      page.drawText(`Recorded By: ${recordedByName} | Generated: ${new Date().toUTCString()}`, {
        x: 40,
        y: footerY - 2,
        size: 7,
        font: fontRegular,
        color: colorMuted,
      });

      page.drawText("This is an official computer-generated receipt.", {
        x: width - 210,
        y: footerY - 2,
        size: 7,
        font: fontRegular,
        color: colorMuted,
      });

      const pdfBytes = await pdfDoc.save();
      const filename = `package-receipt-${packagePayment.receiptNumber.replace(/\//g, "-")}.pdf`;

      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${filename}"`,
          "Content-Length": String(pdfBytes.length),
        },
      });
    } catch (err: any) {
      console.error("GET /api/fees/package-payments/[id]/receipt error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  [Role.SCHOOL_ADMIN, Role.FINANCE_ADMIN]
);
