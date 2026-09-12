# IFC — INTERNATIONAL FUTBOL CONFEDERATION

## Professional Football/Futsal League Platform

### ⚽ Core Features

- **Discord OAuth2 Authentication** - Seamless login with Discord
- **Player Database** - Complete player profiles with statistics
- **Hero Card System** - Visual representation of player stats
- **Market Value System** - Dynamic player valuations
- **Transfer Management** - Handle transfers, loans, and contracts
- **Match Center** - Live match tracking and results
- **Predictions** - Community predictions for matches
- **News & Media** - Professional newsroom and social integration
- **Staff Administration** - Role-based permissions and audit logs
- **Discord Bot** - Commands and notifications

### 🏗️ Architecture

```
DISCORD
  ↓
DISCORD BOT (ifc-discord-bot)
  ↓
IFC API (ifc-platform/backend)
  ↓
POSTGRES DATABASE
  ↓
IFC WEBSITE (ifc-platform/frontend)
```

### 🚀 Quick Start

#### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- Discord Bot Token

#### Installation

```bash
# Clone repository
git clone https://github.com/yojustkamil-ui/ifc-platform.git
cd ifc-platform

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Run database migration
npm run migrate

# Start server
npm run dev
```

### 📦 Project Structure

```
ifc-platform/
├── src/
│   ├── config/          # Database, logger, etc.
│   ├── middleware/      # Auth, validation, error handling
│   ├── routes/          # API routes
│   ├── utils/           # Utilities
│   └── server.js        # Express app
├── database/
│   └── schema.sql       # Database schema
├── scripts/
│   └── migrate.js       # Migration script
└── package.json
```

### 🔐 Authentication

The platform uses:
- **Discord OAuth2** for user authentication
- **JWT tokens** for API access
- **Role-based access control** for authorization

### 📊 Database

PostgreSQL with the following main tables:
- `users` - User accounts
- `players` - Player profiles
- `teams` - Team information
- `leagues` - League data
- `matches` - Match records
- `hero_cards` - Player cards
- `contracts` - Player contracts
- `transfers` - Transfer records
- `news` - News articles
- `audit_logs` - Admin actions

### 🤖 Discord Bot

Separate repository: [ifc-discord-bot](https://github.com/yojustkamil-ui/ifc-discord-bot)

Commands:
- `/player [name]` - Get player info
- `/team [name]` - Get team info
- `/match [id]` - Get match details
- `/predictions [match_id]` - Vote on match prediction
- `/transfers` - Latest transfers

### 📝 API Endpoints

#### Authentication
- `GET /api/auth/discord/callback` - Discord OAuth callback
- `POST /api/auth/refresh` - Refresh access token

#### Players
- `GET /api/players` - Get all players
- `GET /api/players/:id` - Get player by ID
- `POST /api/players` - Create player (staff only)

#### Teams
- `GET /api/teams` - Get all teams
- `GET /api/teams/:id` - Get team with squad

#### Leagues
- `GET /api/leagues` - Get all leagues
- `GET /api/leagues/:id` - Get league by ID

### 🔄 Development Phases

**Phase 1** ✅ Foundation
- Database schema
- Backend API
- Discord OAuth2
- User authentication

**Phase 2** 📋 Core Football Data
- Players, Teams, Leagues
- Matches, Statistics

**Phase 3** 🏆 Hero System
- Hero Cards, Rating engine
- Market value system

**Phase 4** 📦 Transfers
- Contracts, Offers
- Transfer management

**Phase 5** ⚽ Match System
- Live match tracking
- Predictions

**Phase 6** 📰 Media
- News system
- Social media integration

**Phase 7** 🤖 Discord Bot
- Bot commands
- Notifications

**Phase 8** 👥 Staff Management
- Admin dashboard
- Permissions

**Phase 9** 📊 Advanced Features
- Records, Hall of Fame
- Analytics, Comparisons

### 🔒 Security

- Environment variables for secrets
- JWT token-based authentication
- Role-based access control
- Audit logging for all admin actions
- Rate limiting on API
- SQL injection prevention via parameterized queries
- CORS protection
- Helmet.js security headers

### 📄 License

MIT

### 👥 Contributors

- @yojustkamil-ui

---

**Built for the IFC — International Futbol Confederation**
