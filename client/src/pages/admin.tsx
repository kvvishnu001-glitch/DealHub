import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUploadModal } from "@/components/FileUploadModal";

interface AdminUser {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

interface Deal {
  id: string;
  title: string;
  description: string;
  store: string;
  category: string;
  original_price: number;
  sale_price: number;
  discount_percentage: number;
  image_url: string;
  affiliate_url: string;
  is_ai_approved: boolean;
  deal_type: string;
  click_count: number;
  share_count: number;
  created_at: string;
}

interface AdminMetrics {
  total_deals: number;
  ai_approved_deals: number;
  pending_deals: number;
  total_clicks: number;
  total_shares: number;
  revenue_estimate: number;
  top_categories: Array<{category: string; deals_count: number; clicks: number}>;
  top_stores: Array<{store: string; deals_count: number; clicks: number}>;
  recent_activity: Array<{id: string; title: string; store: string; category: string; created_at: string; clicks: number; ai_approved: boolean}>;
}

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [dealForm, setDealForm] = useState({
    title: "",
    description: "",
    store: "",
    category: "",
    original_price: "",
    sale_price: "",
    discount_percentage: "",
    image_url: "",
    affiliate_url: "",
    deal_type: "latest"
  });

  const queryClient = useQueryClient();

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      fetchCurrentAdmin();
    } else {
      setIsCheckingAuth(false);
    }
  }, []);

  const fetchCurrentAdmin = async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      setIsCheckingAuth(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const admin = await response.json();
        setCurrentAdmin(admin);
        setIsLoggedIn(true);
      } else {
        localStorage.removeItem("admin_token");
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error("Error fetching admin:", error);
      localStorage.removeItem("admin_token");
      setIsLoggedIn(false);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: {username: string; password: string}) => {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Login failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("admin_token", data.access_token);
      setCurrentAdmin(data.admin);
      setIsLoggedIn(true);
      console.log("Login successful:", data.admin.username);
    },
    onError: (error: Error) => {
      console.error("Login failed:", error.message);
      alert("Login failed: " + error.message);
    }
  });

  // Metrics query
  const { data: metrics } = useQuery<AdminMetrics>({
    queryKey: ["admin-metrics"],
    queryFn: async () => {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/metrics", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch metrics");
      return response.json();
    },
    enabled: isLoggedIn
  });

  // Deals query
  const { data: deals, refetch: refetchDeals } = useQuery<Deal[]>({
    queryKey: ["admin-deals"],
    queryFn: async () => {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/deals", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch deals");
      return response.json();
    },
    enabled: isLoggedIn && activeTab === "deals"
  });

  // Create deal mutation
  const createDealMutation = useMutation({
    mutationFn: async (dealData: any) => {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/deals", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...dealData,
          original_price: parseFloat(dealData.original_price),
          sale_price: parseFloat(dealData.sale_price),
          discount_percentage: parseInt(dealData.discount_percentage)
        })
      });
      if (!response.ok) throw new Error("Failed to create deal");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-deals"] });
      queryClient.invalidateQueries({ queryKey: ["admin-metrics"] });
      setShowAddDeal(false);
      resetDealForm();
      toast({ title: "Deal created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create deal", description: error.message, variant: "destructive" });
    }
  });

  // Delete deal mutation
  const deleteDealMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/api/admin/deals/${dealId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to delete deal");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-deals"] });
      queryClient.invalidateQueries({ queryKey: ["admin-metrics"] });
      toast({ title: "Deal deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete deal", description: error.message, variant: "destructive" });
    }
  });

  // Approve/reject deal mutations
  const approveDealMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/api/admin/deals/${dealId}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to approve deal");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-deals"] });
      toast({ title: "Deal approved successfully" });
    }
  });

  const rejectDealMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/api/admin/deals/${dealId}/reject`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to reject deal");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-deals"] });
      toast({ title: "Deal rejected successfully" });
    }
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginData);
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setIsLoggedIn(false);
    setCurrentAdmin(null);
    setActiveTab("dashboard");
  };

  const resetDealForm = () => {
    setDealForm({
      title: "",
      description: "",
      store: "",
      category: "",
      original_price: "",
      sale_price: "",
      discount_percentage: "",
      image_url: "",
      affiliate_url: "",
      deal_type: "latest"
    });
    setEditingDeal(null);
  };

  const handleCreateDeal = (e: React.FormEvent) => {
    e.preventDefault();
    createDealMutation.mutate(dealForm);
  };

  // Debug: show current state
  console.log("Admin Page State:", { isCheckingAuth, isLoggedIn, currentAdmin });

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ animation: "spin 1s linear infinite", borderRadius: "50%", height: "32px", width: "32px", borderBottom: "2px solid #2563eb", margin: "0 auto" }}></div>
          <p style={{ marginTop: "8px", color: "#6b7280" }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Login form
  if (!isLoggedIn) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", width: "100%", maxWidth: "400px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", textAlign: "center", marginBottom: "8px" }}>DealSphere Admin</h1>
          <p style={{ textAlign: "center", color: "#6b7280", marginBottom: "24px" }}>Sign in to access the admin dashboard</p>
          
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label htmlFor="username" style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: "500" }}>Username</label>
              <input
                id="username"
                type="text"
                value={loginData.username}
                onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                required
                style={{ 
                  width: "100%", 
                  padding: "8px 12px", 
                  border: "1px solid #d1d5db", 
                  borderRadius: "4px",
                  fontSize: "14px"
                }}
              />
            </div>
            <div>
              <label htmlFor="password" style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: "500" }}>Password</label>
              <input
                id="password"
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                required
                style={{ 
                  width: "100%", 
                  padding: "8px 12px", 
                  border: "1px solid #d1d5db", 
                  borderRadius: "4px",
                  fontSize: "14px"
                }}
              />
            </div>
            <button 
              type="submit" 
              disabled={loginMutation.isPending}
              style={{ 
                width: "100%", 
                padding: "12px", 
                backgroundColor: loginMutation.isPending ? "#9ca3af" : "#2563eb", 
                color: "white", 
                border: "none", 
                borderRadius: "4px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: loginMutation.isPending ? "not-allowed" : "pointer"
              }}
            >
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </button>
          </form>
          
          <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "4px" }}>
            <div style={{ fontSize: "14px" }}>
              <strong>Demo Credentials:</strong><br />
              Username: admin<br />
              Password: admin123
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main admin dashboard
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6" }}>
      {/* Header */}
      <header style={{ backgroundColor: "white", borderBottom: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#111827" }}>DealSphere Admin</h1>
              <nav style={{ display: "flex", gap: "16px" }}>
                <button
                  onClick={() => setActiveTab("dashboard")}
                  style={{ 
                    padding: "8px 16px", 
                    backgroundColor: activeTab === "dashboard" ? "#2563eb" : "transparent", 
                    color: activeTab === "dashboard" ? "white" : "#374151",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab("deals")}
                  style={{ 
                    padding: "8px 16px", 
                    backgroundColor: activeTab === "deals" ? "#2563eb" : "transparent", 
                    color: activeTab === "deals" ? "white" : "#374151",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  Manage Deals
                </button>
              </nav>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ fontSize: "14px", color: "#6b7280" }}>Welcome, {currentAdmin?.username}</span>
              <button 
                onClick={handleLogout}
                style={{ 
                  padding: "8px 16px", 
                  backgroundColor: "transparent", 
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 16px" }}>
        {/* Dashboard Tab */}
        {activeTab === "dashboard" && metrics && (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {/* Metrics Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "24px" }}>
              <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: "500", color: "#6b7280" }}>Total Deals</h3>
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>📊</span>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#111827" }}>{metrics.total_deals}</div>
                <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  {metrics.ai_approved_deals} AI approved
                </p>
              </div>

              <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: "500", color: "#6b7280" }}>Total Clicks</h3>
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>👥</span>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#111827" }}>{metrics.total_clicks}</div>
                <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  {metrics.total_shares} shares
                </p>
              </div>

              <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: "500", color: "#6b7280" }}>Revenue Estimate</h3>
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>💰</span>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#111827" }}>${metrics.revenue_estimate.toFixed(2)}</div>
                <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  Based on clicks
                </p>
              </div>

              <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: "500", color: "#6b7280" }}>Pending Review</h3>
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>📈</span>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#111827" }}>{metrics.pending_deals}</div>
                <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  Awaiting approval
                </p>
              </div>
            </div>

            {/* Charts and Lists */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "32px" }}>
              {/* Top Categories */}
              <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Top Categories</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {metrics.top_categories.map((category, index) => (
                    <div key={category.category} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "14px", fontWeight: "500" }}>{category.category}</span>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "14px", fontWeight: "600" }}>{category.deals_count} deals</div>
                        <div style={{ fontSize: "12px", color: "#6b7280" }}>{category.clicks} clicks</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Stores */}
              <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Top Stores</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {metrics.top_stores.map((store, index) => (
                    <div key={store.store} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "14px", fontWeight: "500" }}>{store.store}</span>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "14px", fontWeight: "600" }}>{store.deals_count} deals</div>
                        <div style={{ fontSize: "12px", color: "#6b7280" }}>{store.clicks} clicks</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Recent Activity</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {metrics.recent_activity.map((activity) => (
                  <div key={activity.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "500", marginBottom: "4px" }}>{activity.title}</div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>{activity.store} • {activity.category}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ 
                        fontSize: "12px", 
                        padding: "2px 8px", 
                        borderRadius: "12px", 
                        backgroundColor: activity.ai_approved ? "#10b981" : "#6b7280", 
                        color: "white" 
                      }}>
                        {activity.ai_approved ? "Approved" : "Pending"}
                      </span>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>{activity.clicks} clicks</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Deals Management Tab */}
        {activeTab === "deals" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "bold" }}>Manage Deals</h2>
              <button
                onClick={() => setShowFileUpload(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 24px",
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500"
                }}
                data-testid="upload-deals-button"
              >
                📁 Upload Deal Files
              </button>
            </div>
            
            {/* Upload Instructions */}
            <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Bulk Deal Upload</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
                <div>
                  <h4 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px", color: "#374151" }}>📊 Supported Formats</h4>
                  <ul style={{ fontSize: "14px", color: "#6b7280", listStyle: "disc", marginLeft: "20px" }}>
                    <li>CSV files (.csv)</li>
                    <li>Excel files (.xls, .xlsx)</li>
                    <li>XML files (.xml)</li>
                    <li>JSON files (.json)</li>
                    <li>Text files (.txt)</li>
                  </ul>
                </div>
                
                <div>
                  <h4 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px", color: "#374151" }}>🌐 Supported Networks</h4>
                  <ul style={{ fontSize: "14px", color: "#6b7280", listStyle: "disc", marginLeft: "20px" }}>
                    <li>Amazon Associates</li>
                    <li>Commission Junction (CJ)</li>
                    <li>ShareASale</li>
                    <li>Rakuten Advertising</li>
                    <li>Impact Radius</li>
                    <li>Other networks</li>
                  </ul>
                </div>
                
                <div>
                  <h4 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px", color: "#374151" }}>⚙️ How it Works</h4>
                  <ol style={{ fontSize: "14px", color: "#6b7280", listStyle: "decimal", marginLeft: "20px" }}>
                    <li>Select affiliate network</li>
                    <li>Upload deal files (max 50MB)</li>
                    <li>AI validates and processes deals</li>
                    <li>Review and approve imported deals</li>
                  </ol>
                </div>
              </div>
            </div>
            
            {/* Sample Files Section */}
            <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>📥 Sample File Templates</h3>
              <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "16px" }}>
                Download sample files to see the correct format for each affiliate network:
              </p>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                {[
                  { network: 'amazon', name: 'Amazon Associates', desc: 'Product details with ratings and availability' },
                  { network: 'cj', name: 'Commission Junction', desc: 'CJ export format with commission data' },
                  { network: 'shareasale', name: 'ShareASale', desc: 'Merchant export with affiliate links' }
                ].map(({ network, name, desc }) => (
                  <div key={network} style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", backgroundColor: "#f9fafb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "8px" }}>
                      <h4 style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}>{name}</h4>
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = `/api/admin/deals/samples/download/${network}`;
                          link.download = `${network}_deals_sample.csv`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        style={{
                          padding: "4px 12px",
                          backgroundColor: "#2563eb",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "12px",
                          cursor: "pointer"
                        }}
                        data-testid={`download-sample-${network}`}
                      >
                        Download
                      </button>
                    </div>
                    <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>{desc}</p>
                    <p style={{ fontSize: "11px", color: "#9ca3af" }}>
                      Fields: title, description, price, image_url, product_url, category
                    </p>
                  </div>
                ))}
              </div>
              
              <div style={{ backgroundColor: "#dbeafe", border: "1px solid #93c5fd", borderRadius: "8px", padding: "16px", marginTop: "16px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px", color: "#1e40af" }}>💡 File Format Tips</h4>
                <ul style={{ fontSize: "12px", color: "#1e40af", margin: 0, paddingLeft: "16px" }}>
                  <li>Include headers in the first row for CSV/Excel files</li>
                  <li>Price fields should be numeric (29.99, not $29.99)</li>
                  <li>Use complete URLs for images and affiliate links</li>
                  <li>Required fields: title, description, price, product_url</li>
                  <li>Add detailed descriptions for better AI validation scores</li>
                </ul>
              </div>
            </div>
            
            <p style={{ color: "#6b7280", fontSize: "14px", fontStyle: "italic" }}>
              Perfect for networks without API access like CJ FTP exports or initial Amazon setups.
            </p>
          </div>
        )}
      </main>
      
      {/* File Upload Modal */}
      <FileUploadModal
        open={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        onUploadComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/admin/deals'] });
        }}
      />
    </div>
  );
}