import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Modal, Pressable, SafeAreaView,
  StatusBar, StyleSheet, Text, TextInput, View
} from "react-native";
import { supabase } from "./src/lib/supabase";

const PAGE_SIZE = 40;

export default function App() {
  const [search, setSearch] = useState("");
  const [drugs, setDrugs] = useState([]);
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDrugs(term = "") {
    setLoading(true);
    setError("");

    let query = supabase
      .from("drugs")
      .select("id,commercial_name_en,commercial_name_ar,scientific_name,manufacturer,drug_class,route,price_egp")
      .order("id", { ascending: true })
      .range(0, PAGE_SIZE - 1);

    if (term.trim()) {
      const p = "%" + term.trim() + "%";
      query = query.or(
        "commercial_name_en.ilike." + p +
        ",commercial_name_ar.ilike." + p +
        ",scientific_name.ilike." + p
      );
    }

    const { data, error: queryError } = await query;
    if (queryError) {
      setError(queryError.message);
      setDrugs([]);
    } else {
      setDrugs(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadDrugs();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadDrugs(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  function renderDrug({ item }) {
    return (
      <Pressable style={styles.card} onPress={() => setSelectedDrug(item)}>
        <View style={styles.cardMain}>
          <Text style={styles.nameEn}>{item.commercial_name_en || "-"}</Text>
          <Text style={styles.nameAr}>{item.commercial_name_ar || "No Arabic name"}</Text>
          <Text style={styles.scientific}>
            {item.scientific_name || "Active ingredient not available"}
          </Text>
        </View>
        <View style={styles.priceBox}>
          <Text style={styles.price}>
            {item.price_egp == null ? "-" : item.price_egp + " EGP"}
          </Text>
          <Text style={styles.route}>{item.route || ""}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <Text style={styles.title}>Egydrugs</Text>
        <Text style={styles.subtitle}>Egyptian Drug Database</Text>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by drug name or active ingredient"
          placeholderTextColor="#8A9694"
          style={styles.search}
          autoCorrect={false}
        />

        {loading && drugs.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text style={styles.status}>Loading drugs...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>Could not load the database</Text>
            <Text style={styles.error}>{error}</Text>
            <Pressable style={styles.retry} onPress={() => loadDrugs(search)}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={drugs}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderDrug}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.status}>No drugs found.</Text>
              </View>
            }
          />
        )}
      </View>

      <Modal
        visible={Boolean(selectedDrug)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDrug(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Pressable style={styles.close} onPress={() => setSelectedDrug(null)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>

            {selectedDrug && (
              <>
                <Text style={styles.modalTitle}>{selectedDrug.commercial_name_en}</Text>
                <Text style={styles.modalArabic}>{selectedDrug.commercial_name_ar || "-"}</Text>
                <Info label="Active ingredient" value={selectedDrug.scientific_name} />
                <Info label="Company" value={selectedDrug.manufacturer} />
                <Info label="Drug class" value={selectedDrug.drug_class} />
                <Info label="Dosage form" value={selectedDrug.route} />
                <Info
                  label="Price"
                  value={selectedDrug.price_egp == null ? "-" : selectedDrug.price_egp + " EGP"}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Info({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "-"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F8F7" },
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 18 },
  title: { fontSize: 30, fontWeight: "800", color: "#0B7468" },
  subtitle: { marginTop: 2, marginBottom: 16, color: "#65716F", fontSize: 14 },
  search: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D7E1DF",
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, marginBottom: 12
  },
  list: { paddingBottom: 24 },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 16, padding: 15, marginBottom: 10,
    flexDirection: "row", justifyContent: "space-between",
    borderWidth: 1, borderColor: "#E2E9E7"
  },
  cardMain: { flex: 1, paddingRight: 10 },
  nameEn: { fontSize: 17, fontWeight: "700", color: "#172321" },
  nameAr: { marginTop: 4, fontSize: 15, color: "#43504D" },
  scientific: { marginTop: 6, fontSize: 13, color: "#77827F" },
  priceBox: { alignItems: "flex-end", justifyContent: "center" },
  price: { fontSize: 14, fontWeight: "700", color: "#0B7468" },
  route: { marginTop: 5, fontSize: 11, color: "#7A8582" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  status: { marginTop: 12, color: "#68736F" },
  errorTitle: { fontSize: 18, fontWeight: "700", color: "#A33A32", textAlign: "center" },
  error: { marginTop: 8, color: "#68736F", textAlign: "center" },
  retry: { marginTop: 16, backgroundColor: "#0B7468", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11 },
  retryText: { color: "#FFFFFF", fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modal: {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 22, paddingBottom: 36, minHeight: "55%"
  },
  close: { alignSelf: "flex-end", padding: 6 },
  closeText: { color: "#0B7468", fontWeight: "700" },
  modalTitle: { fontSize: 24, fontWeight: "800", color: "#172321", marginTop: 8 },
  modalArabic: { fontSize: 17, color: "#4C5956", marginTop: 4, marginBottom: 16 },
  infoRow: { borderTopWidth: 1, borderTopColor: "#E7ECEB", paddingVertical: 12 },
  infoLabel: { fontSize: 12, color: "#7A8582", marginBottom: 4 },
  infoValue: { fontSize: 16, color: "#172321" }
});
