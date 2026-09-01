/**
 * Spending taxonomy + the lexicon that powers the offline NLP engine.
 * Tuned for Indian college students: mess, chai, auto, UPI apps, recharges…
 */

export type CategoryKind = "EXPENSE" | "INCOME";

export type CategorySeed = {
  name: string;
  slug: string;
  emoji: string;
  color: string;
  kind: CategoryKind;
};

export const DEFAULT_CATEGORIES: CategorySeed[] = [
  // ---------------------------------- expense ---------------------------------
  { name: "Mess & Canteen", slug: "mess", emoji: "🍛", color: "#f97316", kind: "EXPENSE" },
  { name: "Chai & Snacks", slug: "chai", emoji: "☕", color: "#a16207", kind: "EXPENSE" },
  { name: "Food Delivery", slug: "delivery", emoji: "🛵", color: "#ef4444", kind: "EXPENSE" },
  { name: "Groceries", slug: "groceries", emoji: "🛒", color: "#22c55e", kind: "EXPENSE" },
  { name: "Transport", slug: "transport", emoji: "🚌", color: "#0ea5e9", kind: "EXPENSE" },
  { name: "Hostel & Rent", slug: "hostel", emoji: "🏠", color: "#8b5cf6", kind: "EXPENSE" },
  { name: "Fees & Academics", slug: "academics", emoji: "🎓", color: "#6366f1", kind: "EXPENSE" },
  { name: "Books & Stationery", slug: "books", emoji: "📚", color: "#14b8a6", kind: "EXPENSE" },
  { name: "Mobile & WiFi", slug: "mobile", emoji: "📶", color: "#06b6d4", kind: "EXPENSE" },
  { name: "Subscriptions", slug: "subscriptions", emoji: "🎬", color: "#ec4899", kind: "EXPENSE" },
  { name: "Shopping", slug: "shopping", emoji: "🛍️", color: "#f43f5e", kind: "EXPENSE" },
  { name: "Health", slug: "health", emoji: "💊", color: "#10b981", kind: "EXPENSE" },
  { name: "Fun & Outings", slug: "fun", emoji: "🎉", color: "#eab308", kind: "EXPENSE" },
  { name: "Travel", slug: "travel", emoji: "🧳", color: "#3b82f6", kind: "EXPENSE" },
  { name: "Gifts & Donations", slug: "gifts", emoji: "🎁", color: "#d946ef", kind: "EXPENSE" },
  { name: "Laundry", slug: "laundry", emoji: "🧺", color: "#7dd3fc", kind: "EXPENSE" },
  { name: "Personal Care", slug: "personal", emoji: "🧼", color: "#f472b6", kind: "EXPENSE" },
  { name: "Other", slug: "other", emoji: "🧾", color: "#94a3b8", kind: "EXPENSE" },
  // ---------------------------------- income ----------------------------------
  { name: "Allowance", slug: "allowance", emoji: "👪", color: "#10b981", kind: "INCOME" },
  { name: "Scholarship", slug: "scholarship", emoji: "🏆", color: "#22c55e", kind: "INCOME" },
  { name: "Freelance", slug: "freelance", emoji: "💼", color: "#0ea5e9", kind: "INCOME" },
  { name: "Internship", slug: "internship", emoji: "🧑‍💻", color: "#6366f1", kind: "INCOME" },
  { name: "Part-time Job", slug: "parttime", emoji: "⏱️", color: "#8b5cf6", kind: "INCOME" },
  { name: "Refunds & Cashback", slug: "refunds", emoji: "↩️", color: "#14b8a6", kind: "INCOME" },
  { name: "Other Income", slug: "other-income", emoji: "💰", color: "#64748b", kind: "INCOME" },
];

export const UNCATEGORISED_SLUG = "other";

