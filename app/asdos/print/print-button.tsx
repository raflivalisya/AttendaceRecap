"use client";

export default function PrintButton() {
  return <button className="print-button" onClick={() => window.print()}>🖨 Print</button>;
}
