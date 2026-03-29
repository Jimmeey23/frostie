import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Snowflake, History, RotateCcw } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";
import WhatsAppWidget from "@/components/WhatsAppWidget";

export default function Index() {
  const [showChat, setShowChat] = useState(false);

  if (showChat) {
    return (
      <div className="min-h-screen bg-background">
        <ChatInterface onComplete={() => setShowChat(false)} />
        <WhatsAppWidget />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Hero background */}
      <div className="absolute inset-0">
        <img
          src="https://i.postimg.cc/Bvc0Nwhn/hp-Img-1774432711.jpg"
          alt="Physique 57 India Studio"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Logo */}
        <header className="p-6 md:p-8">
          <motion.img
            src="/logo.png"
            alt="Physique 57 India"
            className="h-10 md:h-12 brightness-0 invert"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          />
        </header>

        {/* Hero text + CTA */}
        <div className="flex-1 flex items-end pb-16 md:pb-24 px-6 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="max-w-lg"
          >
            <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4 leading-tight tracking-tight">
              Your Membership,<br />
              <span className="text-blue-300">Your Control</span>
            </h1>
            <p className="text-white/60 text-base md:text-lg mb-8 leading-relaxed max-w-md">
              Freeze, modify, or restart your membership in seconds. Our friendly assistant Frostie is here to help! ❄️
            </p>

            <motion.button
              onClick={() => setShowChat(true)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-white text-foreground font-display font-bold text-base shadow-2xl shadow-black/30 hover:shadow-white/20 transition-all"
            >
              <Snowflake className="h-5 w-5 text-blue-500" />
              Chat with Frostie
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </motion.button>

            {/* Quick links */}
            <div className="flex flex-wrap gap-3 mt-6">
              {[
                { icon: Snowflake, label: "Freeze" },
                { icon: RotateCcw, label: "Restart" },
                { icon: History, label: "History" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => setShowChat(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white/70 text-xs font-medium hover:bg-white/20 hover:text-white transition-all"
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <WhatsAppWidget />
    </div>
  );
}
