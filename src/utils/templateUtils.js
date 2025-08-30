const fs = require('fs');
const path = require('path');

const loadTemplate = (templateName, replacements) => {
    try {
        const templatePath = path.join(__dirname, '..', 'templates', templateName);
        let template = fs.readFileSync(templatePath, 'utf8');
        
        // Replace placeholders with actual values
        Object.keys(replacements).forEach(key => {
            const regex = new RegExp(`\\[${key}\\]`, 'g');
            template = template.replace(regex, replacements[key]);
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
