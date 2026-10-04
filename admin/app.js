const CONFIG_KEY="egydrugs-admin-config";
const PAGE_SIZE=40;
const OPTIONS_BATCH_SIZE=1000;
const DEFAULT_CONFIG={url:"https://lfxdgtbsmomafyaolndh.supabase.co",key:"sb_publishable_A9K53JorCDERk7MtJG5wiw_z_Jm0bX0"};
const fields=["id","commercial_name_en","commercial_name_ar","scientific_name","manufacturer","drug_class","route","price_egp","dosage"];

let client;
let page=0;
let hasMore=false;
let lastRows=[];
let searchTimer;
let fieldOptionsPromise;
let medicalLoaded=true;

const drugFieldOptions=[
  {field:"manufacturer",datalistId:"manufacturer-options",hintId:"manufacturer-hint"},
  {field:"drug_class",datalistId:"drug-class-options",hintId:"drug-class-hint"},
  {field:"route",datalistId:"route-options",hintId:"route-hint"}
];

const byId=(id)=>document.getElementById(id);
const app=byId("app");
const loginView=byId("login-view");
const setupView=byId("setup-view");
const notice=byId("notice");
const body=byId("drugs-body");
const emptyState=byId("empty-state");
const dialog=byId("drug-dialog");

function refreshIcons(){window.lucide?.createIcons();}
function savedConfig(){
  try{return {...DEFAULT_CONFIG,...JSON.parse(localStorage.getItem(CONFIG_KEY)||"{}")};}
  catch{return DEFAULT_CONFIG;}
}
function show(view){
  app.hidden=view!=="app";
  loginView.hidden=view!=="login";
  setupView.hidden=view!=="setup";
  refreshIcons();
}
function setNotice(message="",isError=false){
  notice.textContent=message;
  notice.classList.toggle("error",isError);
}
function configuredClient(){
  const config=savedConfig();
  if(!config?.url||!config?.key)return false;
  client=window.supabase.createClient(config.url,config.key);
  return true;
}
function formattedPrice(value){
  if(value===null||value===undefined)return"غير مسجل";
  return `${new Intl.NumberFormat("ar-EG",{maximumFractionDigits:2}).format(value)} ج.م`;
}
function safeSearchTerm(value){return value.trim().replace(/[,%()]/g,"");}
function escapeHtml(value){
  return String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}
