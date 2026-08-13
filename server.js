const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');
const { redactText } = require('./redactor');
const { generateDocx } = require('./documentGenerator');
const { modifyDocxInPlace } = require('./docxModifier');

const app = express();
const port = process.env.PORT || 3000;

// Setup multer for handling file uploads (in-memory)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.pdf' && ext !== '.txt' && ext !== '.docx') {
            return cb(new Error('Only PDF, TXT, and DOCX files are allowed'));
        }
        cb(null, true);
    }
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle the redaction request
app.post('/api/redact', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ error: 'No file uploaded.' });
        }

        const fileExt = path.extname(req.file.originalname).toLowerCase();
        let resultBuffer;

        if (fileExt === '.docx') {
            // Modify in place, preserves layout perfectly!
            resultBuffer = modifyDocxInPlace(req.file.buffer);
        } else {
            // Fallback for PDF and TXT
            let textContent = '';
            if (fileExt === '.pdf') {
                const data = await pdf(req.file.buffer);
                textContent = data.text;
            } else if (fileExt === '.txt') {
                textContent = req.file.buffer.toString('utf-8');
            }

            if (!textContent || textContent.trim().length === 0) {
                return res.status(400).send({ error: 'Could not extract text or file is empty.' });
            }

            // Redact text and generate new docx
            const redactedText = redactText(textContent);
            resultBuffer = await generateDocx(redactedText);
        }

        // 3. Send back to client
        const originalName = path.parse(req.file.originalname).name;
        res.setHeader('Content-Disposition', `attachment; filename="${originalName}_redacted.docx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(resultBuffer);

    } catch (error) {
        console.error('Error during redaction process:', error);
        res.status(500).send({ error: error.message || 'An error occurred during file processing.' });
    }
});

// Export the app for Vercel
module.exports = app;

// Only listen locally if run directly
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server listening at http://localhost:${port}`);
    });
}
