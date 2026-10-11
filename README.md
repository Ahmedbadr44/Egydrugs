# دليل الأدوية المصرية (Android)

## قاعدة بيانات الأدوية المرفقة بالتطبيق

يحتوي إصدار React Native على قاعدة SQLite مبدئية مرفقة داخل حزمة التطبيق (`assets/egymeds-seed.db`) تضم جميع سجلات الأدوية المتاحة وقت بناء الإصدار. لذلك تظهر الأدوية من أول تشغيل دون الحاجة إلى تنزيل قاعدة البيانات كاملة أو وجود اتصال بالإنترنت. عند توفر الإنترنت، يحاول التطبيق مزامنة التغييرات مع Supabase مع الاحتفاظ بالبيانات المحلية عند فشل الاتصال.

لإنشاء نسخة محلية محدثة من قاعدة Supabase قبل إصدار جديد، نفّذ `npm run build:seed-db` ثم أعد بناء التطبيق. يقوم GitHub Actions أيضًا بتوليد الملف والتحقق من سلامة SQLite وتحديثه في فرع `react-native` عند تغيّر سكربت البناء أو إعداد Supabase أو واجهة التطبيق.



تطبيق أندرويد للبحث عن الأدوية المصرية ومعرفة **المثائل** (نفس المادة الفعالة). يعمل بالبيانات المحلية أوفلاين، ويزامن آخر تحديثات قاعدة Supabase عند توفر الإنترنت. الواجهة بالعربي (RTL). البدائل متوقفة مؤقتًا لحين مراجعة التصنيفات. التطبيق للبحث فقط ولا يحتوي على إدارة بيانات أو تسجيل دخول للمشرفين.

