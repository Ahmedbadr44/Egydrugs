import React,{useEffect,useMemo,useState} from "react";
import{ActivityIndicator,FlatList,I18nManager,Linking,Modal,Pressable,SafeAreaView,ScrollView,StatusBar,StyleSheet,Text,TextInput,View}from"react-native";
import{WebView}from"react-native-webview";
import{supabase}from"./src/lib/supabase";
import{useDrugSearch}from"./src/search/useDrugSearch";
import{getEquivalents,ingredientKey}from"./src/equivalents";
I18nManager.allowRTL(true);
const PAGE_SIZE=1000,PHONE="01030950177";
const price=v=>v==null?"غير متوفر":(Number.isInteger(Number(v))?v:Number(v).toFixed(2))+" ج.م";
const route=v=>({"ORAL.SOLID":"أقراص / كبسولات","ORAL.LIQUID":"شراب / سائل للشرب",INJECTION:"حقن",TOPICAL:"موضعي",EFF:"فوار",SPRAY:"بخاخ",EYE:"للعين",VAGINAL:"مهبلي",MOUTH:"للفم",RECTAL:"شرعي / لبوس",SOAP:"صابون",EAR:"للأذن"}[String(v||"").toUpperCase()]||v||"غير محدد");

export default function App(){
 const[query,setQuery]=useState(""),[scope,setScope]=useState("brand"),[medicines,setMedicines]=useState([]),[selected,setSelected]=useState(null),[imageUrl,setImageUrl]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState(""),[menuOpen,setMenuOpen]=useState(false),[toolScreen,setToolScreen]=useState(null);
 const[doseQuery,setDoseQuery]=useState(""),[doseSelected,setDoseSelected]=useState(null),[doseInfo,setDoseInfo]=useState(null),[doseLoading,setDoseLoading]=useState(false),[doseError,setDoseError]=useState("");

 async function loadDrugs(){
  setLoading(true);setError("");
  try{
   const rows=[];
   for(let from=0;;from+=PAGE_SIZE){
    const r=await supabase.from("drugs")
      .select("id,commercial_name_en,commercial_name_ar,scientific_name,manufacturer,drug_class,route,price_egp,product_type")
      .order("id",{ascending:true})
      .range(from,from+PAGE_SIZE-1);
    if(r.error)throw r.error;
    rows.push(...(r.data||[]));
    if(!r.data||r.data.length<PAGE_SIZE)break;
   }
   setMedicines(rows.map(r=>({
    id:r.id,
    nameEn:r.commercial_name_en||"",
    nameAr:r.commercial_name_ar||"",
    price:r.price_egp,
    ingredient:r.scientific_name||"",
    manufacturer:r.manufacturer||"",
    drugClass:r.drug_class||"",
    route:r.route||"",
    productType:r.product_type||""
   })));
  }catch(e){setError(e.message||"تعذر تحميل قاعدة البيانات");}
  finally{setLoading(false);}
 }

 useEffect(()=>{loadDrugs();},[]);

 const searchResult=useDrugSearch(medicines,query,scope,{debounceMs:150,limit:200});
 const drugs=useMemo(()=>searchResult.hits.map(h=>h.item),[searchResult.hits]);
 const [sameRoute,setSameRoute]=useState(false);
 const [sameStrength,setSameStrength]=useState(false);
 const equivalents=useMemo(()=>selected?getEquivalents(medicines,selected,{sameRoute,sameStrength}):[],[medicines,selected,sameRoute,sameStrength]);

 const placeholder=scope==="ingredient"
   ?"اكتب المادة الفعالة بالإنجليزية"
   :"اكتب اسم البراند بالعربي أو الإنجليزي";

 const openDrug=item=>{
  setSameRoute(false);setSameStrength(false);setSelected(item);
};
 const openImageSearch=()=>{if(!selected)return;const q=[selected.nameEn,selected.manufacturer].filter(Boolean).join(" ");setImageUrl("https://www.google.com/search?tbm=isch&q="+encodeURIComponent(q));};
 const card=({item})=><Pressable style={s.card} onPress={()=>openDrug(item)}>
  <View style={s.main}>
   <Text style={s.en} numberOfLines={3}>{item.nameEn||"-"}</Text>
   {item.nameAr?<Text style={s.ar} numberOfLines={2}>{item.nameAr}</Text>:null}
   {item.ingredient?<Text style={s.sc} numberOfLines={3}>{item.ingredient}</Text>:null}
   <Text style={s.co} numberOfLines={2}>{item.manufacturer||"-"}</Text>
  </View>
  <View style={s.priceBox}>
   <Text style={s.price} numberOfLines={1}>{price(item.price)}</Text>
  </View>
 </Pressable>;


 const doseMedicines=useMemo(()=>medicines.filter(item=>!/[+;,\/]/.test(String(item.ingredient||""))),[medicines]);
 const doseSearch=useDrugSearch(doseMedicines,doseQuery,"brand",{debounceMs:120,limit:30});
 const doseResults=useMemo(()=>doseSearch.hits.map(h=>h.item),[doseSearch.hits]);
 const selectDoseDrug=async item=>{
  setDoseSelected(item);setDoseInfo(null);setDoseError("");
  const key=ingredientKey(item.ingredient||"");
  if(!key){setDoseError("تعذر تحديد المادة الفعالة لهذا المنتج.");return;}
  if(String(item.productType||"").toUpperCase()==="COSMETIC"){setDoseError("هذا المنتج مستحضر تجميلي وليس له جرعة دوائية.");return;}
  setDoseLoading(true);
  const r=await supabase.from("dosage_reference")
   .select("ingredient_key,display_name,adult_dose,pediatric_dose,pregnancy_safety,lactation_safety,side_effects,source_name,source_url")
   .eq("ingredient_key",key)
   .eq("is_combination",false)
   .maybeSingle();
  if(r.error) setDoseError(r.error.message||"تعذر تحميل بيانات الجرعة.");
  else if(!r.data) setDoseError("لا توجد بيانات جرعة لهذه المادة الفعالة حاليًا.");
  else setDoseInfo(r.data);
  setDoseLoading(false);
 };
 const resetDose=()=>{setDoseQuery("");setDoseSelected(null);setDoseInfo(null);setDoseError("");};
 return <SafeAreaView style={s.safe}>
  <StatusBar barStyle="dark-content"/>
  <View style={s.container}>
   <View style={s.headerRow}>
    <Text style={s.title}>EgyMeds</Text>
    <Pressable style={s.menuButton} onPress={()=>setMenuOpen(true)} accessibilityLabel="القائمة">
     <Text style={s.menuIcon}>☰</Text>
    </Pressable>
   </View>
   <TextInput
    value={query}
    onChangeText={setQuery}
    placeholder={placeholder}
    placeholderTextColor="#7B8784"
    style={[s.search,{textAlign:searchResult.lang==="ar"?"right":"left"}]}
    autoCorrect={false}
    autoCapitalize="none"
   />
   <View style={s.chips}>
    <Pressable style={[s.chip,scope==="brand"&&s.sel]} onPress={()=>setScope("brand")}>
     <Text style={scope==="brand"?s.selText:s.chipText}>البراند</Text>
    </Pressable>
    <Pressable style={[s.chip,scope==="ingredient"&&s.sel]} onPress={()=>setScope("ingredient")}>
     <Text style={scope==="ingredient"?s.selText:s.chipText}>المادة الفعالة</Text>
    </Pressable>
   </View>

   {loading?
    <View style={s.center}><ActivityIndicator/><Text style={s.status}>جاري تحميل قاعدة البيانات...</Text></View>:
    error?
    <View style={s.center}>
     <Text style={s.err}>تعذر تحميل قاعدة البيانات</Text>
     <Text>{error}</Text>
     <Pressable style={s.retry} onPress={loadDrugs}><Text style={s.retryText}>إعادة المحاولة</Text></Pressable>
    </View>:
    searchResult.notice==="ingredient-english-only"?
    <View style={s.center}><Text style={s.status}>البحث بالمادة الفعالة بالإنجليزية فقط.</Text></View>:
    query.trim().length===0?
    <View style={s.center}><Text style={s.ready}>ابحث عن دواء</Text><Text style={s.status}>اكتب اسم البراند أو المادة الفعالة</Text></View>:
    query.trim().length===1?
    <View style={s.center}><Text style={s.status}>اكتب حرفين على الأقل.</Text></View>:
    drugs.length===0?
    <View style={s.center}><Text style={s.status}>مفيش نتايج.</Text></View>:
    <FlatList data={drugs} keyExtractor={x=>String(x.id)} renderItem={card} contentContainerStyle={s.list}/>
   }
  </View>

  <View style={s.bottom}>
   <Pressable onPress={()=>Linking.openURL("tel:"+PHONE)}>
    <Text style={s.call}>للتواصل والإعلان اتصل بنا: {PHONE}</Text>
   </Pressable>
  </View>

  <Modal visible={!!selected} animationType="slide" onRequestClose={()=>setSelected(null)}>
   <SafeAreaView style={s.safe}>
    <View style={s.container}>
     <Pressable onPress={()=>setSelected(null)}><Text style={s.back}>رجوع</Text></Pressable>
     {selected&&<ScrollView contentContainerStyle={s.detailScroll}>
      <View style={s.detail}>
       <Text style={s.detailLabel}>اسم الدواء</Text>
       <Text style={s.detailEn}>{selected.nameEn||"-"}</Text>
       <Text style={s.detailAr}>{selected.nameAr||"-"}</Text>
       <Info l="المادة الفعالة" v={selected.ingredient}/>
       <Info l="الشركة" v={selected.manufacturer}/>
       <Info l="التصنيف الدوائي" v={selected.drugClass}/>
       <Info l="الشكل الدوائي" v={route(selected.route)}/>
       {selected.productType?<Info l="نوع المنتج" v={productTypeLabel(selected.productType)}/>:null}
       <Info l="السعر" v={price(selected.price)}/>
       <Pressable style={s.imageButton} onPress={openImageSearch}>
        <Text style={s.imageButtonText}>عرض صورة الدواء</Text>
       </Pressable>
      </View>
      <View style={s.eqSection}>
       <Text style={s.eqTitle}>المثائل ({equivalents.length})</Text>
       <Text style={s.eqHint}>أدوية لها نفس المادة الفعالة</Text>
       <View style={s.eqFilters}>
        {String(selected.route||"").trim()&&String(selected.route||"").toUpperCase()!=="UNKNOWN"?
         <Pressable style={[s.eqChip,sameRoute&&s.eqChipActive]} onPress={()=>setSameRoute(v=>!v)}>
          <Text style={sameRoute?s.eqChipTextActive:s.eqChipText}>Same Route</Text>
         </Pressable>:null}
        {selected.nameEn&&hasStrength(selected.nameEn)?
         <Pressable style={[s.eqChip,sameStrength&&s.eqChipActive]} onPress={()=>setSameStrength(v=>!v)}>
          <Text style={sameStrength?s.eqChipTextActive:s.eqChipText}>Same Concentration</Text>
         </Pressable>:null}
       </View>
       {equivalents.length===0?
        <Text style={s.eqEmpty}>لا توجد مثائل مطابقة.</Text>:
        equivalents.map(item=><Pressable key={String(item.id)} style={s.eqCard} onPress={()=>openDrug(item)}>
         <View style={s.eqMain}>
          <Text style={s.eqEn} numberOfLines={2}>{item.nameEn||"-"}</Text>
          {item.nameAr?<Text style={s.eqAr} numberOfLines={2}>{item.nameAr}</Text>:null}
          <Text style={s.eqCo} numberOfLines={1}>{item.manufacturer||"-"}</Text>
         </View>
         <Text style={s.eqPrice}>{price(item.price)}</Text>
        </Pressable>)
       }
      </View>
     </ScrollView>}}
    </View>
   </SafeAreaView>
  </Modal>

  <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={()=>setMenuOpen(false)}>
   <Pressable style={s.menuOverlay} onPress={()=>setMenuOpen(false)}>
    <Pressable style={s.menuPanel} onPress={e=>e.stopPropagation()}>
     <Text style={s.menuTitle}>القائمة</Text>
     <Pressable style={s.menuItem} onPress={()=>{setMenuOpen(false);setToolScreen("dose");}}>
      <Text style={s.menuItemText}>حساب الجرعات</Text>
     </Pressable>
     <Pressable style={s.menuItem} onPress={()=>{setMenuOpen(false);setToolScreen("guide");}}>
      <Text style={s.menuItemText}>دليل الأدوية</Text>
     </Pressable>
     <Pressable style={s.menuItem} onPress={()=>{setMenuOpen(false);setToolScreen("cosmetics");}}>
      <Text style={s.menuItemText}>دليل مستحضرات التجميل</Text>
     </Pressable>
     <Pressable style={s.menuItem} onPress={()=>{setMenuOpen(false);setToolScreen("prices");}}>
      <Text style={s.menuItemText}>تحديث الأسعار</Text>
     </Pressable>
    </Pressable>
   </Pressable>
  </Modal>

  <Modal visible={!!toolScreen} animationType="slide" onRequestClose={()=>setToolScreen(null)}>
   <SafeAreaView style={s.safe}>
    <View style={s.container}>
     <Pressable onPress={()=>setToolScreen(null)}><Text style={s.back}>رجوع</Text></Pressable>
     {toolScreen==="dose" ? (
      <ScrollView contentContainerStyle={s.toolScroll}>
       <View style={s.toolPage}>
        <Text style={s.toolTitle}>حساب الجرعات</Text>
        <Text style={s.toolHint}>ابحث عن الدواء، ثم راجع جرعة مادته الفعالة والمعلومات المرجعية المتاحة.</Text>
        <TextInput value={doseQuery} onChangeText={v=>{setDoseQuery(v);setDoseSelected(null);setDoseInfo(null);setDoseError("");}} placeholder="ابحث عن اسم الدواء" placeholderTextColor="#7B8784" style={s.toolSearch} autoCorrect={false} autoCapitalize="none"/>
        {doseQuery.trim().length>1&&!doseSelected ? (
         <View style={s.doseResults}>
          {doseResults.slice(0,20).map(item=><Pressable key={String(item.id)} style={s.doseResult} onPress={()=>selectDoseDrug(item)}>
           <Text style={s.doseResultEn}>{item.nameEn||"-"}</Text>
           {item.nameAr?<Text style={s.doseResultAr}>{item.nameAr}</Text>:null}
           <Text style={s.doseResultIng}>{item.ingredient||"-"}</Text>
          </Pressable>)}
          {doseResults.length===0?<Text style={s.eqEmpty}>لا توجد نتائج.</Text>:null}
         </View>
        ):null}
        {doseSelected ? (
         <View style={s.dosePanel}>
          <View style={s.doseSelectedCard}>
           <Text style={s.doseSelectedTitle}>{doseSelected.nameEn||"-"}</Text>
           {doseSelected.nameAr?<Text style={s.doseSelectedAr}>{doseSelected.nameAr}</Text>:null}
           <Text style={s.doseSelectedIng}>المادة الفعالة: {doseSelected.ingredient||"-"}</Text>
          </View>
          {doseLoading?<View style={s.medicalLoading}><ActivityIndicator/><Text style={s.status}>جاري تحميل بيانات المادة الفعالة...</Text></View>:null}
          {doseError?<Text style={s.doseError}>{doseError}</Text>:null}
          {doseInfo&&!doseError ? (
           <View>
            <DoseSection title="جرعة البالغين (Adult Dose)" text={doseInfo.adult_dose}/>
            <DoseSection title="جرعة الأطفال (Pediatric Dose)" text={doseInfo.pediatric_dose}/>
            <DoseSection title="أمان الاستخدام في الحمل (Pregnancy Safety)" text={doseInfo.pregnancy_safety}/>
            <DoseSection title="أمان الاستخدام في الرضاعة (Lactation Safety)" text={doseInfo.lactation_safety}/>
            <DoseSection title="أبرز الأعراض الجانبية (Common & Important Side Effects)" text={doseInfo.side_effects}/>
            {(doseInfo.source_name||doseInfo.source_url)?<Text style={s.sourceLine}>المصدر: {doseInfo.source_name||doseInfo.source_url}</Text>:null}
            <Text style={s.disclaimer}>هذه المعلومات مرجعية وليست بديلًا عن التقييم السريري أو النشرة المعتمدة.</Text>
           </View>
          ):null}
          <Pressable style={s.resetButton} onPress={resetDose}><Text style={s.resetButtonText}>اختيار دواء آخر</Text></Pressable>
         </View>
        ):null}
       </View>
      </ScrollView>
     ) : (
      <View style={s.toolPage}>
       <Text style={s.toolTitle}>{toolScreen==="guide"?"دليل الأدوية":toolScreen==="prices"?"تحديث الأسعار":"دليل مستحضرات التجميل"}</Text>
       <Text style={s.toolHint}>{toolScreen==="guide"?"قسم دليل الأدوية جاهز للمرحلة التالية.":toolScreen==="prices"?"قسم تحديث الأسعار جاهز للمرحلة التالية.":"قسم دليل مستحضرات التجميل جاهز للمرحلة التالية."}</Text>
      </View>
     )}
    </View>
   </SafeAreaView>
  </Modal>

  <Modal visible={!!imageUrl} animationType="slide" onRequestClose={()=>setImageUrl("")}>
   <SafeAreaView style={s.safe}>
    <View style={s.browserHeader}>
     <Pressable style={s.browserBack} onPress={()=>setImageUrl("")}><Text style={s.browserBackText}>رجوع</Text></Pressable>
     <Text style={s.browserTitle}>صور الدواء</Text>
    </View>
    {imageUrl?<WebView
      source={{uri:imageUrl}}
      style={s.webview}
      startInLoadingState
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
    />:null}
   </SafeAreaView>
  </Modal>
 </SafeAreaView>;
}

