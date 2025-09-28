import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, CheckCircle, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CouponCodeProps {
  code: string;
  variant?: "card" | "inline" | "badge" | "modal";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CouponCode({ code, variant = "card", size = "md", className }: CouponCodeProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({
        title: "Code Copied!",
        description: `Coupon code "${code}" copied to clipboard`,
        duration: 2000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy coupon code",
        variant: "destructive",
      });
    }
  };

  if (variant === "badge") {
    return (
      <Badge 
        variant="secondary" 
        className={cn("cursor-pointer bg-amber-100 text-amber-800 hover:bg-amber-200", className)}
        onClick={handleCopy}
      >
        <Tag className="w-3 h-3 mr-1" />
        {code}
        {copied ? <CheckCircle className="w-3 h-3 ml-1" /> : <Copy className="w-3 h-3 ml-1" />}
      </Badge>
    );
  }

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-amber-800">
          <Tag className="w-3 h-3" />
          <span className="font-mono text-sm font-medium">{code}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="h-6 px-2 text-xs"
        >
          {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>
    );
  }

  if (variant === "modal") {
    return (
      <div className={cn("text-center", className)}>
        <div className="inline-flex items-center gap-3 px-6 py-3 bg-white border-2 border-dashed border-green-300 rounded-lg">
          <Tag className="w-5 h-5 text-green-600" />
          <span className="font-mono text-xl font-bold text-gray-800">{code}</span>
        </div>
        <Button
          onClick={handleCopy}
          className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white"
        >
          {copied ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Copied to Clipboard!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Copy Coupon Code
            </>
          )}
        </Button>
      </div>
    );
  }

  // Card variant (default)
  const sizeClasses = {
    sm: "p-2 text-xs",
    md: "p-3 text-sm",
    lg: "p-4 text-base"
  };

  return (
    <Card className={cn("bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200", className)}>
      <CardContent className={cn("flex items-center justify-between", sizeClasses[size])}>
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-amber-600" />
          <div>
            <div className="text-xs text-amber-700 font-medium">COUPON CODE</div>
            <div className="font-mono font-bold text-amber-800">{code}</div>
          </div>
        </div>
        <Button
          size={size === "lg" ? "default" : "sm"}
          onClick={handleCopy}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {copied ? (
            <>
              <CheckCircle className="w-4 h-4 mr-1" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-1" />
              Copy
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}