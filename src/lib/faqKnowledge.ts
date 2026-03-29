// Physique 57 India FAQ & Product Knowledge Base
// Used by Frostie to answer general questions about the brand

export interface FaqEntry {
  keywords: string[];
  question: string;
  answer: string;
}

export const FAQ_ENTRIES: FaqEntry[] = [
  // General
  { keywords: ['what is physique 57', 'about physique', 'physique 57'], question: 'What is Physique 57?', answer: 'Physique 57 is a renowned global fitness brand celebrated for its innovative barre-based workouts. In India, we offer a unique experience combining cardio, strength training, and stretching — designed to transform your body safely and effectively! 💪' },
  { keywords: ['benefits', 'advantages'], question: 'Benefits of Physique 57?', answer: 'Physique 57 offers muscle strength & tone, improved posture, enhanced flexibility, increased endurance, and stress reduction. Our workouts are challenging yet accessible, with modifications for all fitness levels! ✨' },
  { keywords: ['beginner', 'all levels', 'fitness level', 'suitable'], question: 'Is it suitable for beginners?', answer: 'Absolutely! Our classes accommodate all fitness levels — from beginners to advanced. The low-impact nature makes it perfect for anyone starting their fitness journey. Our instructors provide modifications to ensure everyone gets the most out of each class! 🌟' },
  { keywords: ['men', 'male', 'guys'], question: 'Can men take classes?', answer: 'Of course! Physique 57 India welcomes everyone regardless of gender. Our workouts benefit anyone looking to improve their fitness. We promote a supportive atmosphere where everyone can thrive! 💯' },
  { keywords: ['pregnant', 'pregnancy', 'prenatal', 'postnatal'], question: 'Is it safe during pregnancy?', answer: 'Yes! We offer prenatal and postnatal modifications, making it safe with healthcare provider clearance. Always consult your doctor before starting any new workout during or after pregnancy. 🤰' },
  { keywords: ['class size', 'how many people', 'participants'], question: 'What is the class size?', answer: 'Most classes have 10-20 participants. We keep classes intimate for personalized attention and individual instruction! 🧘‍♀️' },
  { keywords: ['how often', 'frequency', 'times per week', 'results'], question: 'How often should I attend?', answer: 'For optimal results, we recommend 3-4 classes per week. Consistency is key! Regular attendance paired with a balanced diet helps you achieve your fitness goals faster. 📅' },
  { keywords: ['crosstrain', 'combine', 'other workouts', 'mix'], question: 'Can I crosstrain?', answer: 'Yes! Physique 57 complements other fitness routines beautifully. It builds core strength, flexibility, and endurance that enhances your overall fitness journey. Cross-training is encouraged! 🏋️‍♀️' },
  { keywords: ['cost', 'price', 'pricing', 'how much'], question: 'What do classes cost?', answer: 'Pricing varies by location and package. We offer everything from single classes (₹1,200-₹1,416) to annual unlimited memberships. Check our website or contact the studio for the latest pricing and special offers! 💰' },
  { keywords: ['buy online', 'purchase online', 'book online'], question: 'Can I purchase online?', answer: 'Yes! You can purchase classes online through our website or mobile app. It\'s the easiest way to secure your spot and explore package options! 📱' },

  // Studios
  { keywords: ['location', 'where', 'studio', 'address', 'mumbai'], question: 'Where are the studios?', answer: 'Our studios are located in Mumbai:\n1. Kwality House, August Kranti Rd, Kemps Corner, Grant Road, Mumbai 400036\n2. Lower Parel location\n\nVisit our website for the complete list! 📍' },
  { keywords: ['amenities', 'facilities', 'locker', 'shower', 'towel'], question: 'What amenities are available?', answer: 'Our studios offer locker rooms, showers, complimentary towel service, and a boutique with fitness apparel & accessories. Everything you need for a comfortable workout experience! 🏠' },
  { keywords: ['parking', 'park'], question: 'Is parking available?', answer: 'Parking varies by location. Please contact your local studio for specific parking info. We recommend checking availability ahead of your visit! 🚗' },
  { keywords: ['childcare', 'children', 'kids'], question: 'Is childcare available?', answer: 'Our studios are designed as adult-focused environments and don\'t offer childcare services. Please arrange childcare before attending classes. 👶' },
  { keywords: ['food', 'drinks', 'snacks', 'beverages'], question: 'Food & drinks?', answer: 'Yes! We offer healthy snacks and beverages for purchase. A post-workout snack helps with recovery and hydration! 🥤' },
  { keywords: ['accessible', 'disability', 'wheelchair'], question: 'Accessibility?', answer: 'Yes, our studios are designed to be accessible with wheelchair access. We\'re committed to providing an inclusive environment for all clients! ♿' },
  { keywords: ['guest', 'friend', 'bring someone'], question: 'Can I bring a guest?', answer: 'Yes! Guests must sign a waiver and show valid ID. Bringing a friend makes the experience even better! 👯' },

  // Method
  { keywords: ['method', 'approach', 'technique', 'how it works'], question: 'What is the Physique 57 method?', answer: 'Our method combines isometric exercises (targeting specific muscles), ballet barre (for support & resistance), and interval overload (muscles worked to fatigue then immediately stretched). This promotes lean muscle development and boosts metabolism! 🩰' },
  { keywords: ['history', 'founded', 'founder', 'mallika'], question: 'History of Physique 57 India?', answer: 'Founded by Mallika Parekh, an accomplished entrepreneur passionate about health & wellness. Inspired by the global brand, the Indian franchise has built a loyal community with effective workouts and a supportive atmosphere! 🇮🇳' },
  { keywords: ['science', 'research', 'physiology'], question: 'Science behind it?', answer: 'Based on exercise physiology research — the combination of isometric exercises and interval workouts maximizes results while minimizing injury risk. Studies show significant improvements in strength, flexibility, and overall fitness! 🔬' },
  { keywords: ['barre', 'ballet barre', 'bar'], question: 'Role of the ballet barre?', answer: 'The barre provides stability during exercises, enhances muscle engagement through resistance, and helps maintain proper posture and alignment. It\'s fundamental to our method! 🩰' },
  { keywords: ['stretching', 'flexibility', 'stretch'], question: 'How is stretching incorporated?', answer: 'Stretching is integrated throughout sessions — fluid transitions between intense muscle work aid recovery, elongate muscles, enhance flexibility, and prevent injury! 🧘' },

  // powerCycle
  { keywords: ['powercycle', 'cycling', 'indoor cycling', 'spin', 'bike'], question: 'What is powerCycle?', answer: 'powerCycle is our indoor cycling program combining rhythm-driven rides with meaningful resistance. Sync your pedal strokes to the beat of the music for an engaging, effective workout! Available in 30 and 45-minute formats. 🚴‍♀️' },
  { keywords: ['cycling shoes', 'shoes', 'footwear'], question: 'Do I need special shoes?', answer: 'While sneakers work, we recommend our specialty indoor cycling shoes for the best grip and support. They really enhance your performance on the bike! 👟' },
  { keywords: ['cycling track', 'wattage', 'rpm', 'progress cycling'], question: 'Tracking progress in powerCycle?', answer: 'Track your wattage, distance (km), and RPM on our state-of-the-art bikes. These metrics help you monitor performance and see improvements over time! 📊' },

  // Class formats
  { keywords: ['class level', 'foundations', 'barre 57', 'sweat', 'fit', 'cardio barre', 'class format', 'types of classes'], question: 'What class formats are offered?', answer: 'We offer: **Foundations** (beginner-friendly), **Barre 57** (dynamic, high-intensity), **SWEAT in 30** (HIIT-style), **FIT** (strength-based intervals), **Cardio Barre** (barre + cardio), **Mat 57** (Pilates-inspired core), **Recovery** (stretching & restoration), and **powerCycle** (indoor cycling). Something for everyone! 🎯' },
  { keywords: ['duration', 'how long', 'minutes'], question: 'How long are classes?', answer: 'Most classes last 30-60 minutes. SWEAT in 30 is perfect for quick workouts, while Barre 57 and FIT offer full 57-minute sessions! ⏱️' },
  { keywords: ['cancel', 'cancellation policy', 'late cancel'], question: 'Cancellation policy?', answer: 'Cancellations must be made at least 12 hours before class start time. Late cancellations may result in class deductions from your package. Plan ahead to keep your credits! ⚠️' },
  { keywords: ['what to wear', 'attire', 'clothing', 'dress code'], question: 'What should I wear?', answer: 'Wear comfortable, breathable athletic wear — sports bra, tank top or t-shirt, and leggings or shorts. Grip socks are recommended for barre classes! 👕' },
  { keywords: ['arrive early', 'first time', 'new client', 'newcomer'], question: 'First time tips?', answer: 'New clients should arrive 15 minutes early for bike fitting (powerCycle) or to get oriented. Our staff will help you get set up and feel comfortable! Bring water and a towel. 🆕' },
  { keywords: ['injury', 'limitation', 'modification', 'concern'], question: 'What if I have injuries?', answer: 'Our instructors screen for injuries before class. You can privately discuss any concerns and receive modifications for a safe, effective workout tailored to your needs! 🏥' },

  // Memberships & Packages
  { keywords: ['membership', 'package', 'plan', 'subscribe', 'options'], question: 'What memberships are available?', answer: 'We offer:\n• **Single Class**: ₹1,416\n• **2-for-1 Newcomer**: ₹1,770\n• **4 Class Pack**: ₹6,313\n• **8 Class Pack**: ₹12,036\n• **12 Class Pack**: ₹17,759\n• **2 Week Unlimited**: ₹10,030\n• **1 Month Unlimited**: ₹17,995\n• **3 Month Unlimited**: ₹51,330\n• **6 Month Unlimited**: ₹92,394\n• **Annual Unlimited**: ₹194,700\n\nAll prices include 18% GST. Contact us for current offers! 💳' },
  { keywords: ['freeze policy', 'freeze rules', 'freeze allowance', 'how many freezes'], question: 'Freeze policy?', answer: 'Freeze allowances vary by membership:\n• 2 Week / 4 Class: No freezes\n• 1 Month / 8 Class: 1 freeze (up to 30 days)\n• 3 Month / 12 Class: 1-3 freezes\n• 6 Month: 6 freezes\n• Annual: 12 freezes\nEach freeze can be up to 30 days max! ❄️' },
];

export function findFaqAnswer(query: string): string | null {
  const q = query.toLowerCase().trim();
  
  // Score each entry by keyword matches
  let bestMatch: FaqEntry | null = null;
  let bestScore = 0;

  for (const entry of FAQ_ENTRIES) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw.toLowerCase())) {
        score += kw.length; // Longer keyword matches score higher
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  // Require a minimum match quality
  if (bestMatch && bestScore >= 3) {
    return bestMatch.answer;
  }
  return null;
}
