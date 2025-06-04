// Global variables
window.parsedResumeText = '';
window.originalResumeStructure = '';
let selectedTemplate = 'modern'; // Default template

// Template selection handling
document.addEventListener('DOMContentLoaded', () => {
  // Initialize template selection
  const templateCards = document.querySelectorAll('.template-card');
  templateCards.forEach(card => {
    card.addEventListener('click', () => {
      // Remove selected class from all cards
      templateCards.forEach(c => c.classList.remove('selected'));
      
      // Add selected class to clicked card
      card.classList.add('selected');
      
      // Update selected template
      selectedTemplate = card.dataset.template;
    });
  });

  // Select the default template
  const defaultCard = document.querySelector(`.template-card[data-template="${selectedTemplate}"]`);
  if (defaultCard) {
    defaultCard.classList.add('selected');
  }
});

function showMessage(text, type = 'info') {
  const messageBox = document.getElementById('messageBox');
  messageBox.textContent = text;
  messageBox.className = `message ${type} show`;
  
  if (type === 'success' || type === 'loading') {
    setTimeout(() => {
      messageBox.classList.remove('show');
    }, 5000);
  }
}

function getApiKey() {
  const key = document.getElementById('apiKey').value.trim();
  if (!key) {
    showMessage('Please enter your OpenAI API key first.', 'error');
    return null;
  }
  if (!key.startsWith('sk-')) {
    showMessage('Please enter a valid OpenAI API key (starts with sk-).', 'error');
    return null;
  }
  return key;
}

// File upload handler
document.getElementById('resumeFile').addEventListener('change', handleFileUpload);

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  showMessage('Parsing your resume...', 'loading');
  
  try {
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const resumePreview = document.getElementById('resumePreview');
    
    fileName.textContent = file.name;
    fileSize.textContent = (file.size / 1024).toFixed(1) + ' KB';
    
    let text = '';
    
    if (file.type === 'application/pdf') {
      text = await parsePDF(file);
    } else if (file.type.includes('word') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      text = await parseWord(file);
    } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      text = await file.text();
    } else {
      throw new Error('Unsupported file type. Please use PDF, DOC, DOCX, or TXT files.');
    }
    
    if (!text.trim()) {
      throw new Error('Could not extract text from the file. Please try a different format or ensure the PDF contains selectable text.');
    }
    
    window.parsedResumeText = text;
    window.originalResumeStructure = text;
    
    resumePreview.textContent = text.substring(0, 500) + (text.length > 500 ? '...' : '');
    resumePreview.classList.add('show');
    fileInfo.classList.add('show');
    
    showMessage('Resume parsed successfully! You can now analyze keywords or generate a tailored resume.', 'success');
    
  } catch (error) {
    console.error('File parsing error:', error);
    showMessage(`Error parsing file: ${error.message}`, 'error');
  }
}

// PDF parsing with improved text extraction
async function parsePDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        // Load PDF.js from CDN dynamically
        const pdfjsLib = await loadPDFJS();
        const typedArray = new Uint8Array(e.target.result);
        
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument(typedArray);
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        
        // Extract text from each page
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const textItems = textContent.items.map(item => item.str);
          fullText += textItems.join(' ') + '\n';
        }
        
        if (fullText.trim().length > 0) {
          resolve(fullText);
        } else {
          reject(new Error('Could not extract readable text from PDF. Please try a different PDF or convert to DOC/DOCX format.'));
        }
      } catch (error) {
        console.error('PDF parsing error:', error);
        reject(new Error('Failed to parse PDF. Please try a text-based PDF or convert to DOC/DOCX format.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read PDF file'));
    reader.readAsArrayBuffer(file);
  });
}

// Helper function to load PDF.js dynamically
function loadPDFJS() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js';
    script.onload = () => {
      // Set worker path
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js library'));
    document.head.appendChild(script);
  });
}

async function parseWord(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const arrayBuffer = e.target.result;
      mammoth.extractRawText({arrayBuffer: arrayBuffer})
        .then(function(result) {
          if (result.value && result.value.trim()) {
            resolve(result.value);
          } else {
            reject(new Error('No text found in Word document'));
          }
        })
        .catch(error => {
          console.error('Word parsing error:', error);
          reject(new Error('Failed to parse Word document. Please try a different format.'));
        });
    };
    reader.onerror = () => reject(new Error('Failed to read Word document'));
    reader.readAsArrayBuffer(file);
  });
}

