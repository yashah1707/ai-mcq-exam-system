export const downloadTablePdf = async ({ filename, title, subtitle, columns, rows }) => {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const autoTable = autoTableModule.default || autoTableModule;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  pdf.setFontSize(18);
  pdf.text(title || 'Report', 40, 40);

  if (subtitle) {
    pdf.setFontSize(10);
    pdf.setTextColor(90, 90, 90);
    pdf.text(subtitle, 40, 58);
    pdf.setTextColor(0, 0, 0);
  }

  autoTable(pdf, {
    startY: subtitle ? 76 : 60,
    head: [columns.map((column) => column.label)],
    body: rows.map((row) => columns.map((column) => row[column.key] ?? '')),
    styles: {
      fontSize: 9,
      cellPadding: 6,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 30, right: 30 },
  });

  pdf.save(filename || 'report.pdf');
};