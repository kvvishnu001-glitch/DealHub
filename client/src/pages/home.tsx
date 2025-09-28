import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useRealTimeUpdates } from "@/hooks/use-auto-refresh";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DealCard } from "@/components/ui/deal-card";
import { Skeleton } from "@/components/ui/skeleton";

import { 
  Percent, 
  Search, 
  Flame, 
  Clock, 
  Tag, 
  Store, 
  Facebook, 
  Twitter, 
  Instagram, 
  Youtube, 
  X,
  LogOut,
  Loader2
} from "lucide-react";
// Define types to match API response
interface Deal {
  id: string;
  title: string;
  description: string;
  original_price: number;
  sale_price: number;
  discount_percentage: number;
  image_url: string;
  affiliate_url: string;
  store: string;
  store_logo_url?: string;
  category: string;
  rating?: number;
  review_count?: number;
  expires_at?: string;
  is_active: boolean;
  is_ai_approved?: boolean;
  ai_score?: number;
  click_count?: number;
  deal_type?: string;
  created_at?: string;
  coupon_code?: string;
  coupon_required?: boolean;
}

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [selectedDiscount, setSelectedDiscount] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // View All states for infinite scroll
  const [showAllTop, setShowAllTop] = useState(false);
  const [showAllHot, setShowAllHot] = useState(false);
  const [showAllLatest, setShowAllLatest] = useState(false);
  const [topDealsPage, setTopDealsPage] = useState(1);
  const [hotDealsPage, setHotDealsPage] = useState(1);
  const [latestDealsPage, setLatestDealsPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Enable real-time updates
  useRealTimeUpdates();

  // Fetch deals count for the hero section
  const { data: dealsCount } = useQuery({
    queryKey: ['/api/deals/count'],
    queryFn: async () => {
      const response = await fetch('/api/deals/count');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Fetch deals with infinite scroll pagination
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['/api/deals'],
    queryFn: async ({ pageParam = 0 }) => {
      const url = new URL('/api/deals', window.location.origin);
      url.searchParams.set('limit', '20');
      url.searchParams.set('offset', pageParam.toString());
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const deals = await response.json();
      return deals;
    },
    getNextPageParam: (lastPage, allPages) => {
      // If we got less than 20 deals, we've reached the end
      if (lastPage.length < 20) return undefined;
      // Return the offset for the next page
      return allPages.length * 20;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Flatten all pages into a single array of deals
  const deals = data?.pages.flatMap(page => page) || [];

  if (error) {
    console.error('Query error:', error);
  }

  // Scroll handler for infinite loading
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.innerHeight + document.documentElement.scrollTop;
      const scrollThreshold = document.documentElement.offsetHeight - 1000; // Load when 1000px from bottom
      
      if (scrollPosition >= scrollThreshold && !isFetchingNextPage && hasNextPage) {
        fetchNextPage();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchNextPage, isFetchingNextPage, hasNextPage]);

  // Get unique filter options from actual deals data
  const availableCategories = [...new Set(deals?.map((deal: Deal) => deal.category) || [])];
  const availableStores = [...new Set(deals?.map((deal: Deal) => deal.store) || [])];
  const availableDiscounts = [...new Set(deals?.map((deal: Deal) => {
    const discount = deal.discount_percentage;
    if (discount >= 50) return "50+";
    if (discount >= 30) return "30+";
    if (discount >= 10) return "10+";
    return null;
  }).filter(Boolean) || [])];

  // Filter deals properly
  const filteredDeals = deals?.filter((deal: Deal) => {
    // Check if deal is active and approved (critical filters)
    if (!deal.is_active || deal.is_ai_approved === false) {
      return false;
    }
    
    // Basic field validation
    if (!deal.title || !deal.original_price || !deal.sale_price || !deal.store || !deal.category) {
      return false;
    }
    
    // Search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      const searchable = `${deal.title} ${deal.description} ${deal.store} ${deal.category}`.toLowerCase();
      if (!searchable.includes(query)) return false;
    }
    
    // Category filter
    if (selectedCategory !== "all" && deal.category !== selectedCategory) return false;
    
    // Store filter  
    if (selectedStore !== "all" && deal.store !== selectedStore) return false;
    
    // Discount filter - use calculated percentage if stored is 0
    if (selectedDiscount !== "all") {
      const discount = deal.discount_percentage || 
        Math.round(((deal.original_price - deal.sale_price) / deal.original_price) * 100);
      switch (selectedDiscount) {
        case "50+":
          if (discount < 50) return false;
          break;
        case "30+":
          if (discount < 30) return false;
          break;
        case "10+":
          if (discount < 10) return false;
          break;
      }
    }
    return true;
  }) || [];

  // Debug Latest Deals expansion
  if (process.env.NODE_ENV === 'development') {
    console.log('Latest Deals: available=', latestFilteredDeals?.length || 0, 'showing=', latestDeals?.length || 0);
  }

  // Load more function for infinite scroll
  const loadMoreDeals = (section: 'top' | 'hot' | 'latest') => {
    if (loadingMore) return;
    setLoadingMore(true);
    
    setTimeout(() => {
      if (section === 'top') {
        setTopDealsPage(prev => prev + 1);
      } else if (section === 'hot') {
        setHotDealsPage(prev => prev + 1);
      } else if (section === 'latest') {
        setLatestDealsPage(prev => prev + 1);
      }
      setLoadingMore(false);
    }, 500);
  };

  // Enhanced deal sections with image validation and pagination
  const topDealsLimit = showAllTop ? topDealsPage * 30 : 3;
  const topDeals = filteredDeals
    .filter((deal: Deal) => deal.deal_type === 'top' && deal.image_url && deal.image_url.trim() !== '')
    .slice(0, topDealsLimit);
  
  const hotDealsLimit = showAllHot ? hotDealsPage * 30 : 4;  
  const hotDeals = filteredDeals
    .filter((deal: Deal) => deal.deal_type === 'hot' && deal.image_url && deal.image_url.trim() !== '')
    .slice(0, hotDealsLimit);
  
  // Latest Deals: show all available latest/regular deals (auto-expansion with infinite scroll)
  const latestFilteredDeals = filteredDeals
    .filter((deal: Deal) => (deal.deal_type === 'latest' || deal.deal_type === 'regular') && deal.image_url && deal.image_url.trim() !== '');
  
  // Show at least 5, but expand to show all loaded deals (max 25 for performance)  
  const latestDeals = latestFilteredDeals.slice(0, showAllLatest ? latestDealsPage * 30 : Math.min(25, latestFilteredDeals.length));

  // Debug Latest Deals expansion
  if (process.env.NODE_ENV === 'development') {
    console.log('Latest Deals: available=', latestFilteredDeals?.length || 0, 'showing=', latestDeals?.length || 0);
  }

  // Infinite scroll effect for "view all" sections only
  React.useEffect(() => {
    const handleSectionScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop < document.documentElement.offsetHeight - 500) return;
      
      // Only handle section-specific scrolling when in "view all" mode
      if (showAllTop && topDeals.length < filteredDeals.filter((d: Deal) => d.deal_type === 'top' && d.image_url).length) {
        loadMoreDeals('top');
      } else if (showAllHot && hotDeals.length < filteredDeals.filter((d: Deal) => d.deal_type === 'hot' && d.image_url).length) {
        loadMoreDeals('hot');
      } else if (showAllLatest && latestDeals.length < filteredDeals.filter((d: Deal) => (d.deal_type === 'latest' || d.deal_type === 'regular') && d.image_url).length) {
        loadMoreDeals('latest');
      }
    };

    // Only add listener when in "view all" mode to avoid conflicts
    if (showAllTop || showAllHot || showAllLatest) {
      window.addEventListener('scroll', handleSectionScroll);
      return () => window.removeEventListener('scroll', handleSectionScroll);
    }
  }, [showAllTop, showAllHot, showAllLatest, topDeals.length, hotDeals.length, latestDeals.length, filteredDeals, loadingMore]);
  

  const clearFilters = () => {
    setSelectedCategory("all");
    setSelectedStore("all");
    setSelectedDiscount("all");
    setSearchQuery("");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="w-full h-48" />
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-6 w-1/2 mb-4" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center py-4 sm:h-16 space-y-3 sm:space-y-0">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Percent className="text-red-600 text-xl sm:text-2xl mr-2" />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">DealSphere</h1>
              </div>
            </div>
            
            {/* Search Bar */}
            <div className="flex-1 max-w-lg mx-0 sm:mx-4 lg:mx-8 w-full sm:w-auto">
              <div className="relative">
                <Input
                  type="search"
                  placeholder="Search deals, stores..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 bg-gray-100 border-gray-300 focus:border-red-600 focus:ring-red-600"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <Search className="text-gray-400 w-4 h-4" />
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Admin Dashboard button will be shown only on /admin route */}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-red-600 to-red-700 text-white py-8 sm:py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl sm:text-4xl lg:text-6xl font-bold mb-4">
            AI-Powered Deals & Coupons
          </h1>
          <p className="text-lg sm:text-xl lg:text-2xl mb-8 text-red-100">
            Discover verified deals curated by artificial intelligence
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-red-100 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold">{dealsCount?.count || 0}</div>
              <div className="text-sm">Active Deals</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold">$1.2M+</div>
              <div className="text-sm">Total Savings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold">98%</div>
              <div className="text-sm">AI Verified</div>
            </div>
          </div>
        </div>
      </section>



      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Floating Filters */}
        <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-lg mb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="space-y-4">
                  {/* Filter Pills */}
                  <div className="flex flex-wrap gap-3 items-center">
                    {/* Category Filter */}
                    <div className="flex items-center space-x-2">
                      <Tag className="w-4 h-4 text-gray-500" />
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="h-10 min-w-[140px] border-gray-300 rounded-full bg-white hover:bg-gray-50 focus:ring-2 focus:ring-red-500">
                          <SelectValue placeholder="📁 All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">📁 All Categories</SelectItem>
                          {availableCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Store Filter */}
                    <div className="flex items-center space-x-2">
                      <Store className="w-4 h-4 text-gray-500" />
                      <Select value={selectedStore} onValueChange={setSelectedStore}>
                        <SelectTrigger className="h-10 min-w-[120px] border-gray-300 rounded-full bg-white hover:bg-gray-50 focus:ring-2 focus:ring-red-500">
                          <SelectValue placeholder="🏪 All Stores" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">🏪 All Stores</SelectItem>
                          {availableStores.map((store) => (
                            <SelectItem key={store} value={store}>
                              {store}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Discount Filter */}
                    <div className="flex items-center space-x-2">
                      <Percent className="w-4 h-4 text-gray-500" />
                      <Select value={selectedDiscount} onValueChange={setSelectedDiscount}>
                        <SelectTrigger className="h-10 min-w-[130px] border-gray-300 rounded-full bg-white hover:bg-gray-50 focus:ring-2 focus:ring-red-500">
                          <SelectValue placeholder="💰 Any Discount" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">💰 Any Discount</SelectItem>
                          {availableDiscounts.includes("50+") && (
                            <SelectItem value="50+">🔥 50%+ Off</SelectItem>
                          )}
                          {availableDiscounts.includes("30+") && (
                            <SelectItem value="30+">⚡ 30%+ Off</SelectItem>
                          )}
                          {availableDiscounts.includes("10+") && (
                            <SelectItem value="10+">✨ 10%+ Off</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Active Filters Indicator */}
                    {(selectedCategory !== "all" || selectedStore !== "all" || selectedDiscount !== "all" || searchQuery) && (
                      <div className="flex items-center space-x-2">
                        <div className="h-6 w-px bg-gray-300"></div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={clearFilters}
                          className="h-10 px-4 text-gray-600 hover:text-gray-800 border-gray-300 rounded-full hover:bg-gray-50"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Clear All
                        </Button>
                      </div>
                    )}
                    
                    {/* Filter Count */}
                    <div className="flex items-center space-x-1 text-sm text-gray-500 ml-auto">
                      <span className="hidden sm:inline">Showing</span>
                      <span className="font-semibold text-red-600">{filteredDeals.length}</span>
                      <span className="hidden sm:inline">deals</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Top Deals Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
              <Flame className="text-red-600 mr-2 w-5 h-5 sm:w-6 sm:h-6" />
              Top Deals
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm text-gray-500">AI-curated best deals</span>
              {!showAllTop && topDeals.length >= 3 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowAllTop(true)}
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  View All
                </Button>
              )}
              {showAllTop && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setShowAllTop(false);
                    setTopDealsPage(1);
                  }}
                  className="text-gray-600 border-gray-600 hover:bg-gray-50"
                >
                  Show Less
                </Button>
              )}
            </div>
          </div>
          
          <div className={`grid gap-4 sm:gap-6 ${showAllTop ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
            {topDeals.length > 0 ? topDeals.map((deal: Deal) => (
              <DealCard key={deal.id} deal={deal} variant="full" />
            )) : (
              <div className="col-span-full text-center text-gray-500 py-8 bg-red-100 p-4 rounded">
                No top deals available (Total filtered deals: {filteredDeals.length})
              </div>
            )}
          </div>
          
          {showAllTop && loadingMore && (
            <div className="text-center py-8">
              <div className="inline-flex items-center px-4 py-2 text-sm text-gray-600">
                Loading more deals...
              </div>
            </div>
          )}
        </section>

        {/* Hot Deals Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
              <Flame className="text-amber-500 mr-2 w-5 h-5 sm:w-6 sm:h-6" />
              Hot Deals
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm text-gray-500">Trending now</span>
              {!showAllHot && hotDeals.length >= 4 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowAllHot(true)}
                  className="text-amber-600 border-amber-600 hover:bg-amber-50"
                >
                  View All
                </Button>
              )}
              {showAllHot && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setShowAllHot(false);
                    setHotDealsPage(1);
                  }}
                  className="text-gray-600 border-gray-600 hover:bg-gray-50"
                >
                  Show Less
                </Button>
              )}
            </div>
          </div>
          
          <div className={`grid gap-4 ${showAllHot ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
            {hotDeals.length > 0 ? hotDeals.map((deal: Deal) => (
              <DealCard key={deal.id} deal={deal} variant="compact" />
            )) : (
              <div className="col-span-full text-center text-gray-500 py-8 bg-yellow-100 p-4 rounded">
                No hot deals available (Total filtered deals: {filteredDeals.length})
              </div>
            )}
          </div>
          
          {showAllHot && loadingMore && (
            <div className="text-center py-8">
              <div className="inline-flex items-center px-4 py-2 text-sm text-gray-600">
                Loading more deals...
              </div>
            </div>
          )}
        </section>

        {/* Latest Deals Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
              <Clock className="text-blue-500 mr-2 w-5 h-5 sm:w-6 sm:h-6" />
              Latest Deals
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm text-gray-500">Just added</span>
              {!showAllLatest && latestDeals.length >= 5 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowAllLatest(true)}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  View All
                </Button>
              )}
              {showAllLatest && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setShowAllLatest(false);
                    setLatestDealsPage(1);
                  }}
                  className="text-gray-600 border-gray-600 hover:bg-gray-50"
                >
                  Show Less
                </Button>
              )}
            </div>
          </div>
          
          {showAllLatest ? (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {latestDeals.length > 0 ? latestDeals.map((deal: Deal) => (
                <DealCard key={deal.id} deal={deal} variant="full" />
              )) : (
                <div className="col-span-full text-center text-gray-500 py-8 bg-blue-100 p-4 rounded">
                  No latest deals available (Total filtered deals: {filteredDeals.length})
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {latestDeals.length > 0 ? latestDeals.map((deal: Deal) => (
                    <DealCard key={deal.id} deal={deal} variant="list" />
                  )) : (
                    <div className="text-center text-gray-500 py-8 bg-blue-100 p-4 rounded">
                      No latest deals available (Total filtered deals: {filteredDeals.length})
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          {showAllLatest && loadingMore && (
            <div className="text-center py-8">
              <div className="inline-flex items-center px-4 py-2 text-sm text-gray-600">
                Loading more deals...
              </div>
            </div>
          )}
        </section>

        {filteredDeals.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No deals found</h3>
              <p className="text-gray-600 mb-4">
                Try adjusting your filters or check back later for new deals.
              </p>
              <Button onClick={clearFilters} className="bg-red-600 hover:bg-red-700">
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Main infinite scroll loading indicator - only show when not in "View All" mode */}
        {isFetchingNextPage && !showAllTop && !showAllHot && !showAllLatest && (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200 mx-4 my-8" style={{ minHeight: '120px' }}>
            <div className="inline-flex items-center space-x-3 px-6 py-4 text-gray-600">
              <Loader2 className="w-6 h-6 animate-spin text-red-600" />
              <span className="text-lg font-medium">Loading more deals...</span>
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Discovering amazing deals for you
            </div>
          </div>
        )}
        
        {/* End of deals indicator - only show when not in "View All" mode */}
        {!hasNextPage && deals.length > 0 && !showAllTop && !showAllHot && !showAllLatest && (
          <div className="text-center py-12 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg shadow-sm border border-gray-200 mx-4 my-8" style={{ minHeight: '120px' }}>
            <div className="text-gray-600 flex flex-col items-center justify-center">
              <div className="text-3xl mb-3">🎉</div>
              <div className="text-lg font-medium mb-2">You've seen all deals!</div>
              <div className="text-sm">Check back soon for more amazing offers</div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <Percent className="text-red-600 text-2xl mr-2" />
                <h3 className="text-xl font-bold">DealSphere</h3>
              </div>
              <p className="text-gray-300 mb-4">
                AI-powered deals and coupons platform helping you save money on your favorite products.
              </p>
              <div className="flex space-x-4">
                <Facebook className="w-5 h-5 hover:text-red-600 cursor-pointer transition-colors" />
                <Twitter className="w-5 h-5 hover:text-red-600 cursor-pointer transition-colors" />
                <Instagram className="w-5 h-5 hover:text-red-600 cursor-pointer transition-colors" />
                <Youtube className="w-5 h-5 hover:text-red-600 cursor-pointer transition-colors" />
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Popular Categories</h4>
              <ul className="space-y-2 text-gray-300">
                {availableCategories.slice(0, 6).map((category) => (
                  <li key={category}>
                    <button 
                      onClick={() => {
                        setSelectedCategory(category);
                        window.scrollTo({ top: 200, behavior: 'smooth' });
                      }}
                      className="hover:text-white transition-colors text-left"
                    >
                      {category}
                    </button>
                  </li>
                ))}
                {availableCategories.length === 0 && (
                  <>
                    <li><span className="text-gray-400">Electronics</span></li>
                    <li><span className="text-gray-400">Fashion</span></li>
                    <li><span className="text-gray-400">Home & Garden</span></li>
                    <li><span className="text-gray-400">Sports</span></li>
                    <li><span className="text-gray-400">Beauty</span></li>
                    <li><span className="text-gray-400">Books</span></li>
                  </>
                )}
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Top Stores</h4>
              <ul className="space-y-2 text-gray-300">
                {availableStores.slice(0, 6).map((store) => (
                  <li key={store}>
                    <button 
                      onClick={() => {
                        setSelectedStore(store);
                        window.scrollTo({ top: 200, behavior: 'smooth' });
                      }}
                      className="hover:text-white transition-colors text-left"
                    >
                      {store}
                    </button>
                  </li>
                ))}
                {availableStores.length === 0 && (
                  <>
                    <li><span className="text-gray-400">Amazon</span></li>
                    <li><span className="text-gray-400">Target</span></li>
                    <li><span className="text-gray-400">Best Buy</span></li>
                    <li><span className="text-gray-400">Walmart</span></li>
                    <li><span className="text-gray-400">eBay</span></li>
                    <li><span className="text-gray-400">Macy's</span></li>
                  </>
                )}
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-300">
                <li>
                  <button 
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="hover:text-white transition-colors text-left"
                  >
                    About DealSphere
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => {
                      const email = 'support@dealsphere.com';
                      window.location.href = `mailto:${email}?subject=DealSphere Inquiry`;
                    }}
                    className="hover:text-white transition-colors text-left"
                  >
                    Contact Support
                  </button>
                </li>

                <li>
                  <Link href="/terms-conditions" className="hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy-policy" className="hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <button 
                    onClick={() => window.scrollTo({ bottom: 0, behavior: 'smooth' })}
                    className="hover:text-white transition-colors text-left"
                  >
                    Affiliate Disclosure
                  </button>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-600 mt-8 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex flex-col sm:flex-row items-center gap-4 text-gray-300 text-sm mb-4 md:mb-0">
                <p>© 2025 DealSphere. All rights reserved.</p>
                <div className="flex gap-4">
                  <Link href="/privacy-policy" className="hover:text-white transition-colors" data-testid="link-privacy-policy">
                    Privacy Policy
                  </Link>
                  <Link href="/terms-conditions" className="hover:text-white transition-colors" data-testid="link-terms-conditions">
                    Terms & Conditions
                  </Link>
                </div>
              </div>
              <div className="text-sm text-gray-300 max-w-md">
                <strong>Affiliate Disclosure:</strong> DealSphere is a participant in various affiliate programs and may earn commissions from qualifying purchases made through our links.
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
