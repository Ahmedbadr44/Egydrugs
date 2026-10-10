import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";

export default function CosmeticsGuide() {
  const [categories, setCategories] = useState([]);
  const [current, setCurrent] = useState(null);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCategories() {
    setLoading(true); setError("");
    const { data, error: e } = await supabase.from("cosmetics_categories").select("id,parent_id,name_en,name_ar,sort_order").order("sort_order");
    if (e) setError("تعذر تحميل أقسام مستحضرات التجميل: " + e.message);
    else setCategories(data || []);
    setLoading(false);
  }
  async function loadProducts(category) {
    setCurrent(category); setProducts([]); setQuery(""); setLoading(true); setError("");
    const { data, error: e } = await supabase.from("cosmetics_products").select("id,name_en,name_ar,brand,description,image_url,price_egp,old_price_egp,category_id,skin_type").eq("category_id", category.id).eq("is_active", true).order("name_en");
    if (e) setError("تعذر تحميل المنتجات: " + e.message);
    else setProducts(data || []);
    setLoading(false);
  }
  useEffect(() => { loadCategories(); }, []);
  const children = categories.filter(c => c.parent_id === (current ? current.id : null));
  const visibleProducts = products.filter(p => [p.name_en,p.name_ar,p.brand].join(" ").toLowerCase().includes(query.toLowerCase()));
  const goBack = () => {
    if (!current) return;
    const parent = categories.find(c => c.id === current.parent_id);
    if (!parent) { setCurrent(null); setProducts([]); return; }
    setCurrent(parent); setProducts([]); setQuery("");
  };
  return <View style={cs.wrap}>
    <View style={cs.heading}>
      {current ? <Pressable onPress={goBack} style={cs.back}><Text style={cs.backText}>‹ رجوع</Text></Pressable> : null}
      <Text style={cs.title}>{current ? current.name_en : "دليل مستحضرات التجميل"}</Text>
      {current ? <Text style={cs.subtitle}>{current.name_ar}</Text> : <Text style={cs.subtitle}>اختار القسم للمتابعة</Text>}
    </View>
    {loading ? <View style={cs.center}><ActivityIndicator color="#00695C"/><Text style={cs.hint}>جاري التحميل...</Text></View> :
      error ? <Text style={cs.error}>{error}</Text> :
      children.length > 0 ? <ScrollView contentContainerStyle={cs.list}>
        {children.map(c => <Pressable key={c.id} style={cs.category} onPress={() => {
          const nested = categories.some(x => x.parent_id === c.id);
          if (nested) { setCurrent(c); setProducts([]); setQuery(""); }
          else loadProducts(c);
        }}>
          <View style={cs.categoryText}><Text style={cs.categoryEn}>{c.name_en}</Text><Text style={cs.categoryAr}>{c.name_ar}</Text></View>
          <Text style={cs.chevron}>‹</Text>
        </Pressable>)}
      </ScrollView> :
      <View style={{flex:1}}>
        <TextInput value={query} onChangeText={setQuery} placeholder="ابحث عن منتج أو ماركة" placeholderTextColor="#77817E" style={cs.search}/>
        <FlatList data={visibleProducts} keyExtractor={x => String(x.id)} contentContainerStyle={cs.list}
          ListEmptyComponent={<Text style={cs.hint}>لا توجد منتجات مضافة في هذا القسم حتى الآن.</Text>}
          renderItem={({item}) => <View style={cs.product}>
            <Text style={cs.productEn}>{item.name_en || item.name_ar || "منتج"}</Text>
            {item.name_ar ? <Text style={cs.productAr}>{item.name_ar}</Text> : null}
            {item.brand ? <Text style={cs.brand}>{item.brand}</Text> : null}
            {item.description ? <Text style={cs.description}>{item.description}</Text> : null}
            {item.price_egp != null ? <Text style={cs.price}>{Number(item.price_egp).toLocaleString("en-US")} ج.م</Text> : null}
          </View>} />
      </View>}
  </View>;
}
const cs = StyleSheet.create({
 wrap:{flex:1,backgroundColor:"#F7F5ED",paddingHorizontal:14,paddingTop:8},
 heading:{paddingVertical:10,alignItems:"flex-end"},
 back:{alignSelf:"flex-start",paddingVertical:5,paddingHorizontal:8},
 backText:{fontSize:16,color:"#00695C",fontWeight:"700"},
 title:{fontSize:22,fontWeight:"800",color:"#06463F",textAlign:"right"},
 subtitle:{fontSize:14,color:"#65736E",marginTop:3,textAlign:"right"},
 list:{paddingVertical:8,paddingBottom:24},
 category:{backgroundColor:"#FFFDF8",borderWidth:1,borderColor:"#DCE7DF",borderRadius:10,padding:14,marginBottom:9,flexDirection:"row-reverse",alignItems:"center"},
 categoryText:{flex:1,alignItems:"flex-end"},
 categoryEn:{fontSize:17,fontWeight:"800",color:"#06463F",textAlign:"right"},
 categoryAr:{fontSize:13,color:"#65736E",marginTop:3,textAlign:"right"},
 chevron:{fontSize:26,color:"#16806A",paddingLeft:8},
 center:{flex:1,alignItems:"center",justifyContent:"center",gap:8},
 hint:{textAlign:"center",color:"#65736E",padding:18,fontSize:15},
 error:{color:"#B42318",padding:12,textAlign:"right"},
 search:{backgroundColor:"#FFF",borderWidth:1,borderColor:"#DCE7DF",borderRadius:10,padding:12,fontSize:16,textAlign:"right",marginVertical:8,color:"#22302D"},
 product:{backgroundColor:"#FFFDF8",borderWidth:1,borderColor:"#ECE8DA",borderRadius:10,padding:13,marginBottom:9},
 productEn:{fontSize:17,fontWeight:"800",color:"#06463F",textAlign:"right"},
 productAr:{fontSize:15,color:"#263A35",textAlign:"right",marginTop:3},
 brand:{fontSize:13,color:"#65736E",textAlign:"right",marginTop:5},
 description:{fontSize:13,color:"#65736E",textAlign:"right",marginTop:5},
 price:{fontSize:16,fontWeight:"800",color:"#00695C",textAlign:"right",marginTop:8}
});
