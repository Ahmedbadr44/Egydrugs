import React,{useEffect,useMemo,useState} from "react";
import{ActivityIndicator,FlatList,I18nManager,Linking,Modal,Pressable,SafeAreaView,StatusBar,StyleSheet,Text,TextInput,View}from"react-native";
import{supabase}from"./src/lib/supabase";
import{useDrugSearch}from"./src/search/useDrugSearch";
I18nManager.allowRTL(true);
const PAGE_SIZE=1000,PHONE="01030950177";
const price=v=>v==null?"غير متوفر":(Number.isInteger(Number(v))?v:Number(v).toFixed(2))+" ج.م";
const route=v=>({"ORAL.SOLID":"أقراص / كبسولات","ORAL.LIQUID":"شراب / سائل للشرب",INJECTION:"حقن",TOPICAL:"موضعي",EFF:"فوار",SPRAY:"بخاخ",EYE:"للعين",VAGINAL:"مهبلي",MOUTH:"للفم",RECTAL:"شرعي / لبوس",SOAP:"صابون",EAR:"للأذن"}[String(v||"").toUpperCase()]||v||"غير محدد");

export default function App(){
 const[query,setQuery]=useState(""),[scope,setScope]=useState("brand"),[medicines,setMedicines]=useState([]),[selected,setSelected]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState("");

 async function loadDrugs(){
  setLoading(true);setError("");
  try{
   const rows=[];
   for(let from=0;;from+=PAGE_SIZE){
    const r=await supabase.from("drugs")
      .select("id,commercial_name_en,commercial_name_ar,scientific_name,manufacturer,drug_class,route,price_egp")
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
    route:r.route||""
   })));
  }catch(e){setError(e.message||"تعذر تحميل قاعدة البيانات");}
  finally{setLoading(false);}
 }

 useEffect(()=>{loadDrugs();},[]);

 const searchResult=useDrugSearch(medicines,query,scope,{debounceMs:150,limit:200});
 const drugs=useMemo(()=>searchResult.hits.map(h=>h.item),[searchResult.hits]);

 const placeholder=scope==="ingredient"
   ?"اكتب المادة الفعالة بالإنجليزية"
   :"اكتب اسم البراند بالعربي أو الإنجليزي";

 const card=({item})=><Pressable style={s.card} onPress={()=>setSelected(item)}>
  <View style={s.main}>
   <Text style={s.en}>{item.nameEn||"-"}</Text>
   {item.nameAr?<Text style={s.ar}>{item.nameAr}</Text>:null}
   {item.ingredient?<Text style={s.sc}>{item.ingredient}</Text>:null}
   <Text style={s.co}>{item.manufacturer||"-"}</Text>
  </View>
  <Text style={s.price}>{price(item.price)}</Text>
 </Pressable>;

 return <SafeAreaView style={s.safe}>
  <StatusBar barStyle="dark-content"/>
  <View style={s.container}>
   <Text style={s.title}>دليل الأدوية المصرية</Text>
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
     {selected&&<View style={s.detail}>
      <Text style={s.detailEn}>{selected.nameEn}</Text>
      <Text style={s.detailAr}>{selected.nameAr||"-"}</Text>
      <Info l="المادة الفعالة" v={selected.ingredient}/>
      <Info l="الشركة" v={selected.manufacturer}/>
      <Info l="التصنيف الدوائي" v={selected.drugClass}/>
      <Info l="الشكل الدوائي" v={route(selected.route)}/>
      <Info l="السعر" v={price(selected.price)}/>
     </View>}
    </View>
   </SafeAreaView>
  </Modal>
 </SafeAreaView>;
}

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
 price:{fontSize:14,fontWeight:"800",color:"#0B7468",marginLeft:10},
 center:{flex:1,alignItems:"center",justifyContent:"center",padding:30},
 ready:{fontSize:20,fontWeight:"800"},
 status:{marginTop:8,color:"#68736F",textAlign:"center"},
 err:{fontSize:18,fontWeight:"700",color:"#A33A32",marginBottom:8},
 retry:{marginTop:16,backgroundColor:"#0B7468",borderRadius:10,padding:11},
 retryText:{color:"#FFF"},
 bottom:{position:"absolute",left:0,right:0,bottom:0,backgroundColor:"#FFF",borderTopWidth:1,borderTopColor:"#E1E7E5",padding:8,alignItems:"center"},
 call:{color:"#0B7468",fontWeight:"700"},
 back:{color:"#0B7468",fontWeight:"700",paddingVertical:12},
 detail:{backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E7E5",borderRadius:10,padding:18},
 detailEn:{fontSize:24,fontWeight:"800",color:"#0B7468",textAlign:"right"},
 detailAr:{fontSize:17,color:"#586460",marginTop:5,marginBottom:12,textAlign:"right"},
 info:{borderTopWidth:1,borderTopColor:"#E7ECEB",paddingVertical:12,flexDirection:"row-reverse"},
 label:{width:"36%",color:"#7A8582",textAlign:"right"},
 value:{width:"64%",color:"#172321",textAlign:"right"}
});
