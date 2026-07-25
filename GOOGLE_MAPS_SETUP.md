# Google მისამართების ავტომატური შევსება

Dealivra-ში შეხვედრის მისამართის ველი Google Places-ის შემოთავაზებებს აჩვენებს, როდესაც `VITE_GOOGLE_MAPS_API_KEY` არის დაყენებული. გასაღების გარეშე ველი ჩვეულებრივ ტექსტურ ველად რჩება.

## Google Cloud

1. გახსენი Google Cloud Console და აირჩიე ან შექმენი პროექტი.
2. პროექტზე ჩართე Billing.
3. `APIs & Services` → `Library` გვერდზე ჩართე:
   - Maps JavaScript API
   - Places API (New)
4. `APIs & Services` → `Credentials` გვერდზე შექმენი API key.
5. გასაღების `Application restrictions` ნაწილში აირჩიე `Websites` და დაამატე:
   - `https://dealsafe-mvp.vercel.app/*`
   - `http://localhost:5173/*`
6. `API restrictions` ნაწილში დატოვე მხოლოდ:
   - Maps JavaScript API
   - Places API (New)

## Vercel

1. გახსენი Dealivra პროექტი.
2. გადადი `Settings` → `Environment Variables`.
3. შექმენი ცვლადი:
   - Name: `VITE_GOOGLE_MAPS_API_KEY`
   - Value: Google Cloud-ში შექმნილი API key
4. მონიშნე Production, Preview და Development გარემოები.
5. შეინახე და გაუშვი ახალი Redeploy.

API key არ ჩაწერო GitHub-ში ან პროექტის საჯარო ფაილებში. Google Cloud-ში ყოველთვის დატოვე საიტისა და API-ების შეზღუდვები ჩართული.
