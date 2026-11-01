// South Devon windsurf & wingfoil spots.
//
// seaward   – compass bearing you face when looking from the launch out over the water.
//             Wind FROM this bearing is onshore, from the opposite is offshore, ±90° is cross-shore.
// goodDirs  – optional explicit list of [from, to] wind-from ranges (degrees, clockwise) that work.
//             Used for estuaries where "onshore/offshore" is less meaningful.
// tide      – { rule: 'none' | 'hw' | 'notLow', hours, ref: [lat, lon], offsetMin }
//             hw     → only good within ±hours of high water
//             notLow → avoid ±hours either side of low water
//             ref    → offshore point used for the tide model; offsetMin shifts times for the spot
// links     – extra forecast / webcam / info links. Webcams are third-party and may go offline.

window.SPOTS = [
  {
    id: 'coombe-cellars',
    name: 'Coombe Cellars',
    area: 'River Teign, nr Shaldon',
    favourite: true,
    lat: 50.5458, lon: -3.5488,
    seaward: 0,
    goodDirs: [[55, 125], [235, 320]],
    dirNote: 'Works in east or west winds blowing up/down the river. W–NW is the classic.',
    tide: { rule: 'hw', hours: 2, ref: [50.535, -3.47], offsetMin: 20 },
    notes: 'Flat-water estuary session beside the pub car park. Only sailable about 2 hrs either side of high water – mud banks dry out fast and shift. Expect gusty, shifty wind over the land.',
    windfinder: 'teignmouth',
    webcams: [
      { label: 'Teignmouth estuary cam (Morgans Quay)', url: 'https://openwebcamdb-vwlaqcar.on-forge.com/webcams/teignmouth-estuary-beachfront' },
      { label: 'Windfinder webcams – Teignmouth', url: 'https://www.windfinder.com/webcams/teignmouth' },
    ],
    links: [
      { label: 'Environment Agency river level (Teign)', url: 'https://check-for-flooding.service.gov.uk/river-and-sea-levels/rloi/3226' },
      { label: 'windsurf.co.uk Teignmouth guide', url: 'https://www.windsurf.co.uk/beach-guide/teignmouth/' },
    ],
  },
  {
    id: 'preston-sands',
    name: 'Preston Sands',
    area: 'Paignton seafront, Torbay',
    favourite: true,
    lat: 50.4482, lon: -3.5548,
    seaward: 95,
    dirNote: 'East-facing. N/NE and S/SE are cross-shore; SW–W is offshore (gusty and dangerous).',
    tide: { rule: 'none', ref: [50.44, -3.53], offsetMin: 0 },
    notes: 'Sailable at all states of tide. Watch the swim zones in summer. Can get choppy in strong E/SE winds.',
    windfinder: 'paignton',
    webcams: [
      { label: 'Windfinder webcams – Paignton', url: 'https://www.windfinder.com/webcams/paignton' },
      { label: 'Surf-Forecast webcams – Paignton', url: 'https://www.surf-forecast.com/breaks/Paignton/webcams/latest' },
    ],
    links: [
      { label: 'Met Office obs – Preston Sands', url: 'https://weather.metoffice.gov.uk/observations/gbvqznfh6' },
      { label: 'windsurf.co.uk Preston Sands guide', url: 'https://www.windsurf.co.uk/beach-guide/preston-sands/' },
    ],
  },
  {
    id: 'broadsands',
    name: 'Broadsands',
    area: 'Torbay, nr Churston',
    lat: 50.4075, lon: -3.5565,
    seaward: 90,
    dirNote: 'East-facing. N and S/SE are cross-shore.',
    tide: { rule: 'none', ref: [50.44, -3.53], offsetMin: 0 },
    notes: 'Shallow sandy bay, sailable at most tides. Quieter alternative to Paignton.',
    windfinder: 'paignton',
    webcams: [{ label: 'Windfinder webcams – Paignton', url: 'https://www.windfinder.com/webcams/paignton' }],
    links: [],
  },
  {
    id: 'torre-abbey',
    name: 'Torre Abbey Sands',
    area: 'Torquay seafront',
    lat: 50.4600, lon: -3.5370,
    seaward: 155,
    dirNote: 'SSE-facing. E/NE and SW/W are cross-shore. N is offshore.',
    tide: { rule: 'notLow', hours: 1.5, ref: [50.44, -3.53], offsetMin: 0 },
    notes: 'Beach almost disappears at high water on springs; low tide leaves a long walk. Mid-tide is easiest.',
    windfinder: 'torquay',
    webcams: [{ label: 'Windfinder webcams – Torquay', url: 'https://www.windfinder.com/webcams/torquay' }],
    links: [],
  },
  {
    id: 'teignmouth',
    name: 'Teignmouth seafront',
    area: 'Teignmouth',
    lat: 50.5440, lon: -3.4930,
    seaward: 125,
    dirNote: 'SE-facing. NE and SW are cross-shore. NW is offshore.',
    tide: { rule: 'none', ref: [50.535, -3.47], offsetMin: 0 },
    notes: 'Keep well clear of the river mouth – very strong tidal flow over the bar. Chop builds quickly in E winds.',
    windfinder: 'teignmouth',
    webcams: [
      { label: 'Teignmouth estuary cam (Morgans Quay)', url: 'https://openwebcamdb-vwlaqcar.on-forge.com/webcams/teignmouth-estuary-beachfront' },
      { label: 'Windfinder webcams – Teignmouth', url: 'https://www.windfinder.com/webcams/teignmouth' },
      { label: 'Windfinder webcams – Holcombe / Teignmouth', url: 'https://www.windfinder.com/webcams/holcombe_teignmouth' },
    ],
    links: [{ label: 'windsurf.co.uk Teignmouth guide', url: 'https://www.windsurf.co.uk/beach-guide/teignmouth/' }],
  },
  {
    id: 'dawlish-warren',
    name: 'Dawlish Warren',
    area: 'Exe estuary mouth',
    lat: 50.5975, lon: -3.4410,
    seaward: 135,
    dirNote: 'SE-facing. NE and SW are cross-shore. NW is offshore.',
    tide: { rule: 'notLow', hours: 1.5, ref: [50.59, -3.42], offsetMin: 0 },
    notes: 'Popular kite/windsurf beach. Strong tidal currents near the Exe mouth at the far end of the spit – stay off the point on a big ebb.',
    windfinder: 'warren',
    webcams: [
      { label: 'Dawlish Warren cam (Coast Cams)', url: 'https://www.visitsouthdevon.co.uk/explore/virtual-south-devon/dawlish-warren-webcam' },
      { label: 'Windfinder webcams – Warren', url: 'https://www.windfinder.com/webcams/warren' },
    ],
    links: [{ label: 'windsurf.co.uk Dawlish Warren guide', url: 'https://www.windsurf.co.uk/beach-guide/dawlish-warren/' }],
  },
  {
    id: 'exmouth-duckpond',
    name: 'Exmouth "Duck Pond"',
    area: 'Exe estuary, Exmouth',
    lat: 50.6230, lon: -3.4230,
    seaward: 270,
    goodDirs: [[150, 300], [20, 100]],
    dirNote: 'Flat-water lagoon inside the Warren. S–W and NE–E are best.',
    tide: { rule: 'hw', hours: 2, ref: [50.59, -3.42], offsetMin: 10 },
    notes: 'Classic flat-water learner spot for kite, wing and windsurf. Shallow sandbanks – only works around high water.',
    windfinder: 'exmouth',
    webcams: [
      { label: 'Windfinder webcams – Exmouth (tide)', url: 'https://www.windfinder.com/webcams/exmouth' },
      { label: 'Windfinder webcams – Exmouth seafront', url: 'https://www.windfinder.com/webcams/seafront-exmouth' },
    ],
    links: [
      { label: 'East Devon kitesurf & foiling rules', url: 'https://eastdevon.gov.uk/beaches-harbours-and-coastal-information/beaches/beach-safety-and-information/kitesurfing-and-foiling/' },
    ],
  },
  {
    id: 'exmouth-seafront',
    name: 'Exmouth seafront',
    area: 'Exmouth',
    lat: 50.6115, lon: -3.3980,
    seaward: 170,
    dirNote: 'South-facing. E and W are cross-shore. N is offshore.',
    tide: { rule: 'none', ref: [50.59, -3.42], offsetMin: 0 },
    notes: 'Long sandy beach. Check East Devon zoning for kites/foils in summer.',
    windfinder: 'seafront-exmouth',
    webcams: [{ label: 'Windfinder webcams – Exmouth seafront', url: 'https://www.windfinder.com/webcams/seafront-exmouth' }],
    links: [
      { label: 'East Devon kitesurf & foiling rules', url: 'https://eastdevon.gov.uk/beaches-harbours-and-coastal-information/beaches/beach-safety-and-information/kitesurfing-and-foiling/' },
    ],
  },
  {
    id: 'torcross',
    name: 'Torcross / Slapton Sands',
    area: 'Start Bay',
    lat: 50.2650, lon: -3.6530,
    seaward: 95,
    dirNote: 'East-facing shingle. N/NE and S are cross-shore. W is offshore.',
    tide: { rule: 'none', ref: [50.27, -3.62], offsetMin: 0 },
    notes: 'Steep shingle beach – awkward launch in any swell or shore break. Best in N–NE or S winds.',
    windfinder: 'slapton-sands',
    webcams: [{ label: 'Windfinder webcams – Slapton Sands', url: 'https://www.windfinder.com/webcams/slapton-sands' }],
    links: [],
  },
  {
    id: 'bigbury',
    name: 'Bigbury-on-Sea',
    area: 'Bigbury Bay, by Burgh Island',
    lat: 50.2830, lon: -3.8925,
    seaward: 210,
    dirNote: 'SW-facing. SE and NW are cross-shore. NE is offshore.',
    tide: { rule: 'notLow', hours: 1.5, ref: [50.27, -3.91], offsetMin: 0 },
    notes: 'Sandbar to Burgh Island covers at high water. Strong currents around the Avon mouth towards Bantham – stay on the Bigbury side. Swell can make it a wave spot in W/SW.',
    windfinder: 'bantham',
    webcams: [
      { label: 'Surf-Forecast webcams – Bigbury Bay', url: 'https://www.surf-forecast.com/breaks/Bigbury-Bay/webcams/latest' },
      { label: 'Windfinder webcams – Bantham / Avon', url: 'https://www.windfinder.com/webcams/bantham' },
    ],
    links: [],
  },
  {
    id: 'bantham',
    name: 'Bantham',
    area: 'Avon estuary mouth',
    lat: 50.2790, lon: -3.8800,
    seaward: 240,
    dirNote: 'WSW-facing. NW and SE/S are cross-shore. E/NE is offshore.',
    tide: { rule: 'notLow', hours: 1.5, ref: [50.27, -3.91], offsetMin: 0 },
    notes: 'Primarily a surf spot – good for wave sailing in NW. Lethal rip out of the Avon on the ebb; lifeguarded in summer.',
    windfinder: 'bantham',
    webcams: [
      { label: 'Windfinder webcams – Bantham', url: 'https://www.windfinder.com/webcams/bantham' },
      { label: 'Surf-Forecast webcams – Bantham', url: 'https://www.surf-forecast.com/breaks/Bantham/webcams/latest' },
    ],
    links: [],
  },
  {
    id: 'mount-batten',
    name: 'Mount Batten',
    area: 'Plymouth Sound',
    lat: 50.3585, lon: -4.1290,
    seaward: 270,
    dirNote: 'Faces W across the Sound. N and S/SW are cross-shore. E is offshore.',
    tide: { rule: 'none', ref: [50.34, -4.15], offsetMin: 0 },
    notes: 'Sheltered water inside the breakwater, good for foiling. Busy shipping and naval traffic – keep clear of the main channels.',
    windfinder: 'plymouth',
    webcams: [{ label: 'Windfinder webcams – Plymouth', url: 'https://www.windfinder.com/webcams/plymouth' }],
    links: [],
  },
];

// Display names for the tide reference points used above (key = "lat,lon").
window.TIDE_AREAS = {
  '50.535,-3.47': 'Teign (Teignmouth)',
  '50.44,-3.53': 'Torbay',
  '50.59,-3.42': 'Exe (Exmouth / Dawlish Warren)',
  '50.27,-3.62': 'Start Bay',
  '50.27,-3.91': 'Bigbury Bay / Avon',
  '50.34,-4.15': 'Plymouth Sound',
};

window.GENERAL_LINKS = [
  { label: 'Visit Devon webcam map', url: 'https://www.visitdevon.co.uk/explore/webcams-in-devon/' },
  { label: 'Coastal Monitoring real-time wave & met data', url: 'https://coastalmonitoring.org/realtimedata/' },
  { label: 'Windguru', url: 'https://www.windguru.cz/' },
  { label: 'XCWeather (UK obs map)', url: 'https://www.xcweather.co.uk/' },
];