function rowMarkup(drug){
  const ar=drug.commercial_name_ar?`<small>${escapeHtml(drug.commercial_name_ar)}</small>`:"";
  return `<tr>
    <td class="medicine-name">${escapeHtml(drug.commercial_name_en)}${ar}</td>
    <td>${escapeHtml(drug.scientific_name||"-")}</td>
    <td class="muted-cell">${escapeHtml(drug.manufacturer||"-")}</td>
    <td class="price">${formattedPrice(drug.price_egp)}</td>
    <td><div class="row-actions">
      <button class="icon-button" type="button" data-action="edit" data-id="${drug.id}" title="تعديل"><i data-lucide="pencil"></i></button>
      <button class="icon-button delete-button" type="button" data-action="delete" data-id="${drug.id}" title="حذف"><i data-lucide="trash-2"></i></button>
    </div></td>
  </tr>`;
}
function renderRows(rows){
  body.innerHTML=rows.map(rowMarkup).join("");
  emptyState.hidden=rows.length>0;
  byId("previous-page").disabled=page===0;
  byId("next-page").disabled=!hasMore;
  byId("page-label").textContent=`صفحة ${page+1}`;
  refreshIcons();
}
async function loadDrugFieldOptions(){
  if(fieldOptionsPromise)return fieldOptionsPromise;
  fieldOptionsPromise=(async()=>{
    const sets=new Map(drugFieldOptions.map(({field})=>[field,new Set()]));
    let from=0;
    while(true){
      const {data,error}=await client.from("drugs")
        .select(`id,${drugFieldOptions.map(({field})=>field).join(",")}`)
        .order("id",{ascending:true})
        .range(from,from+OPTIONS_BATCH_SIZE-1);
      if(error)throw error;
      for(const row of data)for(const {field} of drugFieldOptions){
        const value=row[field]?.trim();
        if(value)sets.get(field).add(value);
      }
      if(data.length<OPTIONS_BATCH_SIZE)break;
      from+=data.length;
    }
    for(const {field,datalistId,hintId} of drugFieldOptions){
      const list=byId(datalistId);
      list.replaceChildren();
      [...sets.get(field)].sort((a,b)=>a.localeCompare(b,"ar")).forEach(value=>{
        const option=document.createElement("option");
        option.value=value;
        list.append(option);
      });
      byId(hintId).textContent="اختر من القائمة أو اكتب قيمة جديدة.";
    }
  })().catch(error=>{fieldOptionsPromise=undefined;throw error;});
  return fieldOptionsPromise;
}
async function loadDrugs(){
  if(!client)return;
  setNotice("جاري تحميل الأدوية...");
  const term=safeSearchTerm(byId("search").value);
  const from=page*PAGE_SIZE;
  let query=client.from("drugs").select(fields.join(",")).order("id",{ascending:false}).range(from,from+PAGE_SIZE);
  if(term){
    const pattern=`%${term}%`;
    query=query.or([`commercial_name_en.ilike.${pattern}`,`commercial_name_ar.ilike.${pattern}`,`scientific_name.ilike.${pattern}`].join(","));
  }
  const {data,error}=await query;
  if(error){renderRows([]);setNotice(`تعذر تحميل الأدوية: ${error.message}`,true);return;}
  hasMore=data.length>PAGE_SIZE;
  lastRows=data.slice(0,PAGE_SIZE);
  renderRows(lastRows);
  setNotice("");
}
async function isDrugAdmin(userId){
  const {data,error}=await client.from("drug_admins").select("user_id").eq("user_id",userId).maybeSingle();
  if(error)throw error;
  return Boolean(data);
}
async function openApp(session){
  if(!session?.user||!(await isDrugAdmin(session.user.id))){
    await client.auth.signOut();
    byId("login-error").textContent="هذا الحساب غير مسموح له بإدارة الأدوية.";
    show("login");
    return;
  }
  byId("account-email").textContent=session.user.email||"";
  show("app");page=0;await loadDrugs();
}
function ingredientKeys(scientific){
  return (scientific||"").toUpperCase()
    .replace(/\([^)]*\)/g," ")
    .split(/[+;,/]/)
    .map(v=>v.replace(/\s+/g," ").trim())
    .filter(v=>v.length>=2);
}
function updateIngredientTargets(){
  const wrap=byId("ingredient-target-wrap"),select=byId("ingredient-target");
  if(!wrap||!select)return;
  const keys=[...new Set(ingredientKeys(byId("scientific-name").value))];
  select.replaceChildren();
  keys.forEach(key=>{
    const option=document.createElement("option");
    option.value=key;option.textContent=key;select.append(option);
  });
  wrap.hidden=!keys.length||!byId("propagate-medical").checked;
}
function fillForm(drug){
  byId("drug-id").value=drug?.id??"";
  byId("name-en").value=drug?.commercial_name_en??"";
  byId("name-ar").value=drug?.commercial_name_ar??"";
  byId("scientific-name").value=drug?.scientific_name??"";
  byId("manufacturer").value=drug?.manufacturer??"";
  byId("drug-class").value=drug?.drug_class??"";
  byId("route").value=drug?.route??"";
  byId("price").value=drug?.price_egp??"";
  byId("dosage").value=drug?.dosage??"";
  byId("uses").value="";
  byId("side-effects").value="";
  byId("source-url").value="";
  byId("source-name").value="";
  byId("propagate-medical").checked=false;
  byId("ingredient-target-wrap").hidden=true;
  byId("dialog-title").textContent=drug?"تعديل دواء":"إضافة دواء";
  byId("dialog-error").textContent="";
}
function medicalLines(value){return value.split("\n").map(v=>v.trim()).filter(Boolean);}
function fillMedicalForm(info){
  byId("uses").value=(info?.uses||[]).join("\n");
  byId("side-effects").value=(info?.side_effects||[]).join("\n");
  byId("source-url").value=info?.source_url||"";
  byId("source-name").value=info?.source_name||"";
}
async function loadMedicalInfo(drugId){
  if(!drugId){medicalLoaded=true;return;}
  medicalLoaded=false;
  byId("dialog-error").textContent="جاري تحميل البيانات الطبية...";
  const {data,error}=await client.from("drug_medical_info")
    .select("uses,side_effects,source_url,source_name")
    .eq("drug_id",drugId).maybeSingle();
  if(error)throw error;
  fillMedicalForm(data);
  medicalLoaded=true;
  updateIngredientTargets();
  byId("dialog-error").textContent="";
}
function medicalPayload(drugId){
  return {
    drug_id:Number(drugId),
    uses:medicalLines(byId("uses").value),
    side_effects:medicalLines(byId("side-effects").value),
    source_url:byId("source-url").value.trim()||null,
    source_name:byId("source-name").value.trim()||null
  };
}
function unionValues(first=[],second=[]){
  return [...new Set([...first,...second].map(v=>String(v).trim()).filter(Boolean))];
}
async function saveMedicalInfo(drugId){
  const payload=medicalPayload(drugId);
  const hasContent=payload.uses.length||payload.side_effects.length||payload.source_url||payload.source_name;
  if(hasContent){
    const {error}=await client.from("drug_medical_info").upsert(payload,{onConflict:"drug_id"});
    if(error)throw error;
  }else{
    const {error}=await client.from("drug_medical_info").delete().eq("drug_id",drugId);
    if(error)throw error;
  }

  if(!byId("propagate-medical").checked)return;
  const ingredient=byId("ingredient-target").value.trim();
  if(!ingredient)throw new Error("اختر مادة فعالة للتعميم.");
  if(payload.uses.length===0&&payload.side_effects.length===0)throw new Error("أضف استخدامًا أو عرضًا جانبيًا قبل التعميم.");

  const {data:matches,error:findError}=await client.rpc("find_drug_ids_by_active_ingredient",{p_ingredient:ingredient});
  if(findError)throw findError;
  if(!matches?.length)throw new Error("لم نجد أدوية تحتوي على المادة الفعالة المحددة.");

  const ids=matches.map(row=>row.id);
  const existingById=new Map();
  for(let i=0;i<ids.length;i+=500){
    const {data,error}=await client.from("drug_medical_info")
      .select("drug_id,uses,side_effects,source_url,source_name")
      .in("drug_id",ids.slice(i,i+500));
    if(error)throw error;
    for(const row of data||[])existingById.set(row.drug_id,row);
  }

  const rows=ids.map(id=>{
    const old=existingById.get(id)||{};
    return {
      drug_id:id,
      uses:unionValues(old.uses,payload.uses),
      side_effects:unionValues(old.side_effects,payload.side_effects),
      source_url:payload.source_url||old.source_url||null,
      source_name:payload.source_name||old.source_name||"بيانات مشتركة حسب المادة الفعالة"
    };
  });

  for(let i=0;i<rows.length;i+=200){
    const {error}=await client.from("drug_medical_info").upsert(rows.slice(i,i+200),{onConflict:"drug_id"});
    if(error)throw error;
  }
  setNotice(`تم حفظ البيانات وتعميمها على ${rows.length} دواء يحتوي على ${ingredient}.`);
}
async function openDialog(drug){
  fillForm(drug);
  dialog.showModal();
  byId("name-en").focus();
  loadDrugFieldOptions().catch(()=>{});
  try{await loadMedicalInfo(drug?.id);}catch(error){
    medicalLoaded=false;
    byId("dialog-error").textContent=`تعذر تحميل البيانات الطبية: ${error.message}`;
  }
}
async function saveDrug(event){
  event.preventDefault();
  if(!medicalLoaded){byId("dialog-error").textContent="انتظر اكتمال تحميل البيانات الطبية.";return;}
  const rawPrice=byId("price").value.trim();
  const payload={
    commercial_name_en:byId("name-en").value.trim(),
    commercial_name_ar:byId("name-ar").value.trim(),
    scientific_name:byId("scientific-name").value.trim(),
    manufacturer:byId("manufacturer").value.trim(),
    drug_class:byId("drug-class").value.trim(),
    route:byId("route").value.trim(),
    price_egp:rawPrice===""?null:Number(rawPrice),
    dosage:byId("dosage").value.trim()
  };
  if(!payload.commercial_name_en){byId("dialog-error").textContent="الاسم بالإنجليزية مطلوب.";return;}
  if(payload.price_egp!==null&&(!Number.isFinite(payload.price_egp)||payload.price_egp<0)){byId("dialog-error").textContent="السعر غير صحيح.";return;}
  const id=byId("drug-id").value;
  let savedId=id,error;
  if(id){({error}=await client.from("drugs").update(payload).eq("id",id));}
  else{const result=await client.from("drugs").insert(payload).select("id").single();savedId=result.data?.id;error=result.error;}
  if(error||!savedId){byId("dialog-error").textContent=`تعذر حفظ الدواء: ${error?.message||"خطأ غير معروف"}`;return;}
  try{await saveMedicalInfo(savedId);}catch(medicalError){
    byId("dialog-error").textContent=`تم حفظ الدواء لكن تعذر حفظ البيانات الطبية: ${medicalError.message}`;return;
  }
  dialog.close();
  if(!byId("propagate-medical").checked)setNotice(id?"تم تعديل الدواء والبيانات الطبية.":"تمت إضافة الدواء والبيانات الطبية.");
  await loadDrugs();
}
async function deleteDrug(id){
  const drug=lastRows.find(item=>String(item.id)===String(id));
  if(!drug||!window.confirm(`حذف ${drug.commercial_name_en} نهائيًا؟`))return;
  const {error}=await client.from("drugs").delete().eq("id",id);
  if(error){setNotice(`تعذر الحذف: ${error.message}`,true);return;}
  setNotice("تم حذف الدواء.");await loadDrugs();
}
function attachEvents(){
  byId("setup-form").addEventListener("submit",event=>{
    event.preventDefault();
    const url=byId("project-url").value.trim().replace(/\/$/,"");
    const key=byId("publishable-key").value.trim();
    try{
      const parsed=new URL(url);
      const allowed=parsed.protocol==="https:"&&parsed.hostname.endsWith(".supabase.co");
      if(!allowed||!key)throw new Error();
      localStorage.setItem(CONFIG_KEY,JSON.stringify({url,key}));location.reload();
    }catch{byId("setup-error").textContent="أدخل رابط Supabase ومفتاح Publishable صالحين.";}
  });
  byId("login-form").addEventListener("submit",async event=>{
    event.preventDefault();
    const errorElement=byId("login-error");errorElement.textContent="";
    const {data,error}=await client.auth.signInWithPassword({
      email:byId("login-email").value.trim(),
      password:byId("login-password").value
    });
    if(error){errorElement.textContent="تعذر تسجيل الدخول. راجع البريد وكلمة المرور.";return;}
    await openApp(data.session);
  });
  byId("change-config").addEventListener("click",()=>show("setup"));
  byId("sign-out").addEventListener("click",async()=>{await client.auth.signOut();show("login");});
  byId("add-drug").addEventListener("click",()=>openDialog());
  byId("close-dialog").addEventListener("click",()=>dialog.close());
  byId("cancel-dialog").addEventListener("click",()=>dialog.close());
  byId("drug-form").addEventListener("submit",saveDrug);
  byId("scientific-name").addEventListener("input",updateIngredientTargets);
  byId("propagate-medical").addEventListener("change",updateIngredientTargets);
  body.addEventListener("click",event=>{
    const button=event.target.closest("button[data-action]");if(!button)return;
    const drug=lastRows.find(item=>String(item.id)===button.dataset.id);
    if(button.dataset.action==="edit")openDialog(drug);
    if(button.dataset.action==="delete")deleteDrug(button.dataset.id);
  });
  byId("search").addEventListener("input",()=>{
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>{page=0;loadDrugs();},300);
  });
  byId("previous-page").addEventListener("click",()=>{if(page>0){page--;loadDrugs();}});
  byId("next-page").addEventListener("click",()=>{if(hasMore){page++;loadDrugs();}});
}
async function start(){
  attachEvents();
  if(!configuredClient()){show("setup");return;}
  const {data,error}=await client.auth.getSession();
  if(error){show("login");byId("login-error").textContent="تعذر استعادة الجلسة.";return;}
  if(data.session)await openApp(data.session);else show("login");
}
start();
