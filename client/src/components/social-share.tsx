import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Facebook, MessageCircle, Link, MessageSquare, Smartphone } from "lucide-react";
import { SiX, SiWhatsapp } from "react-icons/si";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
// Use local Deal type to match API response format
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
  category: string;
  rating?: number;
  review_count?: number;
  deal_type?: string;
}

interface SocialShareProps {
  deal: Deal;
  onShare?: () => void;
}

export function SocialShare({ deal, onShare }: SocialShareProps) {
  const [isSharing, setIsSharing] = useState(false);
  const { toast } = useToast();

  const trackShare = async (platform: string) => {
    try {
      await apiRequest('POST', `/api/deals/${deal.id}/share`, { platform });
    } catch (error) {
      console.error('Failed to track share:', error);
    }
  };

  const shareOnFacebook = async () => {
    setIsSharing(true);
    try {
      // Create short URL for Facebook sharing
      const response = await apiRequest('POST', `/api/deals/${deal.id}/share?platform=facebook`);
      const { shortUrl } = await response.json();
      
      const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shortUrl)}&quote=${encodeURIComponent(deal.title)}`;
      
      window.open(shareUrl, '_blank', 'width=600,height=400');
      
      toast({
        title: "Shared on Facebook",
        description: "Thanks for sharing this deal!",
      });
      onShare?.(); // Call callback to refresh stats
    } catch (error) {
      console.error('Facebook share error:', error);
      // Fallback to regular URL if short URL creation fails
      try {
        const dealUrl = `${window.location.origin}/deals/${deal.id}`;
        const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(dealUrl)}&quote=${encodeURIComponent(deal.title)}`;
        
        await trackShare('facebook');
        window.open(shareUrl, '_blank', 'width=600,height=400');
        
        toast({
          title: "Shared on Facebook",
          description: "Thanks for sharing this deal!",
        });
      } catch (fallbackError) {
        toast({
          title: "Error",
          description: "Failed to share on Facebook",
          variant: "destructive",
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  const shareOnX = async () => {
    setIsSharing(true);
    try {
      // Create short URL for X sharing
      const response = await apiRequest('POST', `/api/deals/${deal.id}/share?platform=x`);
      const { shortUrl } = await response.json();
      
      const postText = `${deal.title} - ${deal.discount_percentage}% OFF! Get it for just $${deal.sale_price} (was $${deal.original_price})`;
      const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(postText)}&url=${encodeURIComponent(shortUrl)}`;
      
      window.open(shareUrl, '_blank', 'width=600,height=400');
      
      toast({
        title: "Shared on X",
        description: "Thanks for sharing this deal!",
      });
      onShare?.(); // Call callback to refresh stats
    } catch (error) {
      console.error('X share error:', error);
      // Fallback to regular URL if short URL creation fails
      try {
        const dealUrl = `${window.location.origin}/deals/${deal.id}`;
        const postText = `${deal.title} - ${deal.discount_percentage}% OFF! Get it for just $${deal.sale_price} (was $${deal.original_price})`;
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(postText)}&url=${encodeURIComponent(dealUrl)}`;
        
        await trackShare('x');
        window.open(shareUrl, '_blank', 'width=600,height=400');
        
        toast({
          title: "Shared on X",
          description: "Thanks for sharing this deal!",
        });
      } catch (fallbackError) {
        toast({
          title: "Error",
          description: "Failed to share on X",
          variant: "destructive",
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  const shareOnWhatsApp = async () => {
    setIsSharing(true);
    try {
      // Create short URL for WhatsApp sharing
      const response = await apiRequest('POST', `/api/deals/${deal.id}/share?platform=whatsapp`);
      const { shortUrl } = await response.json();
      
      const message = `Check out this amazing deal: ${deal.title} - ${deal.discount_percentage}% OFF! ${shortUrl}`;
      const shareUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      
      window.open(shareUrl, '_blank');
      
      toast({
        title: "Shared on WhatsApp",
        description: "Thanks for sharing this deal!",
      });
      onShare?.(); // Call callback to refresh stats
    } catch (error) {
      console.error('WhatsApp share error:', error);
      // Fallback to regular URL if short URL creation fails
      try {
        const dealUrl = `${window.location.origin}/deals/${deal.id}`;
        const message = `Check out this amazing deal: ${deal.title} - ${deal.discount_percentage}% OFF! ${dealUrl}`;
        const shareUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        
        await trackShare('whatsapp');
        window.open(shareUrl, '_blank');
        
        toast({
          title: "Shared on WhatsApp",
          description: "Thanks for sharing this deal!",
        });
      } catch (fallbackError) {
        toast({
          title: "Error",
          description: "Failed to share on WhatsApp",
          variant: "destructive",
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  const shareViaSMS = async () => {
    setIsSharing(true);
    try {
      // Create short URL for SMS sharing
      const response = await apiRequest('POST', `/api/deals/${deal.id}/share?platform=sms`);
      const { shortUrl } = await response.json();
      
      const message = `Check out this deal: ${deal.title} - ${deal.discount_percentage}% OFF! ${shortUrl}`;
      const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
      
      window.location.href = smsUrl;
      
      toast({
        title: "SMS App Opened",
        description: "Share this deal via text message!",
      });
      onShare?.(); // Call callback to refresh stats
    } catch (error) {
      console.error('SMS share error:', error);
      try {
        const dealUrl = `${window.location.origin}/deals/${deal.id}`;
        const message = `Check out this deal: ${deal.title} - ${deal.discount_percentage}% OFF! ${dealUrl}`;
        const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
        
        await trackShare('sms');
        window.location.href = smsUrl;
        
        toast({
          title: "SMS App Opened",
          description: "Share this deal via text message!",
        });
      } catch (fallbackError) {
        toast({
          title: "Error",
          description: "Failed to open SMS app",
          variant: "destructive",
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  const copyLink = async () => {
    setIsSharing(true);
    try {
      // Create short URL for sharing
      const response = await apiRequest('POST', `/api/deals/${deal.id}/share?platform=copy`);
      const { shortUrl } = await response.json();
      
      await navigator.clipboard.writeText(shortUrl);
      toast({
        title: "Short Link Copied",
        description: "Shareable link copied to clipboard!",
      });
      onShare?.(); // Call callback to refresh stats
    } catch (error) {
      console.error('Copy link error:', error);
      // Fallback to regular URL if short URL creation fails
      try {
        const dealUrl = `${window.location.origin}/deals/${deal.id}`;
        await navigator.clipboard.writeText(dealUrl);
        
        await trackShare('copy');
        toast({
          title: "Link Copied",
          description: "Deal link copied to clipboard!",
        });
      } catch (fallbackError) {
        toast({
          title: "Error",
          description: "Failed to copy link",
          variant: "destructive",
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 pt-3 border-t border-gray-100">
      <Button
        variant="ghost"
        size="sm"
        onClick={shareOnFacebook}
        disabled={isSharing}
        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2"
        title="Share on Facebook"
        data-testid="button-facebook-share"
      >
        <Facebook className="w-5 h-5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={shareOnX}
        disabled={isSharing}
        className="text-black hover:text-gray-800 hover:bg-gray-100 p-2"
        title="Share on X"
        data-testid="button-x-share"
      >
        <SiX className="w-5 h-5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={shareOnWhatsApp}
        disabled={isSharing}
        className="text-green-600 hover:text-green-700 hover:bg-green-50 p-2"
        title="Share on WhatsApp"
        data-testid="button-whatsapp-share"
      >
        <SiWhatsapp className="w-5 h-5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={shareViaSMS}
        disabled={isSharing}
        className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 p-2"
        title="Share via SMS"
        data-testid="button-sms-share"
      >
        <MessageSquare className="w-5 h-5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={copyLink}
        disabled={isSharing}
        className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 p-2"
        title="Copy Link"
        data-testid="button-copy-link"
      >
        <Link className="w-5 h-5" />
      </Button>
    </div>
  );
}
