# MCP Configuration

## Available Servers

### Supabase MCP
- **Command**: `npx -y @supabase/mcp-server-supabase@latest --project-ref vljbyrayyiwpymbuzedb`
- **Purpose**: Direct database access — run SQL, apply migrations, list tables, generate types, check advisors
- **Config**: `.mcp.json` in project root

## Key Tools & Usage

| Tool | When to use |
|------|-------------|
| `mcp__supabase__apply_migration` | DDL changes (ALTER TABLE, CREATE INDEX, etc.) |
| `mcp__supabase__execute_sql` | Ad-hoc queries, data inspection |
| `mcp__supabase__list_tables` | Check current schema |
| `mcp__supabase__list_migrations` | See applied migrations |
| `mcp__supabase__get_logs` | Debug production issues (auth, postgres, edge-function logs) |
| `mcp__supabase__get_advisors` | Check security/performance after DDL changes |
| `mcp__supabase__generate_typescript_types` | Regenerate types after schema changes |

## Configuration Notes
- Project ref: `vljbyrayyiwpymbuzedb`
- Always run `get_advisors` (security) after DDL changes to catch missing RLS policies
- Realtime must be enabled per-table after creating new tables
