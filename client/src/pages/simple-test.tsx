import React from "react";
import { useQuery } from "@tanstack/react-query";

export default function SimpleTest() {
  const { data: deals, isLoading, error } = useQuery({
    queryKey: ['/api/deals', { limit: 100 }],
    queryFn: async ({ queryKey }) => {
      const [path, params] = queryKey as [string, { limit: number }];
      const url = new URL(path, window.location.origin);
      url.searchParams.set('limit', params.limit.toString());
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Simple test - Raw API Response:', data);
      return data;
    },
  });

  console.log('Simple test state:', { isLoading, error, dealCount: deals?.length });

  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-4xl font-bold text-black mb-8">Simple Deal Test</h1>
      
      {isLoading && (
        <div className="bg-blue-100 p-4 rounded mb-4">
          <p className="text-blue-800 text-xl">Loading deals...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-100 p-4 rounded mb-4">
          <p className="text-red-800 text-xl">Error: {error.message}</p>
        </div>
      )}

      {deals && (
        <div className="bg-green-100 p-4 rounded mb-4">
          <p className="text-green-800 text-xl">Successfully loaded {deals.length} deals!</p>
        </div>
      )}

      {deals && deals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Deal List:</h2>
          {deals.slice(0, 5).map((deal: any, index: number) => (
            <div key={deal.id || index} className="border border-gray-300 p-4 rounded">
              <h3 className="text-lg font-semibold">{deal.title}</h3>
              <p className="text-gray-600">Store: {deal.store}</p>
              <p className="text-gray-600">Category: {deal.category}</p>
              <p className="text-gray-600">Price: ${deal.sale_price} (was ${deal.original_price})</p>
              <p className="text-gray-600">Type: {deal.deal_type}</p>
            </div>
          ))}
        </div>
      )}

      {deals && deals.length === 0 && (
        <div className="bg-yellow-100 p-4 rounded">
          <p className="text-yellow-800 text-xl">No deals found in response</p>
        </div>
      )}
    </div>
  );
}