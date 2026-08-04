# mcp-usgs-water

USGS Water Services (NWIS) MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Usgs Water data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
