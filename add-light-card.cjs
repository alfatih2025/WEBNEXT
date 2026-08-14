const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Find class names that contain 'bg-white', 'border', and are likely cards
  // We'll just look for 'bg-white' followed by space or quote, not a slash.
  const regex = /className="([^"]*)\bbg-white\b(?!\/)([^"]*)"/g;
  content = content.replace(regex, (match, before, after) => {
    // Check if it already has light-card
    if (before.includes('light-card') || after.includes('light-card')) {
      return match;
    }
    // Only apply if it looks like a card (has border, shadow, or p-)
    // Actually, user said "setiap cardnya", so let's just add it if it has bg-white, 
    // and let's assume it's a card. Most solid bg-white elements in this UI are cards.
    return `className="${before}bg-white light-card${after}"`;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      replaceInFile(fullPath);
    }
  }
}

walkDir('./src');
console.log('Added light-card class to all solid bg-white elements.');
