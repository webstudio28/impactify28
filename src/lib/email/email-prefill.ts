import type { EmailTemplateType, ProductItem } from "./templates/types";

/** Shared sample product for dev/testing prefill. */
export const PREFILL_SAMPLE_PRODUCT: ProductItem = {
  productUrl:
    "https://www.rockbunkerbg.com/product/metal-teniska-iron-maiden-senjutsu-samurai/",
  name: "Метъл тениска Iron Maiden Senjutsu",
  imageUrl: "https://www.rockbunkerbg.com/wp-content/uploads/2025/12/70686.jpg",
  description:
    "Официална метъл тениска Iron Maiden Senjutsu с уникален дизайн на Самурай Еди.",
};

const PREFILL_CTA_URL = PREFILL_SAMPLE_PRODUCT.productUrl;
const PREFILL_HERO_IMAGE = PREFILL_SAMPLE_PRODUCT.imageUrl;

function repeatProduct(count: number): ProductItem[] {
  return Array.from({ length: count }, () => ({ ...PREFILL_SAMPLE_PRODUCT }));
}

/** Form field shape used by {@link EmailBuilderStep}. */
export type EmailPrefillFormFields = {
  subjectLine: string;
  language: string;
  ctaText: string;
  ctaUrl: string;
  heroHeadline: string;
  supportingLine: string;
  offerDescription: string;
  products: ProductItem[];
  productName: string;
  productImageUrl: string;
  launchHeadline: string;
  story: string;
  features: string[];
  benefits: string[];
  urgencyMessage: string;
  countdownText: string;
  couponEyebrowText: string;
  couponClosingLine: string;
  discountAmount: string;
  couponCode: string;
  redemptionSteps: string[];
  heroImageUrl: string;
};

const COMMON = {
  language: "bg",
  ctaText: "Виж продукта",
  ctaUrl: PREFILL_CTA_URL,
  heroImageUrl: PREFILL_HERO_IMAGE,
} as const;

export const PREFILL_SENDER = {
  displayName: "Rock Bunker BG",
  email: "newsletter@rockbunkerbg.com",
} as const;

export function getEmailPrefillFields(templateType: EmailTemplateType): EmailPrefillFormFields {
  const empty = {
    subjectLine: "",
    language: COMMON.language,
    ctaText: COMMON.ctaText,
    ctaUrl: COMMON.ctaUrl,
    heroHeadline: "",
    supportingLine: "",
    offerDescription: "",
    products: [] as ProductItem[],
    productName: "",
    productImageUrl: "",
    launchHeadline: "",
    story: "",
    features: ["", "", ""],
    benefits: ["", ""],
    urgencyMessage: "",
    countdownText: "",
    couponEyebrowText: "",
    couponClosingLine: "",
    discountAmount: "",
    couponCode: "",
    redemptionSteps: ["", "", ""],
    heroImageUrl: COMMON.heroImageUrl,
  };

  switch (templateType) {
    case "promotional":
      return {
        ...empty,
        subjectLine: "До 20% отстъпка — Iron Maiden Senjutsu тениска",
        heroHeadline: "До 20% отстъпка",
        supportingLine:
          "Официална метъл тениска Iron Maiden Senjutsu — само за кратко време в Rock Bunker.",
        offerDescription:
          "Сделката е ясна: избери размер, добави в количката и се наслади на уникалния дизайн на Самурай Еди.",
        products: repeatProduct(4),
      };
    case "seasonal":
      return {
        ...empty,
        subjectLine: "Сезонна оферта — Iron Maiden Senjutsu",
        heroHeadline: "Сезонна оферта за феновете на метъла",
        urgencyMessage: "Само до края на месеца — не пропускай!",
        countdownText: "Остават само няколко дни до края на промоцията.",
        offerDescription:
          "Вземи официалната Iron Maiden Senjutsu тениска на специална цена, докато има наличност.",
        products: repeatProduct(4),
      };
    case "discount_coupon":
      return {
        ...empty,
        subjectLine: "Твоят код за 15% отстъпка — Iron Maiden",
        discountAmount: "15%",
        couponCode: "MAIDEN15",
        heroHeadline: "15% отстъпка за тениската Senjutsu",
        couponEyebrowText: "Малък жест за феновете на Rock Bunker",
        couponClosingLine: "Използвай кода, ако си харесаш нещо от колекцията.",
        redemptionSteps: [
          "Отвори продукта и избери размер.",
          "Добави в количката и въведи кода MAIDEN15.",
          "Завърши поръчката и получи тениската с доставка.",
        ],
        products: repeatProduct(3),
      };
    case "product_launch":
      return {
        ...empty,
        subjectLine: "Ново пристигане — Iron Maiden Senjutsu тениска",
        productName: PREFILL_SAMPLE_PRODUCT.name,
        productImageUrl: PREFILL_SAMPLE_PRODUCT.imageUrl,
        launchHeadline: "Продуктът на бъдещето вече е тук",
        story:
          "Официална метъл тениска с арт на Самурай Еди от албума Senjutsu. Мека памучна материя, висококачествен печат и лимитиран дизайн за истински фенове.",
        features: [
          "100% памук, удобна кройка",
          "Официален лицензиран Iron Maiden арт",
          "Висококачествен печат, устойчив на изпиране",
        ],
        benefits: [
          "Уникален дизайн, който не се намира навсякъде",
          "Перфектен подарък за фенове на метъла",
        ],
        heroImageUrl: "",
      };
  }
}
