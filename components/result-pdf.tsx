'use client';
import { useState } from 'react';
import { Download, FileText, Loader2, AlertCircle } from 'lucide-react';

interface ResultPDFProps {
  resultId: string;
  studentName?: string;
  examName?: string;
  className?: string;
  isPublished?: boolean;
  variant?: 'button' | 'card' | 'inline';
}

export default function ResultPDF({ 
  resultId, 
  studentName = 'Student',
  examName = 'Examination',
  className = '',
  isPublished = false,
  variant = 'button'
}: ResultPDFProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownloadPDF() {
    if (!isPublished) {
      setError('Result must be published before downloading PDF');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch PDF data from API
      const response = await fetch(`/api/results/pdf/${resultId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const { data } = await response.json();

      // Generate PDF using browser's print functionality
      // In production, you would use a library like jsPDF or pdfmake
      // or call a server-side PDF generation service
      
      const pdfContent = generatePDFHTML(data);
      
      // Create a printable window
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(pdfContent);
        printWindow.document.close();
        
        // Wait for styles to load then print
        setTimeout(() => {
          printWindow.print();
          // Optionally close after printing
          // printWindow.close();
        }, 500);
      }

    } catch (err) {
      console.error('Error generating PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setLoading(false);
    }
  }

  function generatePDFHTML(data: any): string {
    const { 
      student_name, 
      student_code, 
      class_name, 
      section_name,
      exam_name,
      exam_term,
      total_marks,
      total_max_marks,
      percentage,
      grade,
      rank,
      subjects,
      attendance,
      template,
      generated_at
    } = data;

    const subjectRows = subjects?.map((s: any) => `
      <tr>
        <td>${s.subject_name}</td>
        <td>${s.subject_code || ''}</td>
        <td class="text-right">${Number(s.marks).toFixed(2)}</td>
        <td class="text-right">${Number(s.max_marks).toFixed(2)}</td>
        <td class="text-right">${Number(s.percentage).toFixed(1)}%</td>
        <td class="text-center"><strong>${s.grade}</strong></td>
      </tr>
    `).join('') || '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Result - ${student_name} - ${exam_name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Times New Roman', Times, serif; 
      padding: 40px;
      color: #333;
      line-height: 1.6;
    }
    .container { max-width: 800px; margin: 0 auto; }
    
    /* Header */
    .header { 
      text-align: center; 
      border-bottom: 3px double #333; 
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .school-logo { width: 80px; height: 80px; margin-bottom: 10px; }
    .school-name { 
      font-size: 24px; 
      font-weight: bold; 
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .school-address { font-size: 14px; color: #666; }
    .exam-title { 
      font-size: 18px; 
      margin-top: 15px;
      font-weight: bold;
      text-transform: uppercase;
    }
    
    /* Student Info */
    .student-info {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 30px;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 5px;
    }
    .info-row { display: flex; }
    .info-label { font-weight: bold; width: 120px; }
    .info-value { flex: 1; }
    
    /* Marks Table */
    .marks-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .marks-table th, .marks-table td {
      border: 1px solid #333;
      padding: 10px;
      text-align: left;
    }
    .marks-table th {
      background: #f0f0f0;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 12px;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    
    /* Summary */
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 30px;
      padding: 20px;
      background: #f9f9f9;
      border-radius: 5px;
    }
    .summary-item { text-align: center; }
    .summary-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .summary-value { 
      font-size: 20px; 
      font-weight: bold; 
      margin-top: 5px;
    }
    
    /* Attendance */
    .attendance {
      margin-bottom: 30px;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 5px;
    }
    .attendance h3 { margin-bottom: 10px; font-size: 14px; }
    
    /* Footer */
    .footer {
      margin-top: 60px;
      display: flex;
      justify-content: space-between;
      padding-top: 40px;
    }
    .signature-line {
      border-top: 1px solid #333;
      width: 200px;
      text-align: center;
      padding-top: 10px;
      font-size: 14px;
    }
    
    .generated-at {
      text-align: right;
      font-size: 11px;
      color: #999;
      margin-top: 30px;
    }
    
    /* Grade highlight */
    .grade-excellent { color: #22c55e; }
    .grade-good { color: #3b82f6; }
    .grade-average { color: #f59e0b; }
    .grade-poor { color: #ef4444; }
    
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      ${template.logo_url ? `<img src="${template.logo_url}" alt="Logo" class="school-logo">` : ''}
      <div class="school-name">${template.header_text || 'CHAMPION ENGLISH SCHOOL'}</div>
      <div class="school-address">${template.sub_header_text || 'Dharan-15, Sunsari, Nepal'}</div>
      <div class="exam-title">${exam_term || 'EXAMINATION'} - ${exam_name || 'Result'}</div>
    </div>
    
    <!-- Student Information -->
    <div class="student-info">
      <div class="info-row">
        <span class="info-label">Name:</span>
        <span class="info-value">${student_name || 'N/A'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Student ID:</span>
        <span class="info-value">${student_code || 'N/A'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Class:</span>
        <span class="info-value">${class_name || ''}${section_name ? ` - Section ${section_name}` : ''}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Generated:</span>
        <span class="info-value">${generated_at || new Date().toLocaleString()}</span>
      </div>
    </div>
    
    <!-- Subject-wise Marks -->
    <table class="marks-table">
      <thead>
        <tr>
          <th>Subject</th>
          <th>Code</th>
          <th class="text-right">Obtained</th>
          <th class="text-right">Max Marks</th>
          <th class="text-right">Percentage</th>
          <th class="text-center">Grade</th>
        </tr>
      </thead>
      <tbody>
        ${subjectRows}
      </tbody>
    </table>
    
    <!-- Summary -->
    <div class="summary">
      <div class="summary-item">
        <div class="summary-label">Total Marks</div>
        <div class="summary-value">${Number(total_marks).toFixed(2)} / ${Number(total_max_marks).toFixed(2)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Percentage</div>
        <div class="summary-value">${Number(percentage).toFixed(2)}%</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Grade</div>
        <div class="summary-value ${getGradeClass(grade)}">${grade || 'N/A'}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Class Rank</div>
        <div class="summary-value">#${rank || 'N/A'}</div>
      </div>
    </div>
    
    <!-- Attendance (if included) -->
    ${template.include_attendance && attendance ? `
    <div class="attendance">
      <h3>Attendance Summary</h3>
      <div class="student-info" style="margin-bottom: 0;">
        <div class="info-row">
          <span class="info-label">Total Days:</span>
          <span class="info-value">${attendance.total_days || 0}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Present:</span>
          <span class="info-value">${attendance.present_days || 0}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Absent:</span>
          <span class="info-value">${attendance.absent_days || 0}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Attendance %:</span>
          <span class="info-value">${attendance.percentage || 0}%</span>
        </div>
      </div>
    </div>
    ` : ''}
    
    <!-- Footer -->
    <div class="footer">
      <div class="signature-line">${template.footer_left || 'Class Teacher'}</div>
      <div class="signature-line">${template.footer_right || 'Principal/Admin'}</div>
    </div>
    
    <div class="generated-at">Generated on: ${generated_at}</div>
  </div>
  
  <script>
    function getGradeClass(grade) {
      if (!grade) return '';
      if (['A+', 'A'].includes(grade)) return 'grade-excellent';
      if (['B+', 'B'].includes(grade)) return 'grade-good';
      if (['C+', 'C'].includes(grade)) return 'grade-average';
      return 'grade-poor';
    }
  </script>
</body>
</html>
    `;
  }

  function getGradeClass(grade: string): string {
    if (!grade) return '';
    if (['A+', 'A'].includes(grade)) return 'grade-excellent';
    if (['B+', 'B'].includes(grade)) return 'grade-good';
    if (['C+', 'C'].includes(grade)) return 'grade-average';
    return 'grade-poor';
  }

  if (variant === 'card') {
    return (
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={20} />
          Download Result PDF
        </h3>
        <p style={{ marginBottom: '15px', color: '#666', fontSize: '14px' }}>
          {studentName} - {examName}
        </p>
        {error && (
          <div style={{ 
            padding: '10px', 
            background: '#fef2f2', 
            border: '1px solid #fecaca',
            borderRadius: '5px',
            marginBottom: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#dc2626',
            fontSize: '13px'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        <button
          onClick={handleDownloadPDF}
          disabled={loading || !isPublished}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            background: isPublished ? '#3b82f6' : '#9ca3af',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isPublished ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {loading ? 'Generating...' : 'Download PDF'}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleDownloadPDF}
        disabled={loading || !isPublished}
        title={!isPublished ? 'Result not published yet' : 'Download as PDF'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: variant === 'inline' ? '6px 12px' : '8px 16px',
          background: isPublished ? '#3b82f6' : '#9ca3af',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: isPublished ? 'pointer' : 'not-allowed',
          fontSize: variant === 'inline' ? '13px' : '14px',
          fontWeight: 500
        }}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {variant === 'inline' ? '' : loading ? 'Generating...' : 'PDF'}
      </button>
      
      {error && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#dc2626'
        }}>
          {error}
        </div>
      )}
    </>
  );
}
