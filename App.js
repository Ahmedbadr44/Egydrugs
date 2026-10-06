import React,{useEffect,useMemo,useState} from "react";
import{ActivityIndicator,FlatList,I18nManager,Linking,Modal,Pressable,SafeAreaView,ScrollView,StatusBar,StyleSheet,Text,TextInput,View}from"react-native";
import{WebView}from"react-native-webview";
import{supabase}from"./src/lib/supabase";
import{useDrugSearch}from"./src/search/useDrugSearch";
import{getEquivalents,ingredientKey}from"./src/equivalents";
I18nManager.allowRTL(true);
const PAGE_SIZE=1000,PHONE="01030950177";
const price=v=>v==null?"N/A":(Number.isInteger(Number(v))?v:Number(v).toFixed(2))+" EGP";
const route=v=>({"ORAL.SOLID":"Tablets / Capsules","ORAL.LIQUID":"Oral Liquid","INJECTION":"Injection",TOPICAL:"Topical",EFF:"Effervescent",SPRAY:"Spray",EYE:"Ophthalmic",VAGINAL:"Vaginal",MOUTH:"Oral",RECTAL:"Rectal",SOAP:"Soap",EAR:"Otic"}[String(v||"").toUpperCase()]||v||"Unknown");

export default function App(){
 const[query,setQuery]=useState(""),[scope,setScope]=useState("brand"),[medicines,setMedicines]=useState([]),[selected,setSelected]=useState(null),[favorite,setFavorite]=useState(false),[imageUrl,setImageUrl]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState(""),[menuOpen,setMenuOpen]=useState(false),[toolScreen,setToolScreen]=useState(null);
 const[doseQuery,setDoseQuery]=useState(""),[doseScope,setDoseScope]=useState("brand"),[doseSelected,setDoseSelected]=useState(null),[doseInfo,setDoseInfo]=useState(null),[doseLoading,setDoseLoading]=useState(false),[doseError,setDoseError]=useState("");

 async function loadDrugs(){
  setLoading(true);setError("");
  try{
   const rows=[];
   for(let from=0;;from+=PAGE_SIZE){
    const r=await supabase.from("drugs")
      .select("id,commercial_name_en,commercial_name_ar,scientific_name,manufacturer,drug_class,route,description,uses_summary_en,price_egp,price_old_egp,updated_at,product_type")
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
    drugClass:r.description||r.drug_class||"",
    route:r.uses_summary_en||r.route||"",
    productType:r.product_type||"",
    oldPrice:r.price_old_egp,
    updatedAt:r.updated_at,
   })));
  }catch(e){setError(e.message||"تعذر تحميل قاعدة بيانات الأدوية");}
  finally{setLoading(false);}
 }

 useEffect(()=>{loadDrugs();},[]);

 const searchResult=useDrugSearch(medicines,query,scope,{debounceMs:150,limit:200});
 const drugs=useMemo(()=>searchResult.hits.map(h=>h.item),[searchResult.hits]);
 const [sameRoute,setSameRoute]=useState(false);
 const [sameStrength,setSameStrength]=useState(false);
 const equivalents=useMemo(()=>selected?getEquivalents(medicines,selected,{sameRoute,sameStrength}):[],[medicines,selected,sameRoute,sameStrength]);

 const placeholder=scope==="ingredient"
   ?"ابحث بالمادة الفعالة بالإنجليزية"
   :"ابحث باسم الدواء بالعربي أو بالإنجليزية";

 const openDrug=item=>{
  setSameRoute(false);setSameStrength(false);setFavorite(false);setSelected(item);
};
 const openImageSearch=()=>{if(!selected)return;const q=[selected.nameEn,selected.nameAr,selected.manufacturer,selected.ingredient].filter(Boolean).join(" ");setImageUrl("https://www.google.com/search?tbm=isch&q="+encodeURIComponent(q));};
 const card=({item})=><Pressable style={s.card} onPress={()=>openDrug(item)}>
  <View style={s.cardMain}>
   <Text style={s.cardNameEn} numberOfLines={2}>{item.nameEn||"-"}</Text>
   {item.nameAr?<Text style={s.cardNameAr} numberOfLines={2}>{item.nameAr}</Text>:null}
   {item.ingredient?<Text style={s.cardIngredient} numberOfLines={2}>{item.ingredient}</Text>:null}
   <Text style={s.cardCompany} numberOfLines={1}>{item.manufacturer||"-"}</Text>
  </View>
  <View style={s.cardPriceCol}>
   <Text style={s.cardPrice}>{price(item.price).replace(" EGP"," ج.م")}</Text>
   {item.oldPrice!=null&&Number(item.oldPrice)>0?<Text style={s.cardOldPrice}>{Number(item.oldPrice).toFixed(0)} ج.م</Text>:null}
  </View>
 </Pressable>;


 const doseSearch=useDrugSearch(medicines,doseQuery,doseScope,{debounceMs:150,limit:200});
 const doseResults=useMemo(()=>doseSearch.hits.map(h=>h.item),[doseSearch.hits]);
 const selectDoseDrug=async item=>{
  setDoseSelected(item);setDoseInfo(null);setDoseError("");
  const key=ingredientKey(item.ingredient||"");
  if(!key){setDoseError("تعذر تحديد المادة الفعالة لهذا المنتج.");return;}
  if(String(item.productType||"").toUpperCase()==="COSMETIC"){setDoseError("هذا المنتج مستحضر تجميلي ولا توجد له جرعة دوائية.");return;}
  const isCombination=/[+;,\/]/.test(String(item.ingredient||""));
  setDoseLoading(true);
  const r=await supabase.from("dosage_reference")
   .select("ingredient_key,display_name,adult_dose,pediatric_dose,pregnancy_safety,lactation_safety,side_effects,source_name,source_url")
   .eq("ingredient_key",key)
   .eq("is_combination",isCombination)
   .maybeSingle();
  if(r.error) setDoseError(r.error.message||"تعذر تحميل بيانات الجرعات.");
  else if(!r.data) setDoseError("لا توجد بيانات جرعات مرجعية متاحة حاليًا لهذه المادة الفعالة.");
  else setDoseInfo(r.data);
  setDoseLoading(false);
 };
 const resetDose=()=>{setDoseQuery("");setDoseSelected(null);setDoseInfo(null);setDoseError("");setDoseScope("brand");};
 return <SafeAreaView style={s.safe}>
  <StatusBar barStyle="dark-content"/>
  <View style={s.container}>
   <View style={s.homeHeader}>
    <Pressable style={s.headerIcon} onPress={()=>setMenuOpen(true)}><Text style={s.headerIconText}>☰</Text></Pressable>
    <View style={s.headerCenter}>
     <Text style={s.headerTitle}>EgyMeds</Text>
    </View>
    <Pressable style={s.headerIcon} onPress={()=>setQuery("")}><Text style={s.headerIconText}>↻</Text></Pressable>
   </View>

   <View style={s.searchShell}>
    <Text style={s.searchLabel}>{scope==="brand"?"اسم الدواء":"المادة الفعالة"}</Text>
    <TextInput
      value={query}
      onChangeText={setQuery}
      placeholder={scope==="ingredient"?"ابحث عن المادة الفعالة بالإنجليزية":"ابحث باسم الدواء بالعربي أو بالإنجليزية"}
      placeholderTextColor="#7E8A92"
      style={s.search}
      autoCorrect={false}
      autoCapitalize="none"
    />
    <View style={s.searchActions}>
      <Pressable style={[s.modeButton,scope==="brand"&&s.modeButtonActive]} onPress={()=>setScope("brand")}><Text style={scope==="brand"?s.modeTextActive:s.modeText}>الدواء</Text></Pressable>
      <Pressable style={[s.modeButton,scope==="ingredient"&&s.modeButtonActive]} onPress={()=>setScope("ingredient")}><Text style={scope==="ingredient"?s.modeTextActive:s.modeText}>المادة الفعالة</Text></Pressable>
    </View>
   </View>

   {loading?
    <View style={s.center}><ActivityIndicator color="#1774C8"/><Text style={s.status}>جاري تحميل قاعدة بيانات الأدوية...</Text></View>:
    error?
    <View style={s.center}>
     <Text style={s.err}>تعذر تحميل قاعدة بيانات الأدوية</Text>
     <Text style={s.errorText}>{error}</Text>
     <Pressable style={s.retry} onPress={loadDrugs}><Text style={s.retryText}>إعادة المحاولة</Text></Pressable>
    </View>:
    searchResult.notice==="ingredient-english-only"?
    <View style={s.center}><Text style={s.status}>البحث بالمادة الفعالة متاح باللغة الإنجليزية فقط.</Text></View>:
    query.trim().length===0?
    <View style={s.emptyHome}><Text style={s.emptyIcon}>⌕</Text><Text style={s.ready}>اكتب اسم الدواء للبحث</Text><Text style={s.status}>يمكنك البحث بالعربي أو بالإنجليزية</Text></View>:
    query.trim().length===1?
    <View style={s.center}><Text style={s.status}>أدخل حرفين على الأقل.</Text></View>:
    drugs.length===0?
    <View style={s.center}><Text style={s.status}>لم يتم العثور على نتائج.</Text></View>:
    <FlatList data={drugs} keyExtractor={x=>String(x.id)} renderItem={card} contentContainerStyle={s.list}/>
   }
  </View>

  <View style={s.bottom}>
   <Pressable onPress={()=>Linking.openURL("tel:"+PHONE)}>
    <Text style={s.call}>للتواصل والإعلان: {PHONE}</Text>
   </Pressable>
   <Text style={s.author}>Dr Ahmed badr</Text>
  </View>

  <Modal visible={!!selected} animationType="slide" onRequestClose={()=>setSelected(null)}>
   <SafeAreaView style={s.safe}>
    <View style={s.detailScreen}>
     <View style={s.detailHeader}>
      <Pressable style={s.detailHeaderIcon} onPress={()=>setSelected(null)}><Text style={s.backIcon}>‹</Text></Pressable>
      <Text style={s.detailHeaderTitle}>تفاصيل الدواء</Text>
      <Pressable style={s.detailHeaderIcon} onPress={()=>setFavorite(v=>!v)}><Text style={[s.heartIcon,favorite&&s.heartActive]}>{favorite?"♥":"♡"}</Text></Pressable>
     </View>

     {selected&&<ScrollView contentContainerStyle={s.detailScroll}>
      <View style={s.heroCard}>
       <Pressable style={s.imageSearchHero} onPress={openImageSearch}>
        <Text style={s.imageSearchHeroTitle}>صورة الدواء</Text>
       </Pressable>
       <View style={s.heroRow}>
        <View style={s.heroNameBlock}>
         <Text style={s.heroNameEn}>{selected.nameEn||"-"}</Text>
         {selected.nameAr?<Text style={s.heroNameAr}>{selected.nameAr}</Text>:null}
        </View>
        <View style={s.heroPriceBlock}>
         <Text style={s.currentPriceLabel}>السعر الحالي</Text>
         <Text style={s.currentPrice}>{price(selected.price).replace(" EGP"," ج.م")}</Text>
         {selected.oldPrice!=null?<Text style={s.heroOldPrice}>{Number(selected.oldPrice).toFixed(0)} ج.م</Text>:null}
        </View>
       </View>
      </View>

      <View style={s.infoCard}>
       <Text style={s.sectionTitle}>Drug Information</Text>
       <Info l="Active Ingredient" v={selected.ingredient}/>
       <Info l="Manufacturer" v={selected.manufacturer}/>
       <Info l="Description" v={selected.drugClass}/>
       {selected.productType?<Info l="Product Type" v={String(selected.productType).toUpperCase()}/>:null}
       <Info l="Price" v={price(selected.price)}/>
       {selected.updatedAt?<Info l="Last Price Update" v={new Date(selected.updatedAt).toLocaleDateString("en-GB")}/>:null}
      </View>


      <View style={s.eqSection}>
       <Text style={s.eqTitle}>البدائل المتاحة ({equivalents.length})</Text>
       <View style={s.eqFilters}>
        {String(selected.route||"").trim()&&String(selected.route||"").toUpperCase()!=="UNKNOWN"?
         <Pressable style={[s.eqChip,sameRoute&&s.eqChipActive]} onPress={()=>setSameRoute(v=>!v)}>
          <Text style={sameRoute?s.eqChipTextActive:s.eqChipText}>نفس الشكل الدوائي</Text>
         </Pressable>:null}
        {selected.nameEn&&hasStrength(selected.nameEn)?
         <Pressable style={[s.eqChip,sameStrength&&s.eqChipActive]} onPress={()=>setSameStrength(v=>!v)}>
          <Text style={sameStrength?s.eqChipTextActive:s.eqChipText}>نفس التركيز</Text>
         </Pressable>:null}
       </View>
       {equivalents.length===0?<Text style={s.eqEmpty}>لا توجد أدوية بديلة مطابقة.</Text>:
        equivalents.map(item=><Pressable key={String(item.id)} style={s.eqCard} onPress={()=>openDrug(item)}>
         <View style={s.eqMain}><Text style={s.eqEn} numberOfLines={2}>{item.nameEn||"-"}</Text>{item.nameAr?<Text style={s.eqAr} numberOfLines={2}>{item.nameAr}</Text>:null}<Text style={s.eqCo} numberOfLines={1}>{item.manufacturer||"-"}</Text></View>
         <Text style={s.eqPrice}>{price(item.price).replace(" EGP"," ج.م")}</Text>
        </Pressable>)
       }
      </View>
     </ScrollView>}
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
        <Text style={s.toolHint}>استخدم نفس محرك البحث الرئيسي، ثم اختر دواءً لعرض الجرعات والمعلومات الطبية المرجعية.</Text>
        <TextInput value={doseQuery} onChangeText={v=>{setDoseQuery(v);setDoseSelected(null);setDoseInfo(null);setDoseError("");}} placeholder={doseScope==="ingredient"?"ابحث بالمادة الفعالة بالإنجليزية":"ابحث باسم الدواء"} placeholderTextColor="#7B8784" style={s.toolSearch} autoCorrect={false} autoCapitalize="none"/>
        <Text style={s.doseModeLabel}>البحث عن الجرعة باستخدام:</Text>
        <View style={s.doseModeRow}>
         <Pressable style={[s.doseModeButton,doseScope==="brand"&&s.doseModeButtonActive]} onPress={()=>{setDoseScope("brand");setDoseQuery("");setDoseSelected(null);setDoseInfo(null);setDoseError("");}}>
          <Text style={doseScope==="brand"?s.doseModeTextActive:s.doseModeText}>اسم الدواء</Text>
         </Pressable>
         <Pressable style={[s.doseModeButton,doseScope==="ingredient"&&s.doseModeButtonActive]} onPress={()=>{setDoseScope("ingredient");setDoseQuery("");setDoseSelected(null);setDoseInfo(null);setDoseError("");}}>
          <Text style={doseScope==="ingredient"?s.doseModeTextActive:s.doseModeText}>المادة الفعالة</Text>
         </Pressable>
        </View>
        <View style={s.doseCurrentMode}>
         <Text style={s.doseCurrentModeText}>وضع البحث الحالي: {doseScope==="brand"?"اسم الدواء":"المادة الفعالة"}</Text>
        </View>
        {doseSearch.notice==="ingredient-english-only" ? <Text style={s.doseError}>البحث بالمادة الفعالة متاح باللغة الإنجليزية فقط.</Text> : null}
        {doseQuery.trim().length>1&&!doseSelected ? (
         <View style={s.doseResults}>
          {doseResults.slice(0,20).map(item=><Pressable key={String(item.id)} style={s.doseResult} onPress={()=>selectDoseDrug(item)}>
           <Text style={s.doseResultEn}>{item.nameEn||"-"}</Text>
           
           <Text style={s.doseResultIng}>{item.ingredient||"-"}</Text>
          </Pressable>)}
          {doseResults.length===0?<Text style={s.eqEmpty}>لم يتم العثور على نتائج.</Text>:null}
         </View>
        ):null}
        {doseSelected ? (
         <View style={s.dosePanel}>
          <View style={s.doseSelectedCard}>
           <Text style={s.doseSelectedTitle}>{doseScope==="ingredient"?(doseSelected.ingredient||"-"):(doseSelected.nameEn||"-")}</Text>
           {doseScope==="ingredient"?<Text style={s.doseSelectedIng}>الدواء المرتبط: {doseSelected.nameEn||"-"}</Text>:<Text style={s.doseSelectedIng}>المادة الفعالة: {doseSelected.ingredient||"-"}</Text>}
           <Text style={s.doseSelectedMode}>طريقة البحث: {doseScope==="brand"?"اسم الدواء":"المادة الفعالة"}</Text>
          </View>
          {doseLoading?<View style={s.medicalLoading}><ActivityIndicator/><Text style={s.status}>جاري تحميل المعلومات الطبية المرجعية...</Text></View>:null}
          {doseError?<Text style={s.doseError}>{doseError}</Text>:null}
          {doseInfo&&!doseError ? (
           <View>
            <DoseSection title="جرعة البالغين" text={doseInfo.adult_dose}/>
            <DoseSection title="جرعة الأطفال" text={doseInfo.pediatric_dose}/>
            <DoseSection title="الأمان في الحمل" text={doseInfo.pregnancy_safety}/>
            <DoseSection title="الأمان في الرضاعة" text={doseInfo.lactation_safety}/>
            <DoseSection title="أهم وأشهر الأعراض الجانبية" text={doseInfo.side_effects}/>
            {(doseInfo.source_name||doseInfo.source_url)?<Text style={s.sourceLine}>المصدر: {doseInfo.source_name||doseInfo.source_url}</Text>:null}
            <Text style={s.disclaimer}>هذه المعلومات مرجعية فقط، ولا تُغني عن التقييم الطبي أو النشرة المعتمدة للمنتج.</Text>
           </View>
          ):null}
          <Pressable style={s.resetButton} onPress={resetDose}><Text style={s.resetButtonText}>اختر دواءً آخر</Text></Pressable>
         </View>
        ):null}
       </View>
      </ScrollView>
     ) : (
      <View style={s.toolPage}>
       <Text style={s.toolTitle}>{toolScreen==="guide"?"Drug Guide":toolScreen==="prices"?"Price Updates":"Cosmetics Guide"}</Text>
       <Text style={s.toolHint}>{toolScreen==="guide"?"دليل الأدوية جاهز لمرحلة التنفيذ التالية.":toolScreen==="prices"?"تحديث الأسعار جاهز لمرحلة التنفيذ التالية.":"دليل مستحضرات التجميل جاهز لمرحلة التنفيذ التالية."}</Text>
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

function hasStrength(name){return /\d+(?:\.\d+)?\s*(?:MG|MCG|UG|GM|G|IU)(?![A-Z])|\d+(?:\.\d+)?\s*%/i.test(String(name||""));}
function DoseSection({title,text}){return <View style={s.doseSection}><Text style={s.doseSectionTitle}>{title}</Text><Text style={s.doseText}>{text||"Not available in the current reference database."}</Text></View>}
function Info({l,v}){return <View style={s.info}><Text style={s.label}>{l}</Text><Text style={s.value}>{v||"-"}</Text></View>}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#F7F5ED"},
 container:{flex:1,backgroundColor:"#F7F5ED"},
 homeHeader:{height:112,backgroundColor:"#00695C",paddingTop:18,paddingHorizontal:14,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:"#00574F"},
 headerCenter:{alignItems:"center",justifyContent:"center",flex:1},
 headerTitle:{fontSize:28,fontWeight:"800",color:"#FFF",letterSpacing:.2},
 headerIcon:{width:48,height:48,alignItems:"center",justifyContent:"center"},
 headerIconText:{fontSize:31,color:"#FFF",fontWeight:"700"},
 searchShell:{marginHorizontal:16,marginTop:14,backgroundColor:"#FFFDF8",borderWidth:2,borderColor:"#56A79E",borderRadius:11,paddingHorizontal:13,paddingTop:7,paddingBottom:10,elevation:2},
 searchLabel:{position:"absolute",top:-13,left:14,backgroundColor:"#F7F5ED",paddingHorizontal:7,color:"#3E8F87",fontSize:17,fontWeight:"600"},
 search:{backgroundColor:"#FFFDF8",paddingVertical:12,paddingHorizontal:7,fontSize:20,textAlign:"right",color:"#22302D"},
 searchActions:{flexDirection:"row-reverse",gap:8,marginTop:4},
 modeButton:{borderWidth:1,borderColor:"#D0D9DF",borderRadius:18,paddingHorizontal:13,paddingVertical:7,backgroundColor:"#FFF"},
 modeButtonActive:{backgroundColor:"#E1F1EC",borderColor:"#56A79E"},
 modeText:{fontSize:14,color:"#65727D"},
 modeTextActive:{fontSize:14,color:"#00695C",fontWeight:"800"},
 list:{paddingHorizontal:12,paddingTop:12,paddingBottom:115},
 card:{backgroundColor:"#FBFAF3",borderRadius:10,borderWidth:1,borderColor:"#ECE8DA",paddingVertical:11,paddingHorizontal:12,marginBottom:9,flexDirection:"row-reverse",elevation:1},
 cardMain:{flex:1,minWidth:0,paddingLeft:9,alignItems:"flex-start"},
 cardNameEn:{fontSize:18,fontWeight:"800",color:"#06463F",textAlign:"left",width:"100%"},
 cardNameAr:{marginTop:4,fontSize:16,color:"#536D65",textAlign:"right",width:"100%"},
 cardIngredient:{marginTop:6,fontSize:14,fontWeight:"700",color:"#187168",textAlign:"left",width:"100%"},
 cardCompany:{marginTop:4,fontSize:13,color:"#7A857E",textAlign:"left",width:"100%"},
 cardPriceCol:{width:105,alignItems:"flex-start",justifyContent:"flex-start",paddingTop:0},
 cardPrice:{fontSize:21,fontWeight:"900",color:"#C62828",textAlign:"left"},
 cardOldPrice:{fontSize:15,color:"#606863",textDecorationLine:"line-through",marginTop:2},
 center:{flex:1,alignItems:"center",justifyContent:"center",padding:30},
 emptyHome:{flex:1,alignItems:"center",justifyContent:"center",paddingBottom:120},
 emptyIcon:{fontSize:58,color:"#6D879B",marginBottom:10},
 ready:{fontSize:22,fontWeight:"800",color:"#23303A"},
 status:{marginTop:8,color:"#64727C",textAlign:"center",fontSize:15,lineHeight:21},
 errorText:{color:"#4A555C",textAlign:"center"},
 err:{fontSize:18,fontWeight:"700",color:"#B22C27",marginBottom:8},
 retry:{marginTop:16,backgroundColor:"#00695C",borderRadius:10,paddingVertical:11,paddingHorizontal:22},
 retryText:{color:"#FFF",fontWeight:"800"},
 bottom:{position:"absolute",left:0,right:0,bottom:0,backgroundColor:"#DCE8DE",borderTopWidth:1,borderTopColor:"#C9D9CD",paddingVertical:7,alignItems:"center"},
 author:{marginTop:2,color:"#4A555C",fontSize:12,fontWeight:"700"},
 call:{color:"#2E5A52",fontWeight:"800"},
 menuButton:{position:"absolute",right:10,top:10,width:46,height:46,borderRadius:10},
 menuIcon:{fontSize:25,color:"#1976D2",fontWeight:"700"},
 menuOverlay:{flex:1,backgroundColor:"rgba(0,0,0,.18)"},
 menuPanel:{position:"absolute",top:76,left:12,width:245,backgroundColor:"#FFFDF8",borderWidth:1,borderColor:"#A8C9C2",borderRadius:14,padding:8,elevation:8,shadowColor:"#000",shadowOpacity:.16,shadowRadius:10,shadowOffset:{width:0,height:5}},
 menuTitle:{fontSize:19,fontWeight:"900",color:"#00695C",textAlign:"right",paddingVertical:10,paddingHorizontal:10},
 menuItem:{borderTopWidth:1,borderTopColor:"#E2E8E5",paddingVertical:15,paddingHorizontal:10},
 menuItemText:{fontSize:16,fontWeight:"800",color:"#24574F",textAlign:"right"},
 detailScreen:{flex:1,backgroundColor:"#F7F5ED"},
 detailHeader:{height:72,backgroundColor:"#00695C",flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:12},
 detailHeaderIcon:{width:48,height:48,alignItems:"center",justifyContent:"center"},
 backIcon:{fontSize:47,color:"#FFF",fontWeight:"300",lineHeight:47},
 detailHeaderTitle:{fontSize:23,fontWeight:"900",color:"#FFF"},
 heartIcon:{fontSize:40,color:"#FFF",lineHeight:42},
 heartActive:{color:"#FFF100"},
 detailScroll:{padding:12,paddingBottom:100},
 heroCard:{backgroundColor:"#FFF",borderRadius:18,padding:14,elevation:4,shadowColor:"#000",shadowOpacity:.1,shadowRadius:8,shadowOffset:{width:0,height:4}},
 imageSearchHero:{minHeight:190,alignItems:"center",justifyContent:"center",backgroundColor:"#F3F8F6",borderWidth:2,borderColor:"#79B9AE",borderRadius:16,paddingHorizontal:18,paddingVertical:20},
 imageSearchHeroTitle:{fontSize:28,fontWeight:"900",color:"#06463F"},
  heroRow:{flexDirection:"row-reverse",alignItems:"flex-start",justifyContent:"space-between",marginTop:14,gap:8},
 heroNameBlock:{flex:1,alignItems:"flex-start"},
 heroNameEn:{fontSize:25,fontWeight:"900",color:"#2473AF",textAlign:"left"},
 heroNameAr:{fontSize:18,color:"#1B1B1B",marginTop:4,textAlign:"right"},
 heroPriceBlock:{width:125,alignItems:"flex-end"},
 currentPriceLabel:{fontSize:15,color:"#6B757D",textAlign:"right"},
 currentPrice:{fontSize:28,fontWeight:"900",color:"#2A8E48",textAlign:"right"},
 heroOldPrice:{fontSize:16,color:"#D16B68",textDecorationLine:"line-through",marginTop:2},
 infoCard:{backgroundColor:"#FFF",borderRadius:18,marginTop:14,overflow:"hidden",elevation:2},
 sectionTitle:{color:"#00695C",fontSize:22,fontWeight:"900",textAlign:"right",paddingHorizontal:18,paddingVertical:15},
 info:{borderTopWidth:1,borderTopColor:"#E5E9E6",paddingHorizontal:16,paddingVertical:14,flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",minHeight:58},
 label:{width:"36%",fontSize:15,color:"#6C7774",textAlign:"right",fontWeight:"700",lineHeight:21},
 value:{flex:1,marginLeft:14,fontSize:15,color:"#2F3E3A",textAlign:"left",lineHeight:21},
 eqSection:{backgroundColor:"#FFF",borderRadius:18,marginTop:14,padding:14,elevation:2},
 eqTitle:{fontSize:22,fontWeight:"900",color:"#00695C",textAlign:"right"},
 eqHint:{fontSize:12,color:"#7A8582",textAlign:"right",marginTop:3},
 eqFilters:{flexDirection:"row-reverse",gap:8,marginTop:10,marginBottom:4},
 eqChip:{borderWidth:1,borderColor:"#CBD7D4",borderRadius:16,paddingHorizontal:12,paddingVertical:7,backgroundColor:"#FFF"},
 eqChipActive:{backgroundColor:"#E1F1EC",borderColor:"#56A79E"},
 eqChipText:{fontSize:12,color:"#4B5962"},
 eqChipTextActive:{fontSize:12,color:"#00695C",fontWeight:"800"},
 eqEmpty:{textAlign:"center",paddingVertical:18,color:"#7C878E"},
 eqCard:{backgroundColor:"#F7FAFB",borderWidth:1,borderColor:"#E0E6E9",borderRadius:10,padding:11,marginTop:8,flexDirection:"row-reverse",alignItems:"flex-start"},
 eqMain:{flex:1,minWidth:0},
 eqEn:{fontSize:15,fontWeight:"800",color:"#1B5D8B",textAlign:"left"},
 eqAr:{fontSize:14,color:"#333",marginTop:3,textAlign:"right"},
 eqCo:{fontSize:11,color:"#7A8582",marginTop:5,textAlign:"left"},
 eqPrice:{width:80,fontSize:14,fontWeight:"900",color:"#D73531",textAlign:"right",marginLeft:10},
 imageButton:{marginTop:12,backgroundColor:"#1976D2",borderRadius:10,paddingVertical:12,alignItems:"center"},
 imageButtonText:{color:"#FFF",fontSize:15,fontWeight:"800"},
 toolScroll:{paddingBottom:100},
 toolPage:{flex:1,alignItems:"center",justifyContent:"center",padding:30,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E7E5",borderRadius:12,marginTop:20},
 toolTitle:{fontSize:25,fontWeight:"800",color:"#00695C",textAlign:"center"},
 toolHint:{fontSize:15,color:"#68736F",textAlign:"center",marginTop:12,lineHeight:22},
 toolSearch:{width:"100%",backgroundColor:"#FFFDF8",borderWidth:1,borderColor:"#B9CFC8",borderRadius:10,padding:13,fontSize:16,marginTop:16,textAlign:"right"},
 doseModeLabel:{width:"100%",marginTop:14,fontSize:14,fontWeight:"800",color:"#4A625D",textAlign:"right"},
 doseModeRow:{width:"100%",flexDirection:"row-reverse",gap:8,marginTop:8},
 doseModeButton:{flex:1,minHeight:46,alignItems:"center",justifyContent:"center",borderWidth:1.5,borderColor:"#B9CFC8",borderRadius:12,backgroundColor:"#FFF",paddingHorizontal:10},
 doseModeButtonActive:{backgroundColor:"#00695C",borderColor:"#00695C"},
 doseModeText:{fontSize:15,fontWeight:"700",color:"#5E6D68"},
 doseModeTextActive:{fontSize:15,fontWeight:"900",color:"#FFF"},
 doseCurrentMode:{width:"100%",marginTop:8,paddingVertical:7,paddingHorizontal:10,borderRadius:8,backgroundColor:"#E1F1EC"},
 doseCurrentModeText:{fontSize:12,fontWeight:"700",color:"#00695C",textAlign:"right"},
 doseResults:{width:"100%",marginTop:10},
 doseResult:{backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E7E5",borderRadius:9,padding:12,marginBottom:7},
 doseResultEn:{fontSize:15,fontWeight:"700",color:"#172321",textAlign:"left"},
 doseResultAr:{fontSize:14,color:"#1976D2",marginTop:3,textAlign:"right"},
 doseResultIng:{fontSize:11,color:"#7A8582",marginTop:4,textAlign:"left"},
 dosePanel:{width:"100%",marginTop:14},
 doseSelectedCard:{backgroundColor:"#E1F1EC",borderWidth:1,borderColor:"#56A79E",borderRadius:10,padding:14},
 doseSelectedTitle:{fontSize:17,fontWeight:"800",color:"#00695C",textAlign:"left"},
 doseSelectedIng:{fontSize:12,color:"#68736F",marginTop:4,textAlign:"left"},
 doseSelectedMode:{fontSize:11,color:"#00695C",fontWeight:"800",marginTop:6,textAlign:"right"},
 doseSection:{marginTop:14,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E7E5",borderRadius:10,padding:14},
 doseSectionTitle:{fontSize:19,fontWeight:"800",color:"#00695C",textAlign:"right",marginBottom:8},
 doseText:{fontSize:14,color:"#172321",textAlign:"left",marginTop:6,lineHeight:22},
 doseError:{marginTop:12,color:"#A33A32",fontSize:14,textAlign:"right",lineHeight:20},
 sourceLine:{marginTop:12,color:"#68736F",fontSize:12,textAlign:"right"},
 disclaimer:{marginTop:12,color:"#8A5A00",fontSize:11,textAlign:"right",lineHeight:18},
 resetButton:{marginTop:14,borderWidth:1,borderColor:"#56A79E",borderRadius:10,paddingVertical:11,alignItems:"center"},
 resetButtonText:{color:"#00695C",fontWeight:"800"},
 browserHeader:{height:54,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:14,backgroundColor:"#FFF",borderBottomWidth:1,borderBottomColor:"#E1E7E5"},
 browserTitle:{fontSize:17,fontWeight:"800",color:"#172321"},
 browserBack:{paddingVertical:8,paddingHorizontal:8},
 browserBackText:{color:"#00695C",fontWeight:"700"},
 webview:{flex:1,backgroundColor:"#FFF"},
});

