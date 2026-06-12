'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Layers, ArrowLeft, Key, Globe, Database, Webhook, Check, Copy, 
  Terminal, ShieldCheck, Zap, Sparkles, ChevronRight, HelpCircle, Code
} from 'lucide-react';

interface Endpoint {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  title: string;
  description: string;
  auth: boolean;
  params?: { name: string; type: string; required: boolean; desc: string; example: string }[];
  requestBody?: string;
  responseBody: string;
  snippets: {
    curl: string;
    javascript: string;
    python: string;
  };
}

const endpoints: Endpoint[] = [
  {
    id: 'list-fabrics',
    method: 'GET',
    path: '/api/v1/fabrics',
    title: 'List Catalog Fabrics',
    description: 'Retrieve a paginated and filterable list of fabrics in the inventory catalog.',
    auth: true,
    params: [
      { name: 'limit', type: 'integer', required: false, desc: 'Max records (default: 100, max: 500)', example: '50' },
      { name: 'offset', type: 'integer', required: false, desc: 'Pagination offset (default: 0)', example: '100' },
      { name: 'status', type: 'string', required: false, desc: 'Filter by: pending, completed, discarded', example: 'completed' },
      { name: 'q', type: 'string', required: false, desc: 'Search term for name or QR ID', example: 'Linen' }
    ],
    responseBody: `{
  "data": [
    {
      "id": "8a7b6c5d-4e3d-2c1b-0a9f-8e7d6c5b4a3f",
      "qr_code_id": "FABRIC-8A7B6C5D",
      "name": "Indigo Herringbone Linen",
      "status": "completed",
      "color": "Indigo",
      "pattern": "Herringbone",
      "material": "Linen",
      "created_at": "2026-06-12T17:42:05Z",
      "assets": {
        "image_url": "https://supabase-storage/fabric-images/fabric_123.jpg"
      }
    }
  ],
  "pagination": { "limit": 100, "offset": 0, "count": 24 }
}`,
    snippets: {
      curl: `curl -X GET "https://your-app.com/api/v1/fabrics?status=completed&limit=10" \\
  -H "Authorization: Bearer my-secret-api-key"`,
      javascript: `const response = await fetch('https://your-app.com/api/v1/fabrics?status=completed', {
  headers: {
    'Authorization': 'Bearer my-secret-api-key'
  }
});
const result = await response.json();
console.log(result.data);`,
      python: `import requests

url = "https://your-app.com/api/v1/fabrics"
headers = {
    "Authorization": "Bearer my-secret-api-key"
}
params = {"status": "completed"}

response = requests.get(url, headers=headers, params=params)
print(response.json())`
    }
  },
  {
    id: 'get-fabric',
    method: 'GET',
    path: '/api/v1/fabrics/[qrCodeId]',
    title: 'Retrieve Single Fabric',
    description: 'Fetch detailed fabric roll specifications by its unique QR code ID.',
    auth: true,
    params: [
      { name: 'qrCodeId', type: 'string', required: true, desc: 'Unique scannable code ID', example: 'FABRIC-8A7B6C5D' }
    ],
    responseBody: `{
  "data": {
    "id": "8a7b6c5d-4e3d-2c1b-0a9f-8e7d6c5b4a3f",
    "qr_code_id": "FABRIC-8A7B6C5D",
    "name": "Indigo Herringbone Linen",
    "status": "completed",
    "color": "Indigo",
    "pattern": "Herringbone",
    "material": "Linen",
    "created_at": "2026-06-12T17:42:05Z",
    "session": { "id": "uuid-lobby-code", "code": "XYZ-LOBBY" },
    "assets": { "image_url": "https://storage/swatch.jpg" }
  }
}`,
    snippets: {
      curl: `curl -X GET "https://your-app.com/api/v1/fabrics/FABRIC-8A7B6C5D" \\
  -H "x-api-key: my-secret-api-key"`,
      javascript: `const response = await fetch('https://your-app.com/api/v1/fabrics/FABRIC-8A7B6C5D', {
  headers: {
    'x-api-key': 'my-secret-api-key'
  }
});
const result = await response.json();
console.log(result.data);`,
      python: `import requests

url = "https://your-app.com/api/v1/fabrics/FABRIC-8A7B6C5D"
headers = {
    "x-api-key": "my-secret-api-key"
}

response = requests.get(url, headers=headers)
print(response.json())`
    }
  },
  {
    id: 'bulk-import',
    method: 'POST',
    path: '/api/v1/fabrics/bulk',
    title: 'Bulk Import Fabrics',
    description: 'Batch insert newly arrived fabrics (inserts status as "pending" for tagging).',
    auth: true,
    requestBody: `[
  {
    "image_url": "https://storage/swatch1.jpg",
    "name": "Initial roll name 1",
    "color": "Red"
  },
  {
    "image_url": "https://storage/swatch2.jpg",
    "name": "Initial roll name 2"
  }
]`,
    responseBody: `{
  "success": true,
  "count": 2,
  "data": [
    { "id": "uuid-1", "qr_code_id": "FABRIC-ABC12345", "status": "pending" },
    { "id": "uuid-2", "qr_code_id": "FABRIC-XYZ98765", "status": "pending" }
  ]
}`,
    snippets: {
      curl: `curl -X POST "https://your-app.com/api/v1/fabrics/bulk" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer my-secret-api-key" \\
  -d '[{"image_url": "https://pic.jpg", "name": "Bulk Silk"}]'`,
      javascript: `const response = await fetch('https://your-app.com/api/v1/fabrics/bulk', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer my-secret-api-key'
  },
  body: JSON.stringify([
    { image_url: 'https://pic.jpg', name: 'Bulk Silk' }
  ])
});
const result = await response.json();`,
      python: `import requests

url = "https://your-app.com/api/v1/fabrics/bulk"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer my-secret-api-key"
}
data = [{"image_url": "https://pic.jpg", "name": "Bulk Silk"}]

response = requests.post(url, headers=headers, json=data)
print(response.json())`
    }
  },
  {
    id: 'bulk-update',
    method: 'PATCH',
    path: '/api/v1/fabrics/bulk',
    title: 'Bulk Update Fabrics',
    description: 'Update attributes (name, status, color, pattern, material, etc.) for multiple fabric records in one batch.',
    auth: true,
    requestBody: `[
  {
    "id": "8a7b6c5d-4e3d-2c1b-0a9f-8e7d6c5b4a3f",
    "name": "Updated Linen",
    "color": "Soft Indigo",
    "status": "completed"
  },
  {
    "id": "1e2f3a4b-5c6d-7e8f-9a0b-1c2d3e4f5a6b",
    "status": "discarded",
    "rejection_reason": "Out of stock"
  }
]`,
    responseBody: `{
  "success": true,
  "count": 2,
  "data": [
    { "id": "8a7b6c5d...", "name": "Updated Linen", "status": "completed" },
    { "id": "1e2f3a4b...", "status": "discarded" }
  ]
}`,
    snippets: {
      curl: `curl -X PATCH "https://your-app.com/api/v1/fabrics/bulk" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer my-secret-api-key" \\
  -d '[{"id": "uuid-1", "name": "New Name"}]'`,
      javascript: `const response = await fetch('https://your-app.com/api/v1/fabrics/bulk', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer my-secret-api-key'
  },
  body: JSON.stringify([{ id: 'uuid-1', name: 'New Name' }])
});
const result = await response.json();`,
      python: `import requests

url = "https://your-app.com/api/v1/fabrics/bulk"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer my-secret-api-key"
}
data = [{"id": "uuid-1", "name": "New Name"}]

response = requests.patch(url, headers=headers, json=data)
print(response.json())`
    }
  },
  {
    id: 'integration-test',
    method: 'GET',
    path: '/api/v1/integration/test',
    title: 'Verify Connection',
    description: 'Einfacher Verbindungstest zur Verifizierung des API-Schlüssels für Zapier/Make.com.',
    auth: true,
    responseBody: `{
  "authenticated": true,
  "message": "Connection successful. Fabric inventory API is ready.",
  "environment": "production",
  "info": {
    "system": "Real-Time Fabric Inventory",
    "api_version": "v1"
  },
  "team": {
    "id": "team-uuid",
    "name": "Munich Logistics Hub"
  }
}`,
    snippets: {
      curl: `curl -X GET "https://your-app.com/api/v1/integration/test" \\
  -H "x-api-key: my-secret-api-key"`,
      javascript: `const response = await fetch('https://your-app.com/api/v1/integration/test', {
  headers: {
    'x-api-key': 'my-secret-api-key'
  }
});
const result = await response.json();`,
      python: `import requests

url = "https://your-app.com/api/v1/integration/test"
headers = { "x-api-key": "my-secret-api-key" }
response = requests.get(url, headers=headers)
print(response.json())`
    }
  },
  {
    id: 'register-webhook',
    method: 'POST',
    path: '/api/v1/webhooks',
    title: 'Register Webhook',
    description: 'Subscribe a URL endpoint to real-time events triggered inside the warehouse.',
    auth: true,
    requestBody: `{
  "target_url": "https://your-erp.com/webhooks/fabric",
  "secret_token": "my-secret-signing-key",
  "events": ["fabric.completed", "fabric.discarded"]
}`,
    responseBody: `{
  "data": {
    "id": "webhook-subscription-uuid",
    "target_url": "https://your-erp.com/webhooks/fabric",
    "secret_token": "my-secret-signing-key",
    "events": ["fabric.completed", "fabric.discarded"],
    "active": true,
    "created_at": "2026-06-12T19:00:00Z"
  }
}`,
    snippets: {
      curl: `curl -X POST "https://your-app.com/api/v1/webhooks" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer my-secret-api-key" \\
  -d '{"target_url": "https://erp.com", "events": ["*"]}'`,
      javascript: `const response = await fetch('https://your-app.com/api/v1/webhooks', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer my-secret-api-key'
  },
  body: JSON.stringify({
    target_url: 'https://erp.com',
    events: ['*']
  })
});
const result = await response.json();`,
      python: `import requests

url = "https://your-app.com/api/v1/webhooks"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer my-secret-api-key"
}
data = {
    "target_url": "https://erp.com",
    "events": ["*"]
}

response = requests.post(url, headers=headers, json=data)
print(response.json())`
    }
  }
];

export default function DocsPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'curl' | 'js' | 'python' | 'schema'>('curl');
  const [activeEndpoint, setActiveEndpoint] = useState<string>(endpoints[0].id);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const selectedEndpoint = endpoints.find(e => e.id === activeEndpoint) || endpoints[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-100 rounded-full blur-3xl opacity-20 pointer-events-none" />
      <div className="absolute top-[800px] left-0 w-[400px] h-[400px] bg-violet-100 rounded-full blur-3xl opacity-20 pointer-events-none" />

      {/* Docs Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200/50 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Home</span>
            </Link>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-2 font-bold text-slate-950">
              <Layers className="h-4.5 w-4.5 text-indigo-650" />
              <span className="text-sm">API Reference</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-extrabold uppercase">v1.1</span>
            </div>
          </div>
          <div>
            <Link 
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-805"
            >
              <span>Control Center</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        <div className="grid grid-cols-12 gap-8 items-start">
          
          {/* 1. Sidebar Navigation */}
          <aside className="col-span-12 lg:col-span-3 space-y-6 lg:sticky lg:top-24">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 block">
                Overview
              </div>
              <div className="space-y-1">
                <a href="#auth" className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-650 hover:bg-slate-50 transition-colors">
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                  <span>Authentication</span>
                </a>
                <a href="#signatures" className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-650 hover:bg-slate-50 transition-colors">
                  <Webhook className="h-4 w-4 text-slate-400" />
                  <span>Webhook Security</span>
                </a>
              </div>
              
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mt-6 mb-2 block">
                API Endpoints
              </div>
              <nav className="space-y-1">
                {endpoints.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => {
                      setActiveEndpoint(ep.id);
                      const el = document.getElementById(ep.id);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                      activeEndpoint === ep.id
                        ? 'bg-indigo-50 border-indigo-100 text-indigo-750'
                        : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{ep.title}</span>
                    <span className={`text-[8px] font-extrabold px-1 py-0.5 rounded leading-none shrink-0 ${
                      ep.method === 'GET' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      ep.method === 'POST' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                      ep.method === 'PATCH' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {ep.method}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* 2. Main Content & Code Panels */}
          <main className="col-span-12 lg:col-span-9 space-y-12">
            
            {/* Title / Intro */}
            <div className="space-y-3">
              <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">API & Integration Spec</h1>
              <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-2xl">
                Erstelle Echtzeit-Workflows und integriere deine Logistics-Desk direkt in Warenwirtschaftssysteme (ERP), Shopify oder No-Code-Plattformen wie Zapier und Make.
              </p>
            </div>

            {/* Authentication Guide */}
            <section id="auth" className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-650 border border-indigo-100">
                  <Key className="h-4.5 w-4.5" />
                </div>
                <h2 className="text-lg font-bold text-slate-950">Authentication</h2>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Alle API-Routen unter `/api/v1` sind geschützt. Du kannst dich entweder über einen klassischen Bearer-Token im Authorization-Header oder über einen benutzerdefinierten Header autorisieren.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 font-mono text-xs">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Method 1: Bearer Token</span>
                  <span className="text-slate-800 font-bold">Authorization: Bearer</span> <span className="text-indigo-600 font-bold">&lt;YOUR_API_KEY&gt;</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 font-mono text-xs">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Method 2: Custom API Header</span>
                  <span className="text-slate-800 font-bold">x-api-key:</span> <span className="text-indigo-600 font-bold">&lt;YOUR_API_KEY&gt;</span>
                </div>
              </div>
            </section>

            {/* Webhook Signatures Guide */}
            <section id="signatures" className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-violet-50 rounded-lg flex items-center justify-center text-violet-650 border border-violet-100">
                  <Webhook className="h-4.5 w-4.5" />
                </div>
                <h2 className="text-lg font-bold text-slate-950">Webhook Security</h2>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Wenn du einen Webhook mit einem `secret_token` registrierst, signiert der Dispatcher jede Anfrage. So stellst du sicher, dass Aufrufe wirklich von unserem System stammen.
              </p>
              
              <div className="space-y-2.5">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-800">Signatur-Validierung (Beispiel Node.js)</h4>
                  <pre className="font-mono text-[11px] text-slate-650 overflow-x-auto">
{`const crypto = require('crypto');
const signature = req.headers['x-webhook-signature'];
const expectedSignature = crypto
  .createHmac('sha256', SECRET_TOKEN)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (signature === expectedSignature) {
  // Payload ist authentisch
}`}
                  </pre>
                </div>
                
                {/* Event Catalog table */}
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-55/60 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-450 tracking-wider">
                        <th className="p-3">Event Name</th>
                        <th className="p-3">Triggered When</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-100 font-medium">
                      <tr>
                        <td className="p-3 font-mono font-bold text-indigo-650">fabric.completed</td>
                        <td className="p-3 text-slate-550">Stoffrolle wird fertig beschriftet und QR-Code generiert.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-indigo-650">fabric.discarded</td>
                        <td className="p-3 text-slate-550">Stoffrolle wird wegen schlechter Qualität o.ä. verworfen.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-indigo-650">fabric.bulk_created</td>
                        <td className="p-3 text-slate-550">Massen-Import wird erfolgreich abgeschlossen.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-indigo-650">fabric.bulk_updated</td>
                        <td className="p-3 text-slate-550">Massen-Update von Attributen wird durchgeführt.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Dynamic Endpoint Documentation */}
            <section className="space-y-6">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                API Playground & Reference
              </div>

              {endpoints.map((ep) => (
                <div 
                  key={ep.id} 
                  id={ep.id} 
                  className={`bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6 transition-all relative ${
                    activeEndpoint === ep.id ? 'ring-2 ring-indigo-500/25 border-indigo-300' : ''
                  }`}
                >
                  {/* Endpoint Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-900">{ep.title}</h3>
                      <p className="text-xs text-slate-450 font-medium">{ep.description}</p>
                    </div>
                    
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className={`px-2 py-0.5 rounded font-extrabold ${
                        ep.method === 'GET' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        ep.method === 'POST' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        ep.method === 'PATCH' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {ep.method}
                      </span>
                      <span className="bg-slate-100 text-slate-650 font-bold px-2 py-0.5 rounded border border-slate-200/60">{ep.path}</span>
                    </div>
                  </div>

                  {/* Query / Path Parameters */}
                  {ep.params && ep.params.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parameters</div>
                      <div className="border border-slate-100 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-55/60 border-b border-slate-100 text-[9px] uppercase font-bold text-slate-450 tracking-wider">
                              <th className="p-2.5">Name</th>
                              <th className="p-2.5">Type</th>
                              <th className="p-2.5">Required</th>
                              <th className="p-2.5">Description</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs divide-y divide-slate-100 font-medium">
                            {ep.params.map(p => (
                              <tr key={p.name}>
                                <td className="p-2.5 font-mono font-bold text-slate-700">{p.name}</td>
                                <td className="p-2.5 text-slate-500 font-mono text-[10px]">{p.type}</td>
                                <td className="p-2.5">{p.required ? <span className="text-rose-600 font-bold">Yes</span> : <span className="text-slate-400">No</span>}</td>
                                <td className="p-2.5 text-slate-500 leading-normal">{p.desc} <span className="font-mono text-[9px] text-indigo-650">(e.g. {p.example})</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Request / Response Panel Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Code Snippets Selection */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Request Sample</div>
                        
                        <div className="flex gap-1.5 font-bold text-[9px]">
                          {(['curl', 'js', 'python'] as const).map(tab => (
                            <button
                              key={tab}
                              onClick={() => setActiveTab(tab)}
                              className={`px-2 py-0.5 rounded uppercase ${
                                activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {tab}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-900 rounded-xl p-4 font-mono text-[11px] text-indigo-200 relative overflow-hidden group shadow-inner">
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              const code = activeTab === 'curl' ? ep.snippets.curl :
                                           activeTab === 'js' ? ep.snippets.javascript :
                                           ep.snippets.python;
                              copyToClipboard(code, `${ep.id}-${activeTab}`);
                            }}
                            className="p-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors text-white"
                          >
                            {copiedId === `${ep.id}-${activeTab}` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        <pre className="overflow-x-auto text-left leading-relaxed">
                          {activeTab === 'curl' ? ep.snippets.curl :
                           activeTab === 'js' ? ep.snippets.javascript :
                           ep.snippets.python}
                        </pre>
                      </div>

                      {ep.requestBody && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payload Schema</div>
                          <pre className="bg-slate-50 border border-slate-150 rounded-xl p-3 font-mono text-[10px] text-slate-600 overflow-x-auto text-left max-h-36">
                            {ep.requestBody}
                          </pre>
                        </div>
                      )}
                    </div>

                    {/* Response Sample */}
                    <div className="space-y-2.5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Response JSON</div>
                      <div className="bg-slate-950 rounded-xl p-4 font-mono text-[11px] text-emerald-400 relative overflow-hidden group shadow-inner">
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyToClipboard(ep.responseBody, `${ep.id}-res`)}
                            className="p-1.5 bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors text-white"
                          >
                            {copiedId === `${ep.id}-res` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        <pre className="overflow-x-auto text-left max-h-56 leading-relaxed">
                          {ep.responseBody}
                        </pre>
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </section>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-8 text-center text-xs text-slate-400 relative z-10 mt-20">
        <p>© {new Date().getFullYear()} Inventory Hub. All rights reserved.</p>
      </footer>
    </div>
  );
}
