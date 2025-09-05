---
title: Altus 4 Documentation
description: Complete documentation hub for Altus 4 - AI-Enhanced MySQL Full-Text Search Engine with semantic search, multi-database support, and intelligent caching.
---

# Altus 4 Documentation

Complete Documentation Hub for Altus 4 - AI-Enhanced MySQL Full-Text Search Engine

Welcome to the comprehensive documentation for Altus 4. This documentation provides detailed information about every aspect of the system, from high-level architecture to low-level implementation details.

## What is Altus 4?

Altus 4 is an advanced AI-powered MySQL full-text search engine that enhances traditional database search capabilities with:

- **Semantic Search**: AI-powered understanding of query intent and context
- **Multi-Database Support**: Search across multiple MySQL databases simultaneously
- **Intelligent Caching**: Redis-backed performance optimization
- **API-First Design**: RESTful API with comprehensive authentication
- **Real-time Analytics**: Search trends and performance insights

## Quick Start

Get Altus 4 running locally in under 5 minutes:

```bash
# Prerequisites: Node.js 18+, MySQL 8.0+, Redis 6.0+

# Clone and install
git clone https://github.com/altus4/core.git
cd altus4
npm install

# Option 1: Full Docker Environment (Recommended)
npm run dev:start        # Starts MySQL + Redis + runs migrations
npm run dev              # Start the application
# Server starts at http://localhost:3000

# Option 2: Manual Setup
cp .env.example .env     # Setup environment
# Edit .env with your MySQL/Redis credentials
npm run migrate          # Run database migrations
npm run dev              # Start development server

# When done developing
npm run dev:stop         # Stop Docker services
```

Visit `http://localhost:3000/health` to verify the installation.

## Documentation Sections

### For New Users

1. **[Setup & Installation](setup/)** - Get Altus 4 running
2. **[API Overview](api/)** - Understanding the API
3. **[Examples](examples/)** - Practical code examples

### For Developers

1. **[Architecture](architecture/)** - System design and patterns
2. **[Services](services/)** - Core business logic documentation
3. **[Development Guide](development/)** - Contributing and development workflow

### For DevOps

1. **[Setup & Deployment](setup/)** - Production deployment guide
2. **[Testing](testing/)** - Testing strategies and examples

## Key Features

- **Advanced Search**: Natural language, boolean, and semantic search modes
- **AI Integration**: OpenAI-powered query optimization and result enhancement
- **High Performance**: Intelligent caching and parallel database queries
- **Enterprise Security**: API key authentication with tiered rate limiting
- **Rich Analytics**: Search trends, performance metrics, and insights
- **Developer Friendly**: Comprehensive API documentation and examples

## API Authentication

All API endpoints use API key authentication for B2B service integration:

```bash
# Include API key in all requests
Authorization: Bearer altus4_sk_live_abc123def456...
```

## Support

Need help with Altus 4?

- **Documentation**: You're in the right place!
- **Examples**: Check out the [examples section](examples/)
- **Issues**: [GitHub Issues](https://github.com/altus4/core/issues)
- **Community**: [GitHub Discussions](https://github.com/altus4/core/discussions)

---

**Ready to enhance your MySQL search capabilities with AI?** Start with the [Setup Guide](setup/) or explore our [API Reference](api/).
