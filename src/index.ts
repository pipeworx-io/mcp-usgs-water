interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * USGS Water Services (NWIS) MCP.
 *
 * Keyless US streamflow / river-gauge / water-quality data from the USGS
 * National Water Information System. Real-time and historical readings for
 * tens of thousands of monitoring sites: discharge, gage height, water
 * temperature, precipitation, dissolved oxygen, and more. Keyless.
 *
 * Common USGS parameter codes:
 *   00060 = discharge / streamflow (ft³/s)
 *   00065 = gage height (ft)
 *   00010 = water temperature (°C)
 *   00045 = precipitation (in)
 *   00095 = specific conductance
 *   00300 = dissolved oxygen
 *   63680 = turbidity
 * Common statCd (daily values): 00003 = mean, 00001 = max, 00002 = min.
 */


const BASE = 'https://waterservices.usgs.gov/nwis';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

interface ValuePoint {
  value?: string;
  dateTime?: string;
  qualifiers?: string[];
}

interface TimeSeries {
  sourceInfo?: {
    siteName?: string;
    siteCode?: Array<{ value?: string }>;
    geoLocation?: { geogLocation?: { latitude?: number; longitude?: number } };
  };
  variable?: {
    variableCode?: Array<{ value?: string }>;
    variableName?: string;
    variableDescription?: string;
    unit?: { unitCode?: string };
  };
  values?: Array<{ value?: ValuePoint[] }>;
}

interface WaterMlJson {
  value?: { timeSeries?: TimeSeries[] };
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** The most-recent reading in a timeSeries (last entry of values[0].value). */
function lastValue(ts: TimeSeries): ValuePoint | undefined {
  const arr = ts.values?.[0]?.value;
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  return arr[arr.length - 1];
}

/** Extract site identity + latest reading from a timeSeries. */
function mapTimeSeries(ts: TimeSeries) {
  const si = ts.sourceInfo ?? {};
  const geo = si.geoLocation?.geogLocation ?? {};
  const v = ts.variable ?? {};
  const last = lastValue(ts);
  return {
    site_number: si.siteCode?.[0]?.value ?? null,
    site_name: si.siteName ?? null,
    latitude: toNum(geo.latitude),
    longitude: toNum(geo.longitude),
    parameter: v.variableName ?? null,
    parameter_code: v.variableCode?.[0]?.value ?? null,
    unit: v.unit?.unitCode ?? null,
    latest_value: toNum(last?.value),
    datetime: last?.dateTime ?? null,
  };
}

const tools: McpToolExport['tools'] = [
  {
    name: 'current_conditions',
    description:
      "Latest instantaneous (real-time) readings for one or more USGS gauge sites. Returns the most recent value per site × parameter — e.g. current streamflow and gage height for a river. " +
      'Common parameter codes: 00060 = discharge/streamflow (ft³/s), 00065 = gage height (ft), 00010 = water temperature (°C), 00045 = precipitation (in), 00095 = specific conductance, 00300 = dissolved oxygen, 63680 = turbidity. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        sites: {
          type: 'string',
          description:
            'Comma-separated USGS site numbers, e.g. "01646500" (Potomac at Washington DC) or "01646500,01647000".',
        },
        parameter_codes: {
          type: 'string',
          description:
            'Comma-separated USGS parameter codes (default "00060,00065" = streamflow + gage height).',
        },
      },
      required: ['sites'],
    },
  },
  {
    name: 'daily_values',
    description:
      'Daily-values time series for a single USGS site + parameter over a date range. Returns one statistic per day (default mean). Useful for trends, hydrographs, and historical comparison. ' +
      'Common statCd: 00003 = mean, 00001 = max, 00002 = min. Common parameter codes: 00060 = discharge (ft³/s), 00065 = gage height (ft), 00010 = water temperature (°C). Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        site: { type: 'string', description: 'A single USGS site number, e.g. "01646500".' },
        parameter_code: {
          type: 'string',
          description: 'USGS parameter code (default "00060" = discharge/streamflow).',
        },
        stat_code: {
          type: 'string',
          description: 'Daily statistic code (default "00003" = mean; 00001 = max, 00002 = min).',
        },
        start_date: { type: 'string', description: 'Start date, YYYY-MM-DD.' },
        end_date: { type: 'string', description: 'End date, YYYY-MM-DD.' },
      },
      required: ['site', 'start_date', 'end_date'],
    },
  },
  {
    name: 'find_sites',
    description:
      'Discover active USGS gauge sites in a US state that are currently reporting a given parameter (real-time). Returns sites with their latest reading; useful for finding which gauges are live in a region. Can match many sites, so results are capped. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: '2-letter US state code, e.g. "co", "ca", "tx".' },
        parameter_code: {
          type: 'string',
          description: 'USGS parameter code (default "00060" = discharge/streamflow).',
        },
        limit: { type: 'number', description: 'Max sites to return (default 30, max 60).' },
      },
      required: ['state'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'current_conditions':
        return currentConditions(args);
      case 'daily_values':
        return dailyValues(args);
      case 'find_sites':
        return findSites(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function fetchWaterMl(path: string): Promise<WaterMlJson | { error: string }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) return { error: `USGS NWIS: ${res.status} ${(await res.text()).slice(0, 200)}` };
  return (await res.json()) as WaterMlJson;
}

