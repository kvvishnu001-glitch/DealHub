import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation } from "wouter";

interface AdminCredentials {
  username: string;
  password: string;
}

export default function AdminLogin() {
  const [credentials, setCredentials] = useState<AdminCredentials>({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();

  useEffect(() => {
    console.log('AdminLogin render - isLoggedIn:', !!localStorage.getItem('admin_token'));
    // Check if already logged in
    const token = localStorage.getItem('admin_token');
    if (token) {
      setLocation('/admin/dashboard');
      return;
    }
    
    console.log('AdminLogin mounted - clearing localStorage');
    // Clear any old tokens on mount
    localStorage.removeItem('admin_token');
  }, [setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('admin_token', data.access_token);
        localStorage.setItem('adminUser', JSON.stringify(data.admin));
        setLocation('/admin/dashboard');
      } else {
        const error = await response.text();
        setError(error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
        {/* Login Form */}
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Admin Portal</CardTitle>
            <CardDescription className="text-center">
              Sign in to manage deals and analytics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  required
                  data-testid="input-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  required
                  data-testid="input-password"
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-200">Demo Credentials:</h4>
              <p className="text-sm text-blue-600 dark:text-blue-300">Username: admin</p>
              <p className="text-sm text-blue-600 dark:text-blue-300">Password: admin123</p>
            </div>
          </CardContent>
        </Card>

        {/* Hero Section */}
        <div className="text-center md:text-left space-y-6">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              DealSphere
              <span className="block text-2xl text-blue-600 dark:text-blue-400">Admin Portal</span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Powerful tools to manage your deals platform with AI-powered insights and comprehensive analytics.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 text-left">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Deal Management</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Create, approve, reject, and organize deals by categories</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs">📊</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Analytics Dashboard</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Real-time metrics, click tracking, and performance insights</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs">🤖</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">AI-Powered</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Automated deal validation and smart categorization</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}