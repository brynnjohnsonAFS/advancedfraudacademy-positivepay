/* Advanced Fraud Academy — geo-tagger.js
   Tags fraud news stories with US geographic information.

   Strategy (highest signal first):
     1. Federal jurisdiction phrase ("Eastern District of Michigan") — high
     2. "City, ST" pattern (e.g., "Detroit, MI") — high
     3. Unambiguous state name OR unambiguous major city — medium/high
     4. Ambiguous city, resolved by co-mention of state — medium
     5. Ambiguous city alone — low
     6. No US signal → state: 'Multi-state / Unknown', confidence: 'none'

   Output: { state, stateCode, cities, region, confidence, signals }
*/

'use strict';

// ── State data ───────────────────────────────────────────────────────────────
// Each state: code, full name, region. DC included so federal-district stories
// resolve cleanly.

var STATES = [
  { code: 'AL', name: 'Alabama',        region: 'South' },
  { code: 'AK', name: 'Alaska',         region: 'West' },
  { code: 'AZ', name: 'Arizona',        region: 'West' },
  { code: 'AR', name: 'Arkansas',       region: 'South' },
  { code: 'CA', name: 'California',     region: 'West' },
  { code: 'CO', name: 'Colorado',       region: 'West' },
  { code: 'CT', name: 'Connecticut',    region: 'Northeast' },
  { code: 'DE', name: 'Delaware',       region: 'South' },
  { code: 'DC', name: 'District of Columbia', region: 'South' },
  { code: 'FL', name: 'Florida',        region: 'South' },
  { code: 'GA', name: 'Georgia',        region: 'South' },
  { code: 'HI', name: 'Hawaii',         region: 'West' },
  { code: 'ID', name: 'Idaho',          region: 'West' },
  { code: 'IL', name: 'Illinois',       region: 'Midwest' },
  { code: 'IN', name: 'Indiana',        region: 'Midwest' },
  { code: 'IA', name: 'Iowa',           region: 'Midwest' },
  { code: 'KS', name: 'Kansas',         region: 'Midwest' },
  { code: 'KY', name: 'Kentucky',       region: 'South' },
  { code: 'LA', name: 'Louisiana',      region: 'South' },
  { code: 'ME', name: 'Maine',          region: 'Northeast' },
  { code: 'MD', name: 'Maryland',       region: 'South' },
  { code: 'MA', name: 'Massachusetts',  region: 'Northeast' },
  { code: 'MI', name: 'Michigan',       region: 'Midwest' },
  { code: 'MN', name: 'Minnesota',      region: 'Midwest' },
  { code: 'MS', name: 'Mississippi',    region: 'South' },
  { code: 'MO', name: 'Missouri',       region: 'Midwest' },
  { code: 'MT', name: 'Montana',        region: 'West' },
  { code: 'NE', name: 'Nebraska',       region: 'Midwest' },
  { code: 'NV', name: 'Nevada',         region: 'West' },
  { code: 'NH', name: 'New Hampshire',  region: 'Northeast' },
  { code: 'NJ', name: 'New Jersey',     region: 'Northeast' },
  { code: 'NM', name: 'New Mexico',     region: 'West' },
  { code: 'NY', name: 'New York',       region: 'Northeast' },
  { code: 'NC', name: 'North Carolina', region: 'South' },
  { code: 'ND', name: 'North Dakota',   region: 'Midwest' },
  { code: 'OH', name: 'Ohio',           region: 'Midwest' },
  { code: 'OK', name: 'Oklahoma',       region: 'South' },
  { code: 'OR', name: 'Oregon',         region: 'West' },
  { code: 'PA', name: 'Pennsylvania',   region: 'Northeast' },
  { code: 'RI', name: 'Rhode Island',   region: 'Northeast' },
  { code: 'SC', name: 'South Carolina', region: 'South' },
  { code: 'SD', name: 'South Dakota',   region: 'Midwest' },
  { code: 'TN', name: 'Tennessee',      region: 'South' },
  { code: 'TX', name: 'Texas',          region: 'South' },
  { code: 'UT', name: 'Utah',           region: 'West' },
  { code: 'VT', name: 'Vermont',        region: 'Northeast' },
  { code: 'VA', name: 'Virginia',       region: 'South' },
  { code: 'WA', name: 'Washington',     region: 'West' },
  { code: 'WV', name: 'West Virginia',  region: 'South' },
  { code: 'WI', name: 'Wisconsin',      region: 'Midwest' },
  { code: 'WY', name: 'Wyoming',        region: 'West' }
];

