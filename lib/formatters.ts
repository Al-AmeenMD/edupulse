/**
 * Centralized currency and number formatting utilities for EduPulse.
 * Implements pure string-based formatting to guarantee zero floating-point arithmetic loss (Rule 6).
 */

/**
 * Formats an amount to a standard currency string (e.g. "15,000.00", "-5,000.00")
 * Uses pure string manipulation with half-up rounding for zero floating-point arithmetic loss.
 */
export function formatAmount(amount: number | string | { toString(): string } | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "0.00";

  let str = typeof amount === "string" ? amount.trim() : amount.toString();
  if (!str || str === "NaN") return "0.00";

  let isNegative = false;
  if (str.startsWith("-")) {
    isNegative = true;
    str = str.slice(1).trim();
  } else if (str.startsWith("+")) {
    str = str.slice(1).trim();
  }

  // Split integer and decimal parts
  const parts = str.split(".");
  let intPart = parts[0].replace(/\D/g, "") || "0";
  intPart = intPart.replace(/^0+(?=\d)/, ""); // Strip leading zeros unless it's just "0"

  let decPart = parts.length > 1 ? parts[1].replace(/\D/g, "") : "";

  // Handle rounding if more than 2 decimal digits are provided
  if (decPart.length > 2) {
    const roundDigit = parseInt(decPart[2], 10);
    let twoDigits = parseInt(decPart.slice(0, 2), 10);
    if (roundDigit >= 5) {
      twoDigits += 1;
      if (twoDigits === 100) {
        intPart = (BigInt(intPart || "0") + BigInt(1)).toString();
        decPart = "00";
      } else {
        decPart = String(twoDigits).padStart(2, "0");
      }
    } else {
      decPart = decPart.slice(0, 2);
    }
  } else if (decPart.length === 0) {
    decPart = "00";
  } else if (decPart.length === 1) {
    decPart = decPart + "0";
  }

  // Add thousands commas to integer part
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // If result is 0.00, don't display negative sign
  if (intPart === "0" && decPart === "00") {
    return "0.00";
  }

  return isNegative ? `-${formattedInt}.${decPart}` : `${formattedInt}.${decPart}`;
}

export interface FormatNairaOptions {
  showPlus?: boolean;
  showMinus?: boolean;
}

/**
 * Formats an amount with the Naira (₦) symbol prepended.
 * Guarantees correct negative sign placement (e.g. "-₦5,000.00", "+₦15,000.00", "₦15,000.00", "₦0.00").
 * Zero is always unsigned (never "-₦0.00" or "+₦0.00").
 */
export function formatNaira(
  amount: number | string | { toString(): string } | null | undefined,
  options?: FormatNairaOptions
): string {
  const formatted = formatAmount(amount);
  const isZero = formatted === "0.00";

  if (formatted.startsWith("-")) {
    return `-₦${formatted.slice(1)}`;
  }
  if (options?.showMinus && !isZero) {
    return `-₦${formatted}`;
  }
  if (options?.showPlus && !isZero) {
    return `+₦${formatted}`;
  }
  return `₦${formatted}`;
}
