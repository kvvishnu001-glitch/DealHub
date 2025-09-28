import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Shield, Mail, MapPin, Clock, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Navigation Header */}
      <div className="mb-6">
        <Link href="/">
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to DealSphere
          </Button>
        </Link>
      </div>
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <Shield className="w-8 h-8 text-blue-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Clock className="w-4 h-4 mr-2" />
          <span>Last Updated: January 2025</span>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <p className="text-gray-700 leading-relaxed">
            DealSphere ("we," "our," "us") respects your privacy and is committed to protecting the personal information you share with us. This Privacy Policy explains how we collect, use, and protect your information when you visit our website, subscribe to our services, or interact with our affiliate links, deals, and coupon offers.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">1. Information We Collect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">a) Personal Information You Provide</h4>
              <p className="text-gray-700">Name, email address, phone number, or mailing address (e.g., when subscribing to our newsletter, creating an account, or contacting us).</p>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-2">b) Automatically Collected Information</h4>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>IP address, browser type, operating system, device type, and browsing activity on our site.</li>
                <li>Pages you visit, time spent on site, and referring URLs.</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-2">c) Affiliate Tracking Data</h4>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>When you click on affiliate links, partner websites may collect information for tracking purchases, clicks, and commissions.</li>
                <li>This tracking is typically managed via cookies or unique referral IDs.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">2. How We Use Your Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-3">We use your information to:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              <li>Provide and improve our services and website functionality.</li>
              <li>Send promotional emails, newsletters, and personalized offers (with your consent).</li>
              <li>Track affiliate link performance to earn commissions.</li>
              <li>Prevent fraud, unauthorized activity, and ensure compliance with legal obligations.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">3. Cookies and Tracking Technologies</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-3">We use cookies, web beacons, and similar technologies to:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 mb-3">
              <li>Remember your preferences.</li>
              <li>Analyze website traffic and performance.</li>
              <li>Track affiliate referrals and conversions.</li>
            </ul>
            <p className="text-gray-700">You can manage cookies through your browser settings. Disabling cookies may limit some website functionality.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">4. Affiliate Disclosure</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">
              DealSphere participates in affiliate marketing programs, meaning we may earn commissions when you click on links or make purchases through partner websites. These links do not affect the price you pay but help us maintain our website and services.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">5. Sharing Your Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-3">We do not sell or rent your personal information. We may share your information with:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              <li>Trusted service providers (e.g., email marketing tools, analytics providers).</li>
              <li>Affiliate partners to track and verify commission-based transactions.</li>
              <li>Legal authorities when required by law.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">6. Third-Party Websites</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">
              Our site contains links to third-party websites, including affiliate partners. We are not responsible for the privacy practices of those websites. Please review their privacy policies before providing personal information.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">7. Data Security</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">
              We take reasonable measures to protect your personal data from unauthorized access, alteration, or disclosure. However, no online transmission is 100% secure.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">8. Your Rights</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-3">Depending on your location, you may have the right to:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              <li>Access, update, or delete your personal information.</li>
              <li>Opt out of marketing emails (unsubscribe link in all emails).</li>
              <li>Request data portability or restriction of processing.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">9. Children's Privacy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">
              Our services are not intended for individuals under the age of 13 (or the minimum legal age in your jurisdiction). We do not knowingly collect personal information from children.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">10. Changes to This Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">
              We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated "Last Updated" date.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">11. Contact Us</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <div className="space-y-2">
              <div className="flex items-center text-gray-700">
                <Mail className="w-4 h-4 mr-2 text-blue-600" />
                <span>contact@dealsphere.com</span>
              </div>
              <div className="flex items-center text-gray-700">
                <MapPin className="w-4 h-4 mr-2 text-blue-600" />
                <span>DealSphere Inc., 123 Commerce Street, Suite 100, Business City, BC 12345</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />
      
      <div className="text-center text-sm text-gray-500">
        <p>© 2025 DealSphere. All rights reserved.</p>
      </div>
    </div>
  );
}