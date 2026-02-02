import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  BrainCircuit,
  MonitorDot,
  Wallet,
  History,
  Plus,
  CheckCircle2,
  FileText,
  DollarSign
} from 'lucide-react';
import axios from 'axios';
import { SignalRService } from './services/SignalRService';

const TEST_USER_ID = "00000000-0000-0000-0000-000000000000";
const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:5241") + "/api";

type View = 'dashboard' | 'soul' | 'desktop' | 'wallet' | 'audit';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [status, setStatus] = useState('disconnected');
  const [qr, setQr] = useState<string | null>(null);
  const [balance] = useState(45230.25);
  const [showTopUp, setShowTopUp] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("You are Olubanise, a helpful AI personal assistant. Be concise and professional.");
  const [activePreset, setActivePreset] = useState("Executive Assistant");

  useEffect(() => {
    const signalR = new SignalRService(TEST_USER_ID);

    signalR.onStatusUpdate((data) => {
      setStatus(data.status);
      if (data.qr) setQr(data.qr);
    });

    signalR.onSessionUpdated((data) => {
      setStatus(data.status);
      setQr(null);
    });

    return () => signalR.disconnect();
  }, []);


  const updateSoul = async (newPrompt: string) => {
    try {
      await axios.post(`${API_BASE}/sessions/${TEST_USER_ID}/soul`, {
        systemPrompt: newPrompt
      });
      setSystemPrompt(newPrompt);
      alert("Soul Updated Successfully!");
    } catch (err) {
      console.error(err);
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <div className="section-container">
            <div className="dashboard-grid">
              <div className="card credits-card">
                <div className="card-header">
                  <div className="card-title">Total Credits</div>
                  <button className="topup-btn" onClick={() => setShowTopUp(true)}>
                    <Plus size={14} style={{ marginRight: 4 }} />
                    Top Up
                  </button>
                </div>
                <div className="credits-amount">
                  {balance.toLocaleString()}
                  <span className="credits-symbol">CR</span>
                </div>
              </div>

              <div className="card pairing-card">
                <div className="card-header">
                  <div className="card-title">WhatsApp Pairing</div>
                </div>
                <div className="qr-container">
                  {qr ? (
                    <img src={`data:image/png;base64,${qr}`} alt="QR Code" style={{ width: '100%' }} />
                  ) : (
                    <div className="qr-placeholder"></div>
                  )}
                </div>
                <div className={`connection-status ${status}`}>
                  <div className="status-dot"></div>
                  {status === 'connected' ? 'Active Connection' : 'Scan to Connect'}
                </div>
              </div>

              <div className="card activity-card">
                <div className="card-header">
                  <div className="card-title">Recent Activity</div>
                </div>
                <div className="activity-list">
                  <ActivityItem
                    icon={<FileText size={18} color="#818cf8" />}
                    title="Olubanise organized 5 files"
                    sub="Local Desktop • 2 mins ago"
                    status="Done"
                  />
                  <ActivityItem
                    icon={<DollarSign size={18} color="#f472b6" />}
                    title="Invoice #2024-09 generated"
                    sub="QuickBooks Agent • 14 mins ago"
                    status="Sent"
                  />
                </div>
              </div>

              <div className="card soul-card">
                <div className="card-header">
                  <div className="card-title">Agent Soul</div>
                </div>
                <div className="soul-selector">
                  <div className="soul-icon">OA</div>
                  <div className="soul-name">{activePreset}</div>
                </div>
                <p className="soul-description">
                  "{systemPrompt.substring(0, 100)}..."
                </p>
                <button className="primary-btn" onClick={() => setCurrentView('soul')}>Configure Soul</button>
              </div>
            </div>
          </div>
        );

      case 'soul':
        return (
          <div className="section-container">
            <header className="header">
              <h1>Agent Soul</h1>
              <p className="last-sync">Define the persona and logic of your Olubanise agent.</p>
            </header>
            <div className="card">
              <div className="soul-editor">
                <div className="card-title">Presets</div>
                <div className="soul-preset-grid">
                  <PresetCard
                    title="Executive Assistant"
                    desc="Specializes in scheduling, email drafting, and file organization."
                    active={activePreset === "Executive Assistant"}
                    onClick={() => {
                      setActivePreset("Executive Assistant");
                      setSystemPrompt("You are a professional Executive Assistant. You handle logistics, professional emails, and scheduling with high efficiency.");
                    }}
                  />
                  <PresetCard
                    title="Expert Researcher"
                    desc="Optimized for deep web searches and data synthesis."
                    active={activePreset === "Expert Researcher"}
                    onClick={() => {
                      setActivePreset("Expert Researcher");
                      setSystemPrompt("You are an Expert Researcher. You provide detailed citations, analyze market trends, and synthesize complex information from multiple sources.");
                    }}
                  />
                </div>

                <div className="card-title" style={{ marginTop: 24 }}>Custom Soul Prompt</div>
                <textarea
                  className="textarea-input"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Describe how your agent should behave..."
                />
                <button className="primary-btn" onClick={() => updateSoul(systemPrompt)}>Save Soul Configuration</button>
              </div>
            </div>
          </div>
        );

      case 'desktop':
        return (
          <div className="section-container">
            <header className="header">
              <h1>Desktop Link</h1>
            </header>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="card-title">Pair Local Files & Apps</div>
              <p className="soul-description" style={{ margin: '20px auto', maxWidth: 400 }}>
                Link your Olubanise Desktop Agent to allow your AI to organize local folders and run local scripts.
              </p>
              <div className="pairing-code-box">
                <div className="card-title">Your Pairing Code</div>
                <div className="pairing-code">OLU-B3Z1</div>
              </div>
              <p className="last-sync">Enter this code into the Olubanise Desktop App.</p>
            </div>
          </div>
        );

      case 'wallet':
        return (
          <div className="section-container">
            <header className="header">
              <h1>Wallet & Credits</h1>
            </header>
            <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="card credits-card">
                <div className="card-header">
                  <div className="card-title">Logic Credits Balance</div>
                </div>
                <div className="credits-amount">
                  {balance.toLocaleString()}
                  <span className="credits-symbol">CR</span>
                </div>
                <button className="primary-btn" onClick={() => setShowTopUp(true)}>Buy Credits</button>
              </div>
              <div className="card">
                <div className="card-title">Usage Statistics</div>
                <p className="soul-description">Your agent uses approximately <b>14.2 CR</b> per message.</p>
                <div style={{ marginTop: 20 }}>
                  <div className="last-sync">Daily Average: 120 CR</div>
                  <div className="last-sync">Estimated Expiry: 14 Days</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-title">Recent Transactions</div>
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Feb 2, 2026</td>
                    <td>Claude 3.5 Sonnet Usage</td>
                    <td><span className="type-badge type-debit">DEBIT</span></td>
                    <td>-18.40 CR</td>
                  </tr>
                  <tr>
                    <td>Jan 30, 2026</td>
                    <td>Wallet Top-up (Paystack)</td>
                    <td><span className="type-badge type-credit">CREDIT</span></td>
                    <td>+20,000.00 CR</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'audit':
        return (
          <div className="section-container">
            <header className="header">
              <h1>Audit Logs</h1>
            </header>
            <div className="card">
              <div className="activity-list">
                <ActivityItem icon={<History size={18} />} title="System Prompt Updated" sub="Today • 10:42 AM" status="Logged" />
                <ActivityItem icon={<MonitorDot size={18} />} title="Desktop Agent Connected" sub="Feb 1 • 09:15 PM" status="Success" />
                <ActivityItem icon={<CheckCircle2 size={18} />} title="WhatsApp Session Authenticated" sub="Jan 28 • 02:22 PM" status="Secure" />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-box">
            <LayoutDashboard size={18} color="white" />
          </div>
          Olubanise
        </div>
        <nav className="nav-links">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
          <NavItem icon={<BrainCircuit size={20} />} label="Agent Soul" active={currentView === 'soul'} onClick={() => setCurrentView('soul')} />
          <NavItem icon={<MonitorDot size={20} />} label="Desktop Link" active={currentView === 'desktop'} onClick={() => setCurrentView('desktop')} />
          <NavItem icon={<Wallet size={20} />} label="Wallet" active={currentView === 'wallet'} onClick={() => setCurrentView('wallet')} />
          <NavItem icon={<History size={20} />} label="Audit Logs" active={currentView === 'audit'} onClick={() => setCurrentView('audit')} />
        </nav>
        <div className="sidebar-footer">
          <div className="user-avatar"></div>
          <div className="user-info">
            <div className="name">Simi Adebayo</div>
            <div className="role">Admin</div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {renderContent()}
      </main>

      {showTopUp && (
        <div className="modal-overlay" onClick={() => setShowTopUp(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Top Up Wallet</h2>
            </div>
            <div className="input-group">
              <label className="input-label">Amount (NGN)</label>
              <input type="number" className="text-input" placeholder="e.g. 5000" id="amount-input" />
            </div>
            <button className="primary-btn" onClick={() => {
              const val = (document.getElementById('amount-input') as HTMLInputElement).value;
              alert(`Top up of ${val} NGN initiated!`);
              setShowTopUp(false);
            }}>
              Proceed to Payment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: any) {
  return (
    <div className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      {label}
    </div>
  );
}

function PresetCard({ title, desc, active, onClick }: any) {
  return (
    <div className={`preset-card ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="name" style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div className="soul-description">{desc}</div>
    </div>
  );
}

function ActivityItem({ icon, title, sub, status }: any) {
  return (
    <div className="activity-item">
      <div className="activity-icon">{icon}</div>
      <div className="activity-details">
        <div className="title">{title}</div>
        <div className="sub">{sub}</div>
      </div>
      <div className={`activity-badge ${status.toLowerCase()}`}>
        <CheckCircle2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
        {status}
      </div>
    </div>
  );
}

export default App;
