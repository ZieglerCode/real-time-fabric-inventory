'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Camera, Laptop, Layers, Printer, CheckCircle2, ArrowRight, 
  Cpu, Compass, ShieldAlert, Sparkles, MoveRight, HelpCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

// Animation variants for text reveal
const textRevealVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1] as any, // Custom premium ease-out cubic
    },
  }),
};

// Animation variants for cards sliding in on scroll
const scrollRevealVariant = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1] as any,
    },
  },
};

export default function LandingPage() {
  const { user, isConfigured } = useAuth();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-indigo-500 selection:text-white relative overflow-x-hidden">
      
      {/* Absolute blurred background shapes */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-100 rounded-full blur-3xl opacity-30 pointer-events-none -mr-40 -mt-20" />
      <div className="absolute top-[800px] left-0 w-[500px] h-[500px] bg-violet-100 rounded-full blur-3xl opacity-30 pointer-events-none -ml-40" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-sky-100 rounded-full blur-3xl opacity-20 pointer-events-none" />

      {/* Header / Navbar */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between border-b border-slate-200/50 relative z-20">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 bg-indigo-650 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
            <Layers className="h-5 w-5" />
          </div>
          <span className="font-bold tracking-tight text-slate-900 text-lg">Ziegler Inventory</span>
        </div>

        <div className="flex items-center gap-4">
          {isConfigured && user ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4.5 py-2 border border-slate-200 hover:border-slate-350 bg-white shadow-xs rounded-xl text-sm font-semibold transition-all cursor-pointer"
            >
              <span>Control Center</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-150 transition-all cursor-pointer border-b-2 border-indigo-805"
            >
              <span>Access Portal</span>
              <MoveRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-28 relative z-10 text-center">
        <motion.div 
          initial="hidden" 
          animate="visible"
          className="max-w-4xl mx-auto space-y-6"
        >
          {/* Tagline Badge */}
          <motion.div 
            custom={0}
            variants={textRevealVariant}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-2"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Digital Textile Workflow</span>
          </motion.div>

          {/* Main Hero Header */}
          <motion.h1 
            custom={1}
            variants={textRevealVariant}
            className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15]"
          >
            From Loom to Label <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-650 to-violet-650">In Three Seconds</span>
          </motion.h1>

          {/* Subtext */}
          <motion.p 
            custom={2}
            variants={textRevealVariant}
            className="text-lg text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed"
          >
            Streamline physical fabric cataloging. Match instantaneous mobile camera uploads with desktop tagging, and print barcode stickers on the fly.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div 
            custom={3}
            variants={textRevealVariant}
            className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href={user ? "/dashboard" : "/login"}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-150 transition-all cursor-pointer border-b-2 border-indigo-805"
            >
              <span>{user ? "Go to Dashboard" : "Enter Platform"}</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="#workflow"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4.5 border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-slate-650 rounded-2xl font-bold transition-all shadow-xs cursor-pointer"
            >
              <span>See How it Works</span>
            </a>
          </motion.div>
        </motion.div>

        {/* Floating Mockups / Interactive Preview */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 max-w-5xl mx-auto bg-white/40 backdrop-blur-md border border-slate-200/50 rounded-3xl p-4 shadow-xl"
        >
          <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-inner aspect-[16/9] relative flex items-center justify-center p-6 text-white group">
            {/* Ambient gradients */}
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/30 via-transparent to-violet-900/30 opacity-60 group-hover:scale-105 transition-transform duration-700 pointer-events-none" />
            
            {/* Visual simulation layout */}
            <div className="grid grid-cols-12 gap-6 w-full h-full relative z-10 items-center">
              {/* Simulator phone */}
              <div className="col-span-4 bg-slate-950 border border-slate-800 rounded-3xl aspect-[9/16] p-3 shadow-2xl relative overflow-hidden flex flex-col justify-between hidden md:flex">
                <div className="h-1.5 w-12 bg-slate-800 rounded-full mx-auto mb-2" />
                <div className="flex-1 rounded-2xl border border-slate-900/80 bg-[#F8FAFC] p-3 flex flex-col justify-between text-slate-800 text-left">
                  <div className="text-[9px] font-bold text-indigo-650">CAMERA UPLOAD</div>
                  <div className="flex-1 flex flex-col items-center justify-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Camera className="h-5 w-5" />
                    </div>
                    <span className="text-[9px] text-slate-400 text-center">Scan fabric roll</span>
                  </div>
                  <div className="h-7 w-full bg-indigo-600 rounded-lg text-white font-bold text-[8px] flex items-center justify-center">Take Photo</div>
                </div>
              </div>

              {/* Simulator Desktop Screen */}
              <div className="col-span-12 md:col-span-8 bg-slate-950 border border-slate-800 rounded-2xl aspect-[16/10] p-4 shadow-2xl flex flex-col justify-between text-left">
                <div className="flex items-center gap-1.5 border-b border-slate-900 pb-2">
                  <span className="h-2 w-2 rounded-full bg-rose-500/80" />
                  <span className="h-2 w-2 rounded-full bg-amber-500/80" />
                  <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
                  <span className="text-[9px] text-slate-600 font-mono ml-2">portal.ziegler.com/tagging</span>
                </div>
                <div className="flex-1 grid grid-cols-12 gap-3 pt-3">
                  <div className="col-span-4 border-r border-slate-900 pr-2 space-y-1.5">
                    <div className="text-[8px] font-mono text-slate-600 font-bold">INCOMING QUEUE</div>
                    <div className="h-8 bg-slate-900/80 border border-indigo-900/50 rounded-lg p-1.5 flex gap-1 items-center">
                      <div className="h-5 w-5 bg-slate-800 rounded-md shrink-0" />
                      <div className="space-y-0.5">
                        <div className="h-1 w-8 bg-slate-700 rounded" />
                        <div className="h-1 w-6 bg-slate-800 rounded" />
                      </div>
                    </div>
                  </div>
                  <div className="col-span-8 pl-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="text-[8px] font-bold text-slate-400">LABEL DATA</div>
                      <div className="h-5 bg-slate-900 rounded border border-slate-800 flex items-center px-2 text-[8px] text-slate-500">e.g. Silk Satin 03</div>
                    </div>
                    <div className="h-10 bg-indigo-650/10 border border-indigo-500/30 rounded-lg flex items-center gap-3 p-2">
                      <div className="h-6 w-6 bg-white shrink-0 rounded flex items-center justify-center"><Printer className="h-3.5 w-3.5 text-slate-900" /></div>
                      <div className="space-y-1">
                        <div className="h-1.5 w-12 bg-indigo-200 rounded" />
                        <div className="h-1 w-16 bg-indigo-400/50 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Feature Grid Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10 border-t border-slate-200/50">
        <div className="text-center max-w-xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Designed for Instant Logistics
          </h2>
          <p className="text-sm text-slate-500 mt-2 font-medium">
            No technical overhead, no local installs, and real-time database propagation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={scrollRevealVariant}
            className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xs hover:shadow-md transition-all duration-300 group"
          >
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650 mb-6 group-hover:scale-105 transition-transform">
              <Camera className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Instant Mobile Camera</h3>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">
              Photographers snap high-resolution fabric swatches from physical inventory straight on mobile browsers—no custom app installation required.
            </p>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={scrollRevealVariant}
            className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xs hover:shadow-md transition-all duration-300 group"
          >
            <div className="h-12 w-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-650 mb-6 group-hover:scale-105 transition-transform">
              <Laptop className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Collaborative Labeling</h3>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">
              Dashboard views sync instantly. Review incoming uploads, label fabric specifications, and flag bad lighting or blurry photos in real-time.
            </p>
          </motion.div>

          {/* Card 3 */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={scrollRevealVariant}
            className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xs hover:shadow-md transition-all duration-300 group"
          >
            <div className="h-12 w-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-650 mb-6 group-hover:scale-105 transition-transform">
              <Printer className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Automated Barcode stickers</h3>
            <p className="text-slate-500 text-xs leading-relaxed font-medium">
              Create printable barcode tags with custom naming instantly. Slap stickers on physical fabric rolls for efficient store inventory auditing.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Interactive Workflow Section */}
      <section id="workflow" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10 border-t border-slate-200/50">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-6">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
              A 3-Step Digitization Pipeline
            </h2>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              We have eliminated manual form indexing. Connect multiple cameras and computers in your warehouse, and let real-time synchronization handle the log updates.
            </p>
            <div className="pt-2">
              <Link
                href={user ? "/dashboard" : "/login"}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-650 hover:text-indigo-805 group"
              >
                <span>Launch the cataloging desk</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            {/* Step 1 */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={scrollRevealVariant}
              className="bg-white border border-slate-200/60 rounded-2xl p-6 flex gap-4 shadow-xs"
            >
              <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650 shrink-0 font-bold">1</div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">Snap Sample Swatch</h4>
                <p className="text-slate-500 text-xs leading-relaxed">
                  The mobile photographer captures flat physical fabric swatches. The system auto-uploads the image and broadcasts it directly to the dashboard.
                </p>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={scrollRevealVariant}
              className="bg-white border border-slate-200/60 rounded-2xl p-6 flex gap-4 shadow-xs"
            >
              <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650 shrink-0 font-bold">2</div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">Label Details</h4>
                <p className="text-slate-500 text-xs leading-relaxed">
                  The desktop labeling operator edits the catalog name of the swatch, binds it, or discards blurry photos to prompt a mobile retake alert.
                </p>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={scrollRevealVariant}
              className="bg-white border border-slate-200/60 rounded-2xl p-6 flex gap-4 shadow-xs"
            >
              <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650 shrink-0 font-bold">3</div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">Print Barcode Tag</h4>
                <p className="text-slate-500 text-xs leading-relaxed">
                  An automatic barcode and QR layout is compiled. Print the tag on sticker labels, paste it onto physical inventory fabric rolls, and track with any barcode scanner.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={scrollRevealVariant}
          className="bg-gradient-to-tr from-slate-900 to-indigo-950 rounded-3xl p-8 md:p-12 text-center text-white relative overflow-hidden shadow-xl"
        >
          {/* Subtle glow */}
          <div className="absolute inset-0 bg-indigo-500/10 pointer-events-none" />
          
          <div className="max-w-2xl mx-auto space-y-6 relative z-10">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Ready to Digitize Your Fabrics?
            </h2>
            <p className="text-sm text-indigo-200/80 font-medium leading-relaxed max-w-lg mx-auto">
              Get your warehouse up and running with a production-ready, multi-user system. Lock down uploads, audit catalog changes, and search catalog archives.
            </p>
            <div className="pt-2">
              <Link
                href={user ? "/dashboard" : "/login"}
                className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-slate-50 text-indigo-950 rounded-2xl font-bold shadow-md transition-all cursor-pointer group"
              >
                <span>{user ? "Access Dashboard" : "Sign In & Get Started"}</span>
                <ArrowRight className="h-5 w-5 text-indigo-950 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-10 relative z-10 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} Ziegler Textile Operations. All rights reserved.</p>
        <p className="mt-1">Designed for internal warehouse and logistics cataloging.</p>
      </footer>
    </div>
  );
}