// Analyze keywords button handler
document.getElementById('analyzeBtn').addEventListener('click', analyzeKeywords);

async function analyzeKeywords() {
  const apiKey = getApiKey();
  const jobDesc = document.getElementById('jobDescription').value.trim();
  const resultsDiv = document.getElementById('keywordResults');
  const analyzeBtn = document.getElementById('analyzeBtn');
  
  if (!apiKey) return;
  
  if (!window.parsedResumeText) {
    showMessage('Please upload your resume first.', 'error');
    return;
  }
  
  if (!jobDesc) {
    showMessage('Please paste the job description first.', 'error');
    return;
  }
  
  if (!resultsDiv) {
    console.error('Keyword results div not found');
    showMessage('Error: Could not find results container', 'error');
    return;
  }
  
  if (!analyzeBtn) {
    console.error('Analyze button not found');
    showMessage('Error: Could not find analyze button', 'error');
    return;
  }
  
  analyzeBtn.disabled = true;
  analyzeBtn.innerHTML = '<div style="width: 16px; height: 16px; border: 2px solid #fff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 0.5rem;"></div>Analyzing...';
  
  showMessage('Analyzing keywords and comparing with your resume...', 'loading');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert ATS keyword analyzer and career consultant. Analyze job descriptions and resumes to identify keyword gaps and provide actionable recommendations.'
          },
          {
            role: 'user',
            content: `Please analyze the following job description and resume for keyword optimization:

JOB DESCRIPTION:
${jobDesc}

CURRENT RESUME:
${window.parsedResumeText}

Please provide:
1. KEY KEYWORDS from job description (most important 15-20)
2. MISSING KEYWORDS from resume (not present but should be)
3. EXISTING KEYWORDS in resume (already present)
4. RECOMMENDATIONS for natural integration of missing keywords
5. ATS SCORE estimate (0-100) and improvement suggestions

Format your response clearly with sections and bullet points.`
          }
        ],
        max_tokens: 1500,
        temperature: 0.3,
        stream: true // Enable streaming
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API Error: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage += ` - ${errorData.error?.message || 'Unknown error'}`;
      } catch {
        errorMessage += ` - ${errorText}`;
      }
      throw new Error(errorMessage);
    }
    
    // Clear previous results
    resultsDiv.textContent = '';
    resultsDiv.classList.add('show');
    
    // Create a reader for the response stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      // Decode the chunk and add it to our buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.trim() === 'data: [DONE]') continue;
        
        try {
          const jsonStr = line.replace(/^data: /, '');
          const json = JSON.parse(jsonStr);
          const content = json.choices?.[0]?.delta?.content || '';
          
          if (content) {
            // Append the new content to the results div
            resultsDiv.textContent += content;
            
            // Auto-scroll to the bottom
            resultsDiv.scrollTop = resultsDiv.scrollHeight;
          }
        } catch (e) {
          console.error('Error parsing streaming response:', e);
        }
      }
    }
    
    showMessage('Keyword analysis complete! Check the results below.', 'success');
    
  } catch (error) {
    console.error('Keyword analysis error:', error);
    showMessage(`Failed to analyze keywords: ${error.message}`, 'error');
  } finally {
    if (analyzeBtn) {
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '<svg class="icon" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>Analyze Keywords';
    }
  }
}

// Generate tailored resume button handler
document.getElementById('generateBtn').addEventListener('click', generateTailoredResume);

