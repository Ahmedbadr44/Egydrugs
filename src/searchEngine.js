const DROP = "\u0000";

function lower(c){ return c >= "A" && c <= "Z" ? String.fromCharCode(c.charCodeAt(0)+32) : c; }

function isArabicChar(ch){
  const code=ch.charCodeAt(0);
  return code>=0x0600&&code<=0x06ff;
}

function queryScript(raw){
  let hasArabic=false, hasLatin=false;
  for(const ch of String(raw)){
    if(/[A-Za-z]/.test(ch)) hasLatin=true;
    else if(isArabicChar(ch)&&/\p{L}/u.test(ch)) hasArabic=true;
  }
  if(hasArabic&&!hasLatin) return "ar";
  if(hasLatin&&!hasArabic) return "en";
  if(hasArabic) return "ar";
  return "en";
}

function literalChar(ch){
  const code=ch.charCodeAt(0);
  if((ch>="a"&&ch<="z")||(ch>="0"&&ch<="9")) return ch;
  if(ch>="A"&&ch<="Z") return String.fromCharCode(ch.charCodeAt(0)+32);
  if(ch>="٠"&&ch<="٩") return String.fromCharCode("0".charCodeAt(0)+code-"٠".charCodeAt(0));
  if(ch>="۰"&&ch<="۹") return String.fromCharCode("0".charCodeAt(0)+code-"۰".charCodeAt(0));
  if((ch>="ً"&&ch<="ٟ")||ch==="ٰ"||ch==="ـ") return DROP;
  if("أإآٱ".includes(ch)) return "ا";
  if(ch==="ى") return "ي";
  if(ch==="ة") return "ه";
  if(ch==="ؤ") return "و";
  if(ch==="ئ") return "ي";
  if(ch==="ء") return DROP;
  if(code>=0x0621&&code<=0x06ff) return /\p{L}/u.test(ch) ? ch : " ";
  return " ";
}

export function literal(text=""){
  let out="";
  for(const ch of String(text)){
    const c=literalChar(ch);
    if(c===DROP) continue;
    if(c===" "){ if(out&&out[out.length-1]!==" ") out+=" "; }
    else out+=c;
  }
  if(out.endsWith(" ")) out=out.slice(0,-1);
  return out;
}

function arabicKey(ch){
  if("اأإآٱءع".includes(ch)) return "a";
  if("ة".includes(ch)) return "h";
  if("ىيئ".includes(ch)) return "i";
  if("وؤ".includes(ch)) return "u";
  if("بپ".includes(ch)) return "b";
  if("تط".includes(ch)) return "t";
  if("ثسصزذظ".includes(ch)) return "s";
  if("جغگ".includes(ch)) return "g";
  if("حه".includes(ch)) return "h";
  if("خكقک".includes(ch)) return "k";
  if("دض".includes(ch)) return "d";
  if(ch==="ر") return "r";
  if("شچ".includes(ch)) return "x";
  if("فڤ".includes(ch)) return "f";
  if(ch==="ل") return "l";
  if(ch==="م") return "m";
  if(ch==="ن") return "n";
  if((ch>="ً"&&ch<="ٟ")||ch==="ٰ"||ch==="ـ") return DROP;
  if(ch>="٠"&&ch<="٩") return String.fromCharCode("0".charCodeAt(0)+ch.charCodeAt(0)-"٠".charCodeAt(0));
  if(ch>="۰"&&ch<="۹") return String.fromCharCode("0".charCodeAt(0)+ch.charCodeAt(0)-"۰".charCodeAt(0));
  return " ";
}

export function key(text=""){
  let out="";
  const emit=c=>{
    if(c===" "){ if(out&&out[out.length-1]!==" ") out+=" "; }
    else if(!out||out[out.length-1]!==c) out+=c;
  };
  for(let i=0;i<text.length;i++){
    const c=lower(text[i]), n1=i+1<text.length?lower(text[i+1]):" ";
    if(c>="a"&&c<="z"){
      if(c==="p"){if(n1==="h"){emit("f");i++;}else emit("b");}
      else if(c==="c"){
        if(n1==="h"){const n2=i+2<text.length?lower(text[i+2]):" ";emit(["l","r","o"].includes(n2)?"k":"x");i++;}
        else if(n1==="k"){emit("k");i++;}
        else if(["e","i","y"].includes(n1)) emit("s");
        else emit("k");
      } else if(c==="s"){if(n1==="h"){emit("x");i++;}else emit("s");}
      else if(c==="k"){if(n1==="h"){emit("k");i++;}else emit("k");}
      else if(c==="g"){if(n1==="h"){emit("g");i++;}else emit("g");}
      else if(c==="t"){if(n1==="h"){emit("t");i++;}else emit("t");}
      else if(c==="d"){if(n1==="h"){emit("d");i++;}else emit("d");}
      else if(c==="q") emit("k");
      else if(c==="x"){emit("k");emit("s");}
      else if(c==="z") emit("s");
      else if(c==="j") emit("g");
      else if(c==="v") emit("f");
      else if(c==="w") emit("u");
      else if(c==="y") emit("i");
      else if(c==="e") emit("i");
      else if(c==="o") emit("u");
      else emit(c);
    } else if(c>="0"&&c<="9") emit(c);
    else if(c>="؀"&&c<="ۿ"){const m=arabicKey(c);if(m!==DROP) emit(m);}
    else emit(" ");
  }
  if(out.endsWith(" ")) out=out.slice(0,-1);
  return out;
}

