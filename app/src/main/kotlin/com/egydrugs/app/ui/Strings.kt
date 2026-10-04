package com.egydrugs.app.ui

/** All user-facing text (the app is Arabic only). */
object Str {
    const val APP_NAME = "دليل الأدوية المصرية"
    const val CONTACT_PHONE = "01030950177"
    const val CONTACT_LABEL = "للتواصل و الاعلان اتصل بنا"
    const val SEARCH_HINT = "ابحث باسم البراند"
    const val SEARCH_READY = "ابحث عن دواء"
    const val SEARCH_READY_HINT = "اكتب اسم البراند بالعربي أو الإنجليزي"
    const val CLEAR = "مسح"
    const val BACK = "رجوع"
    const val LOADING = "جاري تحميل قاعدة الأدوية…"
    const val LOAD_ERROR = "تعذّر تحميل قاعدة البيانات"

    const val SCOPE_BRAND = "البراند"
    const val SCOPE_INGREDIENT = "المادة الفعالة"

    const val NO_RESULTS = "مفيش نتايج. جرّب جزء أقل من الاسم، أو حط مسافة مكان الحرف الناقص، أو جرّب كتابة قريبة."
    const val TOO_SHORT = "اكتب حرفين على الأقل."
    const val RESULTS_CAPPED = "بنعرض أول 200 نتيجة، حدّد البحث أكتر لو مش لاقي اللي عاوزه."

    const val DETAILS = "تفاصيل الدواء"
    const val SCIENTIFIC = "المادة الفعالة"
    const val NO_SCIENTIFIC = "غير مسجلة في القاعدة"
    const val MANUFACTURER = "الشركة"
    const val DRUG_CLASS = "التصنيف الدوائي"
    const val FORM = "الشكل الدوائي"
    const val PRICE = "السعر"
    const val DOSAGE = "الجرعة"
    const val DOSAGE_FUTURE = "سيتم إضافة بيانات الجرعات لاحقًا"
    const val CURRENCY = "ج.م"
    const val NO_PRICE = "غير متوفر"
    const val DISCLAIMER =
        "المعلومات للاسترشاد فقط، والأسعار بتتغير. راجع الصيدلي أو الطبيب قبل أي استبدال للدواء."

    const val FILTER_ROUTE = "نفس الشكل الدوائي"
    const val FILTER_STRENGTH = "نفس التركيز"
    const val EQUIVALENTS = "المثائل"
    const val EQUIVALENTS_HINT = "نفس المادة الفعالة، الأغلى أولاً"
    const val NO_EQUIVALENTS = "مفيش مثائل بالفلاتر الحالية. جرّب تلغي فلتر الشكل أو التركيز."
    const val NO_EQUIVALENTS_UNKNOWN = "المادة الفعالة غير مسجلة لهذا الدواء، فمش قادرين نجيب مثائل."

    /** Arabic label for the `route` column. Unknown values are shown as they are. */
    fun routeLabel(route: String): String = when (route.uppercase()) {
        "ORAL.SOLID" -> "أقراص / كبسولات"
        "ORAL.LIQUID" -> "شراب / سائل للشرب"
        "INJECTION" -> "حقن"
        "TOPICAL" -> "موضعي (كريم / مرهم / جل)"
        "UNKNOWN", "" -> "غير محدد"
        "EFF" -> "فوار"
        "SPRAY" -> "بخاخ"
        "EYE" -> "للعين"
        "VAGINAL" -> "مهبلي"
        "MOUTH" -> "للفم (موضعي)"
        "RECTAL" -> "شرجي / لبوس"
        "SOAP" -> "صابون"
        "EAR" -> "للأذن"
        else -> route
    }
}
