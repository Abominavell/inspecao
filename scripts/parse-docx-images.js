const AdmZip = require("adm-zip");
const path = "c:\\Users\\paulo.souza\\Downloads\\Anexo I - Modelo padrão de relatório de inspeção (3).docx";
const zip = new AdmZip(path);
const xml = zip.readAsText("word/document.xml");
const rels = zip.readAsText("word/_rels/document.xml.rels");
const relMap = {};
[...rels.matchAll(/Id="([^"]+)".*?Target="([^"]+)"/g)].forEach((m) => {
  relMap[m[1]] = m[2];
});
const imgs = [...xml.matchAll(/r:embed="([^"]+)"/g)].map((m, i) => {
  const id = m[1];
  const target = relMap[id] || "";
  return { pos: i, id, file: target.replace("media/", "") };
});
console.log("first 15 images in doc order:");
imgs.slice(0, 15).forEach((x) => console.log(x));

// table structure
const tblCount = (xml.match(/<w:tbl>/g) || []).length;
console.log("tables:", tblCount);