/** Brand / merchant name → category. Matched as whole-word substrings. */
export const MERCHANT_LEXICON: Record<string, { slug: string; label?: string }> = {
  // delivery & food
  zomato: { slug: "delivery", label: "Zomato" },
  swiggy: { slug: "delivery", label: "Swiggy" },
  "swiggy instamart": { slug: "groceries", label: "Instamart" },
  blinkit: { slug: "groceries", label: "Blinkit" },
  zepto: { slug: "groceries", label: "Zepto" },
  dunzo: { slug: "groceries", label: "Dunzo" },
  dominos: { slug: "delivery", label: "Domino's" },
  pizza: { slug: "delivery", label: "Pizza" },
  "pizza hut": { slug: "delivery", label: "Pizza Hut" },
  mcd: { slug: "delivery", label: "McDonald's" },
  mcdonald: { slug: "delivery", label: "McDonald's" },
  kfc: { slug: "delivery", label: "KFC" },
  "burger king": { slug: "delivery", label: "Burger King" },
  subway: { slug: "delivery", label: "Subway" },
  starbucks: { slug: "chai", label: "Starbucks" },
  "cafe coffee day": { slug: "chai", label: "Cafe Coffee Day" },
  ccd: { slug: "chai", label: "Cafe Coffee Day" },
  chaayos: { slug: "chai", label: "Chaayos" },
  "chai point": { slug: "chai", label: "Chai Point" },
  chai: { slug: "chai", label: "Chai" },
  chaha: { slug: "chai", label: "Chai" },
  tapri: { slug: "chai", label: "Tapri" },
  canteen: { slug: "mess", label: "Canteen" },
  mess: { slug: "mess", label: "Mess" },
  hostel: { slug: "hostel", label: "Hostel" },
  dhaba: { slug: "mess", label: "Dhaba" },
  lunch: { slug: "mess", label: "Lunch" },
  dinner: { slug: "mess", label: "Dinner" },
  breakfast: { slug: "mess", label: "Breakfast" },
  // groceries
  bigbasket: { slug: "groceries", label: "BigBasket" },
  dmart: { slug: "groceries", label: "DMart" },
  "reliance fresh": { slug: "groceries", label: "Reliance Fresh" },
  more: { slug: "groceries", label: "More Supermarket" },
  kirana: { slug: "groceries", label: "Kirana Store" },
  supermarket: { slug: "groceries", label: "Supermarket" },
  vegetable: { slug: "groceries", label: "Vegetables" },
  milk: { slug: "groceries", label: "Milk" },
  // transport
  uber: { slug: "transport", label: "Uber" },
  ola: { slug: "transport", label: "Ola" },
  rapido: { slug: "transport", label: "Rapido" },
  auto: { slug: "transport", label: "Auto" },
  rickshaw: { slug: "transport", label: "Rickshaw" },
  cab: { slug: "transport", label: "Cab" },
  metro: { slug: "transport", label: "Metro" },
  bus: { slug: "transport", label: "Bus" },
  irctc: { slug: "travel", label: "IRCTC" },
  redbus: { slug: "travel", label: "redBus" },
  petrol: { slug: "transport", label: "Petrol" },
  diesel: { slug: "transport", label: "Diesel" },
  fuel: { slug: "transport", label: "Fuel" },
  "indian oil": { slug: "transport", label: "Indian Oil" },
  // shopping
  amazon: { slug: "shopping", label: "Amazon" },
  flipkart: { slug: "shopping", label: "Flipkart" },
  myntra: { slug: "shopping", label: "Myntra" },
  ajio: { slug: "shopping", label: "Ajio" },
  nykaa: { slug: "personal", label: "Nykaa" },
  meesho: { slug: "shopping", label: "Meesho" },
  "decathlon": { slug: "shopping", label: "Decathlon" },
  // subscriptions / entertainment
  netflix: { slug: "subscriptions", label: "Netflix" },
  spotify: { slug: "subscriptions", label: "Spotify" },
  hotstar: { slug: "subscriptions", label: "Hotstar" },
  "disney hotstar": { slug: "subscriptions", label: "Hotstar" },
  prime: { slug: "subscriptions", label: "Prime Video" },
  "prime video": { slug: "subscriptions", label: "Prime Video" },
  "youtube premium": { slug: "subscriptions", label: "YouTube Premium" },
  "chatgpt": { slug: "subscriptions", label: "ChatGPT" },
  "github copilot": { slug: "subscriptions", label: "GitHub Copilot" },
  "adobe": { slug: "subscriptions", label: "Adobe" },
  "notion": { slug: "subscriptions", label: "Notion" },
  "cloud": { slug: "subscriptions", label: "Cloud" },
  pvr: { slug: "fun", label: "PVR" },
 inox: { slug: "fun", label: "INOX" },
  movie: { slug: "fun", label: "Movie" },
  bookmyshow: { slug: "fun", label: "BookMyShow" },
  // mobile & internet
  jio: { slug: "mobile", label: "Jio" },
  airtel: { slug: "mobile", label: "Airtel" },
  vi: { slug: "mobile", label: "Vi" },
  vodafone: { slug: "mobile", label: "Vi" },
  bsnl: { slug: "mobile", label: "BSNL" },
  recharge: { slug: "mobile", label: "Recharge" },
  wifi: { slug: "mobile", label: "WiFi" },
  broadband: { slug: "mobile", label: "Broadband" },
  // academics
  xerox: { slug: "books", label: "Xerox" },
  photocopy: { slug: "books", label: "Photocopy" },
  printout: { slug: "books", label: "Printout" },
  stationery: { slug: "books", label: "Stationery" },
  notebook: { slug: "books", label: "Notebook" },
  pen: { slug: "books", label: "Stationery" },
  textbook: { slug: "books", label: "Textbook" },
  course: { slug: "academics", label: "Course" },
  udemy: { slug: "academics", label: "Udemy" },
  coursera: { slug: "academics", label: "Coursera" },
  fees: { slug: "academics", label: "Fees" },
  "exam form": { slug: "academics", label: "Exam Form" },
  "semester": { slug: "academics", label: "Semester Fee" },
  "tuition": { slug: "academics", label: "Tuition" },
  lab: { slug: "academics", label: "Lab Fee" },
  // health & personal
  medical: { slug: "health", label: "Medical" },
  chemist: { slug: "health", label: "Chemist" },
  pharmacy: { slug: "health", label: "Pharmacy" },
  "1mg": { slug: "health", label: "1mg" },
  pharmeasy: { slug: "health", label: "PharmEasy" },
  apollo: { slug: "health", label: "Apollo" },
  doctor: { slug: "health", label: "Doctor" },
  gym: { slug: "personal", label: "Gym" },
  "cult.fit": { slug: "personal", label: "Cult.fit" },
  salon: { slug: "personal", label: "Salon" },
  haircut: { slug: "personal", label: "Haircut" },
  laundry: { slug: "laundry", label: "Laundry" },
  dhobi: { slug: "laundry", label: "Dhobi" },
  // income-ish
  salary: { slug: "internship", label: "Salary" },
  stipend: { slug: "internship", label: "Stipend" },
  scholarship: { slug: "scholarship", label: "Scholarship" },
  refund: { slug: "refunds", label: "Refund" },
  cashback: { slug: "refunds", label: "Cashback" },
};