async function generateTailoredResume() {
  const apiKey = getApiKey();
  const jobDesc = document.getElementById('jobDescription').value.trim();
  
  if (!apiKey) return;
  
  if (!window.parsedResumeText) {
    showMessage('Please upload your resume first.', 'error');
    return;
  }
  
  if (!jobDesc) {
    showMessage('Please paste the job description first.', 'error');
    return;
  }
  
  const generateBtn = document.getElementById('generateBtn');
  const loadingSpinner = document.getElementById('loadingSpinner');
  
  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating Tailored Resume...';
  loadingSpinner.style.display = 'block';
  
  showMessage('AI is analyzing your resume and tailoring it to the job description. This may take a moment...', 'loading');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert resume writer and career consultant. You specialize in tailoring existing resumes to specific job descriptions while maintaining the original structure and truthfulness. You optimize keywords, enhance descriptions, and improve professional summaries without fabricating experience.'
          },
          {
            role: 'user',
            content: `Please tailor the following resume to match the job description. IMPORTANT:
1. Keep the same basic structure and format as the original resume
2. Enhance and optimize existing experience descriptions with relevant keywords
3. Update the professional summary to align with the job requirements  
4. Improve skills section to highlight relevant abilities
5. Do NOT fabricate new experiences or qualifications
6. Use strong action verbs and quantifiable achievements where possible
7. Ensure ATS optimization with relevant keywords naturally integrated
8. Return the complete tailored resume in a clean, professional format

JOB DESCRIPTION:
${jobDesc}

ORIGINAL RESUME:
${window.parsedResumeText}

Please provide the complete tailored resume maintaining professional formatting:`
          }
        ],
        max_tokens: 2500,
        temperature: 0.4
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API Error: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage += ` - ${errorData.error?.message || 'Unknown error'}`;
      } catch {
        errorMessage += ` - ${errorText}`;
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    const tailoredResume = data.choices?.[0]?.message?.content || 'Error generating tailored resume.';
    
    // Generate and download PDF
    await generatePDF(tailoredResume);
    
    showMessage('Success! Your tailored resume has been generated and downloaded as PDF.', 'success');
    
  } catch (error) {
    console.error('Resume generation error:', error);
    showMessage(`Failed to generate tailored resume: ${error.message}`, 'error');
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<svg class="icon" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clip-rule="evenodd"/></svg>Generate & Download PDF';
    loadingSpinner.style.display = 'none';
  }
}

