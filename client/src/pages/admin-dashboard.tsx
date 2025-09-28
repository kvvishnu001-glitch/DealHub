import React, { useState, useEffect } from "react";
import { useRealTimeUpdates } from "@/hooks/use-auto-refresh";
import { FileUploadModal } from "../components/FileUploadModal";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [metrics, setMetrics] = useState<any>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<any[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [newDeal, setNewDeal] = useState({
    title: "",
    description: "",
    original_price: "",
    sale_price: "",
    store: "",
    category: "",
    affiliate_url: "",
    image_url: "",
    deal_type: "regular",
    coupon_code: "",
    coupon_required: false
  });
  
  // Automation state
  const [automationStatus, setAutomationStatus] = useState<any>(null);
  const [automationLoading, setAutomationLoading] = useState(false);
  
  // Affiliate networks state
  const [affiliateNetworks, setAffiliateNetworks] = useState<any[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<any>(null);
  const [networkConfig, setNetworkConfig] = useState<any>({});
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  // Deal issues tracking for "Needs Review" functionality
  const [dealIssues, setDealIssues] = useState<Record<string, string[]>>({});

  // Enable real-time updates
  useRealTimeUpdates();

  const categories = ["Electronics", "Clothing", "Home & Garden", "Sports", "Books", "Toys", "Beauty", "Automotive", "Food", "Health"];
  const dealTypes = ["regular", "hot", "top"];

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      window.location.href = "/admin";
      return;
    }
    fetchData();
    if (activeTab === "automation") {
      fetchAutomationStatus();
    } else if (activeTab === "affiliates") {
      fetchAffiliateNetworks();
    }
    
    // Set up auto-refresh for deals and metrics every 30 seconds
    const autoRefreshInterval = setInterval(() => {
      fetchData();
    }, 30000);
    
    return () => clearInterval(autoRefreshInterval);
  }, [activeTab]);

  useEffect(() => {
    filterDeals();
  }, [deals, searchTerm, selectedCategory, statusFilter]);

  const fetchData = async () => {
    await Promise.all([fetchMetrics(), fetchDeals()]);
  };

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
        // Analyze deals for issues after fetching
        analyzeDealIssues(data);
      }
    } catch (error) {
      console.error("Error fetching deals:", error);
    }
  };

  // Function to analyze deals and identify issues
  const analyzeDealIssues = (dealsData: any[]) => {
    const issues: Record<string, string[]> = {};
    
    dealsData.forEach((deal) => {
      const dealIssues: string[] = [];
      
      // Check for missing or invalid image URL
      if (!deal.image_url || deal.image_url.trim() === '') {
        dealIssues.push('Missing image URL');
      } else if (!isValidImageUrl(deal.image_url)) {
        dealIssues.push('Invalid image URL format');
      }
      
      // Check for missing required fields
      if (!deal.title || deal.title.trim() === '') {
        dealIssues.push('Missing title');
      }
      if (!deal.description || deal.description.trim() === '') {
        dealIssues.push('Missing description');
      }
      if (!deal.store || deal.store.trim() === '') {
        dealIssues.push('Missing store name');
      }
      if (!deal.category || deal.category.trim() === '') {
        dealIssues.push('Missing category');
      }
      if (!deal.affiliate_url || deal.affiliate_url.trim() === '') {
        dealIssues.push('Missing affiliate URL');
      }
      
      // Check for invalid pricing
      if (!deal.original_price || deal.original_price <= 0) {
        dealIssues.push('Invalid original price');
      }
      if (!deal.sale_price || deal.sale_price <= 0) {
        dealIssues.push('Invalid sale price');
      }
      if (deal.sale_price >= deal.original_price) {
        dealIssues.push('Sale price not lower than original price');
      }
      // Auto-calculate discount percentage if missing or invalid
      const calculatedDiscount = deal.original_price > 0 && deal.sale_price < deal.original_price 
        ? Math.round(((deal.original_price - deal.sale_price) / deal.original_price) * 100 * 10) / 10
        : 0;
      
      if (calculatedDiscount === 0 && deal.original_price > 0 && deal.sale_price >= deal.original_price) {
        dealIssues.push('Sale price not lower than original price - no discount available');
      }
      
      // Store issues if any found
      if (dealIssues.length > 0) {
        issues[deal.id] = dealIssues;
      }
    });
    
    setDealIssues(issues);
  };

  // Helper function to validate image URL format
  const isValidImageUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return /\.(jpg|jpeg|png|gif|webp)$/i.test(urlObj.pathname) || 
             url.includes('unsplash.com') || 
             url.includes('images.') ||
             url.includes('cdn.');
    } catch {
      return false;
    }
  };

  const filterDeals = () => {
    let filtered = deals;

    if (searchTerm) {
      filtered = filtered.filter(deal =>
        deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.store.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter(deal => deal.category === selectedCategory);
    }

    if (statusFilter !== "all") {
      if (statusFilter === "approved") {
        filtered = filtered.filter(deal => deal.is_ai_approved === true);
      } else if (statusFilter === "pending") {
        filtered = filtered.filter(deal => deal.is_ai_approved === false && deal.status !== "rejected");
      } else if (statusFilter === "rejected") {
        filtered = filtered.filter(deal => deal.status === "rejected");
      } else if (statusFilter === "needs_review") {
        filtered = filtered.filter(deal => dealIssues[deal.id] && dealIssues[deal.id].length > 0);
      }
    }

    setFilteredDeals(filtered);
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/deals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newDeal,
          original_price: parseFloat(newDeal.original_price),
          sale_price: parseFloat(newDeal.sale_price)
        })
      });

      if (response.ok) {
        alert("Deal created successfully!");
        setShowAddDeal(false);
        setNewDeal({
          title: "",
          description: "",
          original_price: "",
          sale_price: "",
          store: "",
          category: "",
          affiliate_url: "",
          image_url: "",
          deal_type: "regular",
          coupon_code: "",
          coupon_required: false
        });
        fetchData();
      } else {
        alert("Failed to create deal");
      }
    } catch (error) {
      alert("Error creating deal: " + error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeal) return;
    setLoading(true);

    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/api/admin/deals/${editingDeal.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...editingDeal,
          original_price: parseFloat(editingDeal.original_price),
          sale_price: parseFloat(editingDeal.sale_price)
        })
      });

      if (response.ok) {
        alert("Deal updated successfully!");
        setEditingDeal(null);
        fetchData();
      } else {
        alert("Failed to update deal");
      }
    } catch (error) {
      alert("Error updating deal: " + error);
    } finally {
      setLoading(false);
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
        fetchData();
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
        alert("Deal rejected and will be deleted in 24 hours!");
        fetchData();
      }
    } catch (error) {
      alert("Error rejecting deal: " + error);
    }
  };

  const deleteDeal = async (dealId: string) => {
    if (!confirm("Are you sure you want to permanently delete this deal?")) return;

    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/api/admin/deals/${dealId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        alert("Deal deleted successfully!");
        fetchData();
      }
    } catch (error) {
      alert("Error deleting deal: " + error);
    }
  };

  const downloadSampleFile = (networkType: string) => {
    let csvContent = '';
    let filename = '';
    
    switch (networkType) {
      case 'amazon':
        csvContent = `title,description,original_price,sale_price,store,category,affiliate_url,image_url,deal_type,coupon_code,coupon_required,needs_ai_review
"Amazon Echo Dot (5th Gen)","Smart speaker with Alexa - Charcoal",49.99,29.99,"Amazon","Electronics","https://amazon.com/dp/B09B8V1LZ3?tag=yourstore-20","https://m.media-amazon.com/images/I/714Rq4k05UL.jpg","hot","SAVE20",false,false
"Wireless Bluetooth Headphones","Premium sound quality with noise cancellation",199.99,99.99,"Amazon","Electronics","https://amazon.com/dp/B08PZHYWJS?tag=yourstore-20","https://m.media-amazon.com/images/I/61a45+UbLYL.jpg","regular","",false,false
"Kitchen Stand Mixer","Professional 6-quart stand mixer with attachments",399.99,249.99,"Amazon","Home & Garden","https://amazon.com/dp/B00005UP2P?tag=yourstore-20","https://m.media-amazon.com/images/I/81VjYXa6NFL.jpg","top","KITCHEN15",true,false`;
        filename = 'amazon_sample_deals.csv';
        break;
      case 'cj':
        csvContent = `advertiser_name,product_name,product_description,retail_price,sale_price,category,buy_url,image_url,promotional_type,coupon_code,coupon_required,needs_ai_review
"Best Buy","Gaming Laptop","High-performance gaming laptop with RTX 4060",1299.99,999.99,"Electronics","https://www.tkqlhce.com/click-123456-987654?url=https://bestbuy.com/laptop","https://pisces.bbystatic.com/image2/BestBuy_US/images/products/laptop.jpg","sale","GAME100",false,false
"Target","Home Decor Set","Modern living room decor bundle",249.99,149.99,"Home & Garden","https://www.anrdoezrs.net/links/123456/type/dlg/https://target.com/decor","https://target.scene7.com/is/image/Target/decor_set","coupon","HOME25",true,false
"Walmart","Fitness Tracker","Advanced fitness tracker with heart rate monitor",199.99,119.99,"Sports","https://linksynergy.walmart.com/deeplink?id=abc123&mid=2149&murl=https://walmart.com/tracker","https://i5.walmartimages.com/asr/fitness-tracker.jpg","flash_sale","",false,false`;
        filename = 'commission_junction_sample_deals.csv';
        break;
      case 'shareasale':
        csvContent = `merchantname,productname,description,price,saleprice,category,directurl,imageurl,dealtype,promocode,coupon_required,needs_ai_review
"Nike","Running Shoes","Professional running shoes with advanced cushioning",129.99,89.99,"Sports","https://www.shareasale.com/r.cfm?b=123456&u=789012&m=1234&urllink=nike.com%2Frunning-shoes","https://static.nike.com/a/images/running-shoe.jpg","clearance","RUN30",false,false
"Barnes & Noble","Bestseller Book Set","Collection of top 10 bestselling novels",199.99,99.99,"Books","https://www.shareasale.com/r.cfm?b=234567&u=789012&m=2345&urllink=barnesandnoble.com%2Fbook-set","https://prodimage.images-bn.com/book-collection.jpg","bundle","BOOKS50",true,false
"Nordstrom","Designer Handbag","Luxury leather handbag from premium brand",599.99,399.99,"Clothing","https://www.shareasale.com/r.cfm?b=345678&u=789012&m=3456&urllink=nordstrom.com%2Fhandbag","https://n.nordstrommedia.com/id/handbag-image.jpg","designer_sale","",false,false`;
        filename = 'shareasale_sample_deals.csv';
        break;
      case 'rakuten':
        csvContent = `advertiser,offer_name,description,original_price,current_price,category,tracking_url,image_url,promotion_type,promo_code,coupon_required,needs_ai_review
"Macy's","Winter Coat Collection","Premium winter coats for men and women",299.99,179.99,"Clothing","https://click.linksynergy.com/deeplink?id=xyz789&mid=1234&murl=macys.com%2Fcoats","https://slimages.macysassets.com/winter-coat.jpg","seasonal","WINTER40",false,false
"Home Depot","Power Tool Set","Professional grade power tools with case",399.99,249.99,"Home & Garden","https://click.linksynergy.com/deeplink?id=xyz789&mid=2345&murl=homedepot.com%2Ftools","https://images.homedepot-static.com/power-tools.jpg","tool_sale","TOOLS25",true,false
"Petco","Pet Food Bundle","Premium dog food and treats bundle",89.99,59.99,"Pet Supplies","https://click.linksynergy.com/deeplink?id=xyz789&mid=3456&murl=petco.com%2Fpet-food","https://assets.petco.com/petco/image/pet-food.jpg","pet_deal","",false,false`;
        filename = 'rakuten_sample_deals.csv';
        break;
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Social sharing functions for admin
  const shareOnX = (deal: any) => {
    const calculatedDiscount = deal.original_price > 0 && deal.sale_price < deal.original_price 
      ? Math.round(((deal.original_price - deal.sale_price) / deal.original_price) * 100 * 10) / 10
      : deal.discount_percentage || 0;
    const text = `🔥 Amazing Deal Alert! ${deal.title} - Save ${calculatedDiscount}% at ${deal.store}! Only $${deal.sale_price} (was $${deal.original_price})`;
    const url = `${window.location.origin}/deals/${deal.id}`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const shareOnWhatsApp = (deal: any) => {
    const calculatedDiscount = deal.original_price > 0 && deal.sale_price < deal.original_price 
      ? Math.round(((deal.original_price - deal.sale_price) / deal.original_price) * 100 * 10) / 10
      : deal.discount_percentage || 0;
    const text = `🔥 Amazing Deal Alert! ${deal.title} - Save ${calculatedDiscount}% at ${deal.store}! Only $${deal.sale_price} (was $${deal.original_price}). Check it out: ${window.location.origin}/deals/${deal.id}`;
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank');
  };

  const shareOnFacebook = (deal: any) => {
    const url = `${window.location.origin}/deals/${deal.id}`;
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(deal.title)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const copyDealLink = async (deal: any) => {
    const url = `${window.location.origin}/deals/${deal.id}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('Deal link copied to clipboard!');
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Deal link copied to clipboard!');
    }
  };

  const fetchAutomationStatus = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/automation/status", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAutomationStatus(data);
      }
    } catch (error) {
      console.error("Error fetching automation status:", error);
    }
  };

  const triggerManualFetch = async () => {
    setAutomationLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/automation/fetch-deals", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        alert(`Manual fetch completed! ${result.details.saved_deals_count} new deals added.`);
        fetchData(); // Refresh deals
        fetchAutomationStatus(); // Refresh automation status
      } else {
        alert("Failed to trigger manual fetch");
      }
    } catch (error) {
      alert("Error triggering manual fetch: " + error);
    } finally {
      setAutomationLoading(false);
    }
  };

  const toggleAutomation = async (start: boolean) => {
    setAutomationLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const endpoint = start ? "/api/admin/automation/start-scheduler" : "/api/admin/automation/stop-scheduler";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        alert(start ? "Automation started successfully!" : "Automation stopped successfully!");
        fetchAutomationStatus();
      } else {
        alert("Failed to toggle automation");
      }
    } catch (error) {
      alert("Error toggling automation: " + error);
    } finally {
      setAutomationLoading(false);
    }
  };

  const fetchAffiliateNetworks = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/affiliates/networks", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAffiliateNetworks(data);
      }
    } catch (error) {
      console.error("Error fetching affiliate networks:", error);
    }
  };

  const configureNetwork = async (networkId: string, configData: any) => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/api/admin/affiliates/networks/${networkId}/configure`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(configData)
      });
      
      if (response.ok) {
        alert("Network configured successfully!");
        fetchAffiliateNetworks();
        setShowConfigModal(false);
      } else {
        const error = await response.json();
        alert(`Configuration failed: ${error.detail}`);
      }
    } catch (error) {
      alert("Error configuring network: " + error);
    }
  };

  const testNetworkConnection = async (networkId: string) => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/api/admin/affiliates/networks/${networkId}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.status === "success") {
          alert(`Connection successful! Found ${result.deals_found} deals.`);
        } else {
          alert(`Connection failed: ${result.error_message}`);
        }
      }
    } catch (error) {
      alert("Error testing connection: " + error);
    }
  };

  const toggleNetworkStatus = async (networkId: string, enable: boolean) => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/api/admin/affiliates/networks/${networkId}/toggle`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ enable })
      });
      
      if (response.ok) {
        alert(`Network ${enable ? 'enabled' : 'disabled'} successfully!`);
        fetchAffiliateNetworks();
      }
    } catch (error) {
      alert("Error toggling network: " + error);
    }
  };

  const openConfigModal = (network: any) => {
    setSelectedNetwork(network);
    setNetworkConfig({});
    setShowConfigModal(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    window.location.href = "/admin";
  };

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
              <button
                onClick={() => setActiveTab("automation")}
                style={{ 
                  padding: "8px 15px", 
                  backgroundColor: activeTab === "automation" ? "#007bff" : "transparent", 
                  color: activeTab === "automation" ? "white" : "#333",
                  border: "1px solid #007bff",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Automation
              </button>
              <button
                onClick={() => setActiveTab("affiliates")}
                style={{ 
                  padding: "8px 15px", 
                  backgroundColor: activeTab === "affiliates" ? "#007bff" : "transparent", 
                  color: activeTab === "affiliates" ? "white" : "#333",
                  border: "1px solid #007bff",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Affiliate Networks
              </button>
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <span style={{ fontSize: "14px", color: "#666" }}>Welcome, Admin</span>
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
                <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>{metrics.ai_approved_deals} approved</div>
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
              
              <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 10px 0", color: "#666", fontSize: "14px" }}>Issues Found</h3>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#ffc107" }}>{Object.keys(dealIssues).length}</div>
                <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>Deals need review</div>
              </div>
            </div>

            {/* Recent Activity */}
            <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
              <h3 style={{ marginBottom: "15px", color: "#333" }}>Recent Activity</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {metrics.recent_activity && metrics.recent_activity.map((activity: any) => (
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ color: "#333" }}>Manage Deals</h2>
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setShowFileUpload(true)}
                    style={{ 
                      padding: "10px 20px", 
                      backgroundColor: "#007bff", 
                      color: "white", 
                      border: "none", 
                      borderRadius: "4px 0 0 4px", 
                      cursor: "pointer",
                      fontSize: "14px"
                    }}
                    data-testid="upload-deals-button"
                  >
                    📁 UPLOAD FILES
                  </button>
                  <button
                    onClick={() => {
                      const dropdown = document.querySelector('.sample-dropdown') as HTMLElement;
                      if (dropdown) {
                        dropdown.style.display = dropdown.style.display === 'none' || !dropdown.style.display ? 'block' : 'none';
                      }
                    }}
                    style={{ 
                      padding: "10px 15px", 
                      backgroundColor: "#0056b3", 
                      color: "white", 
                      border: "none", 
                      borderRadius: "0 4px 4px 0", 
                      cursor: "pointer",
                      fontSize: "14px",
                      borderLeft: "1px solid #004494"
                    }}
                  >
                    📄 ↓
                  </button>
                  <div className="sample-dropdown" style={{ 
                    position: "absolute", 
                    top: "100%", 
                    left: 0, 
                    backgroundColor: "white", 
                    border: "1px solid #ddd", 
                    borderRadius: "4px", 
                    minWidth: "250px", 
                    boxShadow: "0 2px 10px rgba(0,0,0,0.1)", 
                    zIndex: 1000,
                    display: "none"
                  }}>
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontSize: "12px", fontWeight: "bold", color: "#666" }}>
                      Download Sample Files:
                    </div>
                    <button onClick={() => downloadSampleFile('amazon')} style={{ width: "100%", padding: "10px 15px", border: "none", background: "none", textAlign: "left", cursor: "pointer", fontSize: "14px" }}>
                      📦 Amazon Associates CSV
                    </button>
                    <button onClick={() => downloadSampleFile('cj')} style={{ width: "100%", padding: "10px 15px", border: "none", background: "none", textAlign: "left", cursor: "pointer", fontSize: "14px" }}>
                      🏢 Commission Junction CSV
                    </button>
                    <button onClick={() => downloadSampleFile('shareasale')} style={{ width: "100%", padding: "10px 15px", border: "none", background: "none", textAlign: "left", cursor: "pointer", fontSize: "14px" }}>
                      💼 ShareASale CSV
                    </button>
                    <button onClick={() => downloadSampleFile('rakuten')} style={{ width: "100%", padding: "10px 15px", border: "none", background: "none", textAlign: "left", cursor: "pointer", fontSize: "14px" }}>
                      🛍️ Rakuten Advertising CSV
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddDeal(true)}
                  style={{ 
                    padding: "10px 20px", 
                    backgroundColor: "#28a745", 
                    color: "white", 
                    border: "none", 
                    borderRadius: "4px", 
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  + Add Deal
                </button>
              </div>
            </div>

            {/* Filters */}
            <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 200px 200px", gap: "15px", alignItems: "end" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>Search</label>
                  <input
                    type="text"
                    placeholder="Search deals..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px"
                    }}
                  >
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px"
                    }}
                  >
                    <option value="all">All Status</option>
                    <option value="approved">✅ Approved</option>
                    <option value="pending">⏳ Pending</option>
                    <option value="rejected">❌ Rejected</option>
                    <option value="needs_review">🔧 Needs Review ({Object.keys(dealIssues).length})</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Deals Table */}
            {filteredDeals.length > 0 ? (
              <div style={{ backgroundColor: "white", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ backgroundColor: "#f8f9fa" }}>
                      <tr>
                        <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Deal</th>
                        <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Store</th>
                        <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Category</th>
                        <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Price</th>
                        <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Discount</th>
                        <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Status</th>
                        <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Issues</th>
                        <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Stats</th>
                        <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Social Share</th>
                        <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeals.map((deal) => (
                        <tr key={deal.id} style={{ borderBottom: "1px solid #dee2e6" }}>
                          <td style={{ padding: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <img 
                                src={deal.image_url || "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=400&fit=crop"} 
                                alt={deal.title}
                                style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }}
                                onError={(e) => {
                                  e.currentTarget.src = "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=400&fit=crop";
                                }}
                              />
                              <div>
                                <div 
                                  style={{ 
                                    fontWeight: "bold", 
                                    fontSize: "14px", 
                                    maxWidth: "200px", 
                                    overflow: "hidden", 
                                    textOverflow: "ellipsis", 
                                    whiteSpace: "nowrap",
                                    cursor: "pointer",
                                    color: "#007bff"
                                  }}
                                  onClick={() => window.open(`/deals/${deal.id}`, '_blank')}
                                  title="Click to view deal page"
                                >
                                  {deal.title}
                                </div>
                                <div style={{ fontSize: "12px", color: "#666" }}>{deal.deal_type}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "12px", fontSize: "14px" }}>{deal.store}</td>
                          <td style={{ padding: "12px", fontSize: "14px" }}>{deal.category}</td>
                          <td style={{ padding: "12px" }}>
                            <div style={{ fontSize: "14px", fontWeight: "bold" }}>${deal.sale_price}</div>
                            <div style={{ fontSize: "12px", color: "#666", textDecoration: "line-through" }}>${deal.original_price}</div>
                          </td>
                          <td style={{ padding: "12px" }}>
                            {(() => {
                              const calculatedDiscount = deal.original_price > 0 && deal.sale_price < deal.original_price 
                                ? Math.round(((deal.original_price - deal.sale_price) / deal.original_price) * 100 * 10) / 10
                                : deal.discount_percentage || 0;
                              return (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                  <span style={{
                                    fontSize: "16px",
                                    fontWeight: "bold",
                                    color: calculatedDiscount >= 50 ? "#28a745" : calculatedDiscount >= 30 ? "#ffc107" : "#dc3545"
                                  }}>
                                    {calculatedDiscount}%
                                  </span>
                                  <span style={{ fontSize: "10px", color: "#666" }}>
                                    Save ${((deal.original_price - deal.sale_price) || 0).toFixed(2)}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                          <td style={{ padding: "12px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <span style={{ 
                                fontSize: "12px", 
                                padding: "4px 8px", 
                                borderRadius: "12px", 
                                backgroundColor: deal.status === "rejected" ? "#dc3545" : deal.is_ai_approved ? "#28a745" : "#6c757d", 
                                color: "white" 
                              }}>
                                {deal.status === "rejected" ? "❌ Rejected" : deal.is_ai_approved ? "✅ Approved" : "⏳ Pending"}
                              </span>
                              {dealIssues[deal.id] && (
                                <span style={{
                                  fontSize: "10px",
                                  padding: "2px 6px",
                                  borderRadius: "8px",
                                  backgroundColor: "#ffc107",
                                  color: "#212529"
                                }}>
                                  🔧 Needs Review
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "12px" }}>
                            {dealIssues[deal.id] ? (
                              <div style={{ fontSize: "12px" }}>
                                {dealIssues[deal.id].slice(0, 3).map((issue, index) => (
                                  <div key={index} style={{ 
                                    color: "#dc3545", 
                                    marginBottom: "2px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px"
                                  }}>
                                    <span style={{ color: "#dc3545" }}>⚠️</span>
                                    {issue}
                                  </div>
                                ))}
                                {dealIssues[deal.id].length > 3 && (
                                  <div style={{ fontSize: "10px", color: "#6c757d", marginTop: "4px" }}>
                                    +{dealIssues[deal.id].length - 3} more issues
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: "12px", color: "#28a745" }}>✓ No issues</span>
                            )}
                          </td>
                          <td style={{ padding: "12px", fontSize: "12px", color: "#666" }}>
                            <div>{deal.click_count || 0} clicks</div>
                            <div>{deal.share_count || 0} shares</div>
                          </td>
                          <td style={{ padding: "12px" }}>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <button
                                onClick={() => shareOnX(deal)}
                                style={{
                                  padding: "8px",
                                  backgroundColor: "#000000",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center"
                                }}
                                title="Share on X"
                              >
                                <span style={{ color: "white", fontSize: "14px", fontWeight: "bold" }}>𝕏</span>
                              </button>
                              <button
                                onClick={() => shareOnWhatsApp(deal)}
                                style={{
                                  padding: "8px",
                                  backgroundColor: "#25D366",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center"
                                }}
                                title="Share on WhatsApp"
                              >
                                <span style={{ color: "white", fontSize: "14px" }}>💬</span>
                              </button>
                              <button
                                onClick={() => shareOnFacebook(deal)}
                                style={{
                                  padding: "8px",
                                  backgroundColor: "#1877F2",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center"
                                }}
                                title="Share on Facebook"
                              >
                                <span style={{ color: "white", fontSize: "14px", fontWeight: "bold" }}>f</span>
                              </button>
                              <button
                                onClick={() => copyDealLink(deal)}
                                style={{
                                  padding: "8px",
                                  backgroundColor: "#6c757d",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center"
                                }}
                                title="Copy Link"
                              >
                                <span style={{ color: "white", fontSize: "14px" }}>📋</span>
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: "12px" }}>
                            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                              {deal.status !== "rejected" && !deal.is_ai_approved && (
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
                              {deal.status !== "rejected" && (
                                <button
                                  onClick={() => rejectDeal(deal.id)}
                                  style={{ 
                                    padding: "4px 8px", 
                                    backgroundColor: "#ffc107", 
                                    color: "black", 
                                    border: "none", 
                                    borderRadius: "4px", 
                                    cursor: "pointer",
                                    fontSize: "12px"
                                  }}
                                >
                                  ✗ Reject
                                </button>
                              )}
                              <button
                                onClick={() => setEditingDeal(deal)}
                                style={{ 
                                  padding: "4px 8px", 
                                  backgroundColor: "#007bff", 
                                  color: "white", 
                                  border: "none", 
                                  borderRadius: "4px", 
                                  cursor: "pointer",
                                  fontSize: "12px"
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteDeal(deal.id)}
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
                                Delete
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
                <p style={{ color: "#666", margin: 0 }}>No deals found matching your criteria.</p>
              </div>
            )}
          </div>
        )}

        {/* Automation Tab */}
        {activeTab === "automation" && (
          <div>
            <h2 style={{ marginBottom: "20px", color: "#333" }}>Deal Automation & AI</h2>
            
            {/* Automation Status Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "30px" }}>
              <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 15px 0", color: "#333" }}>Automation Status</h3>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
                  <div style={{ 
                    width: "12px", 
                    height: "12px", 
                    borderRadius: "50%", 
                    backgroundColor: automationStatus?.running ? "#28a745" : "#dc3545" 
                  }}></div>
                  <span style={{ fontWeight: "bold" }}>
                    {automationStatus?.running ? "Running" : "Stopped"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => toggleAutomation(true)}
                    disabled={automationLoading || automationStatus?.running}
                    style={{ 
                      padding: "8px 16px", 
                      backgroundColor: automationLoading ? "#ccc" : "#28a745", 
                      color: "white", 
                      border: "none", 
                      borderRadius: "4px", 
                      cursor: automationLoading ? "not-allowed" : "pointer",
                      fontSize: "14px"
                    }}
                  >
                    Start
                  </button>
                  <button
                    onClick={() => toggleAutomation(false)}
                    disabled={automationLoading || !automationStatus?.running}
                    style={{ 
                      padding: "8px 16px", 
                      backgroundColor: automationLoading ? "#ccc" : "#dc3545", 
                      color: "white", 
                      border: "none", 
                      borderRadius: "4px", 
                      cursor: automationLoading ? "not-allowed" : "pointer",
                      fontSize: "14px"
                    }}
                  >
                    Stop
                  </button>
                </div>
              </div>

              <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 15px 0", color: "#333" }}>API Configuration</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Amazon Associates:</span>
                    <span style={{ 
                      color: automationStatus?.api_configurations?.amazon_configured ? "#28a745" : "#dc3545",
                      fontWeight: "bold" 
                    }}>
                      {automationStatus?.api_configurations?.amazon_configured ? "✓ Configured" : "✗ Not Configured"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Commission Junction:</span>
                    <span style={{ 
                      color: automationStatus?.api_configurations?.cj_configured ? "#28a745" : "#dc3545",
                      fontWeight: "bold" 
                    }}>
                      {automationStatus?.api_configurations?.cj_configured ? "✓ Configured" : "✗ Not Configured"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>ClickBank:</span>
                    <span style={{ 
                      color: automationStatus?.api_configurations?.clickbank_configured ? "#28a745" : "#dc3545",
                      fontWeight: "bold" 
                    }}>
                      {automationStatus?.api_configurations?.clickbank_configured ? "✓ Configured" : "✗ Not Configured"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>OpenAI (AI Validation):</span>
                    <span style={{ 
                      color: automationStatus?.api_configurations?.openai_configured ? "#28a745" : "#dc3545",
                      fontWeight: "bold" 
                    }}>
                      {automationStatus?.api_configurations?.openai_configured ? "✓ Configured" : "✗ Not Configured"}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                <h3 style={{ margin: "0 0 15px 0", color: "#333" }}>Manual Actions</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <button
                    onClick={triggerManualFetch}
                    disabled={automationLoading}
                    style={{ 
                      padding: "10px 16px", 
                      backgroundColor: automationLoading ? "#ccc" : "#007bff", 
                      color: "white", 
                      border: "none", 
                      borderRadius: "4px", 
                      cursor: automationLoading ? "not-allowed" : "pointer",
                      fontSize: "14px"
                    }}
                  >
                    {automationLoading ? "Fetching..." : "Fetch Deals Now"}
                  </button>
                  <button
                    onClick={fetchAutomationStatus}
                    style={{ 
                      padding: "10px 16px", 
                      backgroundColor: "#6c757d", 
                      color: "white", 
                      border: "none", 
                      borderRadius: "4px", 
                      cursor: "pointer",
                      fontSize: "14px"
                    }}
                  >
                    Refresh Status
                  </button>
                </div>
              </div>
            </div>

            {/* Configuration Guide */}
            <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "20px" }}>
              <h3 style={{ marginBottom: "15px", color: "#333" }}>Setup Guide</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
                <div>
                  <h4 style={{ color: "#007bff", marginBottom: "10px" }}>Amazon Associates</h4>
                  <p style={{ fontSize: "14px", marginBottom: "10px" }}>Required environment variables:</p>
                  <ul style={{ fontSize: "12px", margin: "0", paddingLeft: "20px" }}>
                    <li>AWS_ACCESS_KEY_ID</li>
                    <li>AWS_SECRET_ACCESS_KEY</li>
                    <li>AMAZON_ASSOCIATE_TAG</li>
                  </ul>
                  <p style={{ fontSize: "12px", marginTop: "10px" }}>
                    <a href="https://affiliate-program.amazon.com/" target="_blank" style={{ color: "#007bff" }}>
                      Sign up for Amazon Associates →
                    </a>
                  </p>
                </div>
                
                <div>
                  <h4 style={{ color: "#007bff", marginBottom: "10px" }}>Commission Junction</h4>
                  <p style={{ fontSize: "14px", marginBottom: "10px" }}>Required environment variables:</p>
                  <ul style={{ fontSize: "12px", margin: "0", paddingLeft: "20px" }}>
                    <li>CJ_DEVELOPER_KEY</li>
                    <li>CJ_WEBSITE_ID</li>
                  </ul>
                  <p style={{ fontSize: "12px", marginTop: "10px" }}>
                    <a href="https://www.cj.com/" target="_blank" style={{ color: "#007bff" }}>
                      Sign up for CJ Affiliate →
                    </a>
                  </p>
                </div>
                
                <div>
                  <h4 style={{ color: "#007bff", marginBottom: "10px" }}>ClickBank</h4>
                  <p style={{ fontSize: "14px", marginBottom: "10px" }}>Required environment variables:</p>
                  <ul style={{ fontSize: "12px", margin: "0", paddingLeft: "20px" }}>
                    <li>CLICKBANK_CLIENT_ID</li>
                    <li>CLICKBANK_DEVELOPER_KEY</li>
                    <li>CLICKBANK_NICKNAME</li>
                  </ul>
                  <p style={{ fontSize: "12px", marginTop: "10px" }}>
                    <a href="https://www.clickbank.com/" target="_blank" style={{ color: "#007bff" }}>
                      Sign up for ClickBank →
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Activity Log */}
            {automationStatus?.recent_logs && (
              <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                <h3 style={{ marginBottom: "15px", color: "#333" }}>Recent Automation Activity</h3>
                <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {automationStatus.recent_logs.slice(0, 10).map((log: any, index: number) => (
                    <div key={index} style={{ 
                      padding: "10px", 
                      borderBottom: "1px solid #eee", 
                      display: "flex", 
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <div>
                        <div style={{ fontWeight: "bold", fontSize: "14px" }}>{log.task}</div>
                        <div style={{ fontSize: "12px", color: "#666" }}>{log.result}</div>
                      </div>
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        {log.executed_at ? new Date(log.executed_at).toLocaleString() : 'Unknown time'}
                      </div>
                    </div>
                  ))}
                  {automationStatus.recent_logs.length === 0 && (
                    <div style={{ textAlign: "center", color: "#666", padding: "20px" }}>
                      No automation activity yet
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Affiliate Networks Tab */}
        {activeTab === "affiliates" && (
          <div>
            <h2 style={{ marginBottom: "20px", color: "#333" }}>Affiliate Network Management</h2>
            
            {/* Network Overview */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "20px", marginBottom: "30px" }}>
              {affiliateNetworks.map((network: any) => (
                <div key={network.network_id} style={{ 
                  backgroundColor: "white", 
                  padding: "20px", 
                  borderRadius: "8px", 
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  border: network.is_active ? "2px solid #28a745" : "2px solid #dc3545"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                    <h3 style={{ margin: 0, color: "#333" }}>{network.name}</h3>
                    <div style={{ 
                      padding: "4px 8px", 
                      borderRadius: "4px", 
                      fontSize: "12px", 
                      fontWeight: "bold",
                      backgroundColor: network.is_configured ? "#d4edda" : "#f8d7da",
                      color: network.is_configured ? "#155724" : "#721c24"
                    }}>
                      {network.is_configured ? "Configured" : "Not Configured"}
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: "15px", fontSize: "14px", color: "#666" }}>
                    <div><strong>Type:</strong> {network.type}</div>
                    <div><strong>Status:</strong> {network.is_active ? "Active" : "Inactive"}</div>
                    {network.last_sync && (
                      <div><strong>Last Sync:</strong> {new Date(network.last_sync).toLocaleString()}</div>
                    )}
                  </div>

                  <div style={{ marginBottom: "15px" }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#333" }}>Required Fields:</h4>
                    <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: "12px", color: "#666" }}>
                      {network.configuration_fields?.map((field: string, index: number) => (
                        <li key={index}>{field}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => openConfigModal(network)}
                      style={{ 
                        padding: "6px 12px", 
                        backgroundColor: "#007bff", 
                        color: "white", 
                        border: "none", 
                        borderRadius: "4px", 
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      Configure
                    </button>
                    
                    {network.is_configured && (
                      <>
                        <button
                          onClick={() => testNetworkConnection(network.network_id)}
                          style={{ 
                            padding: "6px 12px", 
                            backgroundColor: "#28a745", 
                            color: "white", 
                            border: "none", 
                            borderRadius: "4px", 
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          Test
                        </button>
                        
                        <button
                          onClick={() => toggleNetworkStatus(network.network_id, !network.is_active)}
                          style={{ 
                            padding: "6px 12px", 
                            backgroundColor: network.is_active ? "#dc3545" : "#28a745", 
                            color: "white", 
                            border: "none", 
                            borderRadius: "4px", 
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          {network.is_active ? "Disable" : "Enable"}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Compliance Terms */}
                  <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#333" }}>Compliance Requirements:</h4>
                    <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: "11px", color: "#666" }}>
                      {network.compliance_terms?.attribution_required && <li>Attribution required</li>}
                      {network.compliance_terms?.data_retention && (
                        <li>Data retention: {network.compliance_terms.data_retention.replace('_', ' ')}</li>
                      )}
                      {network.compliance_terms?.content_restrictions?.map((restriction: string, index: number) => (
                        <li key={index}>{restriction.replace('_', ' ')}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            {/* Configuration Instructions */}
            <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "20px" }}>
              <h3 style={{ marginBottom: "15px", color: "#333" }}>Setup Instructions</h3>
              <div style={{ fontSize: "14px", lineHeight: "1.6", color: "#666" }}>
                <h4 style={{ color: "#007bff", marginBottom: "10px" }}>How to Configure Affiliate Networks:</h4>
                <ol style={{ paddingLeft: "20px" }}>
                  <li><strong>Sign up</strong> for each affiliate program you want to use</li>
                  <li><strong>Get API credentials</strong> from the affiliate network's developer section</li>
                  <li><strong>Click "Configure"</strong> on any network above to enter your credentials</li>
                  <li><strong>Test the connection</strong> to verify everything works</li>
                  <li><strong>Enable the network</strong> to start fetching deals automatically</li>
                </ol>
                
                <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "#fff3cd", borderRadius: "4px", border: "1px solid #ffeaa7" }}>
                  <strong>⚠️ Important:</strong> All affiliate networks have specific terms of service and compliance requirements. 
                  Make sure to review their terms before enabling automated deal fetching.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configuration Modal */}
        {showConfigModal && selectedNetwork && (
          <div style={{ 
            position: "fixed", 
            top: 0, 
            left: 0, 
            width: "100%", 
            height: "100%", 
            backgroundColor: "rgba(0,0,0,0.5)", 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center",
            zIndex: 1000
          }}>
            <div style={{ 
              backgroundColor: "white", 
              padding: "30px", 
              borderRadius: "8px", 
              maxWidth: "500px", 
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto"
            }}>
              <h3 style={{ marginBottom: "20px", color: "#333" }}>Configure {selectedNetwork.name}</h3>
              
              <div style={{ marginBottom: "20px" }}>
                {selectedNetwork.configuration_fields?.map((field: string, index: number) => (
                  <div key={index} style={{ marginBottom: "15px" }}>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "14px" }}>
                      {field.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}:
                    </label>
                    <input
                      type={field.toLowerCase().includes('key') || field.toLowerCase().includes('secret') || field.toLowerCase().includes('token') ? "password" : "text"}
                      value={networkConfig[field] || ""}
                      onChange={(e) => setNetworkConfig({...networkConfig, [field]: e.target.value})}
                      style={{ 
                        width: "100%", 
                        padding: "8px", 
                        border: "1px solid #ccc", 
                        borderRadius: "4px",
                        fontSize: "14px"
                      }}
                      placeholder={`Enter your ${field}`}
                    />
                  </div>
                ))}
              </div>

              {/* Compliance Info */}
              <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333" }}>Compliance Requirements:</h4>
                <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: "12px", color: "#666" }}>
                  {selectedNetwork.compliance_terms?.attribution_required && <li>All links must include proper affiliate tracking</li>}
                  {selectedNetwork.compliance_terms?.data_retention && (
                    <li>Data retention: {selectedNetwork.compliance_terms.data_retention.replace('_', ' ')}</li>
                  )}
                  {selectedNetwork.compliance_terms?.content_restrictions?.map((restriction: string, index: number) => (
                    <li key={index}>{restriction.replace('_', ' ')}</li>
                  ))}
                </ul>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowConfigModal(false)}
                  style={{ 
                    padding: "10px 20px", 
                    backgroundColor: "#6c757d", 
                    color: "white", 
                    border: "none", 
                    borderRadius: "4px", 
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => configureNetwork(selectedNetwork.network_id, networkConfig)}
                  style={{ 
                    padding: "10px 20px", 
                    backgroundColor: "#007bff", 
                    color: "white", 
                    border: "none", 
                    borderRadius: "4px", 
                    cursor: "pointer"
                  }}
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Deal Modal */}
      {showAddDeal && (
        <div style={{ 
          position: "fixed", 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: "rgba(0,0,0,0.5)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          zIndex: 1000 
        }}>
          <div style={{ 
            backgroundColor: "white", 
            padding: "30px", 
            borderRadius: "8px", 
            width: "90%", 
            maxWidth: "600px", 
            maxHeight: "90vh", 
            overflowY: "auto" 
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#333" }}>Add New Deal</h3>
              <button
                onClick={() => setShowAddDeal(false)}
                style={{ 
                  background: "none", 
                  border: "none", 
                  fontSize: "24px", 
                  cursor: "pointer", 
                  color: "#666" 
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreateDeal}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Title</label>
                  <input
                    type="text"
                    value={newDeal.title}
                    onChange={(e) => setNewDeal({...newDeal, title: e.target.value})}
                    required
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  />
                </div>
                
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Description</label>
                  <textarea
                    value={newDeal.description}
                    onChange={(e) => setNewDeal({...newDeal, description: e.target.value})}
                    required
                    rows={3}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Original Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newDeal.original_price}
                    onChange={(e) => setNewDeal({...newDeal, original_price: e.target.value})}
                    required
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Sale Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newDeal.sale_price}
                    onChange={(e) => setNewDeal({...newDeal, sale_price: e.target.value})}
                    required
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Store</label>
                  <input
                    type="text"
                    value={newDeal.store}
                    onChange={(e) => setNewDeal({...newDeal, store: e.target.value})}
                    required
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Category</label>
                  <select
                    value={newDeal.category}
                    onChange={(e) => setNewDeal({...newDeal, category: e.target.value})}
                    required
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Deal Type</label>
                  <select
                    value={newDeal.deal_type}
                    onChange={(e) => setNewDeal({...newDeal, deal_type: e.target.value})}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  >
                    {dealTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Affiliate URL</label>
                  <input
                    type="url"
                    value={newDeal.affiliate_url}
                    onChange={(e) => setNewDeal({...newDeal, affiliate_url: e.target.value})}
                    required
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  />
                </div>
                
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Image URL</label>
                  <input
                    type="url"
                    value={newDeal.image_url}
                    onChange={(e) => setNewDeal({...newDeal, image_url: e.target.value})}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Coupon Code (Optional)</label>
                  <input
                    type="text"
                    value={newDeal.coupon_code}
                    onChange={(e) => setNewDeal({...newDeal, coupon_code: e.target.value})}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                    placeholder="Enter promo/coupon code"
                  />
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold" }}>
                    <input
                      type="checkbox"
                      checked={newDeal.coupon_required}
                      onChange={(e) => setNewDeal({...newDeal, coupon_required: e.target.checked})}
                    />
                    Coupon Required
                  </label>
                  <span style={{ fontSize: "12px", color: "#666" }}>
                    (Code is mandatory for discount)
                  </span>
                </div>
              </div>
              
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ 
                    flex: 1, 
                    padding: "12px", 
                    backgroundColor: loading ? "#ccc" : "#28a745", 
                    color: "white", 
                    border: "none", 
                    borderRadius: "4px", 
                    cursor: loading ? "not-allowed" : "pointer" 
                  }}
                >
                  {loading ? "Creating..." : "Create Deal"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddDeal(false)}
                  style={{ 
                    flex: 1, 
                    padding: "12px", 
                    backgroundColor: "#6c757d", 
                    color: "white", 
                    border: "none", 
                    borderRadius: "4px", 
                    cursor: "pointer" 
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Deal Modal */}
      {editingDeal && (
        <div style={{ 
          position: "fixed", 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: "rgba(0,0,0,0.5)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          zIndex: 1000 
        }}>
          <div style={{ 
            backgroundColor: "white", 
            padding: "30px", 
            borderRadius: "8px", 
            width: "90%", 
            maxWidth: "600px", 
            maxHeight: "90vh", 
            overflowY: "auto" 
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#333" }}>Edit Deal</h3>
              <button
                onClick={() => setEditingDeal(null)}
                style={{ 
                  background: "none", 
                  border: "none", 
                  fontSize: "24px", 
                  cursor: "pointer", 
                  color: "#666" 
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleUpdateDeal}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Title</label>
                  <input
                    type="text"
                    value={editingDeal.title}
                    onChange={(e) => setEditingDeal({...editingDeal, title: e.target.value})}
                    required
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  />
                </div>
                
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Description</label>
                  <textarea
                    value={editingDeal.description}
                    onChange={(e) => setEditingDeal({...editingDeal, description: e.target.value})}
                    required
                    rows={3}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Original Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingDeal.original_price}
                    onChange={(e) => setEditingDeal({...editingDeal, original_price: e.target.value})}
                    required
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Sale Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingDeal.sale_price}
                    onChange={(e) => setEditingDeal({...editingDeal, sale_price: e.target.value})}
                    required
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Store</label>
                  <input
                    type="text"
                    value={editingDeal.store}
                    onChange={(e) => setEditingDeal({...editingDeal, store: e.target.value})}
                    required
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Category</label>
                  <select
                    value={editingDeal.category}
                    onChange={(e) => setEditingDeal({...editingDeal, category: e.target.value})}
                    required
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Deal Type</label>
                  <select
                    value={editingDeal.deal_type || "regular"}
                    onChange={(e) => setEditingDeal({...editingDeal, deal_type: e.target.value})}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  >
                    {dealTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Affiliate URL</label>
                  <input
                    type="url"
                    value={editingDeal.affiliate_url}
                    onChange={(e) => setEditingDeal({...editingDeal, affiliate_url: e.target.value})}
                    required
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  />
                </div>
                
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Image URL</label>
                  <input
                    type="url"
                    value={editingDeal.image_url}
                    onChange={(e) => setEditingDeal({...editingDeal, image_url: e.target.value})}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Coupon Code (Optional)</label>
                  <input
                    type="text"
                    value={editingDeal.coupon_code || ""}
                    onChange={(e) => setEditingDeal({...editingDeal, coupon_code: e.target.value})}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                    placeholder="Enter promo/coupon code"
                  />
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold" }}>
                    <input
                      type="checkbox"
                      checked={editingDeal.coupon_required || false}
                      onChange={(e) => setEditingDeal({...editingDeal, coupon_required: e.target.checked})}
                    />
                    Coupon Required
                  </label>
                  <span style={{ fontSize: "12px", color: "#666" }}>
                    (Code is mandatory for discount)
                  </span>
                </div>
              </div>
              
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ 
                    flex: 1, 
                    padding: "12px", 
                    backgroundColor: loading ? "#ccc" : "#007bff", 
                    color: "white", 
                    border: "none", 
                    borderRadius: "4px", 
                    cursor: loading ? "not-allowed" : "pointer" 
                  }}
                >
                  {loading ? "Updating..." : "Update Deal"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDeal(null)}
                  style={{ 
                    flex: 1, 
                    padding: "12px", 
                    backgroundColor: "#6c757d", 
                    color: "white", 
                    border: "none", 
                    borderRadius: "4px", 
                    cursor: "pointer" 
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      <FileUploadModal
        open={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        onUploadComplete={() => {
          fetchData(); // Refresh deals data after upload
        }}
      />
    </div>
  );
}