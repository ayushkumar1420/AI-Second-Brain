const GEMINI_KEY = process.env.GEMINI_KEY || "YOUR_GEMINI_API_KEY";
async function listModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`);
  const data = await res.json();
  console.log(data.models.map(m => m.name));
}
listModels();
