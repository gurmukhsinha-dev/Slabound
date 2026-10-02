'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  Activity, 
  ShieldAlert, 
  Settings, 
  Cpu,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Contracts', href: '/contracts', icon: FileText },
  { name: 'Telemetry', href: '/telemetry', icon: Activity },
  { name: 'Disputes', href: '/disputes', icon: ShieldAlert },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#0D121F] border-r border-gray-800 flex flex-col shrink-0 h-screen sticky top-0 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-gray-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[2px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-[#0D121F] rounded-[10px] flex items-center justify-center">
              <Cpu className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-wider text-white">SLABound</span>
              <span className="text-[10px] px-1.5 py-0.5 font-semibold bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-gray-400">Autonomous SLA Engine</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1.5">
        <div className="px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-gray-500">
          Core Operations
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600/30 to-indigo-500/10 text-white border-l-4 border-indigo-500 shadow-sm shadow-indigo-950'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-gray-400'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* AWS Infrastructure Status Box */}
      <div className="p-4 border-t border-gray-800/80 bg-[#0A0E18]/60 m-3 rounded-xl border">
        <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            AWS Production Grid
          </span>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="text-[11px] text-gray-400 space-y-1">
          <div className="flex justify-between">
            <span>Bedrock Claude 3.5:</span>
            <span className="text-emerald-400">Online</span>
          </div>
          <div className="flex justify-between">
            <span>Neptune Gremlin:</span>
            <span className="text-cyan-400">Port 8182</span>
          </div>
          <div className="flex justify-between">
            <span>zk-KMS Prover:</span>
            <span className="text-indigo-400">RSA-2048</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
