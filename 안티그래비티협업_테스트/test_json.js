const fs = require('fs');
const html = fs.readFileSync('component-drafts.html', 'utf8');
const match = html.match(/<script type="application\/json" id="appifact-doc">([\s\S]*?)<\/script>/);
if (match) {
  try {
    JSON.parse(match[1]);
    console.log("Valid JSON in Node!");
  } catch(e) {
    console.log("JSON Error:", e);
  }
} else {
  console.log("No match");
}
