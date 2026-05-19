import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, differenceInDays } from "date-fns";
import confetti from "canvas-confetti";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  User, Mail, Phone, CalendarIcon, Snowflake, Loader2, CheckCircle2,
  AlertTriangle, Clock, ArrowRight, RotateCcw, Shield, MapPin, History,
  FileText, RefreshCw, ArrowLeft, Ban, XCircle, Send, Download,
  FileDown, ImageDown, ChevronDown, Info, Zap, BookOpen, MessageCircle,
  Play, Calendar as CalendarList, Sparkles, X
} from "lucide-react";
import { sendOtp, memberLookup, freezeMembership, unfreezeMembership, restartMembership, sendConfirmation, freezeHistory, memberBookings, sessionsList } from "@/lib/momenceApi";
import { findFaqAnswer } from "@/lib/faqKnowledge";
import frostieAvatar from "@/assets/frostie-avatar.png";
import InteractiveRobotSpline from "@/components/InteractiveRobotSpline";
import { ROBOT_SPLINE_URL } from "@/lib/galleryImages";

type Step =
  | 'welcome' | 'ask-name' | 'ask-email' | 'ask-phone'
  | 'otp' | 'operation' | 'memberships'
  | 'freeze-reason' | 'freeze-dates' | 'freeze-mode' | 'modify-unfreeze' | 'unfreeze-mode'
  | 'confirm' | 'processing' | 'success' | 'history' | 'chat';

type Operation = 'freeze' | 'modify' | 'restart' | 'history' | 'bookings' | 'schedule' | 'ask';

interface ChatMsg {
  id: string;
  role: 'bot' | 'user';
  text: string;
  widget?: string;
  widgetData?: any;
  dismissed?: boolean;
  isTyping?: boolean;
  timestamp?: Date;
}

interface MembershipView {
  id: number; type: string; startDate: string; endDate: string; isFrozen: boolean;
  scheduledFreezeAt: string | null; scheduledUnfreezeAt: string | null;
  freeze: any; location: string;
  membership: { id: number; name: string; description?: string; duration: number; durationUnit: string };
  freezePolicy: { name: string; attempts: number; days: number } | null;
  freezeUsage: { attemptsUsed: number; frozenDaysUsed: number; intervals: any[] };
  freezeEligibility: { eligible: boolean; reason: string; attemptsRemaining: number; daysRemaining: number; maxWindowDays: number };
  actions: { canFreeze: boolean; canUnfreeze: boolean; canRemoveScheduledFreeze: boolean; canRemoveScheduledUnfreeze: boolean };
}

interface FreezeHistoryRow {
  membershipId: number;
  membershipName: string;
  location: string;
  startDate: string;
  endDate: string;
  isFrozen: boolean;
  isExpired?: boolean;
  scheduledFreezeAt: string | null;
  scheduledUnfreezeAt: string | null;
  freezePolicy: { name: string; attempts: number; days: number } | null;
  freezeUsage: { attemptsUsed: number; frozenDaysUsed: number; intervals: any[] };
  freezeEligibility: { eligible: boolean; reason: string; attemptsRemaining: number; daysRemaining: number };
}

let msgId = 0;
const nextId = () => `msg-${++msgId}`;

const AGENT_NAME = "Frostie";

const FREEZE_REASONS = [
  { id: 'travel', emoji: '✈️', label: 'Travel / Vacation' },
  { id: 'health', emoji: '🏥', label: 'Health / Injury' },
  { id: 'work', emoji: '💼', label: 'Work / Schedule' },
  { id: 'personal', emoji: '🏠', label: 'Personal Reasons' },
  { id: 'other', emoji: '💬', label: 'Something Else' },
];

const WITTY_QUOTA_MESSAGES = [
  "Uh oh! Looks like you've used up all your freeze cards! 🃏 Even Frostie can't conjure more freeze days out of thin air!",
  "Brrr... your freeze account is running on empty! ❄️ You've squeezed every last snowflake out of this one!",
  "Hold up, superstar! 🌟 Your freeze quota has left the building. Time to hit the barre instead!",
  "Looks like someone's been on quite a few adventures! 🧳 No more freeze days left though — gotta work those muscles now!",
  "Your freeze bank account balance: $0.00 ❄️💸 Time to invest in some squats instead!",
];

const SUCCESS_MESSAGES: Record<string, string[]> = {
  travel: [
    "Bon voyage! ✈️🌍 Your membership is frozen and waiting for you when you get back. Safe travels!",
    "Happy trails! 🧳 Your membership is on ice. Enjoy every moment of your trip!",
    "Off you go, jet-setter! 🛫 Membership frozen. Send us a postcard! 😄",
  ],
  health: [
    "Take all the time you need! 💪 Your membership is safe and sound. Wishing you a speedy recovery!",
    "Rest up, warrior! 🌿 We've put everything on pause. Can't wait to see you back and stronger!",
  ],
  work: [
    "All work and no play... but at least your membership is safe! 💼 See you when things ease up!",
    "Hustle mode: ON. Freeze mode: also ON! 😎 Your spot is saved.",
  ],
  personal: [
    "No worries at all! 🤗 Your membership is snugly frozen. We'll be here whenever you're ready!",
    "Life happens! Your membership is safely on ice. Take your time! ❄️",
  ],
  other: [
    "All done! ✨ Your membership is frozen and we'll keep it cozy until you're back!",
    "Consider it done! 🎉 Membership on pause. See you soon!",
  ],
  default: [
    "All done! ✅ Your membership has been updated successfully. A confirmation email is on its way!",
    "Sorted! 🎉 Everything's taken care of. Check your inbox for the confirmation!",
  ],
};

