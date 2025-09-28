import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { FileText, Mail, MapPin, Clock, Bot, Link as LinkIcon, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function TermsConditions() {
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
          <FileText className="w-8 h-8 text-blue-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">Terms and Conditions</h1>
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Clock className="w-4 h-4 mr-2" />
          <span>Last Updated: January 2025</span>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <p className="text-gray-700 leading-relaxed">
            Welcome to DealSphere ("we," "us," or "our"). These Terms and Conditions ("Terms") govern your use of our website, services, and content, including affiliate links, deals, coupon offers, and AI-generated recommendations. By accessing or using our website, you agree to these Terms. If you do not agree, you must not use our site.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">1. Acceptance of Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">
              By using our website, you confirm that you are at least 18 years old (or the legal age in your jurisdiction) and that you agree to comply with these Terms. If you are using the site on behalf of a business, you represent that you are authorized to bind that business to these Terms.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">2. Use of Our Website</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-3">You agree to:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 mb-3">
              <li>Use the site only for lawful purposes.</li>
              <li>Not disrupt, damage, or interfere with the security or functionality of our site.</li>
              <li>Not attempt to scrape, copy, or reproduce our content without permission.</li>
            </ul>
            <p className="text-gray-700">
              We may suspend or terminate your access if you violate these Terms.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center">
              <LinkIcon className="w-5 h-5 mr-2" />
              3. Affiliate Links & Commissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-3">
              Our website participates in affiliate marketing programs. When you click an affiliate link and make a purchase, we may earn a commission at no extra cost to you.
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              <li>These commissions help us maintain and improve our services.</li>
              <li>We do not control third-party websites, products, or services, and are not responsible for their content, terms, or delivery.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">4. Coupons, Deals & Offers</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              <li>Deals, coupons, and promotional offers are subject to change without notice.</li>
              <li>We strive for accuracy but do not guarantee the validity, availability, or savings from any deal or coupon.</li>
              <li>Users are responsible for verifying final prices and offer terms on the merchant's site before making a purchase.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center">
              <Bot className="w-5 h-5 mr-2" />
              5. AI-Generated Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-3">
              Our website uses Artificial Intelligence (AI) to filter, rank, and recommend deals, coupons, and offers.
            </p>
            <p className="text-gray-700 mb-3">
              By using our site, you acknowledge and agree that:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              <li>AI-generated recommendations are for informational purposes only and do not constitute professional, financial, or purchasing advice.</li>
              <li>While we aim for accuracy, AI results may contain errors, outdated information, or subjective rankings.</li>
              <li>You should always verify deal details on the merchant's website before making a purchase.</li>
              <li>We are not liable for any damages, losses, or issues arising from reliance on AI-generated content.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">6. Third-Party Websites</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-3">
              Our site contains links to third-party websites, including affiliate partners. We are not responsible for:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 mb-3">
              <li>Their content, policies, or practices.</li>
              <li>Any damages or losses resulting from your use of third-party websites.</li>
            </ul>
            <p className="text-gray-700">
              We encourage you to review their terms of service and privacy policies before using them.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">7. Intellectual Property</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              <li>All content on this site — including text, graphics, logos, images, and AI-generated content — is owned by DealSphere or our licensors.</li>
              <li>You may not copy, reproduce, modify, or distribute our content without prior written consent.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">8. Limitation of Liability</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              <li>We provide our website and content on an "as is" and "as available" basis without warranties of any kind.</li>
              <li>We are not responsible for inaccuracies, omissions, or errors in content, including AI-generated results.</li>
              <li>To the maximum extent permitted by law, we are not liable for any loss, damage, or inconvenience resulting from your use of our site or reliance on its content.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">9. Indemnification</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-3">
              You agree to indemnify and hold harmless DealSphere, its affiliates, employees, and partners from any claims, damages, liabilities, or expenses arising from:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              <li>Your use of the website.</li>
              <li>Your violation of these Terms.</li>
              <li>Your infringement of any third-party rights.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">10. Changes to These Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">
              We may update these Terms from time to time. Any changes will be posted on this page with an updated "Last Updated" date. Your continued use of the site after changes means you accept the new Terms.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">11. Governing Law</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">
              These Terms are governed by and construed in accordance with the laws of the United States, without regard to conflict of law principles.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">12. Contact Us</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">
              If you have questions about these Terms, please contact us:
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