const nlp = require('compromise');
const { faker } = require('@faker-js/faker');

// A global mapping dictionary to maintain consistent replacements
// e.g., 'Rashi Patil' -> 'John Doe'
const replacementMap = new Map();

/**
 * Gets or creates a fake replacement for a given string based on entity type.
 * @param {string} original - The original PII string
 * @param {string} type - The type of PII (e.g., 'name', 'email')
 * @returns {string} The fake replacement string
 */
function getReplacement(original, type) {
    const key = original.toLowerCase().trim();
    if (replacementMap.has(key)) {
        return replacementMap.get(key);
    }

    let replacement = '';
    switch (type) {
        case 'name':
            replacement = faker.person.fullName();
            break;
        case 'email':
            replacement = faker.internet.email();
            break;
        case 'phone':
            replacement = faker.phone.number();
            break;
        case 'company':
            replacement = faker.company.name();
            break;
        case 'address':
            replacement = faker.location.streetAddress() + ', ' + faker.location.city();
            break;
        case 'ssn':
            replacement = faker.finance.routingNumber(); // fallback for generic 9 digits if needed
            // Generating a more structural SSN lookalike
            replacement = `${faker.string.numeric(3)}-${faker.string.numeric(2)}-${faker.string.numeric(4)}`;
            break;
        case 'credit_card':
            replacement = faker.finance.creditCardNumber();
            break;
        case 'dob':
            replacement = faker.date.birthdate().toISOString().split('T')[0];
            break;
        case 'ip':
            replacement = faker.internet.ipv4();
            break;
        default:
            replacement = faker.lorem.word();
    }

    replacementMap.set(key, replacement);
    return replacement;
}

/**
 * Redacts PII from the provided text using regex and NLP.
 * @param {string} text - The input text containing PII
 * @returns {string} The redacted text
 */
function redactText(text) {
    let processedText = text;

    // --- Regex based Redaction ---

    // 1. Emails
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    processedText = processedText.replace(emailRegex, (match) => getReplacement(match, 'email'));

    // 2. IP Addresses (IPv4)
    const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    processedText = processedText.replace(ipRegex, (match) => getReplacement(match, 'ip'));

    // 3. Social Security Numbers (SSN) - format XXX-XX-XXXX
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
    processedText = processedText.replace(ssnRegex, (match) => getReplacement(match, 'ssn'));

    // 4. Credit Card Numbers (simplified, mostly 16 digits, with or without dashes/spaces)
    const ccRegex = /\b(?:\d[ -]*?){13,16}\b/g;
    processedText = processedText.replace(ccRegex, (match) => {
        // avoid simple short numbers getting caught by greedy regex if poorly bounded
        const cleanMatch = match.replace(/[- ]/g, '');
        if (cleanMatch.length >= 13 && cleanMatch.length <= 16 && !isNaN(cleanMatch)) {
            return getReplacement(match, 'credit_card');
        }
        return match;
    });

    // 5. Phone Numbers (including international +91, etc.)
    // Complex regex to match various phone formats, avoiding simple numbers
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
    processedText = processedText.replace(phoneRegex, (match) => getReplacement(match, 'phone'));

    // 6. Dates of Birth / Dates (simple MM/DD/YYYY or YYYY-MM-DD or DD-MM-YYYY)
    // Be careful with dates to not redact every date, but for a strict PII redactor we might redact most structured dates.
    const dateRegex = /\b(?:0[1-9]|1[0-2]|[1-9])[-/](?:0[1-9]|[12]\d|3[01]|[1-9])[-/](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01])\b/g;
    processedText = processedText.replace(dateRegex, (match) => getReplacement(match, 'dob'));

    // --- NLP based Redaction (using compromise) ---
    const doc = nlp(processedText);

    // Names
    const names = doc.people().out('array');
    names.forEach(name => {
        // Avoid single standard words being marked as names sometimes by NLP
        if (name.split(' ').length > 1 || doc.match(name).has('#Person')) {
             const fake = getReplacement(name, 'name');
             // Replace globally in the string
             const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi');
             processedText = processedText.replace(regex, fake);
        }
    });

    // Companies / Organizations
    const organizations = doc.organizations().out('array');
    organizations.forEach(org => {
         const fake = getReplacement(org, 'company');
         const regex = new RegExp(`\\b${escapeRegExp(org)}\\b`, 'gi');
         processedText = processedText.replace(regex, fake);
    });

    // Addresses / Places
    const places = doc.places().out('array');
    places.forEach(place => {
         const fake = getReplacement(place, 'address');
         const regex = new RegExp(`\\b${escapeRegExp(place)}\\b`, 'gi');
         processedText = processedText.replace(regex, fake);
    });

    return processedText;
}

// Utility to escape string for Regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

// Export the function and map (map exported for testing/evaluation purposes)
module.exports = { redactText, replacementMap };
