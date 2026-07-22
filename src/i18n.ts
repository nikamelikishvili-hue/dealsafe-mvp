import { localePacks } from './localePacks';
import { extraLocalePacks } from './extraLocalePacks';

export const supportedLanguages=[
  {code:'en',name:'English'},
  {code:'ka',name:'ქართული'},
  {code:'de',name:'Deutsch'},
  {code:'es',name:'Español'},
  {code:'fr',name:'Français'},
  {code:'pt',name:'Português'},
  {code:'it',name:'Italiano'},
  {code:'ru',name:'Русский'},
  {code:'tr',name:'Türkçe'},
  {code:'el',name:'Ελληνικά'},
  {code:'zh',name:'简体中文'},
  {code:'ja',name:'日本語'},
  {code:'ko',name:'한국어'},
  {code:'ar',name:'العربية'},
  {code:'he',name:'עברית'},
  {code:'hi',name:'हिन्दी'}
] as const;

export type AppLanguage=typeof supportedLanguages[number]['code'];

const languageKey='dealsafe_language';
const languageCodes=new Set<string>(supportedLanguages.map(language=>language.code));
const resolveLanguage=(value:string|null):AppLanguage=>{const normalized=(value||'').toLowerCase();const exact=supportedLanguages.find(language=>language.code===normalized);if(exact)return exact.code;const base=normalized.split('-')[0];return languageCodes.has(base)?base as AppLanguage:'en'};
const storedLanguage=localStorage.getItem(languageKey);
let activeLanguage:AppLanguage=storedLanguage&&languageCodes.has(storedLanguage)?storedLanguage as AppLanguage:resolveLanguage(navigator.languages?.[0]||navigator.language);

