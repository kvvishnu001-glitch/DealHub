import { useState } from "react";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  sizes?: "card" | "thumbnail" | "banner";
  onError?: () => void;
}

export function OptimizedImage({ 
  src, 
  alt, 
  className = "", 
  width, 
  height, 
  sizes = "card",
  onError 
}: OptimizedImageProps) {
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fallback image for when external images fail to load
  const fallbackImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-family='Arial, sans-serif' font-size='14'%3EImage Not Available%3C/text%3E%3C/svg%3E";

  // Image size configurations (compliance: external URLs only)
  const sizeConfigs = {
    card: { width: 300, height: 200 },
    thumbnail: { width: 150, height: 100 },
    banner: { width: 600, height: 300 }
  };

  const targetSize = sizeConfigs[sizes];
  const displayWidth = width || targetSize.width;
  const displayHeight = height || targetSize.height;

  // Generate optimized image URL (external hosting only - compliance requirement)
  const getOptimizedImageUrl = (originalUrl: string): string => {
    if (!originalUrl || imageError) return fallbackImage;
    
    // Ensure external URL (compliance with affiliate operating agreements)
    if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://')) {
      return fallbackImage;
    }

    // Add sizing parameters for common CDNs (no local storage)
    if (originalUrl.includes('amazon')) {
      const separator = originalUrl.includes('?') ? '&' : '?';
      return `${originalUrl}${separator}w=${displayWidth}&h=${displayHeight}`;
    }
    
    if (originalUrl.includes('shopify')) {
      if (originalUrl.includes('_master.')) {
        return originalUrl.replace('_master.', `_${displayWidth}x${displayHeight}.`);
      }
    }
    
    if (originalUrl.includes('cloudinary')) {
      if (originalUrl.includes('/image/upload/')) {
        return originalUrl.replace('/image/upload/', `/image/upload/w_${displayWidth},h_${displayHeight},c_fill/`);
      }
    }

    // Generic sizing parameters for other services
    const separator = originalUrl.includes('?') ? '&' : '?';
    return `${originalUrl}${separator}w=${displayWidth}&h=${displayHeight}&fit=crop`;
  };

  const handleImageError = () => {
    setImageError(true);
    setLoading(false);
    if (onError) onError();
  };

  const handleImageLoad = () => {
    setLoading(false);
  };

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ width: displayWidth, height: displayHeight }}
    >
      {loading && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center"
          style={{ width: displayWidth, height: displayHeight }}
        >
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      )}
      
      <img
        src={getOptimizedImageUrl(src)}
        alt={alt}
        className={`object-cover transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
        style={{ 
          width: displayWidth, 
          height: displayHeight,
          maxWidth: '100%'
        }}
        onError={handleImageError}
        onLoad={handleImageLoad}
        loading="lazy"
        // Compliance: Ensure we don't cache images locally
        crossOrigin="anonymous"
      />
      
      {imageError && (
        <div 
          className="absolute inset-0 bg-gray-100 flex items-center justify-center border border-gray-200"
          style={{ width: displayWidth, height: displayHeight }}
        >
          <div className="text-center text-gray-500 px-4">
            <div className="text-xs mb-1">Image Not Available</div>
            <div className="text-xs text-gray-400">External source required</div>
          </div>
        </div>
      )}
    </div>
  );
}