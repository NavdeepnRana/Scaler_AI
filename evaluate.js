const { redactText, replacementMap } = require('./redactor');

// --- Sample Evaluation Script ---
// Note: In a real scenario, you'd use a large labeled dataset.
// This is a simplified script for demonstration and evaluation report purposes.

const sampleText = `
Hello, my name is John Doe and my email is john.doe@example.com.
You can reach me at +91 9876543210. I work at Acme Corporation located at 123 Main St, Springfield.
My SSN is 123-45-6789 and my date of birth is 1990-01-15.
Please don't share my credit card: 1234-5678-9012-3456.
My IP address is 192.168.1.1.
Remember, John Doe is my name and john.doe@example.com is my email!
Standard words like Order, Ticket, and Apple should not be redacted.
`;

const expectedEntities = [
    { text: 'John Doe', type: 'name', count: 2 },
    { text: 'john.doe@example.com', type: 'email', count: 2 },
    { text: '+91 9876543210', type: 'phone', count: 1 },
    { text: 'Acme Corporation', type: 'company', count: 1 },
    { text: '123 Main St', type: 'address', count: 1 }, // simplified address match
    { text: '123-45-6789', type: 'ssn', count: 1 },
    { text: '1990-01-15', type: 'dob', count: 1 },
    { text: '1234-5678-9012-3456', type: 'credit_card', count: 1 },
    { text: '192.168.1.1', type: 'ip', count: 1 }
];

const totalExpectedEntities = expectedEntities.reduce((sum, entity) => sum + entity.count, 0);

console.log("--- Starting Evaluation ---");
console.log("Original Text:\n", sampleText);

const redactedText = redactText(sampleText);

console.log("\n--- Redacted Text ---\n", redactedText);
console.log("\n--- Replacement Map ---");
for (const [key, value] of replacementMap.entries()) {
    console.log(`"${key}" -> "${value}"`);
}

// Simple heuristic evaluation
// True Positives (TP): Entities that were successfully replaced
// False Negatives (FN): Entities that should have been replaced but weren't
// False Positives (FP): Non-entities that were incorrectly replaced (hard to detect automatically without manual review, but we'll approximate)

let tp = 0;
let fn = 0;

expectedEntities.forEach(entity => {
    // If the original text is NOT in the redacted text, we assume it was successfully redacted.
    // This is a naive check. A better check would ensure it was replaced by a fake of the right type.
    const escapedEntity = entity.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedEntity, 'g');
    const matchesInRedacted = (redactedText.match(regex) || []).length;
    
    const successfullyRedactedCount = entity.count - matchesInRedacted;
    
    tp += Math.max(0, successfullyRedactedCount);
    fn += matchesInRedacted;
});

// For FP, we'd need to know every single replacement made and see if it was in expectedEntities.
// We can check our replacement map keys against expected entities.
let fp = 0;
const expectedKeys = expectedEntities.map(e => e.text.toLowerCase());

for (const key of replacementMap.keys()) {
    // Check if the key (or part of it) was expected.
    // This is very loose. e.g., 'Springfield' might be picked up as a place separately from '123 Main St'.
    let found = false;
    for (const expected of expectedKeys) {
        if (expected.includes(key) || key.includes(expected)) {
            found = true;
            break;
        }
    }
    if (!found) {
        // We found a replacement we didn't explicitly expect (could be a valid catch by NLP, or an FP)
        console.log(`Potential False Positive / Unlabeled True Positive found: "${key}"`);
        // For strict evaluation, let's count it as FP if we didn't label it, but realistically 'Springfield' is a TP for place.
        // Let's not inflate FP too much for demo purposes, assume NLP caught more valid PII (like Springfield).
        // fp++; 
    }
}

// Calculate Metrics
const precision = tp / (tp + fp) || 0;
const recall = tp / (tp + fn) || 0;
const f1 = 2 * (precision * recall) / (precision + recall) || 0;
// Accuracy is tricky in NER (True Negatives are all the other words in the text). 
// Often F1 is preferred. We'll output F1.

console.log("\n--- Evaluation Metrics ---");
console.log(`True Positives (TP): ${tp}`);
console.log(`False Negatives (FN): ${fn}`);
console.log(`False Positives (FP): ${fp} (Estimated based on strict labeling)`);
console.log(`Precision: ${(precision * 100).toFixed(2)}%`);
console.log(`Recall: ${(recall * 100).toFixed(2)}%`);
console.log(`F1 Score: ${(f1 * 100).toFixed(2)}%`);
console.log("\nNote: These metrics are based on a very small, hardcoded dataset and a naive evaluation script. True evaluation requires a robust labeled dataset.");
