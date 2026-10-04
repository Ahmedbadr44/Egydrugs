const DROP = "\u0000";

function lower(c){ return c >= "A" && c <= "Z" ? String.fromCharCode(c.charCodeAt(0)+32) : c; }

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
    if(c===" "){ if(out && out[out.length-1]!==" ") out+=" "; }
    else out+=c;
  }
  if(out.endsWith(" ")) out=out.slice(0,-1);
  return out;
}

function arabicKey(ch){
  if("اأإآٱءةع".includes(ch)) return "a";
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
    if(c===" "){ if(out && out[out.length-1]!==" ") out+=" "; }
    else if(!out || out[out.length-1]!==c) out+=c;
  };
  for(let i=0;i<text.length;i++){
    const c=lower(text[i]), n1=i+1<text.length?lower(text[i+1]):" ";
    if(c>="a"&&c<="z"){
      if(c==="p"){ if(n1==="h"){emit("f");i++;} else emit("b");}
      else if(c==="c"){ if(n1==="h"){const n2=i+2<text.length?lower(text[i+2]):" ";emit(["l","r","o"].includes(n2)?"k":"x");i++;} else if(n1==="k"){emit("k");i++;} else if(["e","i","y"].includes(n1)) emit("s"); else emit("k");}
      else if(c==="s"){if(n1==="h"){emit("x");i++;}else emit("s");}
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

export function skeleton(pk=""){
  let out="";
  for(const c of pk) if(!"aiu ".includes(c)) out+=c;
  return out;
}

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
    while(idx>=0&&!gapAllowed(hay,pos,idx)) idx=hay.indexOf(segs[n],idx+1);
    if(idx<0) return false;
    pos=idx+segs[n].length;
  }
  return true;
}
function gapAllowed(hay,from,idx){
  if(idx===0||hay[idx-1]===" ") return true;
  if(idx-from>4) return false;
  for(let k=from;k<idx;k++) if(hay[k]===" ") return false;
  return true;
}

function levenshtein(a,b,max){
  if(Math.abs(a.length-b.length)>max) return max+1;
  let prev=Array.from({length:b.length+1},(_,i)=>i),cur=new Array(b.length+1);
  for(let i=1;i<=a.length;i++){
    cur[0]=i; let rowMin=cur[0];
    for(let j=1;j<=b.length;j++){
      const cost=a[i-1]===b[j-1]?0:1;
      const v=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+cost);
      cur[j]=v;if(v<rowMin)rowMin=v;
    }
    if(rowMin>max)return max+1;
    [prev,cur]=[cur,prev];
  }
  return prev[b.length];
}

function fuzzyDistance(item,q,scope){
  const target=q.skJoined,maxD=target.length>=7?2:1;
  let best=maxD+1;
  const scan=lit=>{
    if(!lit)return;
    let count=0;
    for(const tok of lit.split(" ")){
      if(count>=4)break; count++;
      if(tok.length<3)continue;
      const sk=skeleton(key(tok));if(sk.length<2)continue;
      let dist=levenshtein(target,sk,best-1);
      if(sk.length>target.length){
        const pd=levenshtein(target,sk.slice(0,target.length),best-1);
        if(pd<dist)dist=pd;
      }
      if(dist<best)best=dist;
    }
  };
  if(scope==="brand"){scan(item.litEn);scan(item.litAr);}else scan(item.litSci);
  return best<=maxD?best:-1;
}

function fieldScore(lit,pk,sk,q){
  let tier=-1;
  if(lit){
    const idx=orderedFind(lit,q.lit);
    if(idx>=0) tier=!q.anchored?3:idx===0?(lit===q.litJoined?0:1):(lit[idx-1]===" "?2:3);
  }
  if(tier<0&&pk&&q.pkLen>=2){
    const idx=orderedFind(pk,q.pk);
    if(idx>=0) tier=!q.anchored?6:idx===0?4:(pk[idx-1]===" "?5:6);
  }
  if(tier<0&&sk&&q.skJoined.length>=2){
    const idx=orderedFind(sk,q.sk);
    if(idx>=0) tier=q.anchored&&idx===0?7:8;
  }
  return tier<0?-1:tier*2;
}

function parseQuery(raw){
  if(!raw)return null;
  const litText=literal(raw);if(!litText)return null;
  const lit=litText.split(" ");
  if(lit.reduce((n,x)=>n+x.length,0)<2)return null;
  const pk=lit.map(key).filter(Boolean);
  const sk=pk.map(skeleton).filter(Boolean);
  return {anchored:!/^\s/.test(raw),lit,pk,sk,litJoined:lit.join(" "),pkLen:pk.reduce((n,x)=>n+x.length,0),skJoined:sk.join("")};
}

function prepare(d){
  const litEn=literal(d.commercial_name_en||"");
  const litAr=literal(d.commercial_name_ar||"");
  const litSci=literal(d.scientific_name||"");
  const pkEn=key(litEn),pkSci=key(litSci);
  return {...d,litEn,litAr,litSci,pkEn,pkSci,skEn:skeleton(pkEn),skAr:skeleton(key(litAr)),skSci:skeleton(pkSci)};
}

export function createSearchIndex(rows){ return rows.map(prepare); }

export function searchIndex(items,raw,scope="brand",limit=200){
  const q=parseQuery(raw);if(!q)return [];
  const hits=[],flagged=new Array(items.length).fill(false);
  for(let i=0;i<items.length;i++){
    const d=items[i];
    let score=-1;
    if(scope==="brand"){
      score=fieldScore(d.litEn,d.pkEn,d.skEn,q);
      const ar=fieldScore(d.litAr,null,d.skAr,q);
      if(score<0)score=ar;else if(ar>=0)score=Math.min(score,ar);
    }else score=fieldScore(d.litSci,d.pkSci,d.skSci,q);
    if(score>=0){hits.push({index:i,score});flagged[i]=true;}
  }
  if(hits.length<10&&q.skJoined.length>=3){
    for(let i=0;i<items.length;i++){
      if(flagged[i])continue;
      const d=fuzzyDistance(items[i],q,scope);
      if(d>=0)hits.push({index:i,score:20+d});
    }
  }
  hits.sort((a,b)=>{
    if(a.score!==b.score)return a.score-b.score;
    const na=items[a.index].commercial_name_en||"",nb=items[b.index].commercial_name_en||"";
    return na.length!==nb.length?na.length-nb.length:na.localeCompare(nb);
  });
  return hits.slice(0,limit).map(h=>items[h.index]);
}