async function generatePDF(resumeContent) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Set up document properties
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margins = 20;
    const usableWidth = pageWidth - (margins * 2);
    let yPosition = margins;
    
    // Template-specific styles
    const templates = {
      modern: {
        primaryColor: '#2c3e50', // Dark blue for headers
        secondaryColor: '#34495e', // Slightly lighter for subheaders
        accentColor: '#3498db', // Blue for bullets
        textColor: '#333333', // Dark gray for body text
        lightGray: '#f8f9fa',
        headerHeight: 0,
        sectionSpacing: 10,
        lineHeight: 5,
        bulletIndent: 5,
        isTwoColumn: false,
        nameFontSize: 20,
        sectionHeaderFontSize: 14,
        bodyFontSize: 10,
        jobTitleFontSize: 11
        },
      classic: {
        primaryColor: '#2c3e50',
        secondaryColor: '#34495e',
        accentColor: '#95a5a6',
        textColor: '#2c3e50',
        lightGray: '#ecf0f1',
        headerHeight: 35,
        sectionSpacing: 12,
        lineHeight: 5.5,
        bulletIndent: 4,
        isTwoColumn: false
      },
      executive: {
        primaryColor: '#1a2a6c',
        secondaryColor: '#b21f1f',
        accentColor: '#fdbb2d',
        textColor: '#2c3e50',
        lightGray: '#f8f9fa',
        headerHeight: 45,
        sectionSpacing: 18,
        lineHeight: 6.5,
        bulletIndent: 6,
        isTwoColumn: false
      },
      'modern-sidebar': {
        primaryColor: '#2c3e50', // Dark blue for sidebar
        secondaryColor: '#34495e', // Slightly lighter dark blue
        accentColor: '#3498db', // Blue accent for bullets/icons
        textColor: '#2c3e50', // Dark text for main content
        sidebarColor: '#2c3e50', // Explicit sidebar background
        sidebarTextColor: '#ffffff', // White text for sidebar
        lightGray: '#f0f0f0', // Light background for main sections
        headerHeight: 0, // No header bar needed for this design
        sectionSpacing: 10, // Reduced spacing for two-column
        lineHeight: 5,
        bulletIndent: 5,
        isTwoColumn: true,
        sidebarWidth: 0.35 // 35% of page width
      }
    };
    
    const style = templates[selectedTemplate];

    // --- Improved Parsing Logic ---
    const lines = resumeContent.split('\n');
    let currentSection = null;
    const sections = {};
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const sectionMatch = trimmedLine.match(/^(EXPERIENCE|EDUCATION|SKILLS|PROJECTS|CERTIFICATIONS|AWARDS|SUMMARY|PROFILE|OBJECTIVE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EMPLOYMENT HISTORY):/i);
      
      if (sectionMatch) {
        currentSection = sectionMatch[1].toUpperCase();
        sections[currentSection] = [];
      } else if (currentSection) {
        sections[currentSection].push(line);
      } else {
        if (!sections['HEADER']) sections['HEADER'] = [];
        sections['HEADER'].push(line);
      }
    }
    // --- End Improved Parsing Logic ---

    if (style.isTwoColumn) {
        const sidebarWidth = pageWidth * style.sidebarWidth;
        const mainContentLeft = margins + sidebarWidth + margins / 2;
        const mainContentWidth = pageWidth - mainContentLeft - margins;
        let sidebarYPosition = margins;
        let mainContentYPosition = margins;

        // Draw sidebar background
        doc.setFillColor(style.sidebarColor);
        doc.rect(0, 0, sidebarWidth + margins, pageHeight, 'F'); // Extend background into left margin

        // Process HEADER in sidebar
        if (sections['HEADER'] && sections['HEADER'].length > 0) {
            const headerLines = sections['HEADER'].filter(line => line.trim());
            if(headerLines.length > 0) {
                // Name
                doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
                doc.setTextColor(style.sidebarTextColor);
                doc.text(headerLines[0].trim(), margins, sidebarYPosition);
                sidebarYPosition += 10;
            }
             // Add Photo Placeholder (Optional - requires image handling, keeping it simple for now)
             // doc.setFillColor(style.accentColor);
             // doc.circle(margins + (sidebarWidth/2), sidebarYPosition + 10, 20, 'F');
             // sidebarYPosition += 40; // Adjust space for photo

            if(headerLines.length > 1) {
                // Contact Info - Format each line separately
                 sidebarYPosition += 5; // Space before contact info
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(style.sidebarTextColor);
                for (const contactLine of headerLines.slice(1)) {
                     const splitContact = doc.splitTextToSize(contactLine.trim(), sidebarWidth - margins);
                     doc.text(splitContact, margins, sidebarYPosition);
                     sidebarYPosition += (splitContact.length * style.lineHeight);
                }
                 sidebarYPosition += style.sectionSpacing;
            }
        }

         // Process EDUCATION in sidebar
        const educationContent = sections['EDUCATION'];
        if (educationContent && educationContent.length > 0) {
            // Section header
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
            doc.setTextColor(style.sidebarTextColor);
            doc.text('EDUCATION', margins, sidebarYPosition);
            sidebarYPosition += 8;

            // Process each education entry
            let currentEducationLines = [];
            for (const line of educationContent) {
                const trimmedLine = line.trim();
                 if (!trimmedLine) continue;

                // Check for a new education entry (starts with a potential program name)
                const isNewEducation = /^[A-Z0-9][\w\s.,&-]*?$/i.test(trimmedLine) && !trimmedLine.startsWith('•') && !trimmedLine.startsWith('-') && !trimmedLine.startsWith('*');

                if (isNewEducation && currentEducationLines.length > 0) {
                    sidebarYPosition = processEducationBlock(doc, currentEducationLines, margins, sidebarYPosition, sidebarWidth - margins, pageHeight, style, style.sidebarTextColor, style.accentColor);
                    currentEducationLines = [line];
      } else {
                    currentEducationLines.push(line);
                }
            }
             // Process the last education block
            if (currentEducationLines.length > 0) {
                sidebarYPosition = processEducationBlock(doc, currentEducationLines, margins, sidebarYPosition, sidebarWidth - margins, pageHeight, style, style.sidebarTextColor, style.accentColor);
            }
            sidebarYPosition += style.sectionSpacing; // Space after the entire education section
        }

         // Process SKILLS in sidebar
        const skillsContent = sections['SKILLS'];
        if (skillsContent && skillsContent.length > 0) {
            // Section header
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(style.sidebarTextColor);
            doc.text('SKILLS', margins, sidebarYPosition);
            sidebarYPosition += 8;

            // Skills text
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(style.sidebarTextColor);
            const skillsText = skillsContent.join(' ').trim();
            const splitSkills = doc.splitTextToSize(skillsText, sidebarWidth - margins);
            doc.text(splitSkills, margins, sidebarYPosition);
            sidebarYPosition += (splitSkills.length * style.lineHeight) + style.sectionSpacing;
        }
         // You can add LANGUAGES or other sidebar sections here similarly

        // --- Process Main Content Column ---

        // Process SUMMARY in main content
        const summaryContent = sections['SUMMARY'] || sections['PROFILE'] || sections['OBJECTIVE'];
        if (summaryContent && summaryContent.length > 0) {
             const summaryLines = summaryContent.filter(line => line.trim());
             if (summaryLines.length > 0) {
               // Section header (e.g., PROFILE)
                const summaryHeaderMatch = summaryLines[0].match(/^(SUMMARY|PROFILE|OBJECTIVE):/i);
                if(summaryHeaderMatch) {
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(style.primaryColor); // Use primary color for main content headers
                    doc.text(summaryHeaderMatch[1].toUpperCase(), mainContentLeft, mainContentYPosition);
                    mainContentYPosition += 8;
                    summaryLines.shift(); // Remove the header line
                }

               // Professional Title (Assume first line after header/section title)
               if (summaryLines.length > 0) {
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(style.secondaryColor);
                    const titleLine = summaryLines.shift(); // Get and remove the title line
                    doc.text(titleLine.trim(), mainContentLeft, mainContentYPosition);
                    mainContentYPosition += 8;
               }

               // Summary text
               if (summaryLines.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
                    doc.setTextColor(style.textColor);
                    const summaryText = summaryLines.join(' ').trim();
                    const splitSummary = doc.splitTextToSize(summaryText, mainContentWidth);
                    doc.text(splitSummary, mainContentLeft, mainContentYPosition);
                    mainContentYPosition += (splitSummary.length * style.lineHeight) + style.sectionSpacing;
               }
            }
        }

        // Process EXPERIENCE in main content
        const experienceContent = sections['EXPERIENCE'] || sections['WORK EXPERIENCE'] || sections['PROFESSIONAL EXPERIENCE'] || sections['EMPLOYMENT HISTORY'];
         if (experienceContent && experienceContent.length > 0) {
            // Section header
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(style.primaryColor);
            doc.text('WORK EXPERIENCE', mainContentLeft, mainContentYPosition);
            mainContentYPosition += 8; // Smaller spacing for two-column

            // Process each job entry
            let currentJobLines = [];
             for (const line of experienceContent) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                // Check for a new job entry based on the Company • Location • Date format
                const isNewJob = /^[\w\s.,&-]+ • [\w\s.,&-]+ • \d{2}\/\d{4}(?: - \d{2}\/\d{4}| - Present)?$/i.test(trimmedLine);

                if (isNewJob && currentJobLines.length > 0) {
                    mainContentYPosition = processJobBlock(doc, currentJobLines, mainContentLeft, mainContentYPosition, mainContentWidth, pageHeight, style, style.textColor, style.accentColor);
                    currentJobLines = [line]; // Start new job block with the current line
                } else {
                    currentJobLines.push(line);
                }
            }
             // Process the last job block
            if (currentJobLines.length > 0) {
                mainContentYPosition = processJobBlock(doc, currentJobLines, mainContentLeft, mainContentYPosition, mainContentWidth, pageHeight, style, style.textColor, style.accentColor);
            }
            mainContentYPosition += style.sectionSpacing; // Space after the entire experience section
        }

        // Process PROJECTS in main content
        const projectsContent = sections['PROJECTS'];
        if (projectsContent && projectsContent.length > 0) {
            // Section header
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(style.primaryColor);
            doc.text('PROJECTS', mainContentLeft, mainContentYPosition);
            mainContentYPosition += 8;

            // Process each project entry
            let currentProjectLines = [];
             for (const line of projectsContent) {
                 const trimmedLine = line.trim();
                 if (!trimmedLine) continue;

                // Check for a new project entry (starts with a potential project name)
                 const isNewProject = /^[A-Z0-9][\w\s.,&-]*?(?: \([\w\s.,&\-]+\))?$/i.test(trimmedLine) && !trimmedLine.startsWith('•') && !trimmedLine.startsWith('-') && !trimmedLine.startsWith('*');

                if (isNewProject && currentProjectLines.length > 0) {
                   mainContentYPosition = processProjectBlock(doc, currentProjectLines, mainContentLeft, mainContentYPosition, mainContentWidth, pageHeight, style, style.textColor, style.accentColor);
                   currentProjectLines = [line]; // Start new project block
                 } else {
                   currentProjectLines.push(line);
                 }
            }
             // Process the last project block
            if (currentProjectLines.length > 0) {
               mainContentYPosition = processProjectBlock(doc, currentProjectLines, mainContentLeft, mainContentYPosition, mainContentWidth, pageHeight, style, style.textColor, style.accentColor);
            }
            mainContentYPosition += style.sectionSpacing; // Space after the entire projects section
        }

         // Add footer and page numbers (adjust positions for two-column) - Simplified, might need more complex logic for long documents
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(style.secondaryColor);

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(style.secondaryColor);
          doc.text(`Page ${i} of ${pageCount}`, pageWidth - margins, pageHeight - 10);
        }



    } else { // Existing single column template logic

        // Process Header section (Name, Contact Info) - Single Column
        if (sections['HEADER'] && sections['HEADER'].length > 0) {
            const headerLines = sections['HEADER'].filter(line => line.trim());
            if(headerLines.length > 0) {
                // Name
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(style.primaryColor);
                doc.text(headerLines[0].trim(), margins, yPosition);
                yPosition += 10;
            }
            if(headerLines.length > 1) {
                // Contact Info
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(style.textColor);
                const contactInfo = headerLines.slice(1).join(' • ');
                doc.text(contactInfo, margins, yPosition);
                yPosition += 15;
            }
        }

        // Process Summary section - Single Column
        const summaryContent = sections['SUMMARY'] || sections['PROFILE'] || sections['OBJECTIVE'];
        if (summaryContent && summaryContent.length > 0) {
            const summaryLines = summaryContent.filter(line => line.trim());
            if (summaryLines.length > 0) {
                // Section Header (if present in the original text)
                 const summaryHeaderMatch = summaryLines[0].match(/^(SUMMARY|PROFILE|OBJECTIVE):/i);
                if(summaryHeaderMatch) {
                     doc.setFontSize(12);
                     doc.setFont('helvetica', 'bold');
                     doc.setTextColor(style.primaryColor);
                     doc.text(summaryHeaderMatch[1].toUpperCase(), margins, yPosition);
                     yPosition += 10;
                     summaryLines.shift(); // Remove the header line
                 }

                // Professional Title (Assume first line after header/section title)
                if(summaryLines.length > 0) {
                     doc.setFontSize(12);
                     doc.setFont('helvetica', 'bold');
                     doc.setTextColor(style.secondaryColor);
                     const titleLine = summaryLines.shift();
                     doc.text(titleLine.trim(), margins, yPosition);
                     yPosition += 8;
                }

                // Summary text
                if(summaryLines.length > 0) {
                     doc.setFontSize(10);
                     doc.setFont('helvetica', 'normal');
                     doc.setTextColor(style.textColor);
                     const summaryText = summaryLines.join(' ');
                     const splitSummary = doc.splitTextToSize(summaryText, usableWidth);
                     doc.text(splitSummary, margins, yPosition);
                     yPosition += (splitSummary.length * style.lineHeight) + style.sectionSpacing;
                }
            }
        }

        // Process Work Experience section - Single Column
         const experienceContent = sections['EXPERIENCE'] || sections['WORK EXPERIENCE'] || sections['PROFESSIONAL EXPERIENCE'] || sections['EMPLOYMENT HISTORY'];
        if (experienceContent && experienceContent.length > 0) {
            // Section header
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(style.primaryColor);
            doc.text('WORK EXPERIENCE', margins, yPosition);
            yPosition += 10;

             // Process each job entry
            let currentJobLines = [];
             for (const line of experienceContent) {
                 const trimmedLine = line.trim();
                 if (!trimmedLine) continue;

                 const isNewJob = /^[\w\s.,&-]+ • [\w\s.,&-]+ • \d{2}\/\d{4}(?: - \d{2}\/\d{4}| - Present)?$/i.test(trimmedLine);

                 if (isNewJob && currentJobLines.length > 0) {
                     yPosition = processJobBlock(doc, currentJobLines, margins, yPosition, usableWidth, pageHeight, style, style.textColor, style.accentColor);
                     currentJobLines = [line];
                 } else {
                     currentJobLines.push(line);
                 }
            }
             if (currentJobLines.length > 0) {
                 yPosition = processJobBlock(doc, currentJobLines, margins, yPosition, usableWidth, pageHeight, style, style.textColor, style.accentColor);
            }
            yPosition += style.sectionSpacing;
        }

        // Process Projects section - Single Column
        const projectsContent = sections['PROJECTS'];
        if (projectsContent && projectsContent.length > 0) {
             // Section header
             doc.setFontSize(12);
             doc.setFont('helvetica', 'bold');
             doc.setTextColor(style.primaryColor);
             doc.text('PROJECTS', margins, yPosition);
             yPosition += 10;

             // Process each project entry
             let currentProjectLines = [];
             for (const line of projectsContent) {
                 const trimmedLine = line.trim();
                  if (!trimmedLine) continue;

                 const isNewProject = /^[A-Z0-9][\w\s.,&-]*?(?: \([\w\s.,&\-]+\))?$/i.test(trimmedLine) && !trimmedLine.startsWith('•') && !trimmedLine.startsWith('-') && !trimmedLine.startsWith('*');

                 if (isNewProject && currentProjectLines.length > 0) {
                    yPosition = processProjectBlock(doc, currentProjectLines, margins, yPosition, usableWidth, pageHeight, style, style.textColor, style.accentColor);
                    currentProjectLines = [line];
                 } else {
                    currentProjectLines.push(line);
                 }
             }
              if (currentProjectLines.length > 0) {
                yPosition = processProjectBlock(doc, currentProjectLines, margins, yPosition, usableWidth, pageHeight, style, style.textColor, style.accentColor);
             }
             yPosition += style.sectionSpacing;
        }

        // Process Skills section - Single Column
         const skillsContent = sections['SKILLS'];
        if (skillsContent && skillsContent.length > 0) {
             // Section header
             doc.setFontSize(12);
             doc.setFont('helvetica', 'bold');
             doc.setTextColor(style.primaryColor);
             doc.text('SKILLS', margins, yPosition);
             yPosition += 10;

             // Skills text
             doc.setFontSize(10);
             doc.setFont('helvetica', 'normal');
             doc.setTextColor(style.textColor);
             const skillsText = skillsContent.join(' ').trim();
             const splitSkills = doc.splitTextToSize(skillsText, usableWidth);
             doc.text(splitSkills, margins, yPosition);
             yPosition += (splitSkills.length * style.lineHeight) + style.sectionSpacing;
        }

        // Process Education section - Single Column
        const educationContent = sections['EDUCATION'];
        if (educationContent && educationContent.length > 0) {
             // Section header
             doc.setFontSize(12);
             doc.setFont('helvetica', 'bold');
             doc.setTextColor(style.primaryColor);
             doc.text('EDUCATION', margins, yPosition);
             yPosition += 10;

              // Process each education entry
            let currentEducationLines = [];
            for (const line of educationContent) {
                const trimmedLine = line.trim();
                 if (!trimmedLine) continue;

                 const isNewEducation = /^[A-Z0-9][\w\s.,&-]*?$/i.test(trimmedLine) && !trimmedLine.startsWith('•') && !trimmedLine.startsWith('-') && !trimmedLine.startsWith('*');

                 if (isNewEducation && currentEducationLines.length > 0) {
                     yPosition = processEducationBlock(doc, currentEducationLines, margins, yPosition, usableWidth, pageHeight, style, style.textColor, style.accentColor);
                     currentEducationLines = [line];
                 } else {
                     currentEducationLines.push(line);
                 }
            }
             if (currentEducationLines.length > 0) {
                yPosition = processEducationBlock(doc, currentEducationLines, margins, yPosition, usableWidth, pageHeight, style, style.textColor, style.accentColor);
            }
            yPosition += style.sectionSpacing;
        }

        // Add footer and page numbers - Single Column
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
        doc.setTextColor(style.secondaryColor);

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(style.secondaryColor);
          doc.text(`Page ${i} of ${pageCount}`, pageWidth - margins, pageHeight - 10);
        }
    }
    
    // Save the PDF
    doc.save(`Professional_Resume_${selectedTemplate}.pdf`);
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error('Failed to generate PDF. Please try again or copy the text manually.');
  }
}