/** Fallback keyword rules (checked against the whole utterance). */
export const KEYWORD_RULES: { slug: string; words: string[] }[] = [
  { slug: "mess", words: ["lunch", "dinner", "breakfast", "mess", "canteen", "thali", "meal", "food", "khana", "hostel food"] },
  { slug: "chai", words: ["chai", "tea", "coffee", "snacks", "samosa", "vada pav", "biscuit", "cold drink", "coldrink", "juice", "lassi", "nasta"] },
  { slug: "delivery", words: ["zomato", "swiggy", "delivery", "ordered", "order", "takeaway", "parcel"] },
  { slug: "groceries", words: ["grocery", "groceries", "vegetables", "sabzi", "milk", "ration", "kirana", "fruits", "eggs"] },
  { slug: "transport", words: ["auto", "cab", "rickshaw", "bus", "metro", "petrol", "fuel", "toll", "parking", "scooter", "bike"] },
  { slug: "hostel", words: ["rent", "hostel", "pg", "deposit", "electricity", "maintenance", "room"] },
  { slug: "academics", words: ["fees", "fee", "tuition", "exam", "semester", "course", "workshop", "certification", "lab", "college"] },
  { slug: "books", words: ["book", "books", "notebook", "stationery", "pen", "xerox", "photocopy", "printout", "notes", "textbook"] },
  { slug: "mobile", words: ["recharge", "wifi", "internet", "data pack", "broadband", "sim", "postpaid", "prepaid"] },
  { slug: "subscriptions", words: ["subscription", "netflix", "spotify", "hotstar", "premium", "membership", "saas", "monthly plan"] },
  { slug: "shopping", words: ["shirt", "shoes", "clothes", "shopping", "dress", "jeans", "sneakers", "gadget", "earphones", "electronics"] },
  { slug: "health", words: ["medicine", "doctor", "clinic", "hospital", "chemist", "tablet", "fever", "checkup", "dentist"] },
  { slug: "fun", words: ["movie", "party", "concert", "game", "bowling", "trip to", "outing", "birthday", "treat"] },
  { slug: "travel", words: ["train", "flight", "ticket", "irctc", "bus ticket", "trip", "hostel to home", "vacation"] },
  { slug: "gifts", words: ["gift", "donation", "bday", "birthday gift", "present", "diwali", "festival"] },
  { slug: "laundry", words: ["laundry", "dhobi", "washing", "dry clean"] },
  { slug: "personal", words: ["haircut", "salon", "grooming", "skincare", "gym", "parlour"] },
  // income
  { slug: "allowance", words: ["pocket money", "allowance", "mom sent", "dad sent", "from mom", "from dad", "from home", "parents"] },
  { slug: "scholarship", words: ["scholarship", "merit", "grant"] },
  { slug: "freelance", words: ["freelance", "client", "project payment", "gig", "fiverr", "upwork"] },
  { slug: "internship", words: ["internship", "stipend", "salary", "paycheck", "payroll"] },
  { slug: "parttime", words: ["part time", "part-time", "tutoring", "shift", "hourly"] },
  { slug: "refunds", words: ["refund", "cashback", "returned", "reimbursed", "got back"] },
];