var STATE_BY_CODE = {};
var STATE_BY_NAME = {};
STATES.forEach(function (s) {
  STATE_BY_CODE[s.code] = s;
  STATE_BY_NAME[s.name.toLowerCase()] = s;
});

// ── Unambiguous cities → single state ───────────────────────────────────────
// Curated for fraud-news context: large metros + cities that are reliably
// associated with one state. Ambiguous ones live in CITIES_AMBIGUOUS below.

var CITIES_UNIQUE = {
  // AL
  'Birmingham': 'AL', 'Montgomery': 'AL', 'Tuscaloosa': 'AL', 'Huntsville': 'AL', 'Mobile': 'AL',
  // AK
  'Anchorage': 'AK', 'Juneau': 'AK', 'Fairbanks': 'AK',
  // AZ
  'Phoenix': 'AZ', 'Tucson': 'AZ', 'Mesa': 'AZ', 'Scottsdale': 'AZ', 'Tempe': 'AZ', 'Chandler': 'AZ',
  // AR
  'Little Rock': 'AR', 'Fayetteville': 'AR', 'Fort Smith': 'AR',
  // CA
  'Los Angeles': 'CA', 'San Francisco': 'CA', 'San Diego': 'CA', 'San Jose': 'CA',
  'Sacramento': 'CA', 'Oakland': 'CA', 'Long Beach': 'CA', 'Anaheim': 'CA',
  'Santa Ana': 'CA', 'Fresno': 'CA', 'Bakersfield': 'CA', 'Stockton': 'CA',
  'Irvine': 'CA', 'Berkeley': 'CA', 'Palo Alto': 'CA', 'Beverly Hills': 'CA',
  'Santa Monica': 'CA', 'San Bernardino': 'CA', 'Modesto': 'CA',
  // CO
  'Denver': 'CO', 'Colorado Springs': 'CO', 'Boulder': 'CO', 'Fort Collins': 'CO', 'Pueblo': 'CO',
  // CT
  'Hartford': 'CT', 'New Haven': 'CT', 'Bridgeport': 'CT', 'Stamford': 'CT', 'Waterbury': 'CT',
  // DE
  'Wilmington': 'DE',
  // DC
  'Washington DC': 'DC', 'Washington, D.C.': 'DC', 'Washington, DC': 'DC',
  // FL
  'Miami': 'FL', 'Orlando': 'FL', 'Tampa': 'FL', 'Jacksonville': 'FL',
  'Fort Lauderdale': 'FL', 'Tallahassee': 'FL', 'St. Petersburg': 'FL',
  'Hialeah': 'FL', 'Boca Raton': 'FL', 'Naples': 'FL', 'Sarasota': 'FL',
  'West Palm Beach': 'FL', 'Coral Springs': 'FL', 'Pompano Beach': 'FL',
  // GA
  'Atlanta': 'GA', 'Savannah': 'GA', 'Macon': 'GA', 'Sandy Springs': 'GA',
  // HI
  'Honolulu': 'HI', 'Pearl Harbor': 'HI',
  // ID
  'Boise': 'ID', 'Idaho Falls': 'ID', 'Pocatello': 'ID',
  // IL
  'Chicago': 'IL', 'Rockford': 'IL', 'Naperville': 'IL', 'Peoria': 'IL', 'Evanston': 'IL',
  // IN
  'Indianapolis': 'IN', 'Fort Wayne': 'IN', 'Evansville': 'IN', 'South Bend': 'IN', 'Gary': 'IN',
  // IA
  'Des Moines': 'IA', 'Cedar Rapids': 'IA', 'Davenport': 'IA', 'Iowa City': 'IA',
  // KS
  'Wichita': 'KS', 'Topeka': 'KS', 'Overland Park': 'KS',
  // KY
  'Louisville': 'KY', 'Frankfort': 'KY', 'Bowling Green': 'KY',
  // LA
  'New Orleans': 'LA', 'Baton Rouge': 'LA', 'Shreveport': 'LA', 'Metairie': 'LA',
  // ME
  'Bangor': 'ME', 'Lewiston': 'ME',
  // MD
  'Baltimore': 'MD', 'Annapolis': 'MD', 'Bethesda': 'MD', 'Silver Spring': 'MD',
  // MA
  'Boston': 'MA', 'Worcester': 'MA', 'Lowell': 'MA', 'Quincy': 'MA', 'Brookline': 'MA',
  // MI
  'Detroit': 'MI', 'Grand Rapids': 'MI', 'Ann Arbor': 'MI', 'Lansing': 'MI',
  'Flint': 'MI', 'Dearborn': 'MI', 'Kalamazoo': 'MI', 'Sterling Heights': 'MI', 'Warren': 'MI',
  // MN
  'Minneapolis': 'MN', 'Saint Paul': 'MN', 'St. Paul': 'MN', 'Bloomington': 'MN', 'Duluth': 'MN',
  // MS
  'Biloxi': 'MS', 'Gulfport': 'MS', 'Hattiesburg': 'MS',
  // MO
  'St. Louis': 'MO', 'Saint Louis': 'MO', 'Independence': 'MO',
  // MT
  'Billings': 'MT', 'Missoula': 'MT', 'Bozeman': 'MT',
  // NE
  'Omaha': 'NE',
  // NV
  'Las Vegas': 'NV', 'Reno': 'NV', 'Carson City': 'NV',
  // NH
  'Nashua': 'NH', 'Portsmouth': 'NH',
  // NJ
  'Jersey City': 'NJ', 'Trenton': 'NJ', 'Paterson': 'NJ', 'Princeton': 'NJ', 'Edison': 'NJ',
  // NM
  'Albuquerque': 'NM', 'Santa Fe': 'NM', 'Las Cruces': 'NM',
  // NY
  'New York City': 'NY', 'NYC': 'NY', 'Manhattan': 'NY', 'Brooklyn': 'NY',
  'Queens': 'NY', 'Bronx': 'NY', 'Staten Island': 'NY', 'Buffalo': 'NY',
  'Syracuse': 'NY', 'Yonkers': 'NY', 'Long Island': 'NY',
  // NC
  'Raleigh': 'NC', 'Greensboro': 'NC', 'Winston-Salem': 'NC', 'Asheville': 'NC', 'Fayetteville NC': 'NC',
  // ND
  'Fargo': 'ND', 'Bismarck': 'ND',
  // OH
  'Cleveland': 'OH', 'Cincinnati': 'OH', 'Akron': 'OH', 'Youngstown': 'OH', 'Toledo': 'OH',
  // OK
  'Oklahoma City': 'OK', 'Tulsa': 'OK', 'OKC': 'OK', 'Norman': 'OK',
  // OR
  'Eugene': 'OR', 'Beaverton': 'OR', 'Hillsboro': 'OR',
  // PA
  'Philadelphia': 'PA', 'Pittsburgh': 'PA', 'Allentown': 'PA', 'Erie': 'PA',
  'Harrisburg': 'PA', 'Scranton': 'PA', 'Bethlehem': 'PA',
  // RI
  'Providence': 'RI', 'Pawtucket': 'RI', 'Cranston': 'RI',
  // SC
  'Myrtle Beach': 'SC',
  // SD
  'Sioux Falls': 'SD', 'Rapid City': 'SD',
  // TN
  'Nashville': 'TN', 'Memphis': 'TN', 'Knoxville': 'TN', 'Chattanooga': 'TN',
  // TX
  'Houston': 'TX', 'Dallas': 'TX', 'San Antonio': 'TX', 'Fort Worth': 'TX',
  'El Paso': 'TX', 'Corpus Christi': 'TX', 'Plano': 'TX', 'Lubbock': 'TX',
  'Laredo': 'TX', 'McAllen': 'TX', 'Garland': 'TX', 'Frisco': 'TX',
  'Irving': 'TX', 'Waco': 'TX', 'Amarillo': 'TX', 'Brownsville': 'TX', 'Galveston': 'TX',
  // UT
  'Salt Lake City': 'UT', 'Provo': 'UT', 'Ogden': 'UT', 'West Jordan': 'UT',
  // VT
  'Montpelier': 'VT',
  // VA
  'Virginia Beach': 'VA', 'Chesapeake': 'VA', 'Fairfax': 'VA', 'Roanoke': 'VA',
  // WA
  'Seattle': 'WA', 'Spokane': 'WA', 'Tacoma': 'WA', 'Olympia': 'WA',
  // WV
  'Morgantown': 'WV',
  // WI
  'Milwaukee': 'WI', 'Green Bay': 'WI', 'Kenosha': 'WI',
  // WY
  'Cheyenne': 'WY', 'Casper': 'WY', 'Jackson Hole': 'WY', 'Laramie': 'WY'
};

