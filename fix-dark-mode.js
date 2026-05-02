const fs = require('fs');
const path = require('path');

const dirsToScan = [
  path.join(__dirname, 'components'),
  path.join(__dirname, 'app')
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

let changedFiles = 0;

dirsToScan.forEach(dir => {
  const files = walk(dir);
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Replace text-slate-900 and text-black with text-foreground
    content = content.replace(/\btext-slate-900\b/g, 'text-foreground');
    content = content.replace(/\btext-gray-900\b/g, 'text-foreground');
    content = content.replace(/\btext-zinc-900\b/g, 'text-foreground');
    
    // Replace text-slate-800 with text-foreground/90
    content = content.replace(/\btext-slate-800\b/g, 'text-foreground/90');
    
    // Replace borders
    content = content.replace(/\bborder-slate-200\b/g, 'border-border');
    content = content.replace(/\bborder-gray-200\b/g, 'border-border');
    content = content.replace(/\bborder-slate-100\b/g, 'border-border/50');
    content = content.replace(/\bborder-gray-100\b/g, 'border-border/50');
    
    // Replace hardcoded backgrounds (careful with bg-white, but bg-slate-50 is usually muted)
    content = content.replace(/\bbg-slate-50\b/g, 'bg-muted/50');
    content = content.replace(/\bbg-gray-50\b/g, 'bg-muted/50');
    content = content.replace(/\bbg-white\b/g, 'bg-card');

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      changedFiles++;
      console.log(`Updated: ${file}`);
    }
  });
});

console.log(`Finished! Updated ${changedFiles} files to support dark mode.`);
