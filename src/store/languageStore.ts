/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from "zustand";
import { useAppStore } from "./appStore.js";

type Language = "nl" | "en";
type AdminLanguage = "nl" | "en" | "tr";

interface TranslationDictionary {
  [key: string]: {
    nl: string;
    en: string;
    tr: string;
  };
}

const dictionary: TranslationDictionary = {
  // Menu navigation
  menuHome: { nl: "Home", en: "Home", tr: "Ana Sayfa" },
  menuCatalog: { nl: "Catalogus", en: "Catalog", tr: "Katalog" },
  menuOrders: { nl: "Contact", en: "Contact", tr: "İletişim" },
  menuAdmin: { nl: "Portaal", en: "Portal", tr: "Yönetim" },
  menuBooking: { nl: "Boeken", en: "Book Now", tr: "Rezervasyon" },
  menuAdvisor: { nl: "Adviestool", en: "Advisor", tr: "Danışman" },
  menuLogin: { nl: "Inloggen", en: "Login", tr: "Giriş Yap" },
  menuMyArea: { nl: "Mijn Account", en: "My Account", tr: "Hesabım" },

  // Landing page / Hero
  heroBannerEyebrow: { nl: "Machine Verhuur", en: "Machine Rental", tr: "Makine Kiralama" },
  heroBannerLine1: { nl: "Slimme machines,", en: "Smart machines,", tr: "Akıllı makineler," },
  heroBannerLine2: { nl: "snel geregeld.", en: "sorted fast.", tr: "hızlıca ayarlandı." },
  heroFeatureOnline: { nl: "Snel & eenvoudig online huren", en: "Quick & easy online rental", tr: "Hızlı & kolay online kiralama" },
  heroFeatureDelivery: { nl: "Bezorging met of zonder chauffeur", en: "Delivery with or without driver", tr: "Şoförlü veya şoförsüz teslimat" },
  heroFeatureAudience: { nl: "Voor ZZP en particulier", en: "For businesses and individuals", tr: "Şirketler ve bireyler için" },
  heroTagline: { nl: "Professionele Hoogwerker Verhuur", en: "Professional Aerial Work Platform Rental", tr: "Profesyonel Yüksek Erişim Platformu Kiralama" },
  heroTitle: { nl: "De juiste machine, snel en veilig geregeld.", en: "The right machine, arranged quickly and safely.", tr: "Doğru makine, hızlı ve güvenli şekilde ayarlandı." },
  heroSubtitle: {
    nl: "HuurGo verhuurt hoogwerkers, schaarliften en ladderliften aan ZZP'ers en particulieren. Geen gedoe, direct online geregeld. Kies uw machine en boek eenvoudig via WhatsApp.",
    en: "HuurGo rents aerial work platforms, scissor lifts and ladder lifts to freelancers and individuals. No hassle, arranged directly online. Choose your machine and book easily via WhatsApp.",
    tr: "HuurGo, ZZP'ciler ve bireyler için sepetli platform, makaslı lift ve merdiven asansörü kiralar. Zahmetsiz, doğrudan çevrimiçi. Makinenizi seçin ve WhatsApp üzerinden kolayca rezervasyon yapın."
  },
  searchPlaceholder: { nl: "Waar gaat u werken? (bijv. 15 meter, schilder)", en: "Where will you work? (e.g. 15 meters, painting)", tr: "Nerede çalışacaksınız? (örn. 15 metre, boyacı)" },
  searchButton: { nl: "Zoeken", en: "Search Fleet", tr: "Filoda Ara" },

  // Catalog Section
  catalogTitle: { nl: "Professionele Verhuurvloot", en: "Professional Rental Fleet", tr: "Profesyonel Kiralama Filosu" },
  catalogSubtitle: { nl: "Direct beschikbaar voor ZZP'ers, bouw, groenvoorziening en industrie.", en: "Directly available for freelancers, construction, landscaping, and industry.", tr: "ZZP'ciler, inşaat, peyzaj ve sanayi için anında rezerve edilebilir." },
  filterAll: { nl: "Alle Machines", en: "All Machines", tr: "Tüm Platformlar" },
  btnSelect: { nl: "Dit Model Kiezen", en: "Choose This Model", tr: "Bu Modeli Seç" },
  btnSpecifications: { nl: "Geschikt voor mij?", en: "Is this right for me?", tr: "Bana uygun mu?" },
  btnRentNow: { nl: "Huur Nu", en: "Rent Now", tr: "Kirala" },
  btnMoreInfo: { nl: "Geschikt voor mijn klus?", en: "Is this right for my job?", tr: "İşime uygun mu?" },
  infoUseCases: { nl: "Waarvoor", en: "Use Cases", tr: "Kullanım Alanları" },
  infoAdvantages: { nl: "Voordelen", en: "Advantages", tr: "Avantajlar" },
  infoNotFor: { nl: "Niet geschikt voor", en: "Not suitable for", tr: "Uygun Değil" },

  // Price Summary
  priceSummaryReservation: { nl: "Jouw reservering", en: "Your reservation", tr: "Rezervasyonunuz" },
  priceSummaryTrailer: { nl: "Aanhangerverhuur", en: "Trailer rental", tr: "Römork kiralama" },
  priceSummaryDelivery: { nl: "Transportkosten", en: "Transport costs", tr: "Taşıma maliyeti" },
  priceSummaryPickup: { nl: "Bezorging", en: "Delivery", tr: "Teslimat" },
  priceSummaryPickupFree: { nl: "Zelf ophalen (gratis)", en: "Self-pickup (free)", tr: "Kendi alım (ücretsiz)" },
  priceSummaryTotal: { nl: "Totaal te betalen", en: "Total to pay", tr: "Ödenecek Toplam" },
  priceSummaryInclVAT: { nl: "incl. BTW", en: "incl. VAT", tr: "KDV dahil" },
  priceSummaryChooseMachine: { nl: "Kies een machine", en: "Choose a machine", tr: "Makine seçin" },
  priceSummaryNoHidden: { nl: "Geen verborgen kosten · Veilige betaling", en: "No hidden costs · Secure payment", tr: "Gizli maliyet yok · Güvenli ödeme" },
  priceSummaryChooseMachineHint: { nl: "Selecteer een hoogwerker uit de catalogus om uw prijs te zien.", en: "Select an aerial lift from the catalog to see your price.", tr: "Fiyatınızı görmek için katalogdan bir platform seçin." },
  priceSummaryChooseDates: { nl: "Kies uw huurperiode", en: "Choose your rental period", tr: "Kiralama döneminizi seçin" },
  priceSummaryChooseDatesHint: { nl: "Selecteer een begin- en einddatum in de kalender om de prijs te zien.", en: "Select a start and end date in the calendar to see the price.", tr: "Fiyatı görmek için takvimde bir başlangıç ve bitiş tarihi seçin." },
  priceSummaryMultiplePeriods: { nl: "Meerdere periodes", en: "Multiple periods", tr: "Birden fazla dönem" },
  priceSummaryMachinesReserved: { nl: "machines gereserveerd", en: "machines reserved", tr: "makine rezerve edildi" },
  priceSummaryDayRental: { nl: "dag huur", en: "day rental", tr: "gün kiralama" },
  priceSummaryDaysRental: { nl: "dagen huur", en: "days rental", tr: "gün kiralama" },
  priceSummaryRentPeriod: { nl: "Huurperiode", en: "Rental period", tr: "Kiralama dönemi" },
  priceSummaryRate: { nl: "Tarief", en: "Rate", tr: "Tarife" },
  priceSummaryWorkWeekRate: { nl: "Werkweektarief", en: "Work-week rate", tr: "Çalışma haftası tarifesi" },
  priceSummaryDayRate: { nl: "Dagtarief", en: "Daily rate", tr: "Günlük tarife" },
  priceSummaryTrailerOnLocation: { nl: "Aanhanger op locatie", en: "Trailer on location", tr: "Yerinde römork" },
  priceSummaryDay: { nl: "dag", en: "day", tr: "gün" },
  priceSummaryDays: { nl: "dagen", en: "days", tr: "gün" },
  priceSummaryCampaignDiscount: { nl: "Campagnekorting", en: "Campaign discount", tr: "Kampanya indirimi" },
  priceSummaryYouSave: { nl: "Je bespaart", en: "You save", tr: "Tasarruf edersiniz" },
  priceSummaryWeekendDay: { nl: "Weekenddag", en: "Weekend day", tr: "Hafta sonu günü" },
  priceSummaryWeekendDays: { nl: "Weekenddagen", en: "Weekend days", tr: "Hafta sonu günleri" },
  priceSummaryFreeNoUse: { nl: "Gratis (geen gebruik)", en: "Free (no use)", tr: "Ücretsiz (kullanılmadı)" },
  priceSummarySundayBlock: { nl: "Zondagblokkade", en: "Sunday block", tr: "Pazar blokajı" },
  priceSummarySundayBlockNote: { nl: "(retour ma 08:00)", en: "(return Mon 08:00)", tr: "(iade Pzt 08:00)" },
  priceSummaryViewBreakdown: { nl: "Prijsopbouw bekijken", en: "View price breakdown", tr: "Fiyat dökümünü görüntüle" },
  priceSummaryCalculation: { nl: "Berekening", en: "Calculation", tr: "Hesaplama" },
  priceSummaryWorkingDay: { nl: "werkdag", en: "working day", tr: "iş günü" },
  priceSummaryWorkingDays: { nl: "werkdagen", en: "working days", tr: "iş günü" },
  priceSummaryCalculated: { nl: "berekend", en: "calculated", tr: "hesaplandı" },
  priceSummaryWeekendDayLower: { nl: "weekenddag", en: "weekend day", tr: "hafta sonu günü" },
  priceSummaryWeekendDaysLower: { nl: "weekenddagen", en: "weekend days", tr: "hafta sonu günü" },
  priceSummaryFree: { nl: "Gratis", en: "Free", tr: "Ücretsiz" },
  priceSummaryWorkWeekRate5Days: { nl: "Werkweektarief (5 dgn)", en: "Work-week rate (5 days)", tr: "Çalışma haftası tarifesi (5 gün)" },
  priceSummaryExtraDay: { nl: "extra dag", en: "extra day", tr: "ekstra gün" },
  priceSummaryExtraDays: { nl: "extra dagen", en: "extra days", tr: "ekstra gün" },
  priceSummaryDiscounts: { nl: "Kortingen", en: "Discounts", tr: "İndirimler" },
  priceSummarySubtotalExclVAT: { nl: "Subtotaal (excl. BTW)", en: "Subtotal (excl. VAT)", tr: "Ara toplam (KDV hariç)" },
  priceSummaryVAT21: { nl: "BTW 21%", en: "VAT 21%", tr: "KDV %21" },
  priceSummaryPerDay: { nl: "/dag", en: "/day", tr: "/gün" },
  priceSummaryPerWeek: { nl: "/week", en: "/week", tr: "/hafta" },

  // Booking Step 1
  step1Title: { nl: "Huurperiode & Bezorging", en: "Rental Period & Delivery", tr: "Kiralama Dönemi & Teslimat" },
  step1Subtitle: { nl: "Kies uw datums en hoe u de machine wilt ontvangen.", en: "Choose your dates and how you'd like to receive the machine.", tr: "Tarihlerinizi ve makineyi nasıl almak istediğinizi seçin." },
  step1EmptyCart: { nl: "Uw winkelwagen is leeg", en: "Your cart is empty", tr: "Sepetiniz boş" },
  step1EmptyCartSub: { nl: "Selecteer een of meer machines uit onze catalogus om uw boeking te starten.", en: "Select one or more machines from our catalog to start your booking.", tr: "Rezervasyonunuzu başlatmak için katalogumuzdan bir veya daha fazla makine seçin." },
  step1BrowseCatalog: { nl: "Catalogus Bekijken", en: "Browse Catalog", tr: "Kataloğa Göz At" },
  step1StartDate: { nl: "Begindatum", en: "Start Date", tr: "Başlangıç Tarihi" },
  step1EndDate: { nl: "Einddatum (Retour)", en: "End Date (Return)", tr: "Bitiş Tarihi (İade)" },
  step1TransportOpts: { nl: "Transport Opties", en: "Transport Options", tr: "Nakliye Seçenekleri" },
  step1Opt1Title: { nl: "Wij bezorgen", en: "We deliver", tr: "Biz teslim ederiz" },
  step1Opt2Title: { nl: "Onze aanhanger huren", en: "Rent our trailer", tr: "Römorkumuzu kiralayın" },
  step1Opt3Title: { nl: "Zelf ophalen", en: "Self pickup", tr: "Kendi alımı" },
  step1AddonsTitle: { nl: "Kies Extra Opties & Services", en: "Choose Extra Options & Services", tr: "Ekstra Seçenekler & Hizmetler" },
  step1WeekendQuestion: { nl: "🗓 Gaat u in het weekend (za/zo) met de machine werken?", en: "🗓 Will you be working with the machine on the weekend (Sat/Sun)?", tr: "🗓 Hafta sonu (Cmt/Paz) makineyle çalışacak mısınız?" },
  step1WeekendYesShort: { nl: "Ja", en: "Yes", tr: "Evet" },
  step1WeekendNoShort: { nl: "Nee", en: "No", tr: "Hayır" },
  step1WeekendYesExplainer: { nl: "Volledig werkweektarief, za/zo inbegrepen", en: "Full work-week rate, Sat/Sun included", tr: "Tam çalışma haftası tarifesi, Cmt/Paz dahil" },
  step1WeekendNoExplainer: { nl: "Alleen werkdagen tellen · voordeliger, geen start op za/zo", en: "Only working days count · cheaper, no start on Sat/Sun", tr: "Yalnızca iş günleri sayılır · daha uygun, Cmt/Paz başlangıç yok" },
  step1WeekendNo: { nl: "Nee, niet werken", en: "No, not working", tr: "Hayır, çalışmıyorum" },
  step1WeekendNoSub: { nl: "Alleen werkdagen · voordeliger", en: "Working days only · cheaper", tr: "Yalnızca iş günleri · daha uygun" },
  step1WeekendYes: { nl: "Ja, ik werk in het weekend", en: "Yes, I work weekends", tr: "Evet, hafta sonu çalışıyorum" },
  step1WeekendYesSub: { nl: "Volledig werkweektarief", en: "Full work-week rate", tr: "Tam çalışma haftası tarifesi" },
  step1WeekendNoWarning: { nl: "⚠️ U betaalt nu alleen de werkdagen. Wordt gebruik van de machine op weekenddagen geconstateerd via de urenteller, dan wordt het volledige werkweektarief alsnog in rekening gebracht.", en: "⚠️ You now only pay for working days. If machine use is detected on weekend days via the hour meter, the full work-week rate will still be charged.", tr: "⚠️ Şu anda yalnızca çalışma günleri için ödeme yapıyorsunuz. Hafta sonu makine kullanımı saat sayacıyla tespit edilirse, tam çalışma haftası tarifesi yine de faturalandırılır." },

  // Availability calendar (date-range picker)
  calSelectPeriod: { nl: "Selecteer huurperiode", en: "Select rental period", tr: "Kiralama dönemi seçin" },
  calChange: { nl: "Wijzig", en: "Change", tr: "Değiştir" },
  calTitle: { nl: "Kies uw huurperiode", en: "Choose your rental period", tr: "Kiralama döneminizi seçin" },
  calClose: { nl: "Sluiten", en: "Close", tr: "Kapat" },
  calPrevMonth: { nl: "Vorige maand", en: "Previous month", tr: "Önceki ay" },
  calNextMonth: { nl: "Volgende maand", en: "Next month", tr: "Sonraki ay" },
  calLegendAvailable: { nl: "Beschikbaar", en: "Available", tr: "Müsait" },
  calLegendSelected: { nl: "Geselecteerd", en: "Selected", tr: "Seçili" },
  calLegendUnavailable: { nl: "Niet beschikbaar", en: "Unavailable", tr: "Müsait değil" },
  calReset: { nl: "Herstel", en: "Reset", tr: "Sıfırla" },
  calConfirm: { nl: "Bevestigen", en: "Confirm", tr: "Onayla" },
  calCappedHint: {
    nl: "Er zijn nog beschikbare data na de bezette periode — kies een nieuwe startdatum na die periode.",
    en: "Dates are available after the booked period — pick a new start date after it.",
    tr: "Dolu dönemden sonra müsait tarihler var — o dönemden sonra yeni bir başlangıç tarihi seçin.",
  },

  // Booking Success
  successTitle: { nl: "Reservering Aangevraagd", en: "Reservation Requested", tr: "Rezervasyon Talep Edildi" },
  successPending: { nl: "Nog niet bevestigd", en: "Not yet confirmed", tr: "Henüz onaylanmadı" },
  successConfirmWA: { nl: "Bevestig via WhatsApp", en: "Confirm via WhatsApp", tr: "WhatsApp ile Onayla" },
  successPdfBtn: { nl: "Pro-forma PDF", en: "Pro-forma PDF", tr: "Pro-forma PDF" },
  successOrdersBtn: { nl: "Mijn Bestellingen", en: "My Orders", tr: "Siparişlerim" },
  successWAStep1: { nl: "Klik hieronder om uw aanvraag te bevestigen via WhatsApp.", en: "Click below to confirm your request via WhatsApp.", tr: "WhatsApp üzerinden talebinizi onaylamak için aşağıya tıklayın." },
  successWAStep2: { nl: "U ontvangt binnen 2 uur een beveiligde iDEAL-betaallink.", en: "You will receive a secure iDEAL payment link within 2 hours.", tr: "2 saat içinde güvenli bir iDEAL ödeme bağlantısı alacaksınız." },
  successWAStep3: { nl: "Na betaling is uw boeking definitief bevestigd.", en: "After payment your booking is definitively confirmed.", tr: "Ödeme sonrasında rezervasyonunuz kesin olarak onaylanır." },
  specRenter: { nl: "Huurder", en: "Renter", tr: "Kiracı" },
  specMachine: { nl: "Hoogwerker", en: "Machine", tr: "Makine" },
  specPeriod: { nl: "Periode", en: "Period", tr: "Dönem" },
  specCollection: { nl: "Afhaling", en: "Collection", tr: "Teslim alma" },
  specAddress: { nl: "Adres", en: "Address", tr: "Adres" },
  specTotal: { nl: "Totaal incl. BTW", en: "Total incl. VAT", tr: "Toplam KDV dahil" },
  successConfirmRef: { nl: "Bevestig via WhatsApp om uw betaallink te ontvangen.", en: "Confirm via WhatsApp to receive your payment link.", tr: "Ödeme bağlantınızı almak için WhatsApp üzerinden onaylayın." },

  // Footer
  footerHours: { nl: "Openingstijden", en: "Opening Hours", tr: "Çalışma Saatleri" },
  footerHoursLine: { nl: "Ma – Za: 07:00–19:00", en: "Mon – Sat: 07:00–19:00", tr: "Pzt – Cmt: 07:00–19:00" },
  footerClosed: { nl: "Zondag gesloten", en: "Closed on Sundays", tr: "Pazar günleri kapalı" },

  // Booking Section
  bookingTitle: { nl: "Rond uw Reservatie Af", en: "Complete Your Reservation", tr: "Rezervasyonunuzu Tamamlayın" },
  bookingSubtitle: { nl: "Configureer uw huurperiode en bezorgwijze. Veilig, vakkundig en direct verbonden.", en: "Configure your rental period and delivery method. Safe, professional, and directly connected.", tr: "Kiralama periyodunuzu ve lojistik yönteminizi seçin. Güvenli, profesyonel ve anında bağlantılı." },
  stepLogistics: { nl: "Logistiek", en: "Logistics", tr: "Lojistik" },
  stepCustomer: { nl: "Gegevens", en: "Details", tr: "Bilgiler" },
  stepPayment: { nl: "Betaling", en: "Payment", tr: "Ödeme" },
  btnBack: { nl: "Terug", en: "Back", tr: "Geri" },
  btnContinue: { nl: "Doorgaan", en: "Continue", tr: "Devam Et" },
  btnPay: { nl: "Veilig Betalen", en: "Pay Securely", tr: "Güvenli Ödeme" },

  // Price summary
  priceSpecTitle: { nl: "Huur Specificatie", en: "Rental Specification", tr: "Kiralama Detayları" },
  priceDays: { nl: "Aantal dagen gevraagd:", en: "Rental days requested:", tr: "Talep edilen gün sayısı:" },
  priceGross: { nl: "Bruto huurtarief:", en: "Gross rental rate:", tr: "Brüt kiralama tutarı:" },
  priceNet: { nl: "Netto huurtarief:", en: "Net rental rate:", tr: "Net kiralama tutarı:" },
  priceTransport: { nl: "Transportkosten (Heen/Weer):", en: "Transport costs (Round-trip):", tr: "Nakliye Ücreti (Gidiş-Dönüş):" },
  priceChauffeur: { nl: "Chauffeur & Demonstratie:", en: "Driver & Demonstration:", tr: "Operatör & Gösterim:" },
  priceVat: { nl: "Omzetbelasting BTW (21%):", en: "VAT (21%):", tr: "KDV (%21):" },
  priceTotal: { nl: "Totaal Overeenkomst", en: "Total Agreement", tr: "Toplam Sözleşme Tutarı" },
  priceBtwNote: { nl: "Inclusief BTW & Training", en: "Includes VAT & Training", tr: "KDV ve Güvenlik Eğitimi Dahildir" },

  // Admin portal
  adminPortalTitle: { nl: "HubAdmin Command Center", en: "HubAdmin Command Center", tr: "HubAdmin Yönetim Merkezi" },
  adminPortalSubtitle: { nl: "Volledig overzicht over vlootbeschikbaarheid, reserveringsaccordering, facturering en live logging.", en: "Complete overview of fleet availability, reservation approvals, invoicing, and live logging.", tr: "Filo uygunluğu, rezervasyon onayları, faturalandırma ve canlı log kayıtlarına tam kontrol ve genel bakış." },
  adminSecure: { nl: "Secure Admin Control • Active Connection", en: "Secure Admin Control • Active Connection", tr: "Güvenli Yönetici Erişimi • Aktif Güvenli Bağlantı" },
  adminTabDashboard: { nl: "Dashboard", en: "Dashboard", tr: "Panel" },
  adminTabOrders: { nl: "Huurcontracten", en: "Rental Contracts", tr: "Sözleşmeler" },
  adminTabMachines: { nl: "Machine Beheer", en: "Manage Machines", tr: "Makine Yönetimi" },
  adminTabCalendar: { nl: "Kalender & Datums", en: "Calendar & Dates", tr: "Takvim & Planlama" },
  adminTabAdd: { nl: "Machine Toevoegen", en: "Add Machine", tr: "Makine Ekle" },
  adminTabCustomizer: { nl: "Beheer Storefront", en: "Manage Storefront", tr: "Mağaza Ayarları" },
  adminTabLogs: { nl: "Bezoekers & Activiteit", en: "Visitors & Activity", tr: "Ziyaretçi & Aktivite" },
  cookieText: {
    nl: "Wij gebruiken functionele cookies en — met uw toestemming — analytische cookies om de site te verbeteren.",
    en: "We use functional cookies and — with your consent — analytics cookies to improve the site.",
    tr: "Siteyi iyileştirmek için işlevsel çerezler ve — izninizle — analitik çerezler kullanıyoruz.",
  },
  cookieMoreInfo: { nl: "Meer info", en: "More info", tr: "Daha fazla bilgi" },
  cookieAccept: { nl: "Accepteren", en: "Accept", tr: "Kabul et" },
  cookieReject: { nl: "Weigeren", en: "Decline", tr: "Reddet" },
};