const ka:Record<string,string>={
  'Database connected':'მონაცემთა ბაზა დაკავშირებულია','Private beta':'დახურული ბეტა','Sign in':'შესვლა','Sign out':'გასვლა',
  'Dashboard':'მთავარი გვერდი','Activity':'აქტივობა','New deal':'ახალი გარიგება','Create a Deal Link':'გარიგების ბმულის შექმნა',
  'A clearer way to make a private sale':'კერძო გაყიდვის უფრო ნათელი გზა','Put the deal in writing.':'დააფიქსირე გარიგება წერილობით.','Share it with confidence.':'გააზიარე თავდაჯერებულად.',
  'Create a single link with the item, price, parties, and agreed terms—before money or goods change hands.':'შექმენი ერთი ბმული ნივთით, ფასით, მხარეებითა და შეთანხმებული პირობებით — სანამ თანხა ან ნივთი გადაიცემა.',
  'DealSafe does not hold your money in this beta.':'ამ ბეტა ვერსიაში DealSafe თანხას არ ინახავს.','One link. The facts that matter.':'ერთი ბმული. ყველა მნიშვნელოვანი ფაქტი.',
  'Shared terms':'გაზიარებული პირობები','Price, condition, handoff, and disclosures stay together.':'ფასი, მდგომარეობა, გადაცემა და აღწერა ერთ სივრცეში რჩება.',
  'Clear verification':'ნათელი ვერიფიკაცია','See exactly which contact or identity checks are complete.':'ზუსტად ნახე, კონტაქტისა და ვინაობის რომელი შემოწმებაა დასრულებული.',
  'Recorded consent':'დაფიქსირებული თანხმობა','Both parties accept the same version of the agreement.':'ორივე მხარე შეთანხმების ერთსა და იმავე ვერსიას ადასტურებს.',
  'Your workspace':'შენი სამუშაო სივრცე','Recent deals':'ბოლო გარიგებები','Deal dashboard':'გარიგებების მართვა','Track every sale from published link to completed handoff.':'მართე ყველა გაყიდვა ბმულის გამოქვეყნებიდან ნივთის გადაცემამდე.',
  'All deals':'ყველა გარიგება','Active':'აქტიური','Completed':'დასრულებული','Total value':'სრული ღირებულება','Search by item or Deal ID':'მოძებნე ნივთით ან გარიგების ID-ით','No matching deals':'გარიგება ვერ მოიძებნა',
  'Try another search or filter, or create a new Deal Link.':'სცადე სხვა ძიება ან შექმენი ახალი გარიგების ბმული.','Create deal':'გარიგების შექმნა','Selling':'ყიდი','Buying':'ყიდულობ',
  'DealSafe account':'DealSafe ანგარიში','Create your account':'ანგარიშის შექმნა','Welcome back':'კეთილი იყოს დაბრუნება','Your name':'შენი სახელი','Email':'ელფოსტა','Password':'პაროლი','Create account':'ანგარიშის შექმნა',
  'Already have an account? Sign in':'უკვე გაქვს ანგარიში? შედი','New to DealSafe? Create account':'ახალი ხარ DealSafe-ში? შექმენი ანგარიში','Forgot password?':'დაგავიწყდა პაროლი?','Back':'უკან',
  'New Deal Link':'ახალი გარიგების ბმული','Describe what you’re selling':'აღწერე რას ყიდი','You can review every detail before the link is published.':'ბმულის გამოქვეყნებამდე ყველა დეტალს გადაამოწმებ.',
  'Item title':'ნივთის დასახელება','Price (USD)':'ფასი (USD)','Condition':'მდგომარეობა','Known condition and defects':'მდგომარეობა და ცნობილი დეფექტები','Serial or IMEI (optional)':'სერიული ნომერი ან IMEI (არასავალდებულო)','Handoff':'გადაცემის მეთოდი','Publish Deal Link':'გარიგების ბმულის გამოქვეყნება',
  'Item photos or video':'ნივთის ფოტოები ან ვიდეო','Choose photos together or add them one at a time':'აირჩიე ფოტოები ერთად ან დაამატე სათითაოდ','selected':'არჩეულია','Item details':'ნივთის დეტალები','Serial':'სერიული ნომერი','Not provided':'არ არის მითითებული',
  'Seller contact':'გამყიდველის კონტაქტი','Deal agreement':'გარიგების შეთანხმება','The buyer agrees to the stated price, condition disclosures, and handoff method.':'მყიდველი ეთანხმება მითითებულ ფასს, მდგომარეობას და გადაცემის მეთოდს.',
  'Item and defects reviewed':'ნივთი და დეფექტები გადამოწმებულია','Price confirmed':'ფასი დადასტურებულია','Handoff terms confirmed':'გადაცემის პირობები დადასტურებულია','Your full name':'შენი სრული სახელი','Buyer name':'მყიდველის სახელი','Accept these terms':'პირობების მიღება','Terms accepted':'პირობები მიღებულია','verification pending':'ვერიფიკაცია მოლოდინშია',
  'Copy Deal Link':'გარიგების ბმულის კოპირება','Ratings unlock after completion':'შეფასება გაიხსნება დასრულების შემდეგ','One rating per party, tied to this deal.':'თითო შეფასება თითოეული მხარისგან, ამ გარიგებაზე მიბმული.',
  'Agreement copy':'შეთანხმების ასლი','Save or share this record':'შეინახე ან გააზიარე ჩანაწერი','Use your browser’s print screen to save a PDF copy. The live Deal Link remains the current record.':'PDF ასლის შესანახად გამოიყენე ბეჭდვის ფუნქცია. ცოცხალი Deal Link კვლავ მთავარ ჩანაწერად რჩება.','Print / Save PDF':'PDF-ის ბეჭდვა / შენახვა','Share':'გაზიარება',
  'Show QR Code':'QR კოდის ჩვენება','Hide QR Code':'QR კოდის დამალვა','Scan to open this Deal Link on another phone.':'დაასკანერე ამ გარიგების სხვა ტელეფონში გასახსნელად.','Download QR':'QR-ის ჩამოტვირთვა','Preparing QR Code…':'QR კოდი მზადდება…',
  'Trust profile':'ნდობის პროფილი','Average rating':'საშუალო შეფასება','received':'მიღებული','Completed deals':'დასრულებული გარიგებები','Successful handoffs':'წარმატებული გადაცემები','Verification':'ვერიფიკაცია','Identity verification comes next':'შემდეგი ეტაპია ვინაობის ვერიფიკაცია','Reputation history':'რეპუტაციის ისტორია','Member since':'წევრია','No ratings yet':'შეფასებები ჯერ არ არის','Ratings received after completed deals will appear here.':'დასრულებული გარიგებების შეფასებები აქ გამოჩნდება.',
  'Account protection':'ანგარიშის დაცვა','Verification & Security Center':'ვერიფიკაციისა და უსაფრთხოების ცენტრი','Email account active':'ელფოსტა აქტიურია','Identity verification':'ვინაობის ვერიფიკაცია','Request verification':'ვერიფიკაციის მოთხოვნა','Secure handoff enabled':'უსაფრთხო გადაცემა ჩართულია',
  'Account settings':'ანგარიშის პარამეტრები','Manage your account':'ანგარიშის მართვა','Public display name':'საჯარო სახელი','This name appears on your profile and Deal Links.':'ეს სახელი გამოჩნდება პროფილსა და გარიგების ბმულებზე.','Save name':'სახელის შენახვა','Change password':'პაროლის შეცვლა','Use at least 8 characters and keep it private.':'გამოიყენე მინიმუმ 8 სიმბოლო და არავის გაუზიარო.','New password':'ახალი პაროლი','Confirm password':'გაიმეორე პაროლი','Update password':'პაროლის განახლება',
  'all':'ყველა','published':'გამოქვეყნებული','accepted':'მიღებული','completed':'დასრულებული','cancelled':'გაუქმებული','disputed':'გასაჩივრებული','not started':'არ დაწყებულა','pending':'მოლოდინშია','verified':'ვერიფიცირებული','failed':'ვერ შესრულდა',
  'Meet in person':'პირადად შეხვედრა','Ship to buyer':'მყიდველთან გაგზავნა','Like new':'თითქმის ახალი','Good':'კარგი','Fair':'დამაკმაყოფილებელი'
  ,'Creating your Deal Link…':'თქვენი გარიგების ბმული იქმნება…','Item video':'ნივთის ვიდეო','Main photo':'მთავარი ფოტო','Photo':'ფოტო',
  'Seller contact verified':'გამყიდველის კონტაქტი დადასტურებულია','Review agreement':'შეთანხმების ნახვა','At least 8 characters':'მინიმუმ 8 სიმბოლო',
  'Be specific about wear, repairs, locks, and included accessories.':'ზუსტად მიუთითე ცვეთა, შეკეთება, ბლოკირება და თანდართული აქსესუარები.','Stored privately; only last characters shown':'ინახება კონფიდენციალურად; გამოჩნდება მხოლოდ ბოლო სიმბოლოები',
  'Next in production:':'შემდეგი საწარმოო ეტაპი:','Add photos, verify contact, then preview the agreement. This prototype publishes immediately.':'დაამატე ფოტოები, დაადასტურე კონტაქტი და გადახედე შეთანხმებას. ეს პროტოტიპი ბმულს დაუყოვნებლივ აქვეყნებს.',
  'Version':'ვერსია','Buyer':'მყიდველი','Typing your name records consent for this prototype. Production language requires legal review.':'სახელის შეყვანა ამ პროტოტიპში თანხმობას აფიქსირებს. საბოლოო სამართლებრივი ტექსტი იურისტმა უნდა შეამოწმოს.',
  'No written comment.':'წერილობითი კომენტარი არ არის.','Facts, consent, and a clearer handoff.':'ფაქტები, თანხმობა და უფრო ნათელი გადაცემა.'
};