function getSuccessMessage(reason?: string, operation?: string): string {
  if (operation === 'restart') return "Your membership is back in action! 🚀 Time to crush those workouts!";
  if (operation === 'modify') return "Unfreeze scheduled! 📅 We'll thaw things out right on time!";
  const pool = SUCCESS_MESSAGES[reason || 'default'] || SUCCESS_MESSAGES.default;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getQuotaMessage(): string {
  return WITTY_QUOTA_MESSAGES[Math.floor(Math.random() * WITTY_QUOTA_MESSAGES.length)];
}

function getIneligibleBadge(m: MembershipView): { text: string; color: string } | null {
  if (m.actions.canFreeze) return null;
  if (m.isFrozen) return { text: "Currently Frozen", color: "bg-blue-100 text-blue-700 border-blue-200" };
  if (!m.freezePolicy) return { text: "No Freeze Policy", color: "bg-gray-100 text-gray-600 border-gray-200" };
  if (m.freezeEligibility.attemptsRemaining <= 0) return { text: "Attempts Exhausted", color: "bg-red-100 text-red-600 border-red-200" };
  if (m.freezeEligibility.daysRemaining <= 0) return { text: "Days Exhausted", color: "bg-red-100 text-red-600 border-red-200" };
  return { text: m.freezeEligibility.reason, color: "bg-amber-100 text-amber-700 border-amber-200" };
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isInlineInputWidget(widget?: string) {
  return [
    'ask-name-input',
    'ask-email-input',
    'ask-phone-input',
    'otp',
    'chat-input',
  ].includes(widget || '');
}

export default function ChatInterface({ onComplete }: { onComplete?: () => void }) {
  const [testMode, setTestMode] = useState(false);
  const [step, setStep] = useState<Step>('welcome');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [chatInput, setChatInput] = useState('');

  const [otpCode, setOtpCode] = useState('');
  const [serverOtp, setServerOtp] = useState('');

  const [memberId, setMemberId] = useState<number>(0);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberships, setMemberships] = useState<MembershipView[]>([]);

  const [operation, setOperation] = useState<Operation>('freeze');
  const [selectedMembership, setSelectedMembership] = useState<MembershipView | null>(null);
  const [freezeReason, setFreezeReason] = useState('');

  const [freezeStartDate, setFreezeStartDate] = useState<Date>();
  const [freezeEndDate, setFreezeEndDate] = useState<Date>();
  const [unfreezeDate, setUnfreezeDate] = useState<Date>();

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);
  const [confirmDetails, setConfirmDetails] = useState<{ title: string; lines: string[] }>({ title: '', lines: [] });

  const [historyRows, setHistoryRows] = useState<FreezeHistoryRow[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, 150);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, step, scrollToBottom]);

  useEffect(() => {
    addBotDelayed(`Hey there! 👋 I'm **${AGENT_NAME}**, your friendly wellness assistant at Physique 57 India! I'm here to help with freezes, bookings, schedules, and anything P57-related.`, 400, () => {
      addBotDelayed("Let's get started! What's your **full name** (first & last)?", 800, undefined, 'ask-name-input');
      setStep('ask-name');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissWidgets = useCallback(() => {
    setMessages(prev => prev.map(m => m.widget && !m.dismissed ? { ...m, dismissed: true } : m));
  }, []);

  const addBot = useCallback((text: string, widget?: string, widgetData?: any) => {
    setMessages(p => [...p, { id: nextId(), role: 'bot', text, widget, widgetData, timestamp: new Date() }]);
  }, []);

  const addBotDelayed = useCallback((text: string, delay: number, afterCb?: () => void, widget?: string, widgetData?: any) => {
    const typingId = nextId();
    setMessages(p => [...p, { id: typingId, role: 'bot', text: '', isTyping: true }]);
    typingTimeoutRef.current = window.setTimeout(() => {
      setMessages(p => p.filter(m => m.id !== typingId));
      setMessages(p => [...p, { id: nextId(), role: 'bot', text, widget, widgetData, timestamp: new Date() }]);
      afterCb?.();
    }, delay);
  }, []);

  const addUser = useCallback((text: string) => {
    dismissWidgets();
    setMessages(p => [...p, { id: nextId(), role: 'user', text, timestamp: new Date() }]);
  }, [dismissWidgets]);

  useEffect(() => {
    return () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); };
  }, []);

  // ─── Handlers ───

  const handleNameSubmit = () => {
    const trimmed = nameInput.trim();
    if (!trimmed || !trimmed.includes(' ')) return;
    const parts = trimmed.split(/\s+/);
    setFirstName(parts[0]);
    setLastName(parts.slice(1).join(' '));
    addUser(trimmed);
    setNameInput('');
    addBotDelayed(`Lovely to meet you, **${parts[0]}**! 😊 Now, what's your **email address**?`, 600, undefined, 'ask-email-input');
    setStep('ask-email');
  };

  const handleEmailSubmit = () => {
    const trimmed = emailInput.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    setEmail(trimmed);
    addUser(trimmed);
    setEmailInput('');
    addBotDelayed("Perfect! And lastly, your **phone number** (with country code)?", 600, undefined, 'ask-phone-input');
    setStep('ask-phone');
  };

  const handlePhoneSubmit = async () => {
    const trimmed = phoneInput.trim();
    if (!trimmed || trimmed.length < 6) return;
    let cc = countryCode;
    let num = trimmed;
    if (trimmed.startsWith('+')) {
      const match = trimmed.match(/^(\+\d{1,4})\s*(.+)$/);
      if (match) { cc = match[1]; num = match[2].replace(/\s/g, ''); }
    }
    setCountryCode(cc);
    setPhone(num);
    addUser(`${cc} ${num}`);
    setPhoneInput('');
    setIsLoading(true);

    try {
      if (testMode) {
        addBotDelayed("⚡ Test mode — skipping verification. Looking up your account...", 500, async () => {
          try {
            const result = await memberLookup(email);
            setMemberId(result.member.id);
            setMemberName(`${result.member.firstName} ${result.member.lastName}`);
            setMemberEmail(result.member.email);
            setMemberships(result.memberships || []);
            addBot(`Welcome back, **${result.member.firstName}**! 🎉 I found ${result.memberships?.length || 0} active membership(s). How can I help you today?`, 'operations');
            setStep('operation');
          } catch (e: any) {
            addBot(`❌ ${e.message}. Let's try again!`, 'ask-name-input');
            setStep('ask-name');
          } finally { setIsLoading(false); }
        });
      } else {
        addBotDelayed(`📧 Sending a verification code to **${email}**...`, 500, async () => {
          try {
            const otpResult = await sendOtp(email);
            setServerOtp(otpResult.otp);
            addBot("Code sent! 🔐 Please enter the 6-digit verification code below.", 'otp');
            setStep('otp');
          } catch (e: any) {
            addBot(`❌ ${e.message}. Please try again.`, 'ask-name-input');
            setStep('ask-name');
          } finally { setIsLoading(false); }
        });
      }
    } catch { setIsLoading(false); }
  };

  const handleOtpVerify = async () => {
    if (otpCode !== serverOtp) {
      addBot("❌ Hmm, that code doesn't match. Let's try again!", 'otp');
      setOtpCode('');
      return;
    }
    addUser(`Code: ••••${otpCode.slice(-2)}`);
    setIsLoading(true);
    addBotDelayed("✅ Verified! Let me pull up your account...", 600, async () => {
      try {
        const result = await memberLookup(email);
        setMemberId(result.member.id);
        setMemberName(`${result.member.firstName} ${result.member.lastName}`);
        setMemberEmail(result.member.email);
        setMemberships(result.memberships || []);
        addBot(`Welcome back, **${result.member.firstName}**! 🎉 I found ${result.memberships?.length || 0} active membership(s). How can I help you today?`, 'operations');
        setStep('operation');
      } catch (e: any) { addBot(`❌ ${e.message}`); }
      finally { setIsLoading(false); }
    });
  };

  const handleOperation = async (op: Operation) => {
    setOperation(op);
    const labels: Record<Operation, string> = {
      freeze: '❄️ Freeze Membership', modify: '🔧 Modify Frozen Membership',
      restart: '🔄 Restart Membership', history: '📋 View Freeze History',
      bookings: '📖 My Bookings & Visits', schedule: '🗓️ Class Schedule',
      ask: '💬 Ask a Question',
    };
    addUser(labels[op]);

    if (op === 'ask') {
      addBotDelayed("Sure! Ask me anything about Physique 57 — classes, memberships, schedules, the method, or anything else! I'm all ears 👂✨", 600, undefined, 'chat-input');
      setStep('chat');
      return;
    }

    if (op === 'bookings') {
      setIsLoading(true);
      try {
        const result = await memberBookings(memberId);
        const bookings = result.payload || [];
        if (bookings.length === 0) {
          addBotDelayed("Looks like you don't have any bookings yet! Ready to book your first class? 🎯", 600, undefined, 'operations');
        } else {
          addBotDelayed(`Here are your recent bookings (${bookings.length} found):`, 600, undefined, 'bookings-list', bookings);
        }
      } catch (e: any) { addBot(`❌ ${e.message}`); }
      finally { setIsLoading(false); }
      return;
    }

    if (op === 'schedule') {
      setIsLoading(true);
      try {
        const now = new Date();
        const weekAhead = addDays(now, 7);
        const result = await sessionsList({ startDate: now.toISOString(), endDate: weekAhead.toISOString() });
        const sessions = result.payload || [];
        if (sessions.length === 0) {
          addBotDelayed("No upcoming classes found this week. Check back later! 🗓️", 600, undefined, 'operations');
        } else {
          addBotDelayed(`Here are the upcoming classes this week (${sessions.length} sessions):`, 600, undefined, 'schedule-list', sessions);
        }
      } catch (e: any) { addBot(`❌ ${e.message}`); }
      finally { setIsLoading(false); }
      return;
    }

    if (op === 'history') {
      setIsLoading(true);
      try {
        const result = await freezeHistory(email);
        setHistoryRows(result.rows || []);
        addBotDelayed("Here's your complete freeze history across **all** memberships (including expired ones) 📊", 600, undefined, 'history-table', result.rows);
        setStep('history');
      } catch (e: any) { addBot(`❌ ${e.message}`); }
      finally { setIsLoading(false); }
      return;
    }

    if (op === 'freeze') {
      const hasEligible = memberships.some(m => m.actions.canFreeze);
      if (!hasEligible) {
        addBotDelayed(getQuotaMessage(), 700, () => { addBot("Would you like to try something else?", 'operations'); });
        return;
      }
      addBotDelayed("Here are your memberships. Tap an eligible one to continue: 👇", 600, undefined, 'memberships-all');
      setStep('memberships');
      return;
    }

    // modify or restart
    const filtered = memberships.filter(m => m.isFrozen || m.actions.canRemoveScheduledFreeze);
    if (filtered.length === 0) {
      addBotDelayed("Hmm, no frozen memberships found! 🤔 Would you like to try something else?", 600, undefined, 'operations');
      return;
    }
    addBotDelayed(`Here are your ${op === 'modify' ? 'frozen' : ''} memberships:`, 600, undefined, 'memberships');
    setStep('memberships');
  };

  const handleMembershipSelect = (m: MembershipView) => {
    setSelectedMembership(m);
    addUser(`Selected: ${m.membership.name}`);

    if (operation === 'freeze') {
      addBotDelayed("Before we freeze — mind telling me why? (Totally optional but helps us personalise! 😄)", 600, undefined, 'freeze-reason');
      setStep('freeze-reason');
    } else if (operation === 'modify') {
      // For modify, offer both schedule-unfreeze and unfreeze-now
      addBotDelayed("How would you like to unfreeze this membership?", 600, undefined, 'unfreeze-mode');
      setStep('unfreeze-mode');
    } else if (operation === 'restart') {
      setConfirmDetails({
        title: 'Restart Membership',
        lines: [
          `Membership: ${m.membership.name}`,
          m.isFrozen ? 'This will unfreeze the membership immediately.' : 'This will cancel the scheduled freeze.',
        ],
      });
      setConfirmAction(() => async () => {
        await restartMembership(memberId, m.id, memberName, memberEmail);
        try { await sendConfirmation({ to: memberEmail, memberName, membershipName: m.membership.name, action: 'restart' }); } catch (e) { console.error('Confirmation email failed:', e); }
      });
      setShowConfirm(true);
    }
  };

  const handleReasonSelect = (reasonId: string) => {
    const reason = FREEZE_REASONS.find(r => r.id === reasonId);
    setFreezeReason(reasonId);
    addUser(`${reason?.emoji} ${reason?.label}`);
    if (!selectedMembership) return;
    // Offer freeze mode choice
    addBotDelayed("Would you like to freeze **right now** or **schedule it** for specific dates?", 600, undefined, 'freeze-mode');
    setStep('freeze-mode');
  };

  const handleSkipReason = () => {
    setFreezeReason('');
    addUser("Skip — no reason");
    if (!selectedMembership) return;
    addBotDelayed("Would you like to freeze **right now** or **schedule it** for specific dates?", 600, undefined, 'freeze-mode');
    setStep('freeze-mode');
  };

  const handleFreezeNow = () => {
    if (!selectedMembership) return;
    addUser("⚡ Freeze Now");
    setConfirmDetails({
      title: 'Freeze Immediately',
      lines: [
        `Membership: ${selectedMembership.membership.name}`,
        'This will freeze your membership right now.',
        'You can unfreeze it later from this portal.',
      ],
    });
    setConfirmAction(() => async () => {
      await freezeMembership({
        memberId, boughtMembershipId: selectedMembership.id,
        startDate: new Date().toISOString(), endDate: '',
        operation: 'freeze-now', memberName, memberEmail,
      });
      try {
        await sendConfirmation({
          to: memberEmail, memberName, membershipName: selectedMembership.membership.name,
          action: 'freeze', freezeStart: new Date().toISOString(),
        });
      } catch (e) { console.error('Confirmation email failed:', e); }
    });
    setShowConfirm(true);
  };

  const handleScheduleFreeze = () => {
    if (!selectedMembership) return;
    addUser("📅 Schedule Freeze");
    addBotDelayed(`Choose your freeze window below. You have **${selectedMembership.freezeEligibility.daysRemaining} day(s)** remaining (max 30 per freeze). ❄️`, 600, undefined, 'freeze-dates');
    setStep('freeze-dates');
  };

  const handleUnfreezeNow = () => {
    if (!selectedMembership) return;
    addUser("⚡ Unfreeze Now");
    setConfirmDetails({
      title: 'Unfreeze Immediately',
      lines: [
        `Membership: ${selectedMembership.membership.name}`,
        'This will unfreeze your membership right now and resume it immediately.',
      ],
    });
    setConfirmAction(() => async () => {
      await unfreezeMembership({
        memberId, boughtMembershipId: selectedMembership.id,
        operation: 'unfreeze-now', memberName, memberEmail,
      });
      try {
        await sendConfirmation({
          to: memberEmail, memberName, membershipName: selectedMembership.membership.name,
          action: 'unfreeze',
        });
      } catch (e) { console.error('Confirmation email failed:', e); }
    });
    setShowConfirm(true);
  };

  const handleScheduleUnfreeze = () => {
    addUser("📅 Schedule Unfreeze");
    addBotDelayed("When would you like this membership to unfreeze? (Max 30 days from now)", 600, undefined, 'modify-unfreeze');
    setStep('modify-unfreeze');
  };

  const handleFreezeSubmit = () => {
    if (!freezeStartDate || !freezeEndDate || !selectedMembership) return;
    const days = differenceInDays(freezeEndDate, freezeStartDate) + 1;
    const resumeDate = addDays(freezeEndDate, 1);

    setConfirmDetails({
      title: 'Confirm Freeze',
      lines: [
        `Membership: ${selectedMembership.membership.name}`,
        `Freeze: ${format(freezeStartDate, 'dd MMM yyyy')} → ${format(freezeEndDate, 'dd MMM yyyy')} (${days} days)`,
        `Resume: ${format(resumeDate, 'dd MMM yyyy')}`,
        ...(freezeReason ? [`Reason: ${FREEZE_REASONS.find(r => r.id === freezeReason)?.label || freezeReason}`] : []),
      ],
    });
    setConfirmAction(() => async () => {
      await freezeMembership({
        memberId, boughtMembershipId: selectedMembership.id,
        startDate: freezeStartDate.toISOString(), endDate: freezeEndDate.toISOString(),
        operation: 'scheduled-window', memberName, memberEmail,
      });
      try {
        await sendConfirmation({
          to: memberEmail, memberName, membershipName: selectedMembership.membership.name,
          action: 'freeze', freezeStart: freezeStartDate.toISOString(),
          freezeEnd: freezeEndDate.toISOString(), resumeDate: addDays(freezeEndDate, 1).toISOString(),
        });
      } catch (e) { console.error('Confirmation email failed:', e); }
    });
    setShowConfirm(true);
  };

  const handleUnfreezeSubmit = () => {
    if (!unfreezeDate || !selectedMembership) return;
    const resumeDate = addDays(unfreezeDate, 1);
    setConfirmDetails({
      title: 'Schedule Unfreeze',
      lines: [
        `Membership: ${selectedMembership.membership.name}`,
        `Unfreeze on: ${format(unfreezeDate, 'dd MMM yyyy')}`,
        `Resume on: ${format(resumeDate, 'dd MMM yyyy')}`,
      ],
    });
    setConfirmAction(() => async () => {
      await unfreezeMembership({
        memberId, boughtMembershipId: selectedMembership.id,
        unfreezeDate: unfreezeDate.toISOString(), operation: 'schedule-unfreeze', memberName, memberEmail,
      });
      try {
        await sendConfirmation({
          to: memberEmail, memberName, membershipName: selectedMembership.membership.name,
          action: 'unfreeze', unfreezeDate: unfreezeDate.toISOString(),
          resumeDate: addDays(unfreezeDate, 1).toISOString(),
        });
      } catch (e) { console.error('Confirmation email failed:', e); }
    });
    setShowConfirm(true);
  };

  const fireConfetti = () => {
    const duration = 2000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#3b82f6', '#8b5cf6', '#ec4899'] });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#10b981', '#f59e0b', '#06b6d4'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };

  const handleConfirmExecute = async () => {
    setShowConfirm(false);
    addBot("⏳ Processing your request...");
    setIsLoading(true);
    try {
      if (confirmAction) await confirmAction();
      const msg = getSuccessMessage(freezeReason, operation);
      fireConfetti();
      addBotDelayed(msg, 800, undefined, 'success');
      setStep('success');
    } catch (e: any) {
      const errMsg = e.message || 'Something went wrong';
      if (errMsg.toLowerCase().includes('limit') || errMsg.toLowerCase().includes('exceed') || errMsg.toLowerCase().includes('remaining')) {
        addBotDelayed(getQuotaMessage(), 600, () => { addBot("Would you like to try something else?", 'operations'); });
      } else {
        addBot(`❌ Oops! ${errMsg}. Want to give it another shot?`, 'operations');
      }
      setStep('operation');
    } finally { setIsLoading(false); }
  };

  const handleBackToOperations = () => {
    dismissWidgets();
    addBotDelayed("What else can I help you with? 😊", 400, undefined, 'operations');
    setStep('operation');
  };

  const handleGoHome = () => { onComplete?.(); };

  // ─── Chat / FAQ handler ───
  const handleChatSubmit = async () => {
    const q = chatInput.trim();
    if (!q) return;
    addUser(q);
    setChatInput('');

    // Try FAQ first
    const faqAnswer = findFaqAnswer(q);
    if (faqAnswer) {
      addBotDelayed(faqAnswer, 600, undefined, 'chat-input');
      return;
    }

    // Default helpful response
    addBotDelayed("That's a great question! 🤔 I'm not 100% sure about that one — but our team would love to help! You can reach us on WhatsApp or at the studio. Is there anything else I can help with?", 700, undefined, 'chat-input');
  };

  // ─── Export handlers ───

  const exportCSV = (rows: FreezeHistoryRow[]) => {
    const headers = ['Membership', 'Status', 'Location', 'Membership Start', 'Membership End', 'Freeze #', 'Freeze Start', 'Freeze End', 'Duration (days)', 'Status', 'Policy', 'Attempts Used', 'Attempts Left', 'Days Used', 'Days Left'];
    const csvRows = [headers.join(',')];
    rows.forEach(row => {
      const membershipStatus = row.isExpired ? 'Expired' : (row.isFrozen ? 'Frozen' : 'Active');
      if (row.freezeUsage?.intervals?.length > 0) {
        row.freezeUsage.intervals.forEach((interval: any, idx: number) => {
          const start = new Date(interval.freezeAt);
          const end = interval.unfreezeAt ? new Date(interval.unfreezeAt) : null;
          const days = end ? differenceInDays(end, start) + 1 : differenceInDays(new Date(), start) + 1;
          csvRows.push([
            `"${row.membershipName}"`, membershipStatus, `"${row.location}"`,
            new Date(row.startDate).toLocaleDateString(), new Date(row.endDate).toLocaleDateString(),
            idx + 1, start.toLocaleDateString(), end ? end.toLocaleDateString() : 'Ongoing',
            days, interval.unfreezeAt ? 'Completed' : 'Active',
            row.freezePolicy?.name || 'None',
            row.freezeUsage.attemptsUsed, row.freezeEligibility.attemptsRemaining,
            row.freezeUsage.frozenDaysUsed, row.freezeEligibility.daysRemaining,
          ].join(','));
        });
      } else {
        csvRows.push([
          `"${row.membershipName}"`, membershipStatus, `"${row.location}"`,
          new Date(row.startDate).toLocaleDateString(), new Date(row.endDate).toLocaleDateString(),
          '-', '-', '-', '-', 'No History',
          row.freezePolicy?.name || 'None', 0, row.freezeEligibility?.attemptsRemaining ?? '-',
          0, row.freezeEligibility?.daysRemaining ?? '-',
        ].join(','));
      }
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `freeze-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportPDF = async (rows: FreezeHistoryRow[]) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(18);
    doc.text('Freeze History Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Member: ${memberName} | Email: ${memberEmail}`, 14, 28);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, 14, 34);

    let y = 44;
    rows.forEach(row => {
      if (y > 180) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const statusTag = row.isExpired ? ' [EXPIRED]' : (row.isFrozen ? ' [FROZEN]' : '');
      doc.text(`${row.membershipName}${statusTag} — ${row.location}`, 14, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Period: ${new Date(row.startDate).toLocaleDateString()} → ${new Date(row.endDate).toLocaleDateString()}`, 14, y);
      y += 5;
      if (row.freezePolicy) {
        doc.text(`Policy: ${row.freezePolicy.name} | Attempts: ${row.freezeUsage.attemptsUsed}/${row.freezePolicy.attempts} used | Days: ${row.freezeUsage.frozenDaysUsed}/${row.freezePolicy.days} used`, 14, y);
        y += 5;
      }

      if (row.freezeUsage?.intervals?.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('#', 16, y); doc.text('Freeze Start', 26, y); doc.text('Freeze End', 66, y);
        doc.text('Duration', 106, y); doc.text('Status', 130, y);
        y += 4;
        doc.setFont('helvetica', 'normal');

        row.freezeUsage.intervals.forEach((interval: any, idx: number) => {
          if (y > 190) { doc.addPage(); y = 20; }
          const start = new Date(interval.freezeAt);
          const end = interval.unfreezeAt ? new Date(interval.unfreezeAt) : null;
          const days = end ? differenceInDays(end, start) + 1 : differenceInDays(new Date(), start) + 1;
          doc.text(`${idx + 1}`, 16, y);
          doc.text(start.toLocaleDateString(), 26, y);
          doc.text(end ? end.toLocaleDateString() : 'Ongoing', 66, y);
          doc.text(`${days} days`, 106, y);
          doc.text(interval.unfreezeAt ? 'Completed' : 'Active', 130, y);
          y += 4;
        });
      } else {
        doc.text('No freeze history recorded.', 16, y);
        y += 4;
      }
      y += 6;
    });

    doc.save(`freeze-history-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportImage = async () => {
    if (!historyRef.current) return;
    try {
      const canvas = await html2canvas(historyRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `freeze-history-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) { console.error('Image export failed:', e); }
  };

  const filteredMemberships = operation === 'freeze'
    ? memberships
    : memberships.filter(m => m.isFrozen || m.actions.canRemoveScheduledFreeze);

  const maxFreezeEnd = freezeStartDate ? addDays(freezeStartDate, Math.min(selectedMembership?.freezeEligibility?.maxWindowDays || 30, 30) - 1) : undefined;
  const freezeDays = freezeStartDate && freezeEndDate ? differenceInDays(freezeEndDate, freezeStartDate) + 1 : 0;
  const resumeDateCalc = freezeEndDate ? addDays(freezeEndDate, 1) : null;
  const unfreezeResume = unfreezeDate ? addDays(unfreezeDate, 1) : null;

  const getDisclaimer = () => {
    if (!selectedMembership) return null;
    const policy = selectedMembership.freezePolicy;
    if (!policy) return null;
    const attemptsLeft = Math.max(0, selectedMembership.freezeEligibility.attemptsRemaining - (operation === 'freeze' ? 1 : 0));
    const daysLeft = Math.max(0, selectedMembership.freezeEligibility.daysRemaining - freezeDays);
    const lines: string[] = [];
    lines.push(`📌 You have **${attemptsLeft}** freeze attempt(s) and **${daysLeft}** freeze day(s) remaining for this membership.`);
    if (operation === 'freeze' && freezeEndDate) {
      lines.push(`⏰ Your membership will **auto-unfreeze on ${format(freezeEndDate, 'dd MMM yyyy')}** unless you return to this portal to extend it.`);
    }
    return lines;
  };

  const handleBottomComposerSubmit = () => {
    if (step === 'ask-name') {
      handleNameSubmit();
      return;
    }
    if (step === 'ask-email') {
      handleEmailSubmit();
      return;
    }
    if (step === 'ask-phone') {
      void handlePhoneSubmit();
      return;
    }
    if (step === 'otp') {
      void handleOtpVerify();
      return;
    }
    if (step === 'chat') {
      void handleChatSubmit();
    }
  };

  const renderBottomComposer = () => {
    if (step === 'ask-name') {
      return (
        <div className="flex items-center gap-2">
          <Input
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleBottomComposerSubmit()}
            placeholder="Type your full name"
            className="h-11 rounded-full border-white/70 bg-white px-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            autoFocus
          />
          <Button onClick={handleBottomComposerSubmit} disabled={!nameInput.trim().includes(' ')} size="icon" className="h-11 w-11 rounded-full gradient-primary text-primary-foreground shadow-lg shadow-primary/20 flex-shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    if (step === 'ask-email') {
      return (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBottomComposerSubmit()}
              placeholder="Type your email address"
              className="h-11 rounded-full border-white/70 bg-white pl-9 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              autoFocus
            />
          </div>
          <Button onClick={handleBottomComposerSubmit} disabled={!emailInput.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)} size="icon" className="h-11 w-11 rounded-full gradient-primary text-primary-foreground shadow-lg shadow-primary/20 flex-shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    if (step === 'ask-phone') {
      return (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBottomComposerSubmit()}
              placeholder="Type your phone number with country code"
              className="h-11 rounded-full border-white/70 bg-white pl-9 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              autoFocus
            />
          </div>
          <Button onClick={handleBottomComposerSubmit} disabled={!phoneInput.trim() || phoneInput.trim().length < 6 || isLoading} size="icon" className="h-11 w-11 rounded-full gradient-primary text-primary-foreground shadow-lg shadow-primary/20 flex-shrink-0">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      );
    }

    if (step === 'otp') {
      return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1 overflow-x-auto">
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <InputOTPSlot key={i} index={i} className="h-11 w-11 rounded-xl border-white/80 bg-white text-sm shadow-sm" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button onClick={handleBottomComposerSubmit} disabled={otpCode.length !== 6 || isLoading} className="h-11 rounded-full px-5 gradient-primary text-primary-foreground shadow-lg shadow-primary/20">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Verify
          </Button>
        </div>
      );
    }

    if (step === 'chat') {
      return (
        <div className="flex items-center gap-2">
          <Input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleBottomComposerSubmit()}
            placeholder="Type your message"
            className="h-11 rounded-full border-white/70 bg-white px-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            autoFocus
          />
          <Button onClick={handleBottomComposerSubmit} disabled={!chatInput.trim()} size="icon" className="h-11 w-11 rounded-full gradient-primary text-primary-foreground shadow-lg shadow-primary/20 flex-shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center gap-2.5 text-center">
        {[
          "Immediate freeze & unfreeze",
          "All memberships history",
          "Live bookings & schedule help",
        ].map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] font-semibold text-slate-500 shadow-sm"
          >
            <Snowflake className="h-3 w-3 text-sky-500" />
            {item}
          </span>
        ))}
      </div>
    );
  };

  // ─── Widget renderers ───
  const renderWidget = (msg: ChatMsg) => {
    if (msg.dismissed) return null;
    if (isInlineInputWidget(msg.widget)) return null;

    switch (msg.widget) {
      case 'ask-name-input':
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5">
            <div className="form-panel rounded-[26px] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="form-icon-chip text-sky-600">
                  <User className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Profile step 1</p>
                  <p className="text-sm font-semibold text-slate-900">Let’s start with your full name</p>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
                  placeholder="e.g. John Doe"
                  className="form-field h-12 rounded-[18px]"
                  autoFocus
                />
                <Button onClick={handleNameSubmit} disabled={!nameInput.trim().includes(' ')} size="icon" className="form-action h-12 w-12 rounded-[18px] gradient-primary text-primary-foreground flex-shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="ml-1 mt-2 text-[11px] text-slate-500">First and last name please ✨</p>
            </div>
          </motion.div>
        );

      case 'ask-email-input':
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5">
            <div className="form-panel rounded-[26px] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="form-icon-chip text-violet-600">
                  <Mail className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Profile step 2</p>
                  <p className="text-sm font-semibold text-slate-900">Where should we send verification?</p>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                  <Input
                    type="email" value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEmailSubmit()}
                    placeholder="you@example.com"
                    className="form-field h-12 rounded-[18px] pl-10"
                    autoFocus
                  />
                </div>
                <Button onClick={handleEmailSubmit} disabled={!emailInput.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)} size="icon" className="form-action h-12 w-12 rounded-[18px] gradient-primary text-primary-foreground flex-shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        );

      case 'ask-phone-input':
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5">
            <div className="form-panel rounded-[26px] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="form-icon-chip text-emerald-600">
                  <Phone className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Profile step 3</p>
                  <p className="text-sm font-semibold text-slate-900">One last detail—your phone number</p>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                  <Input
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePhoneSubmit()}
                    placeholder="+91 9876543210"
                    className="form-field h-12 rounded-[18px] pl-10"
                    autoFocus
                  />
                </div>
                <Button onClick={handlePhoneSubmit} disabled={!phoneInput.trim() || phoneInput.trim().length < 6 || isLoading} size="icon" className="form-action h-12 w-12 rounded-[18px] gradient-primary text-primary-foreground flex-shrink-0">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="ml-1 mt-2 text-[11px] text-slate-500">Include country code (for example, +91)</p>
            </div>
          </motion.div>
        );

      case 'otp':
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5">
            <div className="form-panel rounded-[26px] space-y-3 p-4">
              <div className="flex items-center gap-2">
                <span className="form-icon-chip text-amber-600">
                  <Shield className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Secure verification</p>
                  <p className="text-sm font-semibold text-slate-900">Enter the 6-digit code from your inbox</p>
                </div>
              </div>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                  <InputOTPGroup>
                    {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} className="h-12 w-12 rounded-[16px] border-white/80 bg-white/94 text-sm shadow-[0_12px_28px_-18px_rgba(15,23,42,0.3)]" />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button onClick={handleOtpVerify} disabled={otpCode.length !== 6 || isLoading} className="form-action h-11 w-full rounded-[18px] gradient-primary text-primary-foreground text-sm font-semibold">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Verify Code
              </Button>
            </div>
          </motion.div>
        );

      case 'operations':
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5">
            <div className="form-panel rounded-[28px] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Choose your path</p>
                  <h3 className="text-base font-semibold text-slate-950">What would you like Frostie to help with?</h3>
                </div>
                <span className="form-pill text-sky-700">
                  Member tools
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
              {[
                { op: 'freeze' as Operation, icon: Snowflake, label: 'Freeze', desc: 'Pause membership', color: 'from-blue-500/10 to-blue-600/5 border-blue-200/60 hover:border-blue-300' },
                { op: 'modify' as Operation, icon: Clock, label: 'Modify / Unfreeze', desc: 'Change or end freeze', color: 'from-amber-500/10 to-amber-600/5 border-amber-200/60 hover:border-amber-300' },
                { op: 'restart' as Operation, icon: RotateCcw, label: 'Restart', desc: 'Resume now', color: 'from-emerald-500/10 to-emerald-600/5 border-emerald-200/60 hover:border-emerald-300' },
                { op: 'history' as Operation, icon: FileText, label: 'History', desc: 'All-time freezes', color: 'from-purple-500/10 to-purple-600/5 border-purple-200/60 hover:border-purple-300' },
                { op: 'bookings' as Operation, icon: BookOpen, label: 'My Bookings', desc: 'Visits & classes', color: 'from-rose-500/10 to-rose-600/5 border-rose-200/60 hover:border-rose-300' },
                { op: 'schedule' as Operation, icon: CalendarList, label: 'Schedule', desc: 'Upcoming classes', color: 'from-cyan-500/10 to-cyan-600/5 border-cyan-200/60 hover:border-cyan-300' },
              ].map(({ op, icon: Icon, label, desc, color }) => (
                <motion.button
                  key={op}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleOperation(op)}
                  className={cn(
                    "group form-secondary flex min-h-[112px] flex-col items-start gap-2 rounded-[22px] border bg-gradient-to-br p-3.5 text-left cursor-pointer",
                    color
                  )}
                >
                  <span className="form-icon-chip h-9 w-9 rounded-[16px] text-slate-700 transition-transform group-hover:scale-105">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[13px] font-semibold text-foreground">{label}</span>
                  <span className="text-[10px] leading-relaxed text-muted-foreground">{desc}</span>
                </motion.button>
              ))}
              </div>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleOperation('ask')}
                className="form-secondary mt-3 flex w-full items-center gap-3 rounded-[22px] border border-indigo-200/70 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 p-3.5 text-left hover:border-indigo-300"
              >
                <span className="form-icon-chip text-indigo-600">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[13px] font-semibold text-foreground">Ask Frostie anything</div>
                  <div className="text-[10px] text-muted-foreground">Classes, packages, brand questions, or a little gentle hand-holding</div>
                </div>
              </motion.button>
            </div>
          </motion.div>
        );

      case 'memberships':
      case 'memberships-all': {
        const list = msg.widget === 'memberships-all' ? memberships : filteredMemberships;
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5 space-y-2">
              <div className="form-panel mb-1 rounded-[26px] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Membership selection</p>
                  <h3 className="text-sm font-semibold text-slate-950">
                    {operation === 'freeze' ? 'Choose the membership you want to freeze' : 'Choose the membership you want to manage'}
                  </h3>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold text-slate-600">
                  {list.length} found
                </span>
              </div>
            </div>
            {list.map(m => {
              const ineligible = operation === 'freeze' ? getIneligibleBadge(m) : null;
              const isClickable = operation === 'freeze' ? m.actions.canFreeze : true;

              return (
                <motion.button
                  key={m.id}
                  whileHover={isClickable ? { scale: 1.01 } : {}}
                  whileTap={isClickable ? { scale: 0.99 } : {}}
                  onClick={() => isClickable && handleMembershipSelect(m)}
                  disabled={!isClickable}
                  className={cn(
                    "group w-full rounded-[24px] border p-4 text-left transition-all",
                    m.isFrozen && "ring-2 ring-blue-300/40",
                    isClickable
                      ? "form-card cursor-pointer hover:-translate-y-0.5 hover:border-primary/30"
                      : "bg-white/50 border-white/40 opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="form-icon-chip h-8 w-8 rounded-[16px] text-sky-600">
                          <Snowflake className="h-4 w-4" />
                        </span>
                        <h4 className={cn("font-semibold text-[14px]", isClickable ? "text-foreground group-hover:text-primary" : "text-muted-foreground")}>
                          {m.membership.name}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {m.membership.duration} {m.membership.durationUnit}{m.membership.duration > 1 ? 's' : ''} · {m.type}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {m.isFrozen && (
                        <Badge className="text-[8px] font-bold bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 animate-pulse">
                          ❄️ FROZEN
                        </Badge>
                      )}
                      {m.scheduledFreezeAt && !m.isFrozen && (
                        <Badge className="text-[8px] font-semibold bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                          ⏰ Scheduled
                        </Badge>
                      )}
                      {ineligible && !m.isFrozen && (
                        <Badge className={cn("text-[8px] font-semibold border", ineligible.color)}>
                          {ineligible.text}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3 text-[11px] text-slate-600 sm:grid-cols-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{formatShortDate(m.startDate)} → {formatShortDate(m.endDate)}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m.location}</span>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-[10px] text-muted-foreground">
                    {m.freezePolicy && (
                      <div className="flex items-center gap-1">
                        <History className="h-2.5 w-2.5" />
                        <span>{m.freezeEligibility.attemptsRemaining}/{m.freezePolicy.attempts} freezes · {m.freezeEligibility.daysRemaining}/{m.freezePolicy.days} days left</span>
                      </div>
                    )}
                    {!m.freezePolicy && (
                      <div className="flex items-center gap-1 text-muted-foreground/50 italic">
                        <XCircle className="h-2.5 w-2.5" />
                        <span>No freeze policy assigned</span>
                      </div>
                    )}
                    {m.scheduledUnfreezeAt && (
                      <div className="flex items-center gap-1 text-emerald-700">
                        <Clock className="h-2.5 w-2.5" />
                        <span>Scheduled to resume on {formatShortDate(m.scheduledUnfreezeAt)}</span>
                      </div>
                    )}
                    {m.scheduledFreezeAt && !m.isFrozen && (
                      <div className="flex items-center gap-1 text-amber-700">
                        <Clock className="h-2.5 w-2.5" />
                        <span>Scheduled freeze starts on {formatShortDate(m.scheduledFreezeAt)}</span>
                      </div>
                    )}
                  </div>
                  {isClickable && (
                    <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-primary/70 group-hover:text-primary transition-colors">
                      <span>Select membership</span><ArrowRight className="h-3 w-3" />
                    </div>
                  )}
                </motion.button>
              );
            })}
            <button onClick={handleBackToOperations} className="mt-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
              ← Back to options
            </button>
          </motion.div>
        );
      }

      case 'freeze-reason':
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5">
            <div className="form-panel rounded-[26px] p-4">
              <div className="mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Optional context</p>
                <h3 className="text-sm font-semibold text-slate-950">Why are you freezing this membership?</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
              {FREEZE_REASONS.map(r => (
                <motion.button
                  key={r.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleReasonSelect(r.id)}
                  className="form-secondary inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-2 text-[12px] font-medium text-foreground hover:border-primary/30 hover:bg-primary/5"
                >
                  <span>{r.emoji}</span>{r.label}
                </motion.button>
              ))}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSkipReason}
                className="inline-flex items-center rounded-full border border-dashed border-slate-300/80 bg-white/30 px-3 py-2 text-[11px] text-muted-foreground transition-all hover:text-foreground"
              >
                Skip →
              </motion.button>
            </div>
            </div>
          </motion.div>
        );

      case 'freeze-mode':
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5">
            <div className="form-panel rounded-[26px] p-4">
              <div className="mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Freeze options</p>
                <h3 className="text-sm font-semibold text-slate-950">Do you want to freeze immediately or schedule dates?</h3>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleFreezeNow}
                className="form-secondary flex flex-col items-center gap-2 rounded-[22px] border border-blue-200/70 bg-gradient-to-br from-blue-500/10 to-sky-500/5 p-4 hover:border-blue-400"
              >
                <span className="form-icon-chip text-blue-600">
                  <Zap className="h-5 w-5" />
                </span>
                <span className="text-[13px] font-bold text-foreground">Freeze Now</span>
                <span className="text-[9px] text-muted-foreground">Immediate effect</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleScheduleFreeze}
                className="form-secondary flex flex-col items-center gap-2 rounded-[22px] border border-indigo-200/70 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 p-4 hover:border-indigo-400"
              >
                <span className="form-icon-chip text-indigo-600">
                  <CalendarIcon className="h-5 w-5" />
                </span>
                <span className="text-[13px] font-bold text-foreground">Schedule</span>
                <span className="text-[9px] text-muted-foreground">Pick start & end dates</span>
              </motion.button>
            </div>
            </div>
            <button onClick={handleBackToOperations} className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors mt-2">
              ← Back to options
            </button>
          </motion.div>
        );

      case 'unfreeze-mode':
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5">
            <div className="form-panel rounded-[26px] p-4">
              <div className="mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Unfreeze options</p>
                <h3 className="text-sm font-semibold text-slate-950">How would you like this membership to resume?</h3>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleUnfreezeNow}
                className="form-secondary flex flex-col items-center gap-2 rounded-[22px] border border-emerald-200/70 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-4 hover:border-emerald-400"
              >
                <span className="form-icon-chip text-emerald-600">
                  <Zap className="h-5 w-5" />
                </span>
                <span className="text-[13px] font-bold text-foreground">Unfreeze Now</span>
                <span className="text-[9px] text-muted-foreground">Resume immediately</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleScheduleUnfreeze}
                className="form-secondary flex flex-col items-center gap-2 rounded-[22px] border border-amber-200/70 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-4 hover:border-amber-400"
              >
                <span className="form-icon-chip text-amber-600">
                  <CalendarIcon className="h-5 w-5" />
                </span>
                <span className="text-[13px] font-bold text-foreground">Schedule</span>
                <span className="text-[9px] text-muted-foreground">Pick a date</span>
              </motion.button>
            </div>
            </div>
            <button onClick={handleBackToOperations} className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors mt-2">
              ← Back to options
            </button>
          </motion.div>
        );

      case 'freeze-dates':
        return selectedMembership ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5">
            <div className="form-panel rounded-[26px] space-y-3 p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Schedule freeze</p>
                <h3 className="text-sm font-semibold text-slate-950">Choose your freeze window</h3>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Start</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("form-field h-11 w-full justify-start rounded-[16px] border-white/80 bg-white/92 text-left text-xs font-normal", !freezeStartDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-1.5 h-3 w-3" />
                        {freezeStartDate ? format(freezeStartDate, "dd MMM yyyy") : "Select"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={freezeStartDate} onSelect={(d) => { setFreezeStartDate(d); setFreezeEndDate(undefined); }} disabled={d => d < new Date()} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">End</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("form-field h-11 w-full justify-start rounded-[16px] border-white/80 bg-white/92 text-left text-xs font-normal", !freezeEndDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-1.5 h-3 w-3" />
                        {freezeEndDate ? format(freezeEndDate, "dd MMM yyyy") : "Select"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={freezeEndDate} onSelect={setFreezeEndDate} disabled={d => !freezeStartDate || d < freezeStartDate || (maxFreezeEnd ? d > maxFreezeEnd : false)} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {freezeDays > 0 && (
                <div className="form-card rounded-[20px] border border-primary/10 bg-primary/5 p-3 text-[11px] space-y-0.5">
                  <p className="font-semibold text-foreground">{freezeDays} day{freezeDays !== 1 ? 's' : ''} selected</p>
                  {resumeDateCalc && <p className="text-muted-foreground">Resume: <span className="font-medium text-foreground">{format(resumeDateCalc, 'dd MMM yyyy')}</span></p>}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleBackToOperations} className="text-[10px] text-muted-foreground hover:text-foreground rounded-[16px] h-10">← Back</Button>
                <Button onClick={handleFreezeSubmit} disabled={!freezeStartDate || !freezeEndDate} className="form-action flex-1 h-11 rounded-[18px] gradient-primary text-primary-foreground text-sm font-semibold">
                  <Snowflake className="h-3.5 w-3.5 mr-1.5" /> Freeze
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null;

      case 'modify-unfreeze':
        return selectedMembership ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5">
            <div className="form-panel rounded-[26px] space-y-3 p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Schedule unfreeze</p>
                <h3 className="text-sm font-semibold text-slate-950">Choose when this membership should resume</h3>
              </div>
              <div>
                <Label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">Unfreeze Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("form-field h-11 w-full justify-start rounded-[16px] border-white/80 bg-white/92 text-left text-xs font-normal", !unfreezeDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1.5 h-3 w-3" />
                      {unfreezeDate ? format(unfreezeDate, "dd MMM yyyy") : "Select unfreeze date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={unfreezeDate} onSelect={setUnfreezeDate} disabled={d => d < new Date() || d > addDays(new Date(), 30)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              {unfreezeResume && (
                <div className="form-card rounded-[18px] border border-primary/10 bg-primary/5 p-2.5 text-[11px]">
                  <p className="text-muted-foreground">Resume: <span className="font-medium text-foreground">{format(unfreezeResume, 'dd MMM yyyy')}</span></p>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleBackToOperations} className="text-[10px] text-muted-foreground hover:text-foreground rounded-[16px] h-10">← Back</Button>
                <Button onClick={handleUnfreezeSubmit} disabled={!unfreezeDate} className="form-action flex-1 h-11 rounded-[18px] gradient-primary text-primary-foreground text-sm font-semibold">
                  <Clock className="h-3.5 w-3.5 mr-1.5" /> Schedule Unfreeze
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null;

      case 'chat-input':
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5">
            <div className="form-panel rounded-[26px] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="form-icon-chip text-indigo-600">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Ask Frostie</p>
                  <p className="text-sm font-semibold text-slate-900">Need help beyond workflows? Ask away.</p>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleChatSubmit()}
                  placeholder="Ask me anything about P57..."
                  className="form-field h-12 rounded-[18px]"
                  autoFocus
                />
                <Button onClick={handleChatSubmit} disabled={!chatInput.trim()} size="icon" className="form-action h-12 w-12 rounded-[18px] gradient-primary text-primary-foreground flex-shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <button onClick={handleBackToOperations} className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors mt-1.5 ml-1">
              ← Back to menu
            </button>
          </motion.div>
        );

      case 'bookings-list': {
        const bookings = (msg.widgetData || []) as any[];
        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5 space-y-2">
            <div className="rounded-[24px] border border-white/70 bg-white/85 p-3.5 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.3)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Bookings & visits</p>
                  <h3 className="text-sm font-semibold text-slate-950">Your latest class activity</h3>
                </div>
                <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-semibold text-rose-700">
                  {bookings.length} total
                </span>
              </div>
            </div>
            {bookings.slice(0, 10).map((b: any) => (
              <div key={b.id} className={cn("rounded-[22px] border p-3.5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.22)] backdrop-blur-xl", b.cancelledAt ? "border-red-200/60 bg-red-50/40 opacity-75" : "border-white/70 bg-white/85")}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 shadow-sm">
                        <BookOpen className="h-4 w-4" />
                      </span>
                      <h4 className="text-[13px] font-bold text-foreground">{b.session?.name || 'Class'}</h4>
                    </div>
                    <p className="text-[10px] text-slate-500">Booking ID #{b.id}</p>
                  </div>
                  <div className="flex gap-1">
                    {b.checkedIn && <Badge className="text-[7px] bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">✓ Attended</Badge>}
                    {b.cancelledAt && <Badge className="text-[7px] bg-red-100 text-red-600 border-red-200 hover:bg-red-100">Cancelled</Badge>}
                    {!b.checkedIn && !b.cancelledAt && <Badge className="text-[7px] bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">Booked</Badge>}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/75 p-3 text-[10px] text-muted-foreground space-y-1">
                  {b.session?.startsAt && (
                    <p className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {new Date(b.session.startsAt).toLocaleDateString()} · {new Date(b.session.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(b.session.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {b.session?.teacher && (
                    <p className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {b.session.teacher.firstName} {b.session.teacher.lastName}
                    </p>
                  )}
                  {b.session?.inPersonLocation && (
                    <p className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {b.session.inPersonLocation.name}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {bookings.length > 10 && <p className="text-[10px] text-muted-foreground text-center">Showing first 10 of {bookings.length} bookings</p>}
            <button onClick={handleBackToOperations} className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors mt-1">
              ← Back to options
            </button>
          </motion.div>
        );
      }

      case 'schedule-list': {
        const sessions = (msg.widgetData || []) as any[];
        // Group by day
        const grouped: Record<string, any[]> = {};
        sessions.forEach((s: any) => {
          const day = new Date(s.startsAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
          if (!grouped[day]) grouped[day] = [];
          grouped[day].push(s);
        });

        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5 space-y-2.5">
            <div className="rounded-[24px] border border-white/70 bg-white/85 p-3.5 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.3)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Upcoming classes</p>
                  <h3 className="text-sm font-semibold text-slate-950">This week’s class schedule</h3>
                </div>
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[10px] font-semibold text-cyan-700">
                  {sessions.length} sessions
                </span>
              </div>
            </div>
            {Object.entries(grouped).slice(0, 5).map(([day, dayClasses]) => (
              <div key={day} className="rounded-[24px] border border-white/70 bg-white/85 p-3.5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.22)] backdrop-blur-xl">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-foreground/60 uppercase tracking-widest">{day}</p>
                  <span className="text-[10px] font-medium text-slate-500">{dayClasses.length} class{dayClasses.length !== 1 ? 'es' : ''}</span>
                </div>
                <div className="space-y-1.5">
                  {dayClasses.slice(0, 6).map((s: any) => (
                    <div key={s.id} className="rounded-2xl border border-slate-200/70 bg-slate-50/75 p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 shadow-sm">
                            <CalendarList className="h-4 w-4" />
                          </span>
                          <h4 className="text-[12px] font-bold text-foreground">{s.name}</h4>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-medium text-muted-foreground">{s.bookingCount}/{s.capacity} booked</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{new Date(s.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(s.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {s.teacher && <span>• {s.teacher.firstName} {s.teacher.lastName}</span>}
                        {s.inPersonLocation && <span>• {s.inPersonLocation.name}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={handleBackToOperations} className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors mt-1">
              ← Back to options
            </button>
          </motion.div>
        );
      }

      case 'success': {
        const disclaimer = getDisclaimer();
        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="mt-2.5">
            <div className="bg-card border border-border rounded-2xl p-5 text-center shadow-sm">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
                className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3"
              >
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </motion.div>
              <h3 className="text-sm font-bold text-foreground mb-1">All Done! 🎉</h3>
              <p className="text-[11px] text-muted-foreground mb-3">A confirmation email has been sent to your inbox.</p>

              {disclaimer && (
                <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 mb-3 text-left space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                    <Info className="h-3 w-3" /> Important
                  </div>
                  {disclaimer.map((line, i) => (
                    <p key={i} className="text-[11px] text-amber-900/80 leading-relaxed">
                      {line.split('**').map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex gap-2 justify-center">
                <Button onClick={handleBackToOperations} variant="outline" size="sm" className="text-xs rounded-full px-4 h-9">
                  <RefreshCw className="h-3 w-3 mr-1.5" /> Do More
                </Button>
                {onComplete && (
                  <Button onClick={handleGoHome} size="sm" className="text-xs rounded-full px-4 h-9 gradient-primary text-primary-foreground">
                    <ArrowLeft className="h-3 w-3 mr-1.5" /> Home
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        );
      }

      case 'history-table': {
        const rows = (msg.widgetData || historyRows) as FreezeHistoryRow[];
        const grouped = rows.reduce<Record<number, FreezeHistoryRow>>((acc, r) => {
          acc[r.membershipId] = r;
          return acc;
        }, {});

        return (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5">
            {/* Export toolbar */}
            <div className="mb-2.5 rounded-[24px] border border-white/70 bg-white/85 p-3.5 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.3)] backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Freeze history</p>
                  <h3 className="text-sm font-semibold text-slate-950">Your all-time freeze record</h3>
                </div>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-semibold text-violet-700">
                  {Object.keys(grouped).length} memberships
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground font-medium mr-auto">Download:</span>
                <Button variant="outline" size="sm" onClick={() => exportCSV(rows)} className="h-8 px-3 text-[10px] rounded-xl gap-1 bg-white/80">
                <FileDown className="h-3 w-3" /> CSV
              </Button>
                <Button variant="outline" size="sm" onClick={() => exportPDF(rows)} className="h-8 px-3 text-[10px] rounded-xl gap-1 bg-white/80">
                <Download className="h-3 w-3" /> PDF
              </Button>
                <Button variant="outline" size="sm" onClick={exportImage} className="h-8 px-3 text-[10px] rounded-xl gap-1 bg-white/80">
                <ImageDown className="h-3 w-3" /> Image
              </Button>
              </div>
            </div>

            <div ref={historyRef} className="space-y-2.5">
              {Object.values(grouped).map(row => {
                const totalIntervals = row.freezeUsage?.intervals?.length || 0;
                return (
                  <div key={row.membershipId} className={cn(
                    "overflow-hidden rounded-[24px] border shadow-[0_18px_45px_-30px_rgba(15,23,42,0.22)] backdrop-blur-xl",
                    row.isFrozen ? "border-blue-300/50 ring-1 ring-blue-200/30" : row.isExpired ? "border-gray-300/50 opacity-70" : "border-border"
                  )}>
                    {/* Header */}
                    <div className={cn(
                      "px-3.5 py-2.5 border-b flex items-center justify-between",
                      row.isFrozen ? "bg-blue-50/80 border-blue-200/30" : row.isExpired ? "bg-gray-50/70 border-gray-200/30" : "bg-white/85 border-border/30"
                    )}>
                      <div>
                        <h4 className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
                          {row.membershipName}
                          {row.isExpired && (
                            <Badge className="text-[7px] font-semibold bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-200 px-1.5 py-0">
                              EXPIRED
                            </Badge>
                          )}
                          {row.isFrozen && (
                            <Badge className="text-[7px] font-bold bg-blue-500 text-white border-0 hover:bg-blue-500 animate-pulse px-1.5 py-0">
                              ❄️ FROZEN
                            </Badge>
                          )}
                          {row.scheduledFreezeAt && !row.isFrozen && (
                            <Badge className="text-[7px] font-semibold bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 px-1.5 py-0">
                              ⏰ Scheduled
                            </Badge>
                          )}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[9px] text-muted-foreground">
                          <span className="flex items-center gap-0.5"><MapPin className="h-2 w-2" />{row.location}</span>
                          <span>•</span>
                          <span>{new Date(row.startDate).toLocaleDateString()} → {new Date(row.endDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="text-right space-y-0.5 rounded-2xl border border-slate-200/60 bg-white/80 px-3 py-2 shadow-sm">
                        {row.freezePolicy ? (
                          <>
                            <div className="text-[9px] text-muted-foreground">
                              <span className="font-bold text-foreground">{row.freezeUsage.attemptsUsed}</span>/{row.freezePolicy.attempts} attempts
                            </div>
                            <div className="text-[9px] text-muted-foreground">
                              <span className="font-bold text-foreground">{row.freezeUsage.frozenDaysUsed}</span>/{row.freezePolicy.days} days used
                            </div>
                            <div className="text-[8px] text-primary/70 font-medium">
                              {row.freezeEligibility.attemptsRemaining} left · {row.freezeEligibility.daysRemaining}d left
                            </div>
                          </>
                        ) : (
                          <span className="text-[9px] text-muted-foreground/50 italic">No policy</span>
                        )}
                      </div>
                    </div>

                    {/* Intervals table */}
                    {totalIntervals > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-border/20">
                              <TableHead className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground py-1.5 px-3 w-8">#</TableHead>
                              <TableHead className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground py-1.5 px-3">Freeze Start</TableHead>
                              <TableHead className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground py-1.5 px-3">Freeze End</TableHead>
                              <TableHead className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground py-1.5 px-3">Days</TableHead>
                              <TableHead className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground py-1.5 px-3">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {row.freezeUsage.intervals.map((interval: any, idx: number) => {
                              const start = new Date(interval.freezeAt);
                              const end = interval.unfreezeAt ? new Date(interval.unfreezeAt) : null;
                              const days = end ? differenceInDays(end, start) + 1 : differenceInDays(new Date(), start) + 1;
                              const isOngoing = !interval.unfreezeAt;

                              return (
                                <TableRow key={idx} className={cn("border-b border-border/10", isOngoing && "bg-blue-50/20")}>
                                  <TableCell className="text-[10px] py-1.5 px-3 text-muted-foreground font-mono">{idx + 1}</TableCell>
                                  <TableCell className="text-[10px] py-1.5 px-3 font-medium">{start.toLocaleDateString()}</TableCell>
                                  <TableCell className="text-[10px] py-1.5 px-3">{end ? end.toLocaleDateString() : '—'}</TableCell>
                                  <TableCell className="text-[10px] py-1.5 px-3 font-semibold">{days}d</TableCell>
                                  <TableCell className="py-1.5 px-3">
                                    {isOngoing ? (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[7px] font-bold">
                                        ❄️ Active
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[7px] font-medium">
                                        ✓ Done
                                      </span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>

                        {/* Summary row below table */}
                        <div className="px-3.5 py-2 bg-muted/20 border-t border-border/20 flex items-center justify-between text-[9px] text-muted-foreground">
                          <span>{totalIntervals} freeze{totalIntervals !== 1 ? 's' : ''} total · {row.freezeUsage.frozenDaysUsed} days used</span>
                          {row.freezePolicy && (
                            <span className="font-semibold text-foreground">
                              {row.freezeEligibility.attemptsRemaining} attempt{row.freezeEligibility.attemptsRemaining !== 1 ? 's' : ''} · {row.freezeEligibility.daysRemaining}d remaining
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="px-3.5 py-3 text-[10px] text-muted-foreground/50 italic text-center">
                        No freeze history for this membership yet
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5">
              <button onClick={handleBackToOperations} className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                ← Back to options
              </button>
            </div>
          </motion.div>
        );
      }

      default:
        return null;
    }
  };

  // ─── Render ───
  return (
    <div className="relative flex h-full w-full overflow-hidden rounded-[30px] border border-white/50 bg-background shadow-[0_24px_120px_-40px_rgba(15,23,42,0.45)]">
      <div className="hidden lg:flex lg:w-2/5 relative overflow-hidden bg-gradient-to-br from-violet-100/60 via-white to-fuchsia-100/55">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(139,92,246,0.22),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(217,70,239,0.14),transparent_22%),radial-gradient(circle_at_50%_82%,rgba(59,130,246,0.16),transparent_24%)]" />
        <div className="absolute -left-12 top-16 h-56 w-56 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="absolute -right-12 bottom-10 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(100,116,139,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,116,139,0.08)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_78%_56%_at_50%_50%,#000_68%,transparent_110%)]" />

        <InteractiveRobotSpline scene={ROBOT_SPLINE_URL} className="absolute inset-0 h-full w-full" />

        <div className="absolute bottom-8 left-8 right-8 z-10 rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_24px_80px_-30px_rgba(15,23,42,0.35)] backdrop-blur-2xl">
          <div className="flex flex-wrap gap-2">
            {[
              "Immediate freeze & unfreeze",
              "Bookings & visits",
              "Schedule answers",
            ].map((item) => (
              <span
                key={item}
                className="rounded-full border border-slate-200/80 bg-white/85 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex h-full w-full flex-col bg-background lg:w-3/5">
        <motion.header
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          className="relative flex items-center justify-between border-b border-border bg-[#f0f2f5] px-4 py-4 shadow-sm"
        >
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-primary/20 bg-gradient-to-br from-violet-100 to-fuchsia-100 shadow-sm">
              <img src={frostieAvatar} alt={AGENT_NAME} className="h-10 w-10 rounded-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-slate-950">{AGENT_NAME}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-emerald-700 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online
                </span>
              </div>
              <p className="truncate text-xs text-slate-500">Physique 57 Expert</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <span className="text-[10px] text-slate-500 font-medium">Test</span>
              <Switch checked={testMode} onCheckedChange={setTestMode} className="scale-[0.6]" />
            </label>
            {onComplete && (
              <button
                onClick={handleGoHome}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 transition hover:bg-white hover:text-slate-900"
                aria-label="Close chat"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            )}
          </div>
        </motion.header>

        <div
          ref={scrollRef}
          className="chat-scrollbar flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#efeae2]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundColor: '#efeae2',
          }}
        >
          <div className="flex justify-center mb-2">
            <span className="text-[9px] font-medium text-muted-foreground bg-card/80 backdrop-blur-sm border border-border/40 rounded-full px-3 py-1 shadow-sm">
              Today
            </span>
          </div>

          <AnimatePresence>
            {messages.map(msg => {
              if (msg.isTyping) {
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-end gap-2"
                  >
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-card border border-border/30 flex-shrink-0 p-0.5">
                      <img src={frostieAvatar} alt={AGENT_NAME} className="w-full h-full object-contain rounded-full" />
                    </div>
                    <div className="bg-card border border-border/40 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex gap-1 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-typing" style={{ animationDelay: '0s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-typing" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-typing" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}
                >
                  <div className={cn("flex w-full items-end gap-2", msg.role === 'user' && "ml-auto flex-row-reverse justify-end")}>
                    {msg.role === 'bot' && (
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-card border border-border/30 flex-shrink-0 p-0.5 mb-0.5">
                        <img src={frostieAvatar} alt={AGENT_NAME} className="w-full h-full object-contain rounded-full" />
                      </div>
                    )}
                    <div className={cn("flex flex-col gap-0.5", msg.role === 'user' ? "items-end flex-1 pl-12" : "max-w-[94%] pr-6") }>
                      <div className={cn(
                        "relative w-full rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                        msg.role === 'user'
                          ? "rounded-br-sm border border-[#cdebb7] bg-[#dcf8c6] text-slate-900 shadow-sm"
                          : "rounded-bl-sm border border-[#e6e6e6] bg-white text-slate-900 shadow-sm"
                      )}>
                        {msg.text.split('**').map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}
                        <span
                          className={cn(
                            "absolute bottom-0 h-3 w-3 rotate-45",
                            msg.role === 'user'
                              ? "-right-1.5 bg-[#dcf8c6] border-r border-b border-[#cdebb7]"
                              : "-left-1.5 bg-white border-l border-b border-[#e6e6e6]"
                          )}
                        />
                      </div>
                      {msg.timestamp && (
                        <span className={cn(
                          "text-[8px] text-muted-foreground/50 px-1",
                          msg.role === 'user' ? "text-right" : "text-left"
                        )}>
                          {formatTime(msg.timestamp)}
                          {msg.role === 'user' && " ✓✓"}
                        </span>
                      )}
                      {msg.widget && renderWidget(msg)}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {isLoading && !messages.some(m => m.isTyping) && (
            <div className="flex items-end gap-2">
              <div className="w-7 h-7 rounded-full overflow-hidden bg-card border border-border/30 flex-shrink-0 p-0.5">
                <img src={frostieAvatar} alt={AGENT_NAME} className="w-full h-full object-contain rounded-full" />
              </div>
              <div className="rounded-2xl rounded-bl-sm border border-[#e6e6e6] bg-white px-3.5 py-2.5 flex gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-typing" style={{ animationDelay: '0s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-typing" style={{ animationDelay: '0.2s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-typing" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border/50 bg-[#f0f2f5] px-4 py-3">
          {renderBottomComposer()}
        </div>
      </div>

      {/* Confirm dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md border-border bg-background rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground font-bold">{confirmDetails.title}</DialogTitle>
            <DialogDescription>Please review the details below and confirm.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-3">
            {confirmDetails.lines.map((line, i) => (
              <p key={i} className="text-[13px] text-foreground">{line}</p>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowConfirm(false)} className="text-muted-foreground rounded-full">Cancel</Button>
            <Button onClick={handleConfirmExecute} className="gradient-primary text-primary-foreground rounded-full shadow-lg shadow-primary/20">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