interface LanguageState {
  language: Language;
  adminLanguage: AdminLanguage;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  setAdminLanguage: (lang: AdminLanguage) => void;
  t: (key: string, enText?: string, _trText?: string) => string;
  tAdmin: (key: string) => string;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: (localStorage.getItem("hwh_lang") as Language) || "nl",
  adminLanguage: (localStorage.getItem("hwh_admin_lang") as AdminLanguage) || "nl",
  
  toggleLanguage: () => {
    // Strictly toggle nl <-> en for the public storefront
    const nextLang: Language = get().language === "nl" ? "en" : "nl";
    localStorage.setItem("hwh_lang", nextLang);
    set({ language: nextLang });
    document.documentElement.lang = nextLang;
  },
  
  setLanguage: (lang: Language) => {
    localStorage.setItem("hwh_lang", lang);
    set({ language: lang });
    document.documentElement.lang = lang;
  },

  setAdminLanguage: (lang: AdminLanguage) => {
    localStorage.setItem("hwh_admin_lang", lang);
    set({ adminLanguage: lang });
  },

  t: (key: string, enText?: string, _trText?: string) => {
    const currentLang = get().language;
    if (currentLang === "en" && enText) return enText;
    if (currentLang === "nl") {
      const siteConfig = useAppStore.getState().siteConfig;
      if (key === "heroTitle" && siteConfig.heroTitle) return siteConfig.heroTitle;
      if (key === "heroSubtitle" && siteConfig.heroSubtitle) return siteConfig.heroSubtitle;
      if (key === "heroTagline" && siteConfig.heroTagline) return siteConfig.heroTagline;
      if (key === "menuHome" && siteConfig.menuHomeLabel) return siteConfig.menuHomeLabel;
      if (key === "menuCatalog" && siteConfig.menuCatalogLabel) return siteConfig.menuCatalogLabel;
      if (key === "menuOrders" && siteConfig.menuOrdersLabel) return siteConfig.menuOrdersLabel;
      if (key === "menuAdmin" && siteConfig.menuAdminLabel) return siteConfig.menuAdminLabel;
    }
    const entry = dictionary[key];
    if (!entry) return key;
    return entry[currentLang] || key;
  },

  tAdmin: (key: string) => {
    const entry = dictionary[key];
    if (!entry) return key;
    return entry[get().adminLanguage] || key;
  }
}));
