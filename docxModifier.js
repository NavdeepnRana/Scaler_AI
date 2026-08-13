const PizZip = require('pizzip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const { redactText } = require('./redactor');

/**
 * Modifies a DOCX file in-place by extracting its XML, applying redaction, and re-zipping.
 * @param {Buffer} buffer - The original DOCX file buffer.
 * @returns {Buffer} The redacted DOCX file buffer.
 */
function modifyDocxInPlace(buffer) {
    // 1. Unzip the docx file
    const zip = new PizZip(buffer);

    // List of XML files that might contain text
    const xmlFilesToProcess = Object.keys(zip.files).filter(fileName => 
        fileName === 'word/document.xml' || 
        fileName.startsWith('word/header') || 
        fileName.startsWith('word/footer')
    );

    const parser = new DOMParser();
    const serializer = new XMLSerializer();

    for (const fileName of xmlFilesToProcess) {
        const xmlStr = zip.file(fileName).asText();
        const docXml = parser.parseFromString(xmlStr, 'text/xml');

        // Find all <w:t> text nodes (Word Text nodes)
        const textNodes = docXml.getElementsByTagName('w:t');

        // Apply redaction to each text node's content
        for (let i = 0; i < textNodes.length; i++) {
            const node = textNodes[i];
            if (node.textContent && node.textContent.trim().length > 0) {
                const originalText = node.textContent;
                const redacted = redactText(originalText);
                if (redacted !== originalText) {
                    node.textContent = redacted;
                }
            }
        }

        // Serialize back to string and update zip
        const newXmlStr = serializer.serializeToString(docXml);
        zip.file(fileName, newXmlStr);
    }

    // Generate the new docx buffer
    const newBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    return newBuffer;
}

module.exports = { modifyDocxInPlace };