function productTypeLabel(v){
 const k=String(v||"").toUpperCase();
 return ({MEDICINE:"دواء",COSMETIC:"مستحضر تجميلي",SUPPLEMENT:"مكمل غذائي",MEDICAL_DEVICE:"مستلزم / جهاز طبي",OTHER:"أخرى"}[k]||v||"غير محدد");
}
function hasStrength(name){return /\d+(?:\.\d+)?\s*(?:MG|MCG|UG|GM|G|IU)(?![A-Z])|\d+(?:\.\d+)?\s*%/i.test(String(name||""));}
function DoseSection({title,text}){return <View style={s.doseSection}><Text style={s.doseSectionTitle}>{title}</Text><Text style={s.doseText}>{text||"غير متوفر في قاعدة البيانات الحالية."}</Text></View>}
function Info({l,v}){return <View style={s.info}><Text style={s.label}>{l}</Text><Text style={s.value}>{v||"-"}</Text></View>}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#F7F9F8"},
 container:{flex:1,padding:16},
 title:{fontSize:22,fontWeight:"800",color:"#0B7468",textAlign:"center",paddingVertical:16},
 search:{backgroundColor:"#FFF",borderWidth:1,borderColor:"#D5DFDD",borderRadius:10,padding:13,fontSize:16,marginBottom:10},
 chips:{flexDirection:"row-reverse",gap:8,marginBottom:10},
 chip:{borderWidth:1,borderColor:"#CBD7D4",borderRadius:18,paddingHorizontal:14,paddingVertical:8,backgroundColor:"#FFF"},
 sel:{backgroundColor:"#DDEFEA",borderColor:"#0B7468"},
 chipText:{color:"#43504D"},
 selText:{color:"#0B7468",fontWeight:"700"},
 list:{paddingBottom:90},
 card:{backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E7E5",borderRadius:10,padding:14,marginBottom:8,flexDirection:"row-reverse"},
 main:{flex:1,alignItems:"flex-end"},
 en:{fontSize:17,fontWeight:"700",color:"#172321"},
 ar:{marginTop:4,fontSize:15,color:"#0B7468"},
 sc:{marginTop:5,fontSize:13,color:"#707C79",textAlign:"right"},
 co:{marginTop:6,fontSize:12,color:"#7A8582"},
 priceBox:{width:82,flexShrink:0,marginRight:0,marginLeft:12,alignItems:"flex-start",paddingTop:1},
price:{fontSize:14,fontWeight:"800",color:"#0B7468",textAlign:"left",includeFontPadding:false},
 center:{flex:1,alignItems:"center",justifyContent:"center",padding:30},
 ready:{fontSize:20,fontWeight:"800"},
 status:{marginTop:8,color:"#68736F",textAlign:"center"},
 err:{fontSize:18,fontWeight:"700",color:"#A33A32",marginBottom:8},
 retry:{marginTop:16,backgroundColor:"#0B7468",borderRadius:10,padding:11},
 retryText:{color:"#FFF"},
 bottom:{position:"absolute",left:0,right:0,bottom:0,backgroundColor:"#FFF",borderTopWidth:1,borderTopColor:"#E1E7E5",padding:8,alignItems:"center"},
 call:{color:"#0B7468",fontWeight:"700"},
 back:{color:"#0B7468",fontWeight:"700",paddingVertical:12},
 detailScroll:{paddingBottom:110},
headerRow:{minHeight:56,position:"relative",justifyContent:"center",alignItems:"center"},
title:{fontSize:22,fontWeight:"800",color:"#0B7468",textAlign:"center"},
menuButton:{position:"absolute",right:0,top:4,width:46,height:46,borderRadius:10,backgroundColor:"#FFF",borderWidth:1,borderColor:"#D5DFDD",alignItems:"center",justifyContent:"center"},
menuIcon:{fontSize:25,color:"#0B7468",fontWeight:"700",lineHeight:28},
menuOverlay:{flex:1,backgroundColor:"rgba(0,0,0,0.18)"},
menuPanel:{position:"absolute",top:58,right:16,width:230,backgroundColor:"#FFF",borderWidth:1,borderColor:"#DDE5E2",borderRadius:12,padding:12,shadowColor:"#000",shadowOpacity:0.12,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:5},
menuTitle:{fontSize:18,fontWeight:"800",color:"#172321",textAlign:"right",paddingVertical:8,paddingHorizontal:6},
menuItem:{borderTopWidth:1,borderTopColor:"#E7ECEB",paddingVertical:14,paddingHorizontal:8},
menuItemText:{fontSize:16,fontWeight:"700",color:"#0B7468",textAlign:"right"},
toolPage:{flex:1,alignItems:"center",justifyContent:"center",padding:30,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E7E5",borderRadius:12,marginTop:20},
toolTitle:{fontSize:25,fontWeight:"800",color:"#0B7468",textAlign:"center"},
toolHint:{fontSize:15,color:"#68736F",textAlign:"center",marginTop:12,lineHeight:22},
imageButton:{marginTop:16,backgroundColor:"#0B7468",borderRadius:10,paddingVertical:12,paddingHorizontal:16,alignItems:"center"},
imageButtonText:{color:"#FFF",fontSize:15,fontWeight:"800"},
toolScroll:{paddingBottom:100},
toolSearch:{width:"100%",backgroundColor:"#FFF",borderWidth:1,borderColor:"#D5DFDD",borderRadius:10,padding:13,fontSize:16,marginTop:16,textAlign:"right"},
doseResults:{width:"100%",marginTop:10},
doseResult:{backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E7E5",borderRadius:9,padding:12,marginBottom:7},
doseResultEn:{fontSize:15,fontWeight:"700",color:"#172321",textAlign:"right"},
doseResultAr:{fontSize:14,color:"#0B7468",marginTop:3,textAlign:"right"},
doseResultIng:{fontSize:11,color:"#7A8582",marginTop:4,textAlign:"right"},
dosePanel:{width:"100%",marginTop:14},
doseSelectedCard:{backgroundColor:"#DDEFEA",borderWidth:1,borderColor:"#0B7468",borderRadius:10,padding:14},
doseSelectedTitle:{fontSize:17,fontWeight:"800",color:"#0B7468",textAlign:"right"},
doseSelectedAr:{fontSize:14,color:"#586460",marginTop:4,textAlign:"right"},
doseSelectedIng:{fontSize:12,color:"#68736F",marginTop:4,textAlign:"right"},
doseLabel:{fontSize:13,fontWeight:"700",color:"#43504D",textAlign:"right",marginTop:14,marginBottom:6},
toolInput:{width:"100%",backgroundColor:"#FFF",borderWidth:1,borderColor:"#D5DFDD",borderRadius:10,padding:12,fontSize:16,textAlign:"right"},
doseHint:{marginTop:14,color:"#68736F",fontSize:13,textAlign:"right"},
doseSection:{marginTop:14,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E7E5",borderRadius:10,padding:14},
doseSectionTitle:{fontSize:19,fontWeight:"800",color:"#0B7468",textAlign:"right",marginBottom:8},
doseText:{fontSize:14,color:"#172321",textAlign:"right",marginTop:6,lineHeight:22},
calculatedBox:{marginTop:12,backgroundColor:"#F1F7F5",borderRadius:9,padding:12},
calculatedTitle:{fontSize:14,fontWeight:"800",color:"#0B7468",textAlign:"right"},
calculatedText:{fontSize:16,fontWeight:"800",color:"#172321",textAlign:"right",marginTop:6,lineHeight:24},
doseError:{marginTop:12,color:"#A33A32",fontSize:14,textAlign:"right",lineHeight:20},
sourceLine:{marginTop:12,color:"#68736F",fontSize:12,textAlign:"right"},
disclaimer:{marginTop:12,color:"#8A5A00",fontSize:11,textAlign:"right",lineHeight:18},
resetButton:{marginTop:14,borderWidth:1,borderColor:"#0B7468",borderRadius:10,paddingVertical:11,alignItems:"center"},
resetButtonText:{color:"#0B7468",fontWeight:"800"},
browserHeader:{height:54,flexDirection:"row-reverse",alignItems:"center",justifyContent:"space-between",paddingHorizontal:14,backgroundColor:"#FFF",borderBottomWidth:1,borderBottomColor:"#E1E7E5"},
browserTitle:{fontSize:17,fontWeight:"800",color:"#172321"},
browserBack:{paddingVertical:8,paddingHorizontal:8},
browserBackText:{color:"#0B7468",fontWeight:"700"},
webview:{flex:1,backgroundColor:"#FFF"},
detail:{backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E7E5",borderRadius:10,padding:18},
detailLabel:{fontSize:12,fontWeight:"700",color:"#7A8582",textAlign:"right",marginBottom:4},
eqSection:{marginTop:14,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E7E5",borderRadius:10,padding:14},
eqTitle:{fontSize:20,fontWeight:"800",color:"#0B7468",textAlign:"right"},
eqHint:{fontSize:12,color:"#7A8582",textAlign:"right",marginTop:3},
eqFilters:{flexDirection:"row-reverse",gap:8,marginTop:10,marginBottom:10},
eqChip:{borderWidth:1,borderColor:"#CBD7D4",borderRadius:16,paddingHorizontal:12,paddingVertical:7,backgroundColor:"#FFF"},
eqChipActive:{backgroundColor:"#DDEFEA",borderColor:"#0B7468"},
eqChipText:{fontSize:12,color:"#43504D"},
eqChipTextActive:{fontSize:12,color:"#0B7468",fontWeight:"700"},
eqEmpty:{textAlign:"center",paddingVertical:18,color:"#7A8582"},
eqCard:{backgroundColor:"#F8FAF9",borderWidth:1,borderColor:"#E0E7E5",borderRadius:8,padding:12,marginTop:8,flexDirection:"row-reverse",alignItems:"flex-start"},
eqMain:{flex:1,minWidth:0,alignItems:"flex-end"},
eqEn:{fontSize:15,fontWeight:"700",color:"#172321",textAlign:"right"},
eqAr:{fontSize:14,color:"#0B7468",marginTop:3,textAlign:"right"},
eqCo:{fontSize:11,color:"#7A8582",marginTop:5,textAlign:"right"},
eqPrice:{width:70,fontSize:13,fontWeight:"800",color:"#0B7468",textAlign:"left",marginRight:10},

 detailEn:{fontSize:24,fontWeight:"800",color:"#0B7468",textAlign:"right"},
 detailAr:{fontSize:17,color:"#586460",marginTop:5,marginBottom:12,textAlign:"right"},
 info:{borderTopWidth:1,borderTopColor:"#E7ECEB",paddingVertical:12,flexDirection:"row-reverse"},
 label:{width:"36%",color:"#7A8582",textAlign:"right"},
 value:{width:"64%",color:"#172321",textAlign:"right"}
});
