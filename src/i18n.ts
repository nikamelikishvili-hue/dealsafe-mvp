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
const applyDocumentLanguage=(language:AppLanguage)=>{document.documentElement.lang=language;document.documentElement.dir=language==='ar'||language==='he'?'rtl':'ltr'};
applyDocumentLanguage(activeLanguage);

export function getAppLanguage(){return activeLanguage}
export function setAppLanguage(language:AppLanguage){activeLanguage=language;localStorage.setItem(languageKey,language);applyDocumentLanguage(language)}
export function t(text:string){return dictionaries[activeLanguage]?.[text]||text}
