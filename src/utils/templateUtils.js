const fs = require('fs');
const path = require('path');
require('dotenv').config();

const loadTemplate = (templateName, replacements = {}) => {
    try {
        const templatePath = path.join(__dirname, '..', 'templates', templateName);
        let template = fs.readFileSync(templatePath, 'utf8');
        
        // Add environment variables to replacements
        const allReplacements = {
            ...replacements,
            'LOGO_URL': process.env.LOGO_URL || 'https://pub-a9806e1f673d447a94314a6d53e85114.r2.dev/salesBid.png',
            'DOMAIN_URL': process.env.DOMAIN_URL || 'http://localhost:8080'
        };
        
        // First replace all [KEY] placeholders
        Object.keys(allReplacements).forEach(key => {
            const regex = new RegExp(`\\[${key}\\]`, 'g');
            template = template.replace(regex, allReplacements[key]);
        });
        
        // Then handle URL placeholders (__KEY__) separately
        const urlRegex = /__([A-Z_]+)__/g;
        template = template.replace(urlRegex, (match, key) => {
            return allReplacements[key] || match; // Return original if key not found
        });
        
        return template;
    } catch (error) {
        console.error('Error loading template:', error);
        throw error;
    }
};

module.exports = {
    loadTemplate
};
