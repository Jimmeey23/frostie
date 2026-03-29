import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CalendarDays, History, RotateCcw, Snowflake, Sparkles, Bot } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";
import InteractiveRobotSpline from "@/components/InteractiveRobotSpline";
import WhatsAppWidget from "@/components/WhatsAppWidget";
import { cn } from "@/lib/utils";
import { ROBOT_SPLINE_URL } from "@/lib/galleryImages";

function ElegantShape({
  className,
  delay = 0,
  width = 420,
  height = 120,
  rotate = 0,
  gradient = "from-sky-400/20",
}: {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  gradient?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -120, rotate: rotate - 10 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{
        duration: 2,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.1 },
      }}
      className={cn("absolute pointer-events-none", className)}
    >
      <motion.div
        animate={{ y: [0, 16, 0] }}
        transition={{ duration: 12, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        style={{ width, height }}
        className="relative"
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full border border-white/15 bg-gradient-to-r to-transparent backdrop-blur-[2px] shadow-[0_8px_32px_0_rgba(255,255,255,0.08)]",
            "after:absolute after:inset-0 after:rounded-full after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.18),transparent_70%)]",
            gradient,
          )}
        />
      </motion.div>
    </motion.div>
  );
}

export default function Index() {
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    if (!showChat) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowChat(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showChat]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f7fb] text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.18),transparent_34%),linear-gradient(180deg,#f8fbff_0%,#eef3f9_100%)]" />
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="absolute inset-0 overflow-hidden">
        <ElegantShape
          delay={0.25}
          width={620}
          height={160}
          rotate={10}
          gradient="from-sky-400/25"
          className="left-[-12%] top-[10%]"
        />
        <ElegantShape
          delay={0.45}
          width={520}
          height={130}
          rotate={-14}
          gradient="from-violet-400/25"
          className="right-[-8%] top-[68%]"
        />
        <ElegantShape
          delay={0.35}
          width={300}
          height={90}
          rotate={-6}
          gradient="from-cyan-300/20"
          className="left-[4%] bottom-[8%]"
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between py-2">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-4"
          >
            <img src="/logo.png" alt="Physique 57 India" className="h-10 md:h-11" />
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-xl">
              <Sparkles className="h-4 w-4 text-sky-600" />
              AI-guided support, customized for Physique 57 members
            </div>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            onClick={() => setShowChat(true)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <Bot className="h-4 w-4 text-sky-600" />
            Open Frostie
          </motion.button>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:items-end">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.8 }}
            className="max-w-3xl"
          >
            <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl xl:text-[5.3rem]">
              Meet Frostie,
              <br />
              <span className="bg-gradient-to-r from-sky-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
                your membership concierge
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              A polished, brand-friendly support experience for freezes, unfreezes, restarts, live booking lookups,
              schedule questions, and all-time membership freeze history—without making members dig through menus like it’s 2011.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <motion.button
                onClick={() => setShowChat(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-sky-600 via-blue-600 to-violet-600 px-8 py-4 text-base font-semibold text-white shadow-[0_18px_50px_-18px_rgba(37,99,235,0.7)] transition-all"
              >
                <Snowflake className="h-5 w-5" />
                Start chatting with Frostie
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </motion.button>

            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {[
                { icon: Snowflake, label: "Freeze now / schedule" },
                { icon: RotateCcw, label: "Immediate unfreeze" },
                { icon: History, label: "All-time freeze history" },
                { icon: CalendarDays, label: "Bookings & class schedule" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => setShowChat(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/75 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <Icon className="h-3.5 w-3.5 text-sky-600" />
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { value: "24/7", label: "guided member support" },
                { value: "3 taps", label: "to freeze or resume" },
                { value: "Live", label: "booking & schedule answers" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                  className="rounded-3xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl"
                >
                  <div className="text-3xl font-bold tracking-tight text-slate-950">{stat.value}</div>
                  <div className="mt-1 text-sm font-medium text-slate-500">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 34 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.8 }}
            className="relative hidden self-end lg:block lg:h-[calc(100vh-7rem)] lg:min-h-[760px] lg:max-h-[920px]"
          >
            <div className="absolute inset-x-10 -top-10 h-32 rounded-full bg-sky-400/20 blur-3xl" />
            <div className="absolute inset-x-8 bottom-0 h-36 rounded-full bg-violet-400/20 blur-3xl" />
            <div className="relative flex h-full w-full items-end">
              <InteractiveRobotSpline
                scene={ROBOT_SPLINE_URL}
                className="h-full w-full"
              />
            </div>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowChat(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-2 backdrop-blur-md sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="h-[96vh] w-full max-w-7xl overflow-hidden rounded-[32px] border border-white/40 bg-white/40 shadow-[0_40px_160px_-55px_rgba(15,23,42,0.8)] backdrop-blur-2xl sm:h-[92vh]"
            >
              <ChatInterface onComplete={() => setShowChat(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <WhatsAppWidget />
    </div>
  );
}