function tokens(text){ return String(text).split(" ").filter(Boolean); }

function orderedFind(hay,segs){
  if(!segs.length) return -1;
  let start=hay.indexOf(segs[0]);
  while(start>=0){
    if(restMatches(hay,segs,start+segs[0].length)) return start;
    start=hay.indexOf(segs[0],start+1);
  }
  return -1;
}

function restMatches(hay,segs,from){
  let pos=from;
  for(let n=1;n<segs.length;n++){
    let idx=hay.indexOf(segs[n],pos);
    if(idx<0) return false;
    pos=idx+segs[n].length;
  }
  return true;
}

// "_" is a single-character wildcard. It is also used internally when the
// user's query is one character shorter than a candidate token.
function wildcardMatch(text,pattern){
  if(text.length!==pattern.length) return false;
  for(let i=0;i<pattern.length;i++) if(pattern[i]!=="_"&&pattern[i]!==text[i]) return false;
  return true;
}

function wildcardInOneMissingChar(text,query){
  if(!query||text.length!==query.length+1) return false;
  for(let i=0;i<text.length;i++){
    const pattern=query.slice(0,i)+"_"+query.slice(i);
    if(wildcardMatch(text,pattern)) return true;
  }
  return false;
}

function orderedWildcardFind(hay,queryParts){
  const words=tokens(hay);
  const parts=queryParts;
  if(parts.length===0) return -1;
  let cursor=0;
  for(const part of parts){
    let found=-1;
    for(let i=cursor;i<words.length;i++){
      const w=words[i];
      if(wildcardMatch(w,part)||wildcardInOneMissingChar(w,part)){
        found=i;break;
      }
    }
    if(found<0) return -1;
    cursor=found+1;
  }
  return hay.indexOf(words[cursor-parts.length]);
}

function exactOrPhoneticScore(lit,pk,query){
  const litIdx=orderedFind(lit,query.litParts);
  if(litIdx>=0) return query.anchored&&litIdx===0?(lit===query.litJoined?0:1):3;

  const pkIdx=orderedFind(pk,query.pkParts);
  if(pkIdx>=0) return query.anchored&&pkIdx===0?4:6;

  // One missing character: treat the missing character as "_".
  const litWild=orderedWildcardFind(lit,query.litParts);
  if(litWild>=0) return query.anchored&&litWild===0?8:9;

  const pkWild=orderedWildcardFind(pk,query.pkParts);
  if(pkWild>=0) return query.anchored&&pkWild===0?10:11;

  return -1;
}

function parseQuery(raw){
  if(!raw)return null;
  const text=literal(raw);
  if(!text)return null;
  const litParts=tokens(text);
  if(litParts.reduce((n,x)=>n+x.length,0)<2)return null;
  const pkParts=litParts.map(key).filter(Boolean);
  return {
    script:queryScript(raw),
    anchored:!/^\s/.test(raw),
    litParts,
    pkParts,
    litJoined:litParts.join(" ")
  };
}

function prepare(d){
  const litEn=literal(d.commercial_name_en||"");
  const litAr=literal(d.commercial_name_ar||"");
  const litSci=literal(d.scientific_name||"");
  return {
    ...d,
    litEn,
    litAr,
    litSci,
    pkEn:key(litEn),
    pkAr:key(litAr),
    pkSci:key(litSci)
  };
}

export function createSearchIndex(rows){ return rows.map(prepare); }

export function searchIndex(items,raw,scope="brand",limit=200){
  const q=parseQuery(raw);
  if(!q)return [];

  // Brand search is script-specific:
  // Arabic query -> Arabic brand name only.
  // English query -> English brand name only.
  // Active ingredient search -> English/scientific name only.
  if(scope==="ingredient"&&q.script!=="en") return [];

  const hits=[];
  for(let i=0;i<items.length;i++){
    const d=items[i];
    let score=-1;

    if(scope==="brand"){
      if(q.script==="ar"){
        score=exactOrPhoneticScore(d.litAr,d.pkAr,q);
      }else{
        score=exactOrPhoneticScore(d.litEn,d.pkEn,q);
      }
    }else{
      score=exactOrPhoneticScore(d.litSci,d.pkSci,q);
    }

    if(score>=0) hits.push({index:i,score});
  }

  hits.sort((a,b)=>{
    if(a.score!==b.score)return a.score-b.score;
    const na=items[a.index].commercial_name_en||"";
    const nb=items[b.index].commercial_name_en||"";
    return na.length!==nb.length?na.length-nb.length:na.localeCompare(nb);
  });

  return hits.slice(0,limit).map(h=>items[h.index]);
}