// Helper function to process a job block
function processJobBlock(doc, jobLines, xPosition, yPosition, usableWidth, pageHeight, style, textColor, bulletColor) {
    if (jobLines.length === 0) return yPosition;

    // Company • Location • Date line
    const companyLine = jobLines[0];
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textColor); // Use passed in text color
    doc.text(companyLine.trim(), xPosition, yPosition);
    yPosition += 7;

    // Job Title • Part-time / Full-time line
    if (jobLines.length > 1) {
        const titleLine = jobLines[1];
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textColor); // Use passed in text color
        doc.text(titleLine.trim(), xPosition, yPosition);
        yPosition += 7;
    }

    // Bullet points
    for (const line of jobLines.slice(2)) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Check if line is a bullet point
        if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
            const bulletPoint = trimmedLine.substring(1).trim();
            const splitLines = doc.splitTextToSize(bulletPoint, usableWidth - style.bulletIndent - 5);

            // Add bullet point
            doc.setFillColor(bulletColor); // Use passed in bullet color
            doc.circle(xPosition + 2, yPosition - 1, 1, 'F');

            // Add text
            doc.text(splitLines, xPosition + style.bulletIndent, yPosition);
            yPosition += (splitLines.length * style.lineHeight) + 2;
        } else {
             // If a line in the experience block is not a bullet, add it as regular text (handle potential unexpected formatting)
            const splitLines = doc.splitTextToSize(trimmedLine, usableWidth);
            doc.text(splitLines, xPosition, yPosition);
            yPosition += (splitLines.length * style.lineHeight) + 2;
        }

         // Check if we need a new page
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20; // Reset yPosition for new page
        }
    }
     yPosition += 5; // Space after each job block
    return yPosition;
}

// Helper function to process a project block
function processProjectBlock(doc, projectLines, xPosition, yPosition, usableWidth, pageHeight, style, textColor, bulletColor) {
     if (projectLines.length === 0) return yPosition;

     // Project Name (Tech Used) line
     const nameLine = projectLines[0];
     doc.setFontSize(11);
     doc.setFont('helvetica', 'bold');
     doc.setTextColor(textColor); // Use passed in text color
     doc.text(nameLine.trim(), xPosition, yPosition);
     yPosition += 7;

     // 1-line summary
     if (projectLines.length > 1) {
         const summaryLine = projectLines[1];
         doc.setFontSize(10);
         doc.setFont('helvetica', 'normal');
         doc.setTextColor(textColor); // Use passed in text color
         const splitSummary = doc.splitTextToSize(summaryLine.trim(), usableWidth);
         doc.text(splitSummary, xPosition, yPosition);
         yPosition += (splitSummary.length * style.lineHeight) + 5;
     }
     // Any other lines are ignored for now based on the 1-line summary requirement

     // Check if we need a new page
     if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20; // Reset yPosition for new page
     }

     return yPosition;
}

// Helper function to process an education block
function processEducationBlock(doc, educationLines, xPosition, yPosition, usableWidth, pageHeight, style, textColor, bulletColor) {
    if (educationLines.length === 0) return yPosition;

    // Program line
    const programLine = educationLines[0];
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textColor); // Use passed in text color
    doc.text(programLine.trim(), xPosition, yPosition);
    yPosition += 7;

    // Institution and dates line
    if (educationLines.length > 1) {
        const institutionLine = educationLines[1];
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textColor); // Use passed in text color
        doc.text(institutionLine.trim(), xPosition, yPosition);
        yPosition += 10; // Increased spacing after education entry
    }
     // Any other lines are ignored for now based on the format requirement

     // Check if we need a new page
     if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20; // Reset yPosition for new page
     }

    return yPosition;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  // Check for saved API key in localStorage
  const savedApiKey = localStorage.getItem('openai_api_key');
  if (savedApiKey) {
    document.getElementById('apiKey').value = savedApiKey;
  }
  
  // Save API key when changed
  document.getElementById('apiKey').addEventListener('change', function() {
    localStorage.setItem('openai_api_key', this.value.trim());
  });
  
  // Add animation to buttons
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(button => {
    button.addEventListener('mousedown', function() {
      this.style.transform = 'translateY(1px)';
    });
    button.addEventListener('mouseup', function() {
      this.style.transform = 'translateY(-2px)';
    });
    button.addEventListener('mouseleave', function() {
      this.style.transform = '';
    });
  });
}); 