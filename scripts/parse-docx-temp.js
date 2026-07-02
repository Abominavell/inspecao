const AdmZip = require("adm-zip");
const fs = require("fs");
const path = "c:\\Users\\paulo.souza\\Downloads\\Anexo I - Modelo padrão de relatório de inspeção (3).docx";
const zip = new AdmZip(path);
const xml = zip.readAsText("word/document.xml");
const paras = xml.split(/<w:p[ >]/).slice(1);
paras.forEach((p, i) => {
  const texts = [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
  const line = texts.join("").trim();
  if (!line) return;
  const bold = p.includes("w:b/");
  const jc = p.match(/w:jc w:val="([^"]+)"/);
  const align = jc ? jc[1] : "";
  const sz = p.match(/w:sz w:val="(\d+)"/);
  const size = sz ? sz[1] : "";
  console.log(`${i + 1}| b=${bold} a=${align} sz=${size} | ${line.slice(0, 150)}`);
});
console.log("\n--- media ---");
zip.getEntries().filter((e) => e.entryName.startsWith("word/media")).forEach((e) => console.log(e.entryName, e.header.size));

const x = xml;
const shd = [...x.matchAll(/w:shd w:fill="([^"]+)"/g)].map((m) => m[1]);
console.log("\n--- colors ---", [...new Set(shd)].slice(0, 20));

// extract images for report template
const outDir = "c:\\Users\\paulo.souza\\Documents\\Inspecao_Seguranca\\backend\\static\\report";
fs.mkdirSync(outDir, { recursive: true });
zip.getEntries().filter((e) => e.entryName.startsWith("word/media")).forEach((e) => {
  const name = e.entryName.split("/").pop();
  fs.writeFileSync(`${outDir}/${name}`, e.getData());
  console.log("saved", name);
});