async function currentConditions(args: Record<string, unknown>): Promise<unknown> {
  const sites = typeof args.sites === 'string' ? args.sites.trim() : '';
  if (!sites) return { error: 'provide one or more comma-separated site numbers in "sites"' };
  const codes = (typeof args.parameter_codes === 'string' && args.parameter_codes.trim()) || '00060,00065';

  const data = await fetchWaterMl(
    `/iv/?format=json&sites=${encodeURIComponent(sites)}&parameterCd=${encodeURIComponent(codes)}&siteStatus=active`,
  );
  if ('error' in data) return data;

  const series = data.value?.timeSeries ?? [];
  if (!Array.isArray(series) || series.length === 0) {
    return { count: 0, readings: [] };
  }
  const readings = series.map(mapTimeSeries);
  return { count: readings.length, readings };
}

async function dailyValues(args: Record<string, unknown>): Promise<unknown> {
  const site = typeof args.site === 'string' ? args.site.trim() : '';
  if (!site) return { error: 'provide a single site number in "site"' };
  const code = (typeof args.parameter_code === 'string' && args.parameter_code.trim()) || '00060';
  const stat = (typeof args.stat_code === 'string' && args.stat_code.trim()) || '00003';
  const start = typeof args.start_date === 'string' ? args.start_date.trim() : '';
  const end = typeof args.end_date === 'string' ? args.end_date.trim() : '';
  if (!start || !end) return { error: 'provide start_date and end_date (YYYY-MM-DD)' };

  const data = await fetchWaterMl(
    `/dv/?format=json&sites=${encodeURIComponent(site)}&parameterCd=${encodeURIComponent(code)}` +
      `&statCd=${encodeURIComponent(stat)}&startDT=${encodeURIComponent(start)}&endDT=${encodeURIComponent(end)}`,
  );
  if ('error' in data) return data;

  const ts = data.value?.timeSeries?.[0];
  if (!ts) {
    return { site_number: site, count: 0, stat_code: stat, values: [] };
  }
  const si = ts.sourceInfo ?? {};
  const v = ts.variable ?? {};
  const all = ts.values?.[0]?.value ?? [];
  const points = (Array.isArray(all) ? all : []).map((p) => ({
    date: p.dateTime ?? null,
    value: toNum(p.value),
  }));

  const truncated = points.length > 120;
  const values = truncated ? points.slice(points.length - 120) : points;

  return {
    site_number: si.siteCode?.[0]?.value ?? site,
    site_name: si.siteName ?? null,
    parameter: v.variableName ?? null,
    unit: v.unit?.unitCode ?? null,
    stat_code: stat,
    count: values.length,
    ...(truncated ? { values_truncated: true } : {}),
    values,
  };
}

async function findSites(args: Record<string, unknown>): Promise<unknown> {
  const state = typeof args.state === 'string' ? args.state.trim() : '';
  if (!state) return { error: 'provide a 2-letter state code in "state"' };
  const code = (typeof args.parameter_code === 'string' && args.parameter_code.trim()) || '00060';
  let limit = toNum(args.limit) ?? 30;
  if (limit < 1) limit = 30;
  if (limit > 60) limit = 60;

  const data = await fetchWaterMl(
    `/iv/?format=json&stateCd=${encodeURIComponent(state)}&parameterCd=${encodeURIComponent(code)}&siteStatus=active`,
  );
  if ('error' in data) return data;

  const series = data.value?.timeSeries ?? [];
  if (!Array.isArray(series) || series.length === 0) {
    return { state, parameter_code: code, count: 0, sites: [] };
  }
  const sites = series.slice(0, limit).map((ts) => {
    const m = mapTimeSeries(ts);
    return {
      site_number: m.site_number,
      site_name: m.site_name,
      latitude: m.latitude,
      longitude: m.longitude,
      latest_value: m.latest_value,
      unit: m.unit,
      datetime: m.datetime,
    };
  });
  return { state, parameter_code: code, count: sites.length, sites };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
