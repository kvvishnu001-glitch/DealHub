# Overview

DealSphere is an AI-powered deals and coupons platform that aggregates product deals from various stores and uses artificial intelligence to validate and categorize them. The platform now features a public-facing deals browser that shows all deal types (top deals, hot deals, latest deals) without requiring authentication, and an admin dashboard for managing deal submissions, approvals, and analytics. Built as a full-stack application with React frontend and Express backend, it leverages OpenAI for deal validation. A Python backend implementation has also been developed as an alternative.

## Recent Changes (2025-08-13)
- **Rich Social Media Sharing**: Complete Open Graph meta tags integration for Facebook, WhatsApp, Twitter with dynamic deal images and descriptions
- **Short URL System**: Generate shareable short URLs (e.g., /s/ABC123) that redirect to deal pages with full social media previews
- **AI Review Column in CSV**: Added `needs_ai_review` column to CSV uploads - false = auto-approved, true = requires AI screening
- **Enhanced Deal Click Tracking**: Fixed JSON parsing errors, now properly redirects users to affiliate URLs with click tracking
- **Social Media Preview Cards**: Deal pages now display rich previews with images, titles, descriptions, and pricing when shared
- **Complete US Affiliate Network Support**: Built comprehensive system supporting Amazon Associates, Commission Junction, ClickBank, ShareASale, Rakuten, Impact, Partnerize, AvantLink, AWIN, and more
- **Compliance Management System**: Full FTC compliance validation, network-specific terms enforcement, and automatic violation detection
- **Admin Affiliate Portal**: Complete UI for configuring all affiliate networks with API credentials, testing connections, and monitoring compliance
- **Multi-Protocol Support**: API-based (REST), FTP feeds, and CSV import capabilities for different affiliate network types
- **Terms & Conditions Enforcement**: Automatic validation against affiliate operating agreements with real-time compliance monitoring
- **Database-Driven Configuration**: All affiliate network settings, API credentials, and compliance rules stored securely in database
- **Automated Deal Fetching**: Integrated system fetching from all configured networks with AI validation and compliance checking
- **Real-Time Status Monitoring**: Live configuration health checks, connection testing, and automated compliance reporting
- **Production-Ready Compliance**: Built-in FTC disclosure requirements, network-specific attribution, and legal compliance features
- **File Upload System**: Comprehensive bulk deal upload system for networks without API access (CJ FTP exports, initial Amazon phases)
- **Sample File Templates**: Downloadable sample CSV files for Amazon, CJ, ShareASale with proper field formatting and examples
- **Smart Field Mapping**: Automatic field mapping and validation for different affiliate network export formats
- **Multi-Format Support**: CSV, Excel, XML, JSON, and text file processing with drag-and-drop upload interface

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing with public access for deals browsing
- **UI Framework**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **State Management**: TanStack Query for server state management and data fetching
- **Build**: Optimized production build served statically by Python backend

## Backend Architecture
- **Framework**: FastAPI with Python 3.11 for high-performance async API
- **Database**: PostgreSQL with SQLAlchemy async ORM and asyncpg driver
- **API Structure**: RESTful endpoints with automatic OpenAPI documentation
- **Static Files**: Serves built React frontend and handles all routing
- **Performance**: Async/await throughout for optimal concurrent request handling

## Database Design
- **ORM**: Drizzle ORM with PostgreSQL as the primary database
- **Connection**: Neon serverless PostgreSQL with connection pooling
- **Schema**: 
  - Users table for authentication (required by Replit Auth)
  - Deals table with comprehensive product information including AI scores and approval status
  - Analytics tables for tracking deal clicks and social shares
  - Sessions table for authentication session storage

## AI Integration
- **Service**: OpenAI GPT-4o for deal validation and categorization
- **Functionality**: Analyzes deal submissions to determine validity, assign categories, suggest deal types, and provide quality scores
- **Automation**: Auto-approves high-scoring deals (8.5+) while flagging lower-quality submissions for manual review

## External Dependencies

- **Database**: Neon serverless PostgreSQL for data persistence
- **Authentication**: Replit's OIDC authentication service for secure admin access
- **AI Services**: OpenAI API for deal validation and content enhancement
- **UI Components**: Radix UI for accessible, unstyled components with Shadcn/ui styling
- **Development Tools**: Vite for fast development builds and hot module replacement
- **Session Storage**: PostgreSQL-backed session storage for authentication persistence