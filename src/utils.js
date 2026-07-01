export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function mapToPlain(val) {
    if (val instanceof Map) {
        const obj = {};
        for (const [k, v] of val.entries()) obj[k] = mapToPlain(v);
        return obj;
    }
    if (Array.isArray(val)) return val.map(mapToPlain);
    return val;
}

export function steamId(ref) {
    if (!ref) return null;
    if (typeof ref === 'string') return ref;
    if (ref.Steam) return ref.Steam;
    if (ref.Epic) return ref.Epic;
    if (ref.PS4) return ref.PS4;
    if (ref.Xbox) return ref.Xbox;
    return null;
}

export function formatTime(seconds) {
    if (seconds == null || isNaN(seconds)) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatPct(value, total) {
    if (!total) return '0%';
    return Math.round((value / total) * 100) + '%';
}

export function formatNum(n, decimals = 0) {
    if (n == null || isNaN(n)) return '—';
    return decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString();
}

export const MAP_NAMES = {
    EuroStadium_P: 'Mannfield',
    EuroStadium_Night_P: 'Mannfield (Night)',
    Park_P: 'Beckwith Park',
    Park_Night_P: 'Beckwith Park (Midnight)',
    TrainStation_P: 'Urban Central',
    TrainStation_Night_P: 'Urban Central (Night)',
    Underwater_P: 'AquaDome',
    ParkRain_P: 'Beckwith Park (Stormy)',
    Stadium_Foggy_P: 'DFH Stadium (Stormy)',
    Stadium_Winter_P: 'DFH Stadium (Snowy)',
    Stadium_P: 'DFH Stadium',
    Stadium_Race_Day_P: 'DFH Stadium (Circuit)',
    Chinatown_P: 'Wasteland',
    Chinatown_Foggy_P: 'Wasteland (Night)',
    Stadium_Art_P: 'DFH Stadium (Pitch Night)',
    Farm_P: 'Utopia Coliseum',
    Farm_Night_P: 'Utopia Coliseum (Dusk)',
    Farm_HW_P: 'Farmstead',
    Farm_Night_HW_P: 'Farmstead (Night)',
    ThrowbackStadium_P: 'Throwback Stadium',
    ForbiddenTemple_P: 'Forbidden Temple',
    ForbiddenTemple_Night_P: 'Forbidden Temple (Fire & Ice)',
    Stadium_Race_Day_02_P: 'DFH Stadium (Circuit)',
    Stadium_2020_P: 'DFH Stadium',
    Stadium_2020_Day_P: 'DFH Stadium',
    cs_p: 'Champions Field',
    cs_day_p: 'Champions Field (Day)',
    Outpost_P: 'Starbase ARC',
    Workshop01_P: 'Double Goal',
    HoopsStadium_P: 'Dunk House',
    ShatterShot_P: 'Core 707',
    PunkArena_P: 'Neo Tokyo',
    PunkArena_Night_P: 'Neo Tokyo (Comic)',
    EuroStadium_Rainy_P: 'Mannfield (Stormy)',
    SaltyShores_P: 'Salty Shores',
    SaltyShores_Night_P: 'Salty Shores (Night)',
    TriStadium_P: 'Sovereign Heights',
    bSoccer_P: 'Badlands (Battle)',
    FootBall_P: 'Beckwith Park (Snowy)',
    MusicStadium_P: 'Forbidden Temple (Day)',
    MusicStadium_Night_P: 'Forbidden Temple (Night)',
    Beach_P: 'Salty Shores',
    Beach_Night_P: 'Salty Shores (Night)',
    Arc_P: 'Starbase ARC',
    Arc_Lux_P: 'Starbase ARC (Aftermath)',
    NeoTokyo_Standard_P: 'Neo Tokyo',
    NeoTokyo_Standard_Night_P: 'Neo Tokyo (Comic)',
    UnderwaterGardens_P: 'AquaDome (Salty Shallows)',
    UnderwaterGardens_Night_P: 'AquaDome (Deep)',
    TrainStation_Dawn_P: 'Urban Central (Dawn)',
    Stadium_Futuristic_P: 'DFH Stadium (Bionic)',
    Stadium_Futuristic_Twilight_P: 'DFH Stadium (Bionic)',
    Stadium_Neon_P: 'Tokyo Underpass',
    Stadium_Neon_Night_P: 'Tokyo Underpass (Night)',
    Wasteland_P: 'Wasteland',
    Wasteland_Night_P: 'Wasteland (Night)',
    UtopiaStadium_P: 'Utopia Coliseum',
    UtopiaStadium_Lux_P: 'Utopia Coliseum (Dusk)',
    UtopiaStadium_Snow_P: 'Utopia Coliseum (Snowy)',
    Stadium_Grass_P: 'DFH Stadium',
    Stadium_Art_Night_P: 'DFH Stadium (Pitch Night)',
    Stadium_Race_Day_03_P: 'DFH Stadium (Circuit)',
    Stadium_2024_P: 'DFH Stadium',
    Stadium_2024_Day_P: 'DFH Stadium',
    Stadium_2024_Grass_P: 'DFH Stadium',
    Stadium_2024_Race_Day_P: 'DFH Stadium (Circuit)',
};

export function friendlyMapName(raw) {
    if (!raw || raw === '—' || raw === 'Inconnu') return raw || '—';
    return MAP_NAMES[raw] || raw.replace(/_P$/, '').replace(/_/g, ' ');
}
