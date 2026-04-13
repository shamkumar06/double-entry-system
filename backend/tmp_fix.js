const fs = require('fs');
const path = require('path');

const srcDir = 'd:/Double entry system/frontend/src';

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(file => {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            walkDir(filepath, callback);
        } else if (filepath.endsWith('.jsx') || filepath.endsWith('.js')) {
            callback(filepath);
        }
    });
}

walkDir(srcDir, (filePath) => {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/\.logical_id/g, '.id');
    content = content.replace(/tx\.phase_id/g, 'tx.phaseId');
    content = content.replace(/activePhase\?\.phase_id/g, 'activePhase?.id');
    content = content.replace(/activePhase\.phase_id/g, 'activePhase.id');
    content = content.replace(/ph\.phase_id/g, 'ph.id');
    content = content.replace(/phase\.phase_id/g, 'phase.id');
    content = content.replace(/p\.phase_id/g, 'p.id');
    content = content.replace(/phase_id:/g, 'phaseId:');
    content = content.replace(/\.phase_id/g, '.id'); // Catch-all remaining after the above safe ones
    content = content.replace(/total_funds/g, 'totalFunds');
    content = content.replace(/logo_url/g, 'logoUrl');
    content = content.replace(/is_settled/g, 'isSettled');
    content = content.replace(/allocated_funds/g, 'estimatedBudget');
    content = content.replace(/estimated_budget/g, 'estimatedBudget');
    content = content.replace(/attachment_url/g, 'attachmentUrl');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed', path.basename(filePath));
    }
});
console.log('Done replacement');
