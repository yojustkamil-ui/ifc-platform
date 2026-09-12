# PHASE 4: TRANSFERS & CONTRACTS ✅

## What's Included

### 📋 Contracts System
- **GET /api/contracts** - Get all contracts with filters
- **GET /api/contracts/:id** - Get contract details
- **POST /api/contracts** - Create new contract (staff)
- **PATCH /api/contracts/:id** - Update contract terms (staff)
- **GET /api/contracts/alerts/expiring** - Get contracts expiring soon

Contract Features:
- Start and end dates
- Salary tracking
- Release clause management
- Status: active, suspended, terminated
- Automatic expiration alerts (default 30 days)
- Days until expiration calculation

### 🆓 Free Agents System
- **GET /api/free-agents** - Browse all free agents
- **GET /api/free-agents/:id** - Get free agent profile

Filters:
- By league
- By position
- By rating range
- Previous clubs tracking
- Pagination support

### 🔄 Transfers System
- **GET /api/transfers** - Get all transfers
- **GET /api/transfers/:id** - Get transfer details
- **POST /api/transfers** - Create transfer offer (staff)
- **PATCH /api/transfers/:id** - Accept/reject/counter transfer (staff)
- **GET /api/transfers/stats/summary** - Transfer statistics

Transfer Features:
- Permanent and loan transfers
- Status tracking: pending, accepted, rejected, cancelled, completed
- Transfer fee management
- Automatic player team update on completion
- Most expensive transfers tracking
- Transfer activity summary

### 🏅 Loans System
- **GET /api/loans** - Get all active loans
- **POST /api/loans** - Create loan agreement (staff)
- **PATCH /api/loans/:id/end** - End/recall/complete loan (staff)

Loan Features:
- Parent team and loan team tracking
- Loan start and end dates
- Loan fee
- Buy option/purchase clause
- Status: active, returned, bought
- Automatic player team switching
- Loan to permanent transfer conversion

### 🔐 Discord Role Verification (INTEGRATED)

**New Authentication Flow:**
- User logs in with Discord OAuth2
- System checks if user has "Website Organizer" role in Discord server
- Role ID stored in database: `discord_roles` (array)
- Flag stored: `is_website_organizer` (boolean)
- User role automatically upgraded to 'staff' if organizer
- All subsequent API calls verify Discord role status

**Environment Variables Required:**
```env
DISCORD_GUILD_ID=your_guild_id
DISCORD_WEBSITE_ORGANIZER_ROLE_ID=your_role_id
```

**Response includes:**
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "isWebsiteOrganizer": true,
  "role": "staff"
}
```

### 📊 Transfer Statistics
- Most expensive transfers
- Transfer completion rates
- Pending vs completed
- Total transfer fees
- By league filtering

## Database Enhancements

**New Tables:**
- `loans` - Loan agreements

**Modified Tables:**
- `users` - Added:
  - `discord_roles` (TEXT[])
  - `is_website_organizer` (BOOLEAN)
  - `requires_role_verification` (BOOLEAN)

**New Views:**
- `player_transfer_history` - Complete transfer timeline

## Authorization

- **Staff Permissions Required:**
  - `manage_contracts` - Create/update contracts
  - `manage_transfers` - Create/process transfers and loans

- **Discord Role Required:**
  - "Website Organizer" role in Discord server
  - Automatically grants 'staff' role
  - Verified on every login
  - Stored for audit trail

- **Public Access:**
  - View free agents
  - View transfer history
  - View contract info (where public)

## Key Workflows

### Transfer Process
1. Staff creates transfer offer (pending)
2. System validates permissions and teams
3. Offer can be accepted, rejected, or countered
4. On acceptance/completion, player team is updated
5. Historical record preserved
6. Bot receives notification (when integrated)

### Loan Process
1. Staff creates loan agreement
2. Player temporarily assigned to loan team
3. Loan tracked separately from transfers
4. On loan end: returned to parent team OR
5. Buy option activated: converted to permanent transfer

### Contract Management
1. Contract created with player and team
2. Player automatically assigned to team
3. System monitors expiration
4. Alerts generated 30 days before expiration
5. Can be renewed or terminated

### Discord Role Verification
1. User logs in with Discord
2. System retrieves user's Discord roles
3. Checks for "Website Organizer" role ID
4. Stores roles and organizer status
5. Automatically grants staff permissions
6. Can be used for bot integration later

## Bot Integration Ready

When Discord bot is built (Phase 7), it can:
- Subscribe to transfer events
- Post transfer announcements
- Track loan completions
- Monitor contract expirations
- Access all contract/transfer data via same database
- Use Discord role data for bot commands
- Verify organizer status for admin commands

## API Endpoints Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|----------|
| GET | /api/contracts | Any | List contracts |
| POST | /api/contracts | Staff | Create contract |
| PATCH | /api/contracts/:id | Staff | Update contract |
| GET | /api/contracts/alerts/expiring | Staff | Expiring alerts |
| GET | /api/free-agents | Public | Browse free agents |
| GET | /api/transfers | Public | View transfers |
| POST | /api/transfers | Staff | Create offer |
| PATCH | /api/transfers/:id | Staff | Process transfer |
| GET | /api/transfers/stats/summary | Public | Stats |
| GET | /api/loans | Public | View loans |
| POST | /api/loans | Staff | Create loan |
| PATCH | /api/loans/:id/end | Staff | End loan |

## Next Phase: PHASE 5 → MATCH SYSTEM

- Advanced match tracking
- Live match updates
- Match reporting
- Prediction accuracy tracking
- Head-to-head statistics
