import { jsPDF } from "jspdf";

export function generatePDF(report: any, id: string) {
  const doc = new jsPDF();
  const margin = 20;
  let y = 20;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(124, 58, 237); // Brand Primary
  doc.text("AI Startup Idea Validator", margin, y);
  y += 10;
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Report ID: ${id} | Date: ${new Date().toLocaleDateString()}`, margin, y);
  y += 15;

  // Original Hypothesis
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Original Idea:", margin, y);
  y += 7;
  doc.setFontSize(11);
  const splitHypothesis = doc.splitTextToSize(report.critic?.original_hypothesis || "", 170);
  doc.text(splitHypothesis, margin, y);
  y += splitHypothesis.length * 5 + 10;

  // Scores
  doc.setFontSize(14);
  doc.text("Validation Scores:", margin, y);
  y += 10;
  
  const scores = report.financial_model?.score_breakdown || {};
  const rows = [
    ["Dimension", "Score", "Weight"],
    ["Demand Signal", `${Math.round(scores.demand_signal || 0)}/100`, "40%"],
    ["Competitive Gap", `${Math.round(scores.competitive_gap || 0)}/100`, "35%"],
    ["Feasibility", `${Math.round(scores.feasibility || 0)}/100`, "25%"],
    ["Overall Viability", `${report.financial_model?.viability_score || 0}/100`, "100%"]
  ];

  (doc as any).autoTable ? (doc as any).autoTable({
    startY: y,
    head: [rows[0]],
    body: rows.slice(1),
    theme: 'striped',
    headStyles: { fillColor: [124, 58, 237] }
  }) : null;
  
  // Basic layout without autotable if it's not available
  if (!(doc as any).autoTable) {
    rows.forEach(row => {
      doc.text(`${row[0]}: ${row[1]}`, margin, y);
      y += 7;
    });
  } else {
    y = (doc as any).lastAutoTable.finalY + 20;
  }

  // Market Insights
  doc.setFontSize(14);
  doc.text("Market Insights:", margin, y);
  y += 10;
  doc.setFontSize(11);
  doc.text(`Total Addressable Market (TAM): ${report.financial_model?.market_metrics?.tam_formatted || "N/A"}`, margin, y);
  y += 7;
  const whyNow = report.market_research?.why_now_signal?.summary || "";
  const splitWhyNow = doc.splitTextToSize(`Why Now: ${whyNow}`, 170);
  doc.text(splitWhyNow, margin, y);
  y += splitWhyNow.length * 5 + 15;

  // SDG Alignment
  doc.setFontSize(14);
  doc.text("SDG Alignment:", margin, y);
  y += 10;
  doc.setFontSize(11);
  doc.text(`Impact Score: ${report.sdg?.score || 0}/100`, margin, y);
  y += 7;
  const sdgTags = (report.sdg?.sdg_tags || []).join(", ");
  doc.text(`Goals: ${sdgTags}`, margin, y);
  y += 15;

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text("Built with AI Startup Validator | Innovation Mentor 2026", margin, 285);

  doc.save(`validation_report_${id.slice(0, 8)}.pdf`);
}