الداتا الأساسية: [karem505/egyptian-drug-database](https://github.com/karem505/egyptian-drug-database) (ترخيص CC0)، حوالي 25 ألف دواء. الملف المحلي `app/src/main/assets/egyptian-drugs.csv` نسخة احتياطية؛ قاعدة Supabase المشتركة هي مصدر التحديثات بعد إعدادها.

## تشغيل المشروع

1. افتح مجلد المشروع في **Android Studio** (Ladybug أو أحدث) واستنى الـ Gradle Sync.
2. شغّل التطبيق على موبايل أو محاكي (minSdk 23 = أندرويد 6.0).
3. لو عاوز ملف APK/AAB للنشر: `Build > Generate Signed Bundle / APK`.

ملاحظة: مفيش `gradlew` في المجلد. Android Studio بينزّل Gradle 8.9 لوحده من ملف `gradle/wrapper/gradle-wrapper.properties`. ولو عاوز تشتغل من الـ terminal، نفّذ مرة واحدة `gradle wrapper`.

## طرق البحث

الكتابة في خانة واحدة، وفي أربع اختيارات: **الكل / عربي / إنجليزي / المادة الفعالة**.

| الحالة | مثال |
|---|---|
| بالاسم العربي | `بانادول` |
| بالاسم الإنجليزي | `panadol` |
| بالمادة الفعالة (عربي أو إنجليزي) | `باراسيتامول` أو `paracetamol` |
| حروف ناقصة: المسافة مكان الحرف الناقص | `par cetamol`، `pa ado`، `بارا سيت مول` |
| أول الاسم ناقص: ابدأ بمسافة | ` amol` |
| أكتر من كلمة | `amox clav` |
| حروف متشابهة في النطق | `agmentin` = Augmentin، `زيترومكس` = Zithromax، `ibuprofin` = ibuprofen |

### إزاي بيشتغل

كل نص (من الداتا ومن اللي المستخدم كتبه) بيتحوّل لثلاث صيغ، ويتطابق من الأدق للأوسع، والأدق بيظهر الأول:

1. **حرفي**: بدون تشكيل، وتوحيد (أ إ آ ← ا)، (ى ← ي)، (ة ← ه)، وأحرف إنجليزي صغيرة.
2. **صوتي** (`Phonetics.key`): صيغة واحدة للعربي والإنجليزي، بتدمج الحروف المتشابهة: p/ب، v/ف، ph/f، c/k/q/ك/ق، z/s/th/ز/س/ص/ث/ذ/ظ، ch/sh/ش، g/j/ج، w/و، y/ي، وبتتجاهل التكرار. يعني `PANADOL` و`بانادول` بيطلعوا بنفس المفتاح.
3. **هيكل الحروف الساكنة** (`Phonetics.skeleton`): نفس الصوتي بدون حروف العلة، فبيتحمّل اختلاف كتابة الحروف المتحركة (`bnadol` / `panadol` / `بنادول`).
4. **تقريبي** (Levenshtein): بيشتغل بس لما النتايج قليلة، ويسمح بغلطة أو اتنين في الحروف.

المسافة في البحث معناها "حرف أو أكتر ناقص". كل جزء لازم يظهر بالترتيب، وإما يبدأ كلمة جديدة أو ييجي بعد 4 حروف ناقصة على الأكتر جوه نفس الكلمة.

## المثائل والبدائل

* **المثائل**: نفس المادة الفعالة (أو نفس التركيبة لو الدوا فيه أكتر من مادة). بنتجاهل الأسماء بين الأقواس (`PARACETAMOL(ACETAMINOPHEN)` = `PARACETAMOL`) وملح الدوا (`DICLOFENAC SODIUM` = `DICLOFENAC POTASSIUM`) وترتيب المواد. الترتيب من الأغلى للأرخص. فلتر **نفس الشكل الدوائي** و**نفس التركيز** (متاخد من اسم الدوا، و`1 GM` = `1000 MG`).
* **البدائل** متوقفة مؤقتًا إلى أن تُراجع التصنيفات الدوائية.

## هيكل الكود

```
app/src/main/kotlin/com/egydrugs/app/
  core/   منطق نقي بدون Android (قابل للاختبار): CsvParser, Phonetics, Ingredients, Strength,
          SearchEngine, DrugIndex (المثائل والبدائل)
  data/   DrugRepository: قراءة ملف الـ CSV من الـ assets
  ui/     MainViewModel, SearchScreen, DetailScreen, Theme, Strings (كل النصوص العربية)
app/src/test/   اختبارات JUnit بتتشغل على الداتا الحقيقية: ./gradlew test
```

## حدود لازم تعرفها

* **الاسم العربي في الداتا ترجمة صوتية** للاسم الإنجليزي (مش الاسم العربي الرسمي المسجل)، حسب وصف صاحب الداتا. البحث بيشتغل كويس بيها، لكن لو عاوز أسماء رسمية لازم تتراجع على هيئة الدواء المصرية.
* حوالي **2,300 دواء** (9%) مفيهمش مادة فعالة، فمفيش لهم مثائل. وحوالي **430** مفيهمش تصنيف مفيد، فمفيش لهم بدائل.
* التصنيفات في الداتا حوالي 2,500 قيمة وبعضها واسع جداً (زي `SKIN CARE`) أو دقيق جداً (زي `MILD ANALGESIC` فيه 3 مواد بس). البدائل جودتها بتعتمد على جودة التصنيف.
* **المثائل للاسترشاد فقط**. التطبيق بيعرض تنبيه في شاشة التفاصيل، ولازم يفضل موجود لو هتنشره على Google Play. الأسعار والتوافر بيتغيروا، وأي استبدال لازم يتم بمعرفة صيدلي أو طبيب.
* وقت تحميل القاعدة أول ما التطبيق يفتح (حوالي ثانية على جهاز عادي، وممكن أكتر على الأجهزة الضعيفة) بيظهر فيه مؤشر تحميل.

## لو هتنشره على Google Play

* غيّر `applicationId` في `app/build.gradle.kts` (حالياً `com.egydrugs.app`).
* التطبيق يحتاج صلاحية الإنترنت لمزامنة الأدوية. بيانات Supabase المتاحة للتطبيق للقراءة فقط.
* تطبيقات الأدوية بتتصنّف "صحة"؛ راجع متطلبات سياسة الخصوصية وإقرار التطبيقات الصحية قبل النشر.

## تحديث الداتا

لإضافة الأدوية أو تعديلها أو حذفها، استخدم لوحة المتصفح المستقلة في [admin](admin/README.md). لن يظهر أي خيار إدارة داخل التطبيق، والتغيير يصل للأجهزة المفتوحة خلال دقيقة تقريبًا. التعليمات الكاملة في [supabase/SETUP.md](supabase/SETUP.md). ملف CSV يدعم عمود `dosage` الاختياري.


## React Native: bundled offline database

Before starting Expo or creating a store build, generate the bundled SQLite asset from the current Supabase data:

```powershell
npm install
npm run build:seed-db
npx expo start -c
```

The build script reads the app's Supabase URL and publishable key from `src/lib/supabase.js`, downloads the `public.drugs` table in pages, verifies the downloaded row count and SQLite integrity, and writes `assets/egymeds-seed.db`. It does not use a service-role key.

The app opens that bundled asset into its local SQLite database on first launch. It then reads from the local database immediately and synchronizes additions and updates from Supabase; a full reconciliation runs weekly to detect deletions. If you build in the cloud (for example, using EAS Build), commit and push the generated `assets/egymeds-seed.db` so the cloud build can include it.
