// Quarterly Progress Report Notes - Mobile Web App
// Pure client-side application with Mistral AI integration

// State management
const state = {
    currentStep: 'upload',
    imageFile: null,
    imagePreview: null,
    ocrText: '',
    ocrProcessing: false,
    ocrProgress: 0,
    summaryText: '',
    summaryProcessing: false,
    summaryProgress: 0,
    useMistral: true,
    mistralKey: '',
    enhanceImage: true
};

// DOM Elements
const elements = {
    // Steps
    uploadStep: document.getElementById('upload-step'),
    ocrStep: document.getElementById('ocr-step'),
    summaryStep: document.getElementById('summary-step'),
    
    // Step indicators
    steps: document.querySelectorAll('.step'),
    
    // Upload
    fileInput: document.getElementById('file-input'),
    uploadArea: document.getElementById('upload-area'),
    cameraBtn: document.getElementById('camera-btn'),
    imagePreview: document.getElementById('image-preview'),
    previewImg: document.getElementById('preview-img'),
    removeImg: document.getElementById('remove-img'),
    continueToOcr: document.getElementById('continue-to-ocr'),
    
    // OCR
    useMistral: document.getElementById('use-mistral'),
    mistralKey: document.getElementById('mistral-key'),
    enhanceImage: document.getElementById('enhance-image'),
    processOcr: document.getElementById('process-ocr'),
    ocrProgress: document.getElementById('ocr-progress'),
    ocrProgressFill: document.getElementById('ocr-progress-fill'),
    ocrResults: document.getElementById('ocr-results'),
    ocrText: document.getElementById('ocr-text'),
    copyOcr: document.getElementById('copy-ocr'),
    backToUpload: document.getElementById('back-to-upload'),
    continueToSummary: document.getElementById('continue-to-summary'),
    
    // Summary
    studentName: document.getElementById('student-name'),
    gradeLevel: document.getElementById('grade-level'),
    subject: document.getElementById('subject'),
    teacherName: document.getElementById('teacher-name'),
    school: document.getElementById('school'),
    reportingPeriod: document.getElementById('reporting-period'),
    includeStandards: document.getElementById('include-standards'),
    includeBehavioral: document.getElementById('include-behavioral'),
    includeIep: document.getElementById('include-iep'),
    generateSummary: document.getElementById('generate-summary'),
    summaryProgress: document.getElementById('summary-progress'),
    summaryProgressFill: document.getElementById('summary-progress-fill'),
    summaryResults: document.getElementById('summary-results'),
    summaryText: document.getElementById('summary-text'),
    copySummary: document.getElementById('copy-summary'),
    downloadSummary: document.getElementById('download-summary'),
    backToOcr: document.getElementById('back-to-ocr'),
    startOver: document.getElementById('start-over'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.querySelector('.toast-message')
};

// Utility Functions
function showToast(message, type = 'info') {
    elements.toast.className = 'toast ' + type;
    elements.toastMessage.textContent = message;
    elements.toast.style.display = 'block';
    
    setTimeout(() => {
        elements.toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
        setTimeout(() => {
            elements.toast.style.display = 'none';
        }, 300);
    }, 3000);
}

function setStep(step) {
    state.currentStep = step;
    
    // Update step indicators
    elements.steps.forEach(s => {
        s.classList.remove('active', 'completed');
        if (s.dataset.step === step) {
            s.classList.add('active');
        } else if (['upload', 'ocr'].includes(s.dataset.step) && step === 'summary') {
            s.classList.add('completed');
        } else if (s.dataset.step === 'upload' && step === 'ocr') {
            s.classList.add('completed');
        }
    });
    
    // Show/hide step content
    elements.uploadStep.style.display = step === 'upload' ? 'block' : 'none';
    elements.ocrStep.style.display = step === 'ocr' ? 'block' : 'none';
    elements.summaryStep.style.display = step === 'summary' ? 'block' : 'none';
}

function updateProgress(element, fillElement, progress) {
    fillElement.style.width = progress + '%';
    if (progress > 0 && progress < 100) {
        element.style.display = 'block';
    } else if (progress >= 100) {
        setTimeout(() => {
            element.style.display = 'none';
        }, 500);
    }
}

// Image Processing
function enhanceImage(imageFile, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Create canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas dimensions (max 2048px width)
            const maxWidth = 2048;
            const ratio = maxWidth / img.width;
            canvas.width = img.width > maxWidth ? maxWidth : img.width;
            canvas.height = img.height * ratio;
            
            // Draw image
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Convert to grayscale and enhance contrast
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                // Grayscale
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                data[i] = data[i + 1] = data[i + 2] = avg;
                
                // Enhance contrast (simple threshold)
                data[i] = data[i] < 128 ? data[i] * 0.8 : data[i] * 1.2;
                data[i] = Math.min(255, Math.max(0, data[i]));
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            // Convert to blob
            canvas.toBlob(function(blob) {
                callback(blob);
            }, 'image/jpeg', 0.9);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(imageFile);
}

// OCR with Tesseract.js
let tesseractWorker;

async function processWithTesseract(imageFile, onProgress) {
    return new Promise((resolve, reject) => {
        if (!tesseractWorker) {
            tesseractWorker = Tesseract.createWorker({
                logger: m => {
                    if (m.status === 'recognizing text') {
                        onProgress(Math.round(m.progress * 100));
                    }
                }
            });
        }
        
        tesseractWorker.recognize(imageFile)
            .then(({ data: { text } }) => {
                resolve(text);
            })
            .catch(err => {
                reject(err);
            });
    });
}

// OCR with Mistral AI
async function processWithMistral(imageFile, apiKey, onProgress) {
    // Convert image to base64
    const reader = new FileReader();
    const base64Image = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(imageFile);
    });
    
    // Mistral OCR prompt
    const prompt = "Extract all text from this image exactly as it appears. Preserve formatting, line breaks, and spacing. Return only the extracted text without any additional commentary.";
    
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'mistral-large-latest',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: `data:image/jpeg;base64,${base64Image}` }
                ]
            }],
            max_tokens: 4096,
            temperature: 0.0
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Mistral API error');
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

// Summary Generation with Mistral AI
async function generateSummaryWithMistral(text, apiKey, formData, onProgress) {
    // Build Maryland-specific prompt
    const prompt = buildMarylandPrompt(text, formData);
    
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'mistral-large-latest',
            messages: [{
                role: 'user',
                content: prompt
            }],
            max_tokens: 4096,
            temperature: 0.3
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Mistral API error');
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

function buildMarylandPrompt(text, formData) {
    const standardsInfo = `Maryland College and Career Ready Standards (MCCRS) alignment:
- English Language Arts: Reading Literature, Reading Informational Text, Writing, Speaking & Listening, Language
- Mathematics: Operations & Algebraic Thinking, Number & Operations in Base Ten, Measurement & Data, Geometry
- Science: Next Generation Science Standards (NGSS) - Physical Science, Life Science, Earth & Space Science, Engineering
- Social Studies: Maryland Social Studies Standards - History, Geography, Economics, Civics & Government`;
    
    const sections = [
        "You are an expert elementary school teacher in Maryland.",
        "Analyze the following student work data and generate a comprehensive quarterly progress report.",
        "",
        "Student Information:"
    ];
    
    if (formData.studentName) sections.push(`- Student Name: ${formData.studentName}`);
    if (formData.gradeLevel) sections.push(`- Grade Level: ${formData.gradeLevel}`);
    if (formData.subject) sections.push(`- Subject: ${formData.subject}`);
    if (formData.teacherName) sections.push(`- Teacher: ${formData.teacherName}`);
    if (formData.school) sections.push(`- School: ${formData.school}`);
    if (formData.reportingPeriod) sections.push(`- Reporting Period: ${formData.reportingPeriod}`);
    
    sections.push(
        "",
        "Extracted Data from Student Work:",
        "---",
        text,
        "---",
        "",
        formData.includeStandards ? standardsInfo + "\n" : ""
    );
    
    sections.push(
        "Generate a professional quarterly progress report that includes the following sections:",
        "",
        "1. CURRENT PERFORMANCE LEVEL - Overall academic performance and specific skill levels",
        "2. STRENGTHS DEMONSTRATED - 3-5 specific strengths with examples",
        "3. AREAS NEEDING IMPROVEMENT - 2-3 areas needing growth",
        "4. SPECIFIC EXAMPLES FROM THE WORK - Reference actual student work",
        "5. NEXT STEPS FOR INSTRUCTION - Teacher strategies and interventions",
        "6. SUGGESTIONS FOR HOME SUPPORT - Actionable suggestions for parents"
    );
    
    if (formData.includeBehavioral) {
        sections.push("7. BEHAVIORAL AND SOCIAL-EMOTIONAL PROGRESS - Work habits and social skills");
    }
    
    if (formData.includeIep) {
        sections.push("8. IEP GOALS PROGRESS - Progress toward Individualized Education Program goals");
    }
    
    sections.push(
        "",
        "Formatting Requirements:",
        "- Professional, supportive, and constructive tone",
        "- Complete sentences and proper grammar",
        "- Each section 2-4 sentences",
        "- Include specific, concrete examples",
        "- Total report approximately 150-300 words",
        "- Return as a single, well-formatted text block"
    );
    
    return sections.join('\n');
}

// Event Listeners
function initEventListeners() {
    // Upload step
    elements.uploadArea.addEventListener('click', () => {
        elements.fileInput.click();
    });
    
    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleImageUpload(e.target.files[0]);
        }
    });
    
    elements.cameraBtn.addEventListener('click', () => {
        // Use capture attribute on file input
        elements.fileInput.setAttribute('capture', 'environment');
        elements.fileInput.click();
    });
    
    elements.removeImg.addEventListener('click', () => {
        state.imageFile = null;
        state.imagePreview = null;
        elements.imagePreview.style.display = 'none';
        elements.continueToOcr.disabled = true;
    });
    
    elements.continueToOcr.addEventListener('click', () => {
        setStep('ocr');
    });
    
    // OCR step
    elements.processOcr.addEventListener('click', async () => {
        if (!state.imageFile) return;
        
        state.ocrProcessing = true;
        state.ocrProgress = 0;
        elements.processOcr.querySelector('.btn-text').textContent = 'Processing...';
        elements.processOcr.querySelector('.spinner').style.display = 'inline-block';
        elements.processOcr.disabled = true;
        elements.ocrProgress.style.display = 'block';
        
        try {
            const apiKey = elements.mistralKey.value;
            const useMistral = elements.useMistral.checked;
            
            let text;
            
            if (useMistral && apiKey) {
                // Use Mistral AI
                text = await processWithMistral(
                    state.imageFile,
                    apiKey,
                    (progress) => {
                        state.ocrProgress = progress;
                        updateProgress(elements.ocrProgress, elements.ocrProgressFill, progress);
                    }
                );
            } else {
                // Use Tesseract.js
                text = await processWithTesseract(
                    state.imageFile,
                    (progress) => {
                        state.ocrProgress = progress;
                        updateProgress(elements.ocrProgress, elements.ocrProgressFill, progress);
                    }
                );
            }
            
            state.ocrText = text;
            state.ocrProcessing = false;
            
            // Show results
            elements.ocrResults.style.display = 'block';
            elements.ocrText.textContent = text;
            elements.continueToSummary.disabled = false;
            
            showToast('OCR completed successfully!', 'success');
            
        } catch (error) {
            console.error('OCR error:', error);
            showToast('OCR failed: ' + error.message, 'error');
            state.ocrProcessing = false;
        } finally {
            elements.processOcr.querySelector('.btn-text').textContent = 'Process OCR';
            elements.processOcr.querySelector('.spinner').style.display = 'none';
            elements.processOcr.disabled = false;
            updateProgress(elements.ocrProgress, elements.ocrProgressFill, 0);
        }
    });
    
    elements.copyOcr.addEventListener('click', () => {
        if (state.ocrText) {
            navigator.clipboard.writeText(state.ocrText);
            showToast('Text copied to clipboard!', 'success');
        }
    });
    
    elements.backToUpload.addEventListener('click', () => {
        setStep('upload');
    });
    
    elements.continueToSummary.addEventListener('click', () => {
        setStep('summary');
    });
    
    // Summary step
    elements.generateSummary.addEventListener('click', async () => {
        if (!state.ocrText) {
            showToast('No OCR text available', 'error');
            return;
        }
        
        state.summaryProcessing = true;
        state.summaryProgress = 0;
        elements.generateSummary.querySelector('.btn-text').textContent = 'Generating...';
        elements.generateSummary.querySelector('.spinner').style.display = 'inline-block';
        elements.generateSummary.disabled = true;
        elements.summaryProgress.style.display = 'block';
        
        try {
            const apiKey = elements.mistralKey.value;
            const useMistral = elements.useMistral.checked;
            
            let summary;
            
            if (useMistral && apiKey) {
                // Use Mistral AI
                const formData = {
                    studentName: elements.studentName.value,
                    gradeLevel: elements.gradeLevel.value,
                    subject: elements.subject.value,
                    teacherName: elements.teacherName.value,
                    school: elements.school.value,
                    reportingPeriod: elements.reportingPeriod.value,
                    includeStandards: elements.includeStandards.checked,
                    includeBehavioral: elements.includeBehavioral.checked,
                    includeIep: elements.includeIep.checked
                };
                
                summary = await generateSummaryWithMistral(
                    state.ocrText,
                    apiKey,
                    formData,
                    (progress) => {
                        state.summaryProgress = progress;
                        updateProgress(elements.summaryProgress, elements.summaryProgressFill, progress);
                    }
                );
            } else {
                // Fallback to simple summary
                summary = generateSimpleSummary(state.ocrText);
                updateProgress(elements.summaryProgress, elements.summaryProgressFill, 100);
            }
            
            state.summaryText = summary;
            state.summaryProcessing = false;
            
            // Show results
            elements.summaryResults.style.display = 'block';
            elements.summaryText.textContent = summary;
            
            showToast('Report generated successfully!', 'success');
            
        } catch (error) {
            console.error('Summary error:', error);
            showToast('Summary generation failed: ' + error.message, 'error');
            state.summaryProcessing = false;
        } finally {
            elements.generateSummary.querySelector('.btn-text').textContent = 'Generate Progress Report';
            elements.generateSummary.querySelector('.spinner').style.display = 'none';
            elements.generateSummary.disabled = false;
            updateProgress(elements.summaryProgress, elements.summaryProgressFill, 0);
        }
    });
    
    elements.copySummary.addEventListener('click', () => {
        if (state.summaryText) {
            navigator.clipboard.writeText(state.summaryText);
            showToast('Report copied to clipboard!', 'success');
        }
    });
    
    elements.downloadSummary.addEventListener('click', () => {
        if (state.summaryText) {
            const blob = new Blob([state.summaryText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `progress_report_${elements.studentName.value || 'student'}_${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Report downloaded!', 'success');
        }
    });
    
    elements.backToOcr.addEventListener('click', () => {
        setStep('ocr');
    });
    
    elements.startOver.addEventListener('click', () => {
        // Reset state
        state.imageFile = null;
        state.imagePreview = null;
        state.ocrText = '';
        state.summaryText = '';
        
        // Reset UI
        elements.imagePreview.style.display = 'none';
        elements.ocrResults.style.display = 'none';
        elements.summaryResults.style.display = 'none';
        elements.continueToOcr.disabled = true;
        elements.continueToSummary.disabled = true;
        
        setStep('upload');
        showToast('Starting over...', 'info');
    });
    
    // Update continue button when image is uploaded
    elements.fileInput.addEventListener('change', () => {
        elements.continueToOcr.disabled = !state.imageFile;
    });
}

// Image Upload Handler
function handleImageUpload(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file', 'error');
        return;
    }
    
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
        showToast('File too large (max 10MB)', 'error');
        return;
    }
    
    state.imageFile = file;
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
        state.imagePreview = e.target.result;
        elements.previewImg.src = e.target.result;
        elements.imagePreview.style.display = 'block';
        elements.continueToOcr.disabled = false;
    };
    reader.readAsDataURL(file);
}

// Simple Summary Generator (fallback)
function generateSimpleSummary(text) {
    // Extract key information from text
    const lines = text.split('\n').filter(l => l.trim());
    
    // Simple analysis
    const wordCount = text.split(/\s+/).length;
    const hasNumbers = /\d/.test(text);
    const hasLetters = /[a-zA-Z]/.test(text);
    
    // Generate a basic summary
    const sections = [
        `Student has submitted work containing approximately ${wordCount} words of content.`,
        hasNumbers ? "The work includes numerical data and calculations." : "",
        hasLetters ? "Text-based responses are present in the submission." : "",
        "",
        "Based on the submitted work, the student demonstrates engagement with the material.",
        "Continue to monitor progress and provide targeted support as needed."
    ].filter(l => l.trim());
    
    return sections.join('\n\n');
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    setStep('upload');
    
    // Load saved Mistral key from localStorage
    const savedKey = localStorage.getItem('mistralKey');
    if (savedKey) {
        elements.mistralKey.value = savedKey;
    }
    
    // Save Mistral key when changed
    elements.mistralKey.addEventListener('change', () => {
        if (elements.mistralKey.value) {
            localStorage.setItem('mistralKey', elements.mistralKey.value);
        } else {
            localStorage.removeItem('mistralKey');
        }
    });
    
    // Check for camera support
    if (!('capture' in document.createElement('input'))) {
        elements.cameraBtn.style.display = 'none';
    }
});

// Handle back button
window.addEventListener('popstate', (e) => {
    // Prevent browser back button from breaking the app
    e.preventDefault();
});

// Service Worker Registration (for PWA)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Service worker will be added when we deploy
    });
}
