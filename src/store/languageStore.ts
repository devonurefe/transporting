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
  menuCatalog: { nl: "Catalog", en: "Catalog", tr: "Katalog" },
  menuAdvisor: { nl: "Snel Advies", en: "Fast Advice", tr: "Hızlı Tavsiye" },
  menuOrders: { nl: "Contact", en: "Contact", tr: "İletişim" },
  menuAdmin: { nl: "Portaal", en: "Portal", tr: "Yönetim" },

  // Landing page / Hero
  heroTagline: { nl: "Smart Verhuur van Hoogwerkers in Nederland", en: "Smart High-Lift Rentals in the Netherlands", tr: "Hollanda'da Akıllı Sepetli Platform Kiralama" },
  heroTitle: { nl: "Uitzonderlijk bereik. Volledig ontzorgd.", en: "Exceptional Reach. Completely Hassle-Free.", tr: "Olağanüstü Erişim. Tamamen Zahmetsiz." },
  heroSubtitle: { 
    nl: "Van schilderwerk binnen tot zware industriebouw buiten; HuurGo levert direct de juiste machines op locatie. Met of zonder vakbekwame chauffeur, gecontroleerd door onze slimme AI-assistent.",
    en: "From indoor painting to heavy outdoor industrial construction; HuurGo delivers the right machinery directly to your location. With or without a skilled driver, monitored by our smart AI assistant.",
    tr: "İç mekan boya işlerinden ağır dış sanayi inşaatlarına kadar; HuurGo doğru makineleri doğrudan adresinize teslim eder. Uzman operatörlü veya operatörsüz kiralama seçenekleriyle, yapay zeka asistanımız kontrolünde."
  },
  searchPlaceholder: { nl: "Waar gaat u werken? (bijv. 15 meter, schilder)", en: "Where will you work? (e.g. 15 meters, painting)", tr: "Nerede çalışacaksınız? (örn. 15 metre, boyacı)" },
  searchButton: { nl: "Zoeken", en: "Search Fleet", tr: "Filoda Ara" },

  // Catalog Section
  catalogTitle: { nl: "Professionele Verhuurvloot", en: "Professional Rental Fleet", tr: "Profesyonel Kiralama Filosu" },
  catalogSubtitle: { nl: "Direct beschikbaar voor zzp, bouw, groenvoorziening en industrie.", en: "Directly available for freelancers, construction, landscaping, and industry.", tr: "ZZP, inşaat, peyzaj ve sanayi için anında rezerve edilebilir." },
  filterAll: { nl: "Alle Machines", en: "All Machines", tr: "Tüm Platformlar" },
  btnSelect: { nl: "Dit Model Kiezen", en: "Choose This Model", tr: "Bu Modeli Seç" },

  // Advisor Section
  advisorTitle: { nl: "AI Smart Adviseur", en: "AI Smart Advisor", tr: "Yapay Zeka Danışmanı" },
  advisorSubtitle: { 
    nl: "Beschrijf uw klus aan onze AI-assistent en ontvang direct de perfecte hoogwerker-aanbeveling met realtime capaciteitscheck.",
    en: "Describe your job to our AI assistant and instantly receive the perfect high-lift recommendation with real-time capacity checks.",
    tr: "Görevinizi yapay zeka asistanımıza tarif edin, anlık kapasite kontrolü ile en mükemmel sepetli platform önerisini hemen alın."
  },
  advisorPromptPlaceholder: { nl: "Typ uw bericht aan de adviseur...", en: "Type your message to the advisor...", tr: "Yapay zeka asistanına mesajınızı yazın..." },
  advisorSend: { nl: "Versturen", en: "Send", tr: "Gönder" },

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
  priceGross: { nl: "Bruto lokatieduur tarief:", en: "Gross rental rate:", tr: "Brüt kiralama tutarı:" },
  priceNet: { nl: "Netto lokatieduur tarief:", en: "Net rental rate:", tr: "Net kiralama tutarı:" },
  priceTransport: { nl: "Transportkosten (Heen/Weer):", en: "Transport costs (Round-trip):", tr: "Nakliye Ücreti (Gidiş-Dönüş):" },
  priceChauffeur: { nl: "Chauffeur & Demonstratie:", en: "Driver & Demonstration:", tr: "Operatör & Gösterim:" },
  priceVat: { nl: "Omzetbelasting BTW (21%):", en: "VAT (21%):", tr: "KDV (%21):" },
  priceTotal: { nl: "Totaal Overeenkomst", en: "Total Agreement", tr: "Toplam Sözleşme Tutarı" },
  priceBtwNote: { nl: "Inclusief BTW & Training", en: "Includes VAT & Training", tr: "KDV ve Güvenlik Eğitimi Dahildir" },

  // Admin portal
  adminPortalTitle: { nl: "HubAdmin Command Center", en: "HubAdmin Command Center", tr: "HubAdmin Yönetim Merkezi" },
  adminPortalSubtitle: { nl: "Volledig overzicht over vlootbeschikbaarheid, reserveringsaccordering, facturering en live logging.", en: "Complete overview of fleet availability, reservation approvals, invoicing, and live logging.", tr: "Filo uygunluğu, rezervasyon onayları, faturalandırma ve canlı loğ kayıtlarına tam kontrol ve genel bakış." },
  adminSecure: { nl: "Secure Admin Control • Active Connection", en: "Secure Admin Control • Active Connection", tr: "Güvenli Yönetici Erişimi • Aktif Güvenli Bağlantı" },
  adminTabDashboard: { nl: "Dashboard", en: "Dashboard", tr: "Panel" },
  adminTabOrders: { nl: "Huurcontracten", en: "Rental Contracts", tr: "Sözleşmeler" },
  adminTabMachines: { nl: "Machine Beheer", en: "Manage Machines", tr: "Makine Yönetimi" },
  adminTabCalendar: { nl: "Kalender & Datums", en: "Calendar & Dates", tr: "Takvim & Planlama" },
  adminTabAdd: { nl: "Machine Toevoegen", en: "Add Machine", tr: "Makine Ekle" },
  adminTabCustomizer: { nl: "Beheer Storefront", en: "Manage Storefront", tr: "Mağaza Ayarları" },
  adminTabLogs: { nl: "Bezoekers & Activiteit", en: "Visitors & Activity", tr: "Ziyaretçi & Aktivite" },
};

interface LanguageState {
  language: Language;
  adminLanguage: AdminLanguage;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  setAdminLanguage: (lang: AdminLanguage) => void;
  t: (key: string) => string;
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

  t: (key: string) => {
    const currentLang = get().language;
    if (currentLang === "nl") {
      const siteConfig = useAppStore.getState().siteConfig;
      if (key === "heroTitle" && siteConfig.heroTitle) return siteConfig.heroTitle;
      if (key === "heroSubtitle" && siteConfig.heroSubtitle) return siteConfig.heroSubtitle;
      if (key === "heroTagline" && siteConfig.heroTagline) return siteConfig.heroTagline;
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