// ── Ambiguous cities → possible states ──────────────────────────────────────
// Needs a co-mention of the state to resolve. If no state co-mention, we
// flag as low-confidence and report the city without state.

var CITIES_AMBIGUOUS = {
  'Springfield':  ['MA', 'IL', 'MO'],
  'Portland':     ['OR', 'ME'],
  'Columbus':     ['OH', 'GA'],
  'Aurora':       ['CO', 'IL'],
  'Manchester':   ['NH', 'CT'],
  'Concord':      ['NH', 'CA', 'NC'],
  'Albany':       ['NY', 'GA'],
  'Salem':        ['OR', 'MA'],
  'Rochester':    ['NY', 'MN'],
  'Charleston':   ['SC', 'WV'],
  'Lexington':    ['KY', 'MA'],
  'Lafayette':    ['LA', 'IN'],
  'Augusta':      ['GA', 'ME'],
  'Kansas City':  ['MO', 'KS'],
  'Charlotte':    ['NC'],         // dominant, treat as unique-ish (only one major)
  'Durham':       ['NC'],         // dominant
  'Richmond':     ['VA', 'CA'],
  'Norfolk':      ['VA'],         // dominant
  'Alexandria':   ['VA', 'LA'],
  'Arlington':    ['VA', 'TX'],
  'Newark':       ['NJ', 'OH'],
  'Camden':       ['NJ'],         // dominant
  'Newport':      ['RI', 'KY'],
  'Madison':      ['WI'],         // dominant
  'Pasadena':     ['CA', 'TX'],
  'Hollywood':    ['CA', 'FL'],
  'Burlington':   ['VT', 'NC', 'IA'],
  'Vancouver':    ['WA'],         // US-only; the BC one is foreign
  'Greenville':   ['SC', 'NC'],
  'Henderson':    ['NV', 'KY'],
  'Dayton':       ['OH'],         // dominant
  'Lancaster':    ['PA', 'CA'],
  'Bloomington':  ['IL', 'IN', 'MN'],
  'Glendale':     ['CA', 'AZ'],
  'St. George':   ['UT'],
  'Athens':       ['GA', 'OH'],
  'Huntington':   ['WV', 'NY'],
  'Franklin':     ['TN', 'KY'],
  'Bend':         ['OR'],
  'Reading':      ['PA'],
  'Jackson':      ['MS', 'TN', 'MI']
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Full state names: word-boundary match, case-insensitive.
// "District of Columbia" is matched by the federal-district regex too, but
// it's harmless to find it here as well.
var STATE_NAME_REGEXES = STATES.map(function (s) {
  return { code: s.code, re: new RegExp('\\b' + escapeRegex(s.name) + '\\b', 'i') };
});

// State postal code in "City, ST" form — most reliable abbreviation signal.
// Looks for ", AL" through ", WY" preceded by a word char (the city/area).
var CITY_STATECODE_RE = (function () {
  var codes = STATES.map(function (s) { return s.code; }).join('|');
  return new RegExp('\\b([A-Z][A-Za-z.\\-\']+(?:\\s+[A-Z][A-Za-z.\\-\']+){0,2}),\\s+(' + codes + ')\\b', 'g');
})();

// Federal-district patterns ("Eastern District of Michigan", "District of Massachusetts").
// Strong signal — federal cases are filed by office and the office name encodes the state.
var FEDERAL_DISTRICT_RE = (function () {
  var names = STATES.map(function (s) { return escapeRegex(s.name); }).join('|');
  return new RegExp(
    '(?:(?:Eastern|Western|Northern|Southern|Middle|Central)\\s+)?District\\s+of\\s+(' + names + ')',
    'gi'
  );
})();

// US Attorney's Office naming: "U.S. Attorney for the [...] District of [State]".
// Captured by FEDERAL_DISTRICT_RE above, but we keep this for confidence boost.
var US_ATTORNEY_RE = /U\.?S\.?\s+Attorney(?:'s)?\s+(?:Office\s+)?(?:for\s+the\s+)?/i;

// Unique-city regex (case-sensitive on first letter to reduce false hits on
// common words like "Mobile" / "Reading"). Built once.
var UNIQUE_CITY_RES = Object.keys(CITIES_UNIQUE).map(function (city) {
  return {
    city: city,
    code: CITIES_UNIQUE[city],
    re: new RegExp('\\b' + escapeRegex(city) + '\\b')
  };
});

var AMBIGUOUS_CITY_RES = Object.keys(CITIES_AMBIGUOUS).map(function (city) {
  return {
    city: city,
    candidates: CITIES_AMBIGUOUS[city],
    re: new RegExp('\\b' + escapeRegex(city) + '\\b')
  };
});

// ── Main tagger ──────────────────────────────────────────────────────────────

function tagGeo(item) {
  var hay = ((item.title || '') + ' ' + (item.summary || '')).trim();
  if (!hay) {
    return { state: null, stateCode: null, cities: [], region: null,
             confidence: 'none', signals: [] };
  }

  var hits = {};   // stateCode → { score, cities: Set, signals: [] }
  function addHit(code, weight, city, signal) {
    if (!STATE_BY_CODE[code]) return;
    if (!hits[code]) hits[code] = { score: 0, cities: {}, signals: [] };
    hits[code].score += weight;
    if (city) hits[code].cities[city] = true;
    if (signal && hits[code].signals.indexOf(signal) === -1) hits[code].signals.push(signal);
  }

  // 1. Federal jurisdiction phrase — highest signal
  var m;
  FEDERAL_DISTRICT_RE.lastIndex = 0;
  while ((m = FEDERAL_DISTRICT_RE.exec(hay)) !== null) {
    var stateName = m[1];
    var state = STATE_BY_NAME[stateName.toLowerCase()];
    if (state) {
      var sig = 'federal_district';
      // Boost if "U.S. Attorney" appears in the same string
      if (US_ATTORNEY_RE.test(hay)) sig = 'us_attorney_district';
      addHit(state.code, 10, null, sig);
    }
  }

  // 2. "City, ST" pattern — strong signal
  CITY_STATECODE_RE.lastIndex = 0;
  while ((m = CITY_STATECODE_RE.exec(hay)) !== null) {
    var cityCandidate = m[1];
    var code = m[2];
    addHit(code, 8, cityCandidate, 'city_statecode');
  }

  // 3. Full state name (excluding ones already counted via federal district —
  //    but it's fine to double-count for scoring; the signal label tells story)
  STATE_NAME_REGEXES.forEach(function (sr) {
    if (sr.re.test(hay)) {
      addHit(sr.code, 4, null, 'state_name');
    }
  });

  // 4. Unique cities
  UNIQUE_CITY_RES.forEach(function (cr) {
    if (cr.re.test(hay)) {
      addHit(cr.code, 5, cr.city, 'unique_city');
    }
  });

  // 5. Ambiguous cities — only credit if at least one candidate state was
  //    already mentioned. Otherwise log as a city-only low-confidence hit.
  var unresolvedAmbiguousCities = [];
  AMBIGUOUS_CITY_RES.forEach(function (cr) {
    if (!cr.re.test(hay)) return;
    var resolved = false;
    for (var i = 0; i < cr.candidates.length; i++) {
      if (hits[cr.candidates[i]]) {
        addHit(cr.candidates[i], 3, cr.city, 'ambiguous_city_resolved');
        resolved = true;
      }
    }
    if (!resolved) unresolvedAmbiguousCities.push(cr.city);
  });

  // ── Resolution ───────────────────────────────────────────────────────────
  var codes = Object.keys(hits);
  if (codes.length === 0) {
    if (unresolvedAmbiguousCities.length) {
      return {
        state: 'Multi-state / Unknown',
        stateCode: null,
        cities: unresolvedAmbiguousCities,
        region: null,
        confidence: 'low',
        signals: ['ambiguous_city_only']
      };
    }
    return {
      state: 'Multi-state / Unknown',
      stateCode: null,
      cities: [],
      region: null,
      confidence: 'none',
      signals: []
    };
  }

  // Pick the top-scoring state
  codes.sort(function (a, b) { return hits[b].score - hits[a].score; });
  var top = codes[0];
  var topHit = hits[top];
  var topScore = topHit.score;

  // Multi-state detection: if 2+ states are within 30% of top score and top is
  // not from a federal district hit, flag as multi-state.
  var competitors = codes.filter(function (c) {
    return c !== top && hits[c].score >= topScore * 0.7;
  });
  var hasFederalSignal = topHit.signals.some(function (s) {
    return s === 'federal_district' || s === 'us_attorney_district';
  });

  if (competitors.length >= 1 && !hasFederalSignal && topScore < 8) {
    var allCities = [];
    codes.forEach(function (c) { allCities = allCities.concat(Object.keys(hits[c].cities)); });
    return {
      state: 'Multi-state / Unknown',
      stateCode: null,
      cities: dedupeArray(allCities),
      region: null,
      confidence: 'low',
      signals: ['multi_state']
    };
  }

  // Confidence calculation
  var confidence;
  if (hasFederalSignal || (topHit.signals.indexOf('city_statecode') !== -1)) {
    confidence = 'high';
  } else if (topScore >= 7 || topHit.signals.indexOf('unique_city') !== -1) {
    confidence = 'high';
  } else if (topScore >= 4) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  var stateRecord = STATE_BY_CODE[top];
  return {
    state: stateRecord.name,
    stateCode: stateRecord.code,
    cities: dedupeArray(Object.keys(topHit.cities)),
    region: stateRecord.region,
    confidence: confidence,
    signals: topHit.signals
  };
}

function dedupeArray(arr) {
  var seen = {};
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var k = arr[i];
    if (!seen[k]) { seen[k] = true; out.push(k); }
  }
  return out;
}

module.exports = {
  STATES: STATES,
  CITIES_UNIQUE: CITIES_UNIQUE,
  CITIES_AMBIGUOUS: CITIES_AMBIGUOUS,
  tagGeo: tagGeo
};
