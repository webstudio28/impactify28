export type EmailLanguage = "en" | "bg" | "de" | "fr";

export type EmailStrings = {
  shopNow: string;
  unsubscribe: string;
  viewInBrowser: string;
  theOffer: string;
  thisSeasonDeal: string;
  exclusiveOffer: string;
  useCode: string;
  howToRedeem: string;
  dontLetOfferSlip: string;
  useCodeAtCheckout: (code: string) => string;
  discountOff: (amount: string) => string;
  newArrival: string;
  keyFeatures: string;
  whyItMatters: string;
  readyToExperience: string;
};

const COPY: Record<EmailLanguage, EmailStrings> = {
  en: {
    shopNow: "Shop Now \u2192",
    unsubscribe: "Unsubscribe",
    viewInBrowser: "View in browser",
    theOffer: "The Offer",
    thisSeasonDeal: "This Season\u2019s Deal",
    exclusiveOffer: "Exclusive Offer",
    useCode: "Use Code",
    howToRedeem: "How to Redeem",
    dontLetOfferSlip: "Don\u2019t let this offer slip away.",
    useCodeAtCheckout: (code) => `Use code <strong>${code}</strong> at checkout.`,
    discountOff: (amount) => `${amount} Off`,
    newArrival: "New Arrival",
    keyFeatures: "Key Features",
    whyItMatters: "Why It Matters",
    readyToExperience: "Ready to experience it?",
  },
  bg: {
    shopNow: "\u041f\u0430\u0437\u0430\u0440\u0443\u0432\u0430\u0439 \u0441\u0435\u0433\u0430 \u2192",
    unsubscribe: "\u041e\u0442\u043f\u0438\u0441\u0432\u0430\u043d\u0435",
    viewInBrowser: "\u0412\u0438\u0436 \u0432 \u0431\u0440\u0430\u0443\u0437\u044a\u0440",
    theOffer: "\u041e\u0444\u0435\u0440\u0442\u0430\u0442\u0430",
    thisSeasonDeal: "\u0421\u0435\u0437\u043e\u043d\u043d\u0430\u0442\u0430 \u043e\u0444\u0435\u0440\u0442\u0430",
    exclusiveOffer: "\u0415\u043a\u0441\u043a\u043b\u0443\u0437\u0438\u0432\u043d\u0430 \u043e\u0444\u0435\u0440\u0442\u0430",
    useCode: "\u041a\u043e\u0434 \u0437\u0430 \u043e\u0442\u0441\u0442\u044a\u043f\u043a\u0430",
    howToRedeem: "\u041a\u0430\u043a \u0434\u0430 \u0438\u0437\u043f\u043e\u043b\u0437\u0432\u0430\u0448",
    dontLetOfferSlip: "\u041d\u0435 \u0438\u0437\u043f\u0443\u0441\u043d\u0435\u0442\u0435 \u0442\u0430\u0437\u0438 \u043e\u0444\u0435\u0440\u0442\u0430.",
    useCodeAtCheckout: (code) =>
      `\u0418\u0437\u043f\u043e\u043b\u0437\u0432\u0430\u0439\u0442\u0435 \u043a\u043e\u0434 <strong>${code}</strong> \u043f\u0440\u0438 \u043f\u043e\u0440\u044a\u0447\u043a\u0430.`,
    discountOff: (amount) => `${amount} \u043e\u0442\u0441\u0442\u044a\u043f\u043a\u0430`,
    newArrival: "\u041d\u043e\u0432\u043e \u043f\u043e\u0441\u0442\u044a\u043f\u043b\u0435\u043d\u0438\u0435",
    keyFeatures: "\u041a\u043b\u044e\u0447\u043e\u0432\u0438 \u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043a\u0438",
    whyItMatters: "\u0417\u0430\u0449\u043e \u0435 \u0432\u0430\u0436\u043d\u043e",
    readyToExperience: "\u0413\u043e\u0442\u043e\u0432\u0438 \u043b\u0438 \u0441\u0442\u0435 \u0434\u0430 \u0433\u043e \u043e\u0442\u043a\u0440\u0438\u0435\u0442\u0435?",
  },
  de: {
    shopNow: "Jetzt shoppen \u2192",
    unsubscribe: "Abmelden",
    viewInBrowser: "Im Browser ansehen",
    theOffer: "Das Angebot",
    thisSeasonDeal: "Angebot der Saison",
    exclusiveOffer: "Exklusives Angebot",
    useCode: "Code verwenden",
    howToRedeem: "So einl\u00f6sen",
    dontLetOfferSlip: "Lassen Sie sich dieses Angebot nicht entgehen.",
    useCodeAtCheckout: (code) => `Code <strong>${code}</strong> an der Kasse verwenden.`,
    discountOff: (amount) => `${amount} Rabatt`,
    newArrival: "Neuheit",
    keyFeatures: "Hauptmerkmale",
    whyItMatters: "Warum es wichtig ist",
    readyToExperience: "Bereit, es auszuprobieren?",
  },
  fr: {
    shopNow: "Acheter \u2192",
    unsubscribe: "Se d\u00e9sabonner",
    viewInBrowser: "Voir dans le navigateur",
    theOffer: "L\u2019offre",
    thisSeasonDeal: "L\u2019offre de la saison",
    exclusiveOffer: "Offre exclusive",
    useCode: "Utiliser le code",
    howToRedeem: "Comment profiter de l\u2019offre",
    dontLetOfferSlip: "Ne laissez pas passer cette offre.",
    useCodeAtCheckout: (code) => `Utilisez le code <strong>${code}</strong> \u00e0 la caisse.`,
    discountOff: (amount) => `${amount} de r\u00e9duction`,
    newArrival: "Nouveaut\u00e9",
    keyFeatures: "Points cl\u00e9s",
    whyItMatters: "Pourquoi c\u2019est important",
    readyToExperience: "Pr\u00eat \u00e0 l\u2019essayer ?",
  },
};

export function normalizeEmailLanguage(lang: string | null | undefined): EmailLanguage {
  const l = (lang ?? "en").trim().toLowerCase().slice(0, 2);
  if (l === "bg" || l === "de" || l === "fr") return l;
  return "en";
}

export function getEmailStrings(lang: string | null | undefined): EmailStrings {
  return COPY[normalizeEmailLanguage(lang)];
}

export function emailHtmlLang(lang: string | null | undefined): string {
  return normalizeEmailLanguage(lang);
}
