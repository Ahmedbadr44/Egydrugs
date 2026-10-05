const SALT_WORDS=new Set([
 "HCL","HYDROCHLORIDE","SODIUM","POTASSIUM","MALEATE","BESYLATE","BESILATE","MESYLATE",
 "TARTRATE","SUCCINATE","FUMARATE","HYDROBROMIDE","HYDRATE","MONOHYDRATE","DIHYDRATE",
 "TRIHYDRATE","ANHYDROUS"
]);

const STRENGTH=/\d+(?:[.,]\d+)?\s*(?:(?:MG|MCG|UG|GM|G|IU|I\.U|ML|MEQ|UNITS|UNIT|U)(?![A-Z])|%)/gi;

export function ingredientKey(scientific=""){
 if(!scientific||!String(scientific).trim()) return "";
 const up=String(scientific).toUpperCase();
 let text="";
 let depth=0;
 for(const c of up){
  if(c==="(") depth++;
  else if(c===")") {if(depth>0)depth--;}
  else if(depth===0) text+=c;
 }
 if(!text.trim()) text=up.replace(/[()]/g," ");
 const parts=new Set();
 for(const raw of text.split("+")){
  let part=raw.replace(STRENGTH," ");
  part=part.replace(/[^A-Z0-9]+/g," ").trim();
  if(!part) continue;
  const words=part.split(/\s+/);
  while(words.length>=2 && SALT_WORDS.has(words[words.length-1])) words.pop();
  const cleaned=words.join(" ").trim();
  if(cleaned.length>=2) parts.add(cleaned);
 }
 return [...parts].sort().join("+");
}

export function strengthOf(nameEn=""){
 const up=String(nameEn).toUpperCase();
 const pattern=/(\d+(?:\.\d+)?)\s*(?:(MG|MCG|UG|GM|G|IU)(?![A-Z])|(%))/g;
 const out=[];
 let m;
 while((m=pattern.exec(up))!==null){
  const value=Number(m[1]);
  if(!Number.isFinite(value)) continue;
  const unit=m[2];
  const token=m[3]==="%"
   ? `pct=${value}`
   : unit==="MG"
   ? `mg=${value}`
   : unit==="GM"||unit==="G"
   ? `mg=${value*1000}`
   : unit==="MCG"||unit==="UG"
   ? `mg=${value/1000}`
   : unit==="IU"
   ? `iu=${value}`
   : null;
  if(token) out.push(token);
 }
 return out.sort();
}

function knownRoute(route=""){
 return String(route).trim()!=="" && String(route).toUpperCase()!=="UNKNOWN";
}

function priceValue(v){
 const n=Number(v);
 return Number.isFinite(n)?n:-Infinity;
}

export function getEquivalents(rows,selected,{sameRoute=true,sameStrength=true}={}){
 const selectedIng=ingredientKey(selected?.scientific_name||selected?.ingredient||"");
 if(!selectedIng) return [];
 const selectedStrength=strengthOf(selected?.commercial_name_en||selected?.nameEn||"");
 const selectedHasRoute=knownRoute(selected?.route);
 return rows
  .filter(row=>{
   if(String(row.id)===String(selected.id)) return false;
   const ing=ingredientKey(row.scientific_name||row.ingredient||"");
   if(!ing||ing!==selectedIng) return false;
   if(sameRoute&&selectedHasRoute && String(row.route||"").toUpperCase()!==String(selected.route||"").toUpperCase()) return false;
   const otherStrength=strengthOf(row.commercial_name_en||row.nameEn||"");
   if(sameStrength&&selectedStrength.length && JSON.stringify(otherStrength)!==JSON.stringify(selectedStrength)) return false;
   return true;
  })
  .sort((a,b)=>{
   const pa=priceValue(a.price??a.price_egp),pb=priceValue(b.price??b.price_egp);
   if(pa!==pb) return pb-pa;
   const na=a.commercial_name_en||a.nameEn||"",nb=b.commercial_name_en||b.nameEn||"";
   return na.localeCompare(nb);
  });
}
