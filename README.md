# mcp-usgs-water

USGS Water Services (NWIS) MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1476+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `current_conditions` | Latest instantaneous (real-time) readings for one or more USGS gauge sites. Returns the most recent value per site × parameter — e.g. current streamflow and gage height for a river. Common parameter codes: 00060 = discharge/streamflow (ft³/s), 00065 = gage height (ft), 00010 = water temperature (°C), 00045 = precipitation (in), 00095 = specific conductance, 00300 = dissolved oxygen, 63680 = turbidity. Keyless. |
| `daily_values` | Daily-values time series for a single USGS site + parameter over a date range. Returns one statistic per day (default mean). Useful for trends, hydrographs, and historical comparison. Common statCd: 00003 = mean, 00001 = max, 00002 = min. Common parameter codes: 00060 = discharge (ft³/s), 00065 = gage height (ft), 00010 = water temperature (°C). Keyless. |
| `find_sites` | Discover active USGS gauge sites in a US state that are currently reporting a given parameter (real-time). Returns sites with their latest reading; useful for finding which gauges are live in a region. Can match many sites, so results are capped. Keyless. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "usgs-water": {
      "url": "https://gateway.pipeworx.io/usgs-water/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/usgs-water/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1476+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Usgs Water data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
