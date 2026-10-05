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

// Best-effort dosage-form normalization from the commercial name.
// The database currently has no separate dosage_form column, so this is kept
// local and conservative. Unknown forms are left as "unknown".
export function dosageFormOf(name=""){
 const u=String(name||"").toUpperCase();
 const rules=[
  [/\b(TABLETS?|TABS?|TAB)\b/,"tablet"],
  [/\b(CAPSULES?|CAPS?|CAP)\b/,"capsule"],
  [/\b(ORAL\s+SUSPENSION|SUSPENSION|SUSP)\b/,"suspension"],
  [/\b(SYRUP|SOLUTION|LIQUID|DROPS?)\b/,"liquid"],
  [/\b(EFF(?:ERVESCENT)?|EFF(?:ERVESCENT)?\s+TABLETS?)\b/,"effervescent"],
  [/\b(AMP(?:OULE)?S?|AMP)\b/,"ampoule"],
  [/\b(VIALS?|VIAL)\b/,"vial"],
  [/\b(INJECTION|INJ)\b/,"injection"],
  [/\b(CREAM)\b/,"cream"],
  [/\b(OINTMENT|OINT)\b/,"ointment"],
  [/\b(GEL)\b/,"gel"],
  [/\b(LOTION)\b/,"lotion"],
  [/\b(SPRAY)\b/,"spray"],
  [/\b(PATCH)\b/,"patch"],
  [/\b(SUPPOSITORIES?|SUPP)\b/,"suppository"],
  [/\b(PESSAR(?:Y|IES)?)\b/,"pessary"],
  [/\b(POWDER|SACHETS?)\b/,"powder"],
  [/\b(SOAP)\b/,"soap"],
  [/\b(STRIP|STRIPS)\b/,"strip"],
  [/\b(LOZENGES?|PASTILLES?)\b/,"lozenge"],
  [/\b(EYE\s+GEL)\b/,"eye-gel"],
  [/\b(EYE\s+DROPS?)\b/,"eye-drops"],
  [/\b(EAR\s+DROPS?)\b/,"ear-drops"],
  [/\b(NASAL\s+SPRAY)\b/,"nasal-spray"]
 ];
 for(const [re,val] of rules) if(re.test(u)) return val;
 return "unknown";
}

export function getEquivalents(rows,selected,{sameForm=false,sameStrength=false}={}){
 const selectedIng=ingredientKey(selected?.scientific_name||selected?.ingredient||"");
 if(!selectedIng) return [];
 const selectedStrength=strengthOf(selected?.commercial_name_en||selected?.nameEn||"");
 const selectedForm=dosageFormOf(selected?.commercial_name_en||selected?.nameEn||"");
 return rows
  .filter(row=>{
   if(String(row.id)===String(selected.id)) return false;
   const ing=ingredientKey(row.scientific_name||row.ingredient||"");
   if(!ing||ing!==selectedIng) return false;
   if(sameForm){
    const otherForm=dosageFormOf(row.commercial_name_en||row.nameEn||"");
    if(!selectedForm||!otherForm||selectedForm!==otherForm) return false;
   }
   if(sameStrength&&selectedStrength.length){
    const otherStrength=strengthOf(row.commercial_name_en||row.nameEn||"");
    if(JSON.stringify(otherStrength)!==JSON.stringify(selectedStrength)) return false;
   }
   return true;
  })
  .sort((a,b)=>{
   const pa=a.price==null?null:Number(a.price),pb=b.price==null?null:Number(b.price);
   if(pa==null&&pb==null) return String(a.nameEn||a.commercial_name_en||"").localeCompare(String(b.nameEn||b.commercial_name_en||""));
   if(pa==null) return 1;
   if(pb==null) return -1;
   if(pa!==pb) return pb-pa;
   return String(a.nameEn||a.commercial_name_en||"").localeCompare(String(b.nameEn||b.commercial_name_en||""));
  });
}
