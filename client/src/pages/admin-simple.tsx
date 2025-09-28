import React, { useState, useEffect } from "react";

export default function AdminSimple() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [metrics, setMetrics] = useState<any>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("admin_token", data.access_token);
        setCurrentAdmin(data.admin);
        setIsLoggedIn(true);
        fetchMetrics();
        fetchDeals();
        alert("Login successful!");
      } else {
        alert("Login failed!");
      }
    } catch (error) {
      alert("Login error: " + error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setIsLoggedIn(false);
    setCurrentAdmin(null);
    setActiveTab("dashboard");
  };

  // Check for existing token on mount
  useEffect(() => {
    // For now, always start with login form - clear any existing session
    localStorage.removeItem("admin_token");
    setIsLoggedIn(false);
    
    // Future: Add token verification here when backend supports it
    // const token = localStorage.getItem("admin_token");
    // if (token) {
    //   verifyTokenWithBackend(token);
    // }
  }, []);

  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/metrics", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    }
  };

  const fetchDeals = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/deals", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDeals(data);
      }
    } catch (error) {
      console.error("Error fetching deals:", error);
    }
  };

  const approveDeal = async (dealId: string) => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/api/admin/deals/${dealId}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        alert("Deal approved successfully!");
        fetchDeals();
        fetchMetrics();
      }
    } catch (error) {
      alert("Error approving deal: " + error);
    }
  };

  const rejectDeal = async (dealId: string) => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/api/admin/deals/${dealId}/reject`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        alert("Deal rejected successfully!");
        fetchDeals();
        fetchMetrics();
      }
    } catch (error) {
      alert("Error rejecting deal: " + error);
    }
  };

  if (isLoggedIn) {
    return (
      <div style={{ fontFamily: "Arial, sans-serif", minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
        {/* Header */}
        <div style={{ backgroundColor: "white", borderBottom: "1px solid #ddd", padding: "15px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <h1 style={{ margin: 0, color: "#333" }}>DealSphere Admin</h1>
              <nav style={{ display: "flex", gap: "15px" }}>
                <button
                  onClick={() => setActiveTab("dashboard")}
                  style={{ 
                    padding: "8px 15px", 
                    backgroundColor: activeTab === "dashboard" ? "#007bff" : "transparent", 
                    color: activeTab === "dashboard" ? "white" : "#333",
                    border: "1px solid #007bff",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab("deals")}
                  style={{ 
                    padding: "8px 15px", 
                    backgroundColor: activeTab === "deals" ? "#007bff" : "transparent", 
                    color: activeTab === "deals" ? "white" : "#333",
                    border: "1px solid #007bff",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  Manage Deals
                </button>
              </nav>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <span style={{ fontSize: "14px", color: "#666" }}>Welcome, {currentAdmin?.username || "Admin"}</span>
              <button 
                onClick={handleLogout}
                style={{ 
                  padding: "8px 15px", 
                  backgroundColor: "#dc3545", 
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
          {/* Dashboard Tab */}
          {activeTab === "dashboard" && metrics && (
            <div>
              <h2 style={{ marginBottom: "20px", color: "#333" }}>Dashboard Overview</h2>
              
              {/* Metrics Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "30px" }}>
                <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                  <h3 style={{ margin: "0 0 10px 0", color: "#666", fontSize: "14px" }}>Total Deals</h3>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#333" }}>{metrics.total_deals}</div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>{metrics.ai_approved_deals} AI approved</div>
                </div>
                
                <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                  <h3 style={{ margin: "0 0 10px 0", color: "#666", fontSize: "14px" }}>Total Clicks</h3>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#333" }}>{metrics.total_clicks}</div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>{metrics.total_shares} shares</div>
                </div>
                
                <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                  <h3 style={{ margin: "0 0 10px 0", color: "#666", fontSize: "14px" }}>Revenue Estimate</h3>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#333" }}>${metrics.revenue_estimate.toFixed(2)}</div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>Based on clicks</div>
                </div>
                
                <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                  <h3 style={{ margin: "0 0 10px 0", color: "#666", fontSize: "14px" }}>Pending Review</h3>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#333" }}>{metrics.pending_deals}</div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>Awaiting approval</div>
                </div>
              </div>

              {/* Recent Activity */}
              <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                <h3 style={{ marginBottom: "15px", color: "#333" }}>Recent Activity</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {metrics.recent_activity.map((activity: any) => (
                    <div key={activity.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
                      <div>
                        <div style={{ fontWeight: "bold", fontSize: "14px" }}>{activity.title}</div>
                        <div style={{ fontSize: "12px", color: "#666" }}>{activity.store} • {activity.category}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ 
                          fontSize: "12px", 
                          padding: "2px 8px", 
                          borderRadius: "12px", 
                          backgroundColor: activity.ai_approved ? "#28a745" : "#6c757d", 
                          color: "white" 
                        }}>
                          {activity.ai_approved ? "Approved" : "Pending"}
                        </span>
                        <span style={{ fontSize: "12px", color: "#666" }}>{activity.clicks} clicks</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Deals Management Tab */}
          {activeTab === "deals" && (
            <div>
              <h2 style={{ marginBottom: "20px", color: "#333" }}>Manage Deals</h2>
              
              {deals.length > 0 ? (
                <div style={{ backgroundColor: "white", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead style={{ backgroundColor: "#f8f9fa" }}>
                        <tr>
                          <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Deal</th>
                          <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Store</th>
                          <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Price</th>
                          <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Status</th>
                          <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Stats</th>
                          <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deals.slice(0, 20).map((deal) => (
                          <tr key={deal.id} style={{ borderBottom: "1px solid #dee2e6" }}>
                            <td style={{ padding: "12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <img 
                                  src={deal.image_url || "/placeholder.jpg"} 
                                  alt={deal.title}
                                  style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }}
                                />
                                <div>
                                  <div style={{ fontWeight: "bold", fontSize: "14px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {deal.title}
                                  </div>
                                  <div style={{ fontSize: "12px", color: "#666" }}>{deal.category}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "12px", fontSize: "14px" }}>{deal.store}</td>
                            <td style={{ padding: "12px" }}>
                              <div style={{ fontSize: "14px", fontWeight: "bold" }}>${deal.sale_price}</div>
                              <div style={{ fontSize: "12px", color: "#666", textDecoration: "line-through" }}>${deal.original_price}</div>
                            </td>
                            <td style={{ padding: "12px" }}>
                              <span style={{ 
                                fontSize: "12px", 
                                padding: "4px 8px", 
                                borderRadius: "12px", 
                                backgroundColor: deal.is_ai_approved ? "#28a745" : "#6c757d", 
                                color: "white" 
                              }}>
                                {deal.is_ai_approved ? "Approved" : "Pending"}
                              </span>
                            </td>
                            <td style={{ padding: "12px", fontSize: "12px", color: "#666" }}>
                              <div>{deal.click_count} clicks</div>
                              <div>{deal.share_count} shares</div>
                            </td>
                            <td style={{ padding: "12px" }}>
                              <div style={{ display: "flex", gap: "5px" }}>
                                {!deal.is_ai_approved && (
                                  <button
                                    onClick={() => approveDeal(deal.id)}
                                    style={{ 
                                      padding: "4px 8px", 
                                      backgroundColor: "#28a745", 
                                      color: "white", 
                                      border: "none", 
                                      borderRadius: "4px", 
                                      cursor: "pointer",
                                      fontSize: "12px"
                                    }}
                                  >
                                    ✓ Approve
                                  </button>
                                )}
                                <button
                                  onClick={() => rejectDeal(deal.id)}
                                  style={{ 
                                    padding: "4px 8px", 
                                    backgroundColor: "#dc3545", 
                                    color: "white", 
                                    border: "none", 
                                    borderRadius: "4px", 
                                    cursor: "pointer",
                                    fontSize: "12px"
                                  }}
                                >
                                  ✗ Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ backgroundColor: "white", padding: "40px", textAlign: "center", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                  <p style={{ color: "#666", margin: 0 }}>Loading deals...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      backgroundColor: "#f5f5f5", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{ 
        backgroundColor: "white", 
        padding: "40px", 
        borderRadius: "8px", 
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)", 
        width: "100%", 
        maxWidth: "400px" 
      }}>
        <h1 style={{ textAlign: "center", marginBottom: "10px", color: "#333" }}>DealSphere Admin</h1>
        <p style={{ textAlign: "center", marginBottom: "30px", color: "#666" }}>Sign in to access the admin dashboard</p>
        
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{ 
                width: "100%", 
                padding: "10px", 
                border: "1px solid #ddd", 
                borderRadius: "4px",
                fontSize: "16px",
                boxSizing: "border-box"
              }}
            />
          </div>
          
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ 
                width: "100%", 
                padding: "10px", 
                border: "1px solid #ddd", 
                borderRadius: "4px",
                fontSize: "16px",
                boxSizing: "border-box"
              }}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: "100%", 
              padding: "12px", 
              backgroundColor: loading ? "#ccc" : "#007bff", 
              color: "white", 
              border: "none", 
              borderRadius: "4px",
              fontSize: "16px",
              cursor: loading ? "not-allowed" : "pointer",
              marginBottom: "20px"
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        
        <div style={{ 
          backgroundColor: "#f8f9fa", 
          padding: "15px", 
          border: "1px solid #e9ecef", 
          borderRadius: "4px",
          fontSize: "14px"
        }}>
          <strong>Demo Credentials:</strong><br />
          Username: admin<br />
          Password: admin123
        </div>
      </div>
    </div>
  );
}