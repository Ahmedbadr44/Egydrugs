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
 const[query,setQuery]=useState(""),[scope,setScope]=useState("brand"),[medicines,setMedicines]=useState([]),[selected,setSelected]=useState(null),[imageUrl,setImageUrl]=useState(""),[loading,setLoading]=useState(true),[detailLoading,setDetailLoading]=useState(false),[error,setError]=useState("");

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

 const openDrug=async item=>{
  setSameRoute(false);setSameStrength(false);setSelected({...item,medicalInfo:null});setDetailLoading(true);
  const type=String(item.productType||"").toUpperCase();
  let info={uses:[]};
  if(type==="MEDICINE"||type==="COSMETIC"){
   const keys=[...new Set(String(item.ingredient||"").split(/[+;,/]+/).map(x=>ingredientKey(x)).filter(Boolean))];
   if(keys.length){
    const r=await supabase.from("active_ingredient_medical_info").select("ingredient_key,medical_uses,cosmetic_uses").in("ingredient_key",keys);
    if(!r.error){
     const field=type==="MEDICINE"?"medical_uses":"cosmetic_uses";
     info.uses=[...new Set((r.data||[]).flatMap(x=>Array.isArray(x[field])?x[field]:[]))];
    }
   }
  }
  setSelected(prev=>prev&&String(prev.id)===String(item.id)?{...prev,medicalInfo:info}:prev);
  setDetailLoading(false);
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

 return <SafeAreaView style={s.safe}>
  <StatusBar barStyle="dark-content"/>
  <View style={s.container}>
   <Text style={s.title}>EgyMeds</Text>
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
      {detailLoading?
       <View style={s.medicalLoading}><ActivityIndicator/><Text style={s.status}>جاري تحميل الاستخدامات...</Text></View>:
       selected.medicalInfo?.uses?.length?
       <View style={s.medicalSection}>
        <Text style={s.medicalTitle}>{String(selected.productType||"").toUpperCase()==="COSMETIC"?"الاستخدام التجميلي":"الاستخدام الطبي"}</Text>
        {selected.medicalInfo.uses.map((x,i)=><Text key={i} style={s.medicalItem}>• {x}</Text>)}
       </View>:null}

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
        equivalents.map(item=>
         <Pressable key={String(item.id)} style={s.eqCard} onPress={()=>openDrug(item)}>
          <View style={s.eqMain}>
           <Text style={s.eqEn} numberOfLines={2}>{item.nameEn||"-"}</Text>
           {item.nameAr?<Text style={s.eqAr} numberOfLines={2}>{item.nameAr}</Text>:null}
           <Text style={s.eqCo} numberOfLines={1}>{item.manufacturer||"-"}</Text>
          </View>
          <Text style={s.eqPrice}>{price(item.price)}</Text>
         </Pressable>
        )
       }
      </View>
     </ScrollView>}
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
imageButton:{marginTop:16,backgroundColor:"#0B7468",borderRadius:10,paddingVertical:12,paddingHorizontal:16,alignItems:"center"},
imageButtonText:{color:"#FFF",fontSize:15,fontWeight:"800"},
browserHeader:{height:54,flexDirection:"row-reverse",alignItems:"center",justifyContent:"space-between",paddingHorizontal:14,backgroundColor:"#FFF",borderBottomWidth:1,borderBottomColor:"#E1E7E5"},
browserTitle:{fontSize:17,fontWeight:"800",color:"#172321"},
browserBack:{paddingVertical:8,paddingHorizontal:8},
browserBackText:{color:"#0B7468",fontWeight:"700"},
webview:{flex:1,backgroundColor:"#FFF"},
detail:{backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E7E5",borderRadius:10,padding:18},
medicalLoading:{marginTop:14,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E7E5",borderRadius:10,padding:16,alignItems:"center"},
medicalSection:{marginTop:14,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E7E5",borderRadius:10,padding:14},
medicalTitle:{fontSize:20,fontWeight:"800",color:"#0B7468",textAlign:"right",marginBottom:8},
medicalItem:{fontSize:14,color:"#172321",textAlign:"right",marginTop:6,lineHeight:21},
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