const dictionaries:Record<string,Record<string,string>>=Object.fromEntries(Object.entries(localePacks).map(([code,pack])=>[code,{...pack,...extraLocalePacks[code]}]));
dictionaries.ka={...ka,...extraLocalePacks.ka};
const financeLabels:Record<string,Record<string,string>>={
  en:{Price:'Price',Currency:'Currency'},ka:{Price:'ფასი',Currency:'ვალუტა'},de:{Price:'Preis',Currency:'Währung'},es:{Price:'Precio',Currency:'Moneda'},fr:{Price:'Prix',Currency:'Devise'},pt:{Price:'Preço',Currency:'Moeda'},it:{Price:'Prezzo',Currency:'Valuta'},ru:{Price:'Цена',Currency:'Валюта'},tr:{Price:'Fiyat',Currency:'Para birimi'},el:{Price:'Τιμή',Currency:'Νόμισμα'},zh:{Price:'价格',Currency:'货币'},ja:{Price:'価格',Currency:'通貨'},ko:{Price:'가격',Currency:'통화'},ar:{Price:'السعر',Currency:'العملة'},he:{Price:'מחיר',Currency:'מטבע'},hi:{Price:'कीमत',Currency:'मुद्रा'}
};
Object.entries(financeLabels).forEach(([code,labels])=>{dictionaries[code]={...dictionaries[code],...labels}});
const riskLabels:Record<string,Record<string,string>>={
  en:{'Deal safety check':'Deal safety check','Risk score':'Risk score','Low concern':'Low concern','Review recommended':'Review recommended','Caution':'Caution','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.'},
  ka:{'Deal safety check':'გარიგების უსაფრთხოების შემოწმება','Risk score':'რისკის ქულა','Low concern':'დაბალი რისკი','Review recommended':'რეკომენდებულია გადამოწმება','Caution':'სიფრთხილე','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'ეს ავტომატური შემოწმება იყენებს მხოლოდ DealSafe-ის ჩანაწერში არსებულ მონაცემებს. ის არ არის ბრალდება, გარანტია ან საბაზრო ფასის შეფასება.'},
  de:{'Deal safety check':'Sicherheitsprüfung des Deals','Risk score':'Risikowert','Low concern':'Geringe Bedenken','Review recommended':'Prüfung empfohlen','Caution':'Vorsicht','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'Diese automatische Prüfung verwendet nur die Angaben in diesem DealSafe-Eintrag. Sie ist keine Anschuldigung, Garantie oder Marktpreisprüfung.'},
  es:{'Deal safety check':'Comprobación de seguridad','Risk score':'Puntuación de riesgo','Low concern':'Riesgo bajo','Review recommended':'Revisión recomendada','Caution':'Precaución','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'Esta comprobación automática solo usa los datos de este registro de DealSafe. No es una acusación, garantía ni comprobación del precio de mercado.'},
  fr:{'Deal safety check':'Contrôle de sécurité','Risk score':'Score de risque','Low concern':'Risque faible','Review recommended':'Vérification recommandée','Caution':'Prudence','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'Ce contrôle automatique utilise uniquement les informations de cet enregistrement DealSafe. Il ne constitue ni une accusation, ni une garantie, ni une estimation du prix du marché.'},
  pt:{'Deal safety check':'Verificação de segurança','Risk score':'Pontuação de risco','Low concern':'Risco baixo','Review recommended':'Revisão recomendada','Caution':'Cuidado','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'Esta verificação automática utiliza apenas os dados deste registo DealSafe. Não é uma acusação, garantia ou verificação do preço de mercado.'},
  it:{'Deal safety check':'Controllo di sicurezza','Risk score':'Punteggio di rischio','Low concern':'Rischio basso','Review recommended':'Verifica consigliata','Caution':'Attenzione','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'Questo controllo automatico usa solo i dati presenti in questo record DealSafe. Non è un’accusa, una garanzia o una verifica del prezzo di mercato.'},
  ru:{'Deal safety check':'Проверка безопасности сделки','Risk score':'Оценка риска','Low concern':'Низкий риск','Review recommended':'Рекомендуется проверка','Caution':'Осторожно','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'Автоматическая проверка использует только данные этой записи DealSafe. Это не обвинение, не гарантия и не проверка рыночной цены.'},
  tr:{'Deal safety check':'Anlaşma güvenlik kontrolü','Risk score':'Risk puanı','Low concern':'Düşük risk','Review recommended':'İnceleme önerilir','Caution':'Dikkat','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'Bu otomatik kontrol yalnızca bu DealSafe kaydındaki bilgileri kullanır. Bir suçlama, garanti veya piyasa fiyatı kontrolü değildir.'},
  el:{'Deal safety check':'Έλεγχος ασφάλειας συμφωνίας','Risk score':'Βαθμολογία κινδύνου','Low concern':'Χαμηλός κίνδυνος','Review recommended':'Συνιστάται έλεγχος','Caution':'Προσοχή','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'Αυτός ο αυτόματος έλεγχος χρησιμοποιεί μόνο τα στοιχεία αυτής της εγγραφής DealSafe. Δεν αποτελεί κατηγορία, εγγύηση ή έλεγχο τιμής αγοράς.'},
  zh:{'Deal safety check':'交易安全检查','Risk score':'风险评分','Low concern':'低风险','Review recommended':'建议核查','Caution':'请谨慎','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'此自动检查仅使用该 DealSafe 记录中的信息，不构成指控、保证或市场价格评估。'},
  ja:{'Deal safety check':'取引の安全チェック','Risk score':'リスクスコア','Low concern':'低リスク','Review recommended':'確認を推奨','Caution':'注意','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'この自動チェックは、このDealSafe記録の情報のみを使用します。告発、保証、市場価格の確認ではありません。'},
  ko:{'Deal safety check':'거래 안전 확인','Risk score':'위험 점수','Low concern':'낮은 위험','Review recommended':'검토 권장','Caution':'주의','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'이 자동 확인은 해당 DealSafe 기록의 정보만 사용합니다. 사기 단정, 보증 또는 시세 확인이 아닙니다.'},
  ar:{'Deal safety check':'فحص سلامة الصفقة','Risk score':'درجة المخاطر','Low concern':'مخاطر منخفضة','Review recommended':'توصى بالمراجعة','Caution':'تنبيه','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'يستخدم هذا الفحص التلقائي تفاصيل سجل DealSafe هذا فقط. وهو ليس اتهامًا أو ضمانًا أو فحصًا لسعر السوق.'},
  he:{'Deal safety check':'בדיקת בטיחות העסקה','Risk score':'ציון סיכון','Low concern':'סיכון נמוך','Review recommended':'מומלץ לבדוק','Caution':'זהירות','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'הבדיקה האוטומטית משתמשת רק בפרטי רשומת DealSafe זו. היא אינה האשמה, הבטחה או בדיקת מחיר שוק.'},
  hi:{'Deal safety check':'डील सुरक्षा जाँच','Risk score':'जोखिम स्कोर','Low concern':'कम जोखिम','Review recommended':'समीक्षा की सलाह','Caution':'सावधानी','This automated check uses only the details in this DealSafe record. It is not an accusation, guarantee, or market-price check.':'यह स्वचालित जाँच केवल इस DealSafe रिकॉर्ड की जानकारी का उपयोग करती है। यह आरोप, गारंटी या बाज़ार मूल्य की जाँच नहीं है।'}
};
Object.entries(riskLabels).forEach(([code,labels])=>{dictionaries[code]={...dictionaries[code],...labels}});
const applyDocumentLanguage=(language:AppLanguage)=>{document.documentElement.lang=language;document.documentElement.dir=language==='ar'||language==='he'?'rtl':'ltr'};
applyDocumentLanguage(activeLanguage);

export function getAppLanguage(){return activeLanguage}
export function setAppLanguage(language:AppLanguage){activeLanguage=language;localStorage.setItem(languageKey,language);applyDocumentLanguage(language)}
export function t(text:string){return dictionaries[activeLanguage]?.[text]||text}