export const METHOD_KEYWORDS: Record<string, string[]> = {
  UPI: ["upi", "gpay", "google pay", "phonepe", "paytm", "bhim", "cred", "scan", "scanned", "qr", "online", "transferred online"],
  CASH: ["cash", "cash se", "notes", "offline", "paid cash", "by cash", "nakad"],
  CARD: ["card", "credit card", "debit card", "swipe", "swiped", "pos"],
  BANK: ["neft", "imps", "rtgs", "bank transfer", "netbanking", "net banking", "bank"],
};

export const INCOME_KEYWORDS = [
  "received", "recv", "got", "credited", "credit", "earned", "salary", "stipend", "allowance",
  "scholarship", "refund", "cashback", "deposited", "added money", "incoming", "won", "prize",
  "from mom", "from dad", "from home", "milte", "mila", "income", "payment received", "upi cr",
];

export const EXPENSE_KEYWORDS = [
  "spent", "spend", "paid", "pay", "bought", "buy", "purchased", "purchase", "gave", "give",
  "bill", "kharcha", "kharch", "diya", "diye", "lagaya", "lagaye", "paid for", "charged", "debited",
  "upi dr", "sent", "booked", "recharged", "ordered",
];

export const CATEGORY_COLORS = [
  "#f97316", "#ef4444", "#22c55e", "#0ea5e9", "#8b5cf6", "#6366f1", "#14b8a6",
  "#06b6d4", "#ec4899", "#f43f5e", "#eab308", "#3b82f6", "#10b981", "#d946ef",
  "#a16207", "#7dd3fc", "#f472b6", "#94a3b8",
];

export const ACCOUNT_TYPES = [
  { value: "UPI", label: "UPI / Wallet", emoji: "📱", hint: "GPay, PhonePe, Paytm" },
  { value: "CASH", label: "Cash in hand", emoji: "💵", hint: "Physical money" },
  { value: "BANK", label: "Bank account", emoji: "🏦", hint: "Savings / current" },
  { value: "CARD", label: "Card", emoji: "💳", hint: "Debit / credit" },
] as const;

export const PAYMENT_METHODS = [
  { value: "UPI", label: "UPI", emoji: "📱" },
  { value: "CASH", label: "Cash", emoji: "💵" },
  { value: "CARD", label: "Card", emoji: "💳" },
  { value: "BANK", label: "Bank", emoji: "🏦" },
] as const;

export function categorySeedBySlug(slug: string): CategorySeed | undefined {
  return DEFAULT_CATEGORIES.find((c) => c.slug === slug);
}
