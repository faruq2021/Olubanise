import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  BrainCircuit,
  MonitorDot,
  Wallet,
  History,
  Shield,
  Plus,
  CheckCircle2,
  Trash2,
  LogOut
} from 'lucide-react';
import axios from 'axios';
import { SignalRService } from './services/SignalRService';

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:5241") + "/api";

type View = 'dashboard' | 'soul' | 'desktop' | 'wallet' | 'audit' | 'security';

function App() {
  const [user, setUser] = useState<{ id: string, email: string } | null>(() => {
    const saved = localStorage.getItem('olu_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [status, setStatus] = useState('disconnected');
  const [qr, setQr] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showTopUp, setShowTopUp] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("Olubanise is loading...");
  const [activePreset, setActivePreset] = useState("Default");

  // Security State
  const [securitySettings, setSecuritySettings] = useState({
    requireApprovalForDestructive: true,
    restrictToWorkFolder: true,
    workDirectory: "C:\\OlubaniseWork"
  });
  const [trustedSources, setTrustedSources] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [newTrustedSource, setNewTrustedSource] = useState("");

  useEffect(() => {
    if (!user) return;

    // Initial Data Fetch
    fetchInitialData();

    const signalR = new SignalRService(user.id);

    signalR.onStatusUpdate((data) => {
      setStatus(data.status);
      if (data.qr) setQr(data.qr);
    });

    signalR.onSessionUpdated((data) => {
      setStatus(data.status);
      setQr(null);
    });

    return () => signalR.disconnect();
  }, [user]);

  const fetchInitialData = async () => {
    if (!user) return;
    try {
      // Fetch Wallet
      const walletRes = await axios.get(`${API_BASE}/payments/${user.id}/wallet`);
      setBalance(walletRes.data.balance);
      setTransactions(walletRes.data.transactions);

      // Fetch Security Settings
      const settingsRes = await axios.get(`${API_BASE}/security/${user.id}/settings`);
      setSecuritySettings(settingsRes.data);

      // Fetch Trusted Sources
      const trustedRes = await axios.get(`${API_BASE}/security/${user.id}/trusted`);
      setTrustedSources(trustedRes.data);

      // Fetch Audit Logs for Dashboard
      const auditRes = await axios.get(`${API_BASE}/security/${user.id}/audit`);
      setAuditLogs(auditRes.data);

      // Fetch Soul (System Prompt)
      const soulRes = await axios.get(`${API_BASE}/sessions/${user.id}`);
      if (soulRes.data && soulRes.data.systemPrompt) {
        setSystemPrompt(soulRes.data.systemPrompt);
      }
    } catch (e) {
      console.error("Error fetching initial data", e);
    }
  };

  // Fetch data on view change
  useEffect(() => {
    if (!user) return;
    if (currentView === 'security' || currentView === 'dashboard') {
      fetchSecurityData();
    }
    if (currentView === 'wallet') {
      fetchWalletData();
    }
    if (currentView === 'audit') {
      fetchSecurityData();
    }
  }, [currentView, user]);

  const fetchWalletData = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API_BASE}/payments/${user.id}/wallet`);
      setBalance(res.data.balance);
      setTransactions(res.data.transactions);
    } catch (e) { console.error(e); }
  };

  const fetchSecurityData = async () => {
    if (!user) return;
    try {
      const settingsRes = await axios.get(`${API_BASE}/security/${user.id}/settings`);
      setSecuritySettings(settingsRes.data);

      const trustedRes = await axios.get(`${API_BASE}/security/${user.id}/trusted`);
      setTrustedSources(trustedRes.data);

      const auditRes = await axios.get(`${API_BASE}/security/${user.id}/audit`);
      setAuditLogs(auditRes.data);
    } catch (e) {
      console.error("Error fetching security data", e);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const endpoint = authView === 'login' ? 'login' : 'register';
      const res = await axios.post(`${API_BASE}/auth/${endpoint}`, {
        email: authEmail,
        password: authPassword
      });
      const userData = res.data;
      localStorage.setItem('olu_user', JSON.stringify(userData));
      setUser(userData);
    } catch (err: any) {
      alert(err.response?.data || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('olu_user');
    setUser(null);
    setQr(null);
    setStatus('disconnected');
  };

  const updateSettings = async (updates: any) => {
    if (!user) return;
    const newSettings = { ...securitySettings, ...updates };
    setSecuritySettings(newSettings);
    try {
      await axios.post(`${API_BASE}/security/${user.id}/settings`, newSettings);
    } catch (e) {
      console.error("Error saving settings", e);
    }
  };

  const addTrustedSource = async () => {
    if (!user || !newTrustedSource) return;
    try {
      const res = await axios.post(`${API_BASE}/security/${user.id}/trusted`, {
        phoneNumber: newTrustedSource,
        platform: 'WhatsApp'
      });
      setTrustedSources([res.data, ...trustedSources]);
      setNewTrustedSource("");
    } catch (e) {
      console.error("Error adding trusted source", e);
    }
  };

  const removeTrustedSource = async (id: string) => {
    if (!user) return;
    try {
      await axios.delete(`${API_BASE}/security/${user.id}/trusted/${id}`);
      setTrustedSources(trustedSources.filter(s => s.id !== id));
    } catch (e) {
      console.error("Error removing trusted source", e);
    }
  };

  const updateSoul = async (newPrompt: string) => {
    if (!user) return;
    try {
      await axios.post(`${API_BASE}/sessions/${user.id}/soul`, {
        systemPrompt: newPrompt
      });
      setSystemPrompt(newPrompt);
      alert("Soul Updated Successfully!");
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-background">
          <div className="auth-blob" style={{ top: '-10%', left: '-10%' }}></div>
          <div className="auth-blob" style={{ bottom: '-10%', right: '-10%', animationDelay: '-5s' }}></div>
        </div>
        <div className="auth-card">
          <div className="auth-logo">
            <div className="logo-box">
              <LayoutDashboard size={28} color="white" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900 }}>Olubanise</h1>
          </div>
          <div className="auth-title">
            <h2>{authView === 'login' ? 'Welcome Back' : 'Get Started'}</h2>
            <p>{authView === 'login' ? 'Sign in to manage your AI agent.' : 'Create an account to start your journey.'}</p>
          </div>
          <form className="auth-form" onSubmit={handleAuth}>
            <div className="input-group">
              <label className="input-label">Email Address</label>
              <input
                type="email"
                className="text-input"
                placeholder="name@example.com"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Password</label>
              <input
                type="password"
                className="text-input"
                placeholder="••••••••"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
            </div>
            <button className="primary-btn" type="submit" disabled={isLoading}>
              {isLoading ? 'Processing...' : (authView === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
          <div className="auth-footer">
            {authView === 'login' ? (
              <>Don't have an account? <span className="auth-link" onClick={() => setAuthView('register')}>Sign up</span></>
            ) : (
              <>Already have an account? <span className="auth-link" onClick={() => setAuthView('login')}>Sign in</span></>
            )}
          </div>
        </div>
      </div>
    );
  }

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
                  {balance.toFixed(2)}
                  <span className="credits-symbol">CR</span>
                </div>
              </div>

              <div className="card pairing-card">
                <div className="card-header">
                  <div className="card-title">WhatsApp Pairing</div>
                </div>
                <div className="qr-container">
                  {qr ? (
                    <img src={`data:image/png;base64,${qr}`} alt="QR Code" style={{ width: '100%', borderRadius: 8 }} />
                  ) : (
                    <div className="qr-placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b', color: '#64748b', fontSize: '0.8rem', width: '100%', height: '100%' }}>
                      {status === 'connected' ? 'Connected ✅' : 'Waiting for QR...'}
                    </div>
                  )}
                </div>
                <div className={`connection-status ${status}`}>
                  <div className="status-dot"></div>
                  {status === 'connected' ? 'Active Connection' : 'Scan to Connect'}
                </div>
              </div>

              <div className="card activity-card">
                <div className="card-header">
                  <div className="card-title">Live Security Feed</div>
                </div>
                <div className="activity-list">
                  {auditLogs.slice(0, 3).map(log => (
                    <ActivityItem
                      key={log.id}
                      icon={log.status === 'Blocked' ? <Shield size={18} color="#ef4444" /> : <CheckCircle2 size={18} color="#4ade80" />}
                      title={log.action}
                      sub={log.resource}
                      status={log.status}
                    />
                  ))}
                  {auditLogs.length === 0 && <div className="empty-state">No recent activity</div>}
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

      case 'security':
        return (
          <div className="section-container">
            <header className="header">
              <h1>Security & Deep Permissions</h1>
              <p className="last-sync">Manage how your Agent interacts with sensitive data.</p>
            </header>
            <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Permission Toggles</div>
                </div>
                <div className="setting-row" style={{ marginBottom: 24 }}>
                  <div className="setting-info">
                    <div className="setting-label">Require Approval for Deletion</div>
                    <div className="setting-desc">Agent must ask via WhatsApp before deleting files.</div>
                  </div>
                  <Toggle
                    active={securitySettings.requireApprovalForDestructive}
                    onToggle={() => updateSettings({ requireApprovalForDestructive: !securitySettings.requireApprovalForDestructive })}
                  />
                </div>
                <div className="setting-row">
                  <div className="setting-info">
                    <div className="setting-label">Restrict to Work Folder</div>
                    <div className="setting-desc">Agent can only access files in the specified directory.</div>
                  </div>
                  <Toggle
                    active={securitySettings.restrictToWorkFolder}
                    onToggle={() => updateSettings({ restrictToWorkFolder: !securitySettings.restrictToWorkFolder })}
                  />
                </div>
                {securitySettings.restrictToWorkFolder && (
                  <div className="input-group" style={{ marginTop: 16 }}>
                    <label className="input-label">Work Directory Path</label>
                    <input
                      type="text"
                      className="text-input"
                      value={securitySettings.workDirectory}
                      onChange={(e) => updateSettings({ workDirectory: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">Trusted Sources</div>
                </div>
                <p className="setting-desc" style={{ marginBottom: 16 }}>Only these verified numbers can trigger the agent.</p>

                <div className="input-group" style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="+234..."
                    value={newTrustedSource}
                    onChange={(e) => setNewTrustedSource(e.target.value)}
                  />
                  <button className="primary-btn" onClick={addTrustedSource} style={{ width: 'auto' }}>Add</button>
                </div>

                <div className="trusted-list">
                  {trustedSources.map((s: any) => (
                    <div key={s.id} className="trusted-item">
                      <div className="trusted-info">
                        <CheckCircle2 size={16} color="#4ade80" />
                        <span>{s.phoneNumber}</span>
                      </div>
                      <button className="icon-btn" onClick={() => removeTrustedSource(s.id)}>
                        <Trash2 size={16} color="#ef4444" />
                      </button>
                    </div>
                  ))}
                  {trustedSources.length === 0 && <div className="empty-state">No trusted sources added. Agent is open to all.</div>}
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 24 }}>
              <div className="card-header">
                <div className="card-title">Security Audit Log</div>
              </div>
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Status</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log: any) => (
                    <tr key={log.id}>
                      <td>{new Date(log.timestamp).toLocaleString()}</td>
                      <td>{log.action}</td>
                      <td>{log.resource}</td>
                      <td>
                        <span className={`type-badge ${log.status === 'Blocked' ? 'type-debit' : 'type-credit'}`}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td>{log.reason}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20 }}>No security events logged.</td></tr>}
                </tbody>
              </table>
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
                  style={{ minHeight: 150 }}
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
                <div className="pairing-code">OLU-{user.id.substring(0, 4).toUpperCase()}</div>
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
                  {balance.toFixed(2)}
                  <span className="credits-symbol">CR</span>
                </div>
                <button className="primary-btn" onClick={() => setShowTopUp(true)}>Buy Credits</button>
              </div>
              <div className="card">
                <div className="card-title">Usage Statistics</div>
                <p className="soul-description">You have {transactions.length} recent transactions.</p>
                <div style={{ marginTop: 20 }}>
                  <div className="last-sync">Daily Average: Calculated on use</div>
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
                  {transactions.map((t: any) => (
                    <tr key={t.id}>
                      <td>{new Date(t.timestamp).toLocaleDateString()}</td>
                      <td>{t.description}</td>
                      <td><span className={`type-badge ${t.transactionType === 'DEBIT' ? 'type-debit' : 'type-credit'}`}>{t.transactionType}</span></td>
                      <td>{t.amount.toFixed(2)} CR</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>No transactions yet.</td></tr>}
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
                {auditLogs.map(log => (
                  <ActivityItem
                    key={log.id}
                    icon={<History size={18} />}
                    title={log.action}
                    sub={`${log.resource} - ${log.reason}`}
                    status={log.status}
                  />
                ))}
                {auditLogs.length === 0 && <div className="empty-state">No audit logs available.</div>}
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
          <NavItem icon={<Shield size={20} />} label="Security" active={currentView === 'security'} onClick={() => setCurrentView('security')} />
          <NavItem icon={<BrainCircuit size={20} />} label="Agent Soul" active={currentView === 'soul'} onClick={() => setCurrentView('soul')} />
          <NavItem icon={<MonitorDot size={20} />} label="Desktop Link" active={currentView === 'desktop'} onClick={() => setCurrentView('desktop')} />
          <NavItem icon={<Wallet size={20} />} label="Wallet" active={currentView === 'wallet'} onClick={() => setCurrentView('wallet')} />
          <NavItem icon={<History size={20} />} label="Audit Logs" active={currentView === 'audit'} onClick={() => setCurrentView('audit')} />
        </nav>
        <div className="sidebar-footer" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="user-avatar" style={{ background: 'linear-gradient(45deg, #818cf8, #f472b6)' }}></div>
            <div className="user-info">
              <div className="name">{user.email.split('@')[0]}</div>
              <div className="role">Member</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} style={{ width: '100%' }}>
            <LogOut size={14} /> Sign Out
          </button>
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
              alert(`Top up of ${val} NGN initiated! Payment Gateway redirected...`);
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

function Toggle({ active, onToggle }: any) {
  return (
    <div
      className={`toggle-switch ${active ? 'active' : ''}`}
      onClick={onToggle}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: active ? '#4ade80' : '#334155',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background-color 0.2s'
      }}
    >
      <div style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        backgroundColor: 'white',
        position: 'absolute',
        top: 2,
        left: active ? 22 : 2,
        transition: 'left 0.2s'
      }} />
    </div>
  );
}

export default App;
