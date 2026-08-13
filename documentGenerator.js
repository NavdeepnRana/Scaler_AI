const { Document, Packer, Paragraph, TextRun } = require('docx');

/**
 * Generates a DOCX file buffer from the given text string.
 * @param {string} text - The redacted text to place in the document.
 * @returns {Promise<Buffer>} A promise that resolves to the DOCX file buffer.
 */
async function generateDocx(text) {
    // Normalize line endings and split by lines
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    
    const paragraphs = [];
    
    for (const line of lines) {
        // Allow single empty lines, but avoid excessive spacing if needed
        if (line.trim() === '') {
            paragraphs.push(new Paragraph({ text: "" }));
            continue;
        }

        paragraphs.push(new Paragraph({
            children: [
                new TextRun({
                    text: line,
                    size: 24, // 12pt font (size is in half-points)
                    font: "Calibri" // Standard readable font
                })
            ],
            spacing: {
                after: 200, // Add spacing after paragraphs (10pt)
                line: 276,  // 1.15 line spacing
            }
        }));
    }

    // Create a new document with margins and paragraphs
    const doc = new Document({
        creator: "PII Redactor",
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 1440,    // 1 inch
                            right: 1440,
                            bottom: 1440,
                            left: 1440,
                        },
                    },
                },
                children: paragraphs
            }
        ]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);
    return buffer;
}

module.exports = { generateDocx };
