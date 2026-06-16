import initSubtrActor, {
    parse_replay,
    get_replay_frames_data_with_progress,
    get_stats_timeline
} from '@rlrml/subtr-actor';
import subtrWasmUrl from '@rlrml/subtr-actor/rl_replay_subtr_actor_bg.wasm?url';
import { buildCoachReport, buildPlayerIdMap } from './coachAnalytics.js';
import { mapToPlain, friendlyMapName } from './utils.js';

let subtrInitialized = false;

function parseHeaderProp(val) {
    if (val instanceof Map) return mapToPlain(val);
    if (!val) return null;
    if (typeof val !== 'object') return val;
    if (Array.isArray(val)) {
        if (val.length > 0 && Array.isArray(val[0]) && val[0].length === 2 && typeof val[0][0] === 'string') {
            const obj = {};
            val.forEach(pair => { obj[pair[0]] = parseHeaderProp(pair[1]); });
            return obj;
        }
        return val.map(v => parseHeaderProp(v));
    }
    if (val.Int !== undefined) return val.Int;
    if (val.int !== undefined) return val.int;
    if (val.Str !== undefined) return val.Str;
    if (val.str !== undefined) return val.str;
    if (val.Float !== undefined) return val.Float;
    if (val.float !== undefined) return val.float;
    if (val.Name !== undefined) return typeof val.Name === 'object' ? parseHeaderProp(val.Name) : val.Name;
    if (val.QWord !== undefined) return val.QWord;
    if (val.Bool !== undefined) return val.Bool;
    if (val.Byte !== undefined) return typeof val.Byte === 'object' ? val.Byte.value : val.Byte;
    if (val.Array !== undefined) return parseHeaderProp(val.Array);
    if (val.array !== undefined) return parseHeaderProp(val.array);
    const obj = {};
    for (const key in val) obj[key] = parseHeaderProp(val[key]);
    return obj;
}

function flattenProperties(replayData) {
    let rawProps = replayData instanceof Map ? replayData.get('properties') : replayData?.properties;
    if (!rawProps) return {};
    if (rawProps instanceof Map) return mapToPlain(rawProps);
    const props = {};
    if (Array.isArray(rawProps)) {
        if (rawProps.length > 0 && Array.isArray(rawProps[0])) {
            rawProps.forEach(h => {
                if (Array.isArray(h) && h.length === 2) props[h[0]] = parseHeaderProp(h[1]);
            });
        } else {
            rawProps.forEach((v, i) => { props[i] = parseHeaderProp(v); });
        }
    } else {
        for (const key in rawProps) props[key] = parseHeaderProp(rawProps[key]);
    }
    return props;
}

const getInt = (obj) => typeof obj === 'object' && obj !== null ? (obj.int || obj.Int || obj.integer || 0) : (obj || 0);
const getStr = (obj) => typeof obj === 'object' && obj !== null ? (obj.str || obj.Str || obj.string || obj.Name || 'Inconnu') : (obj || 'Inconnu');
const getFloat = (obj) => typeof obj === 'object' && obj !== null ? (obj.float || obj.Float || 0) : (obj || 0);

function toPlayerRow(p) {
    const row = p instanceof Map ? mapToPlain(p) : p;
    const id = row.OnlineID || (row.PlayerID?.fields ? Object.values(mapToPlain(row.PlayerID.fields || {}))[0] : null);
    return {
        id: typeof id === 'string' ? id : null,
        Name: typeof row.Name === 'string' ? row.Name : (row.name || 'Inconnu'),
        Score: row.Score ?? row.score ?? 0,
        Goals: row.Goals ?? row.goals ?? 0,
        Assists: row.Assists ?? row.assists ?? 0,
        Saves: row.Saves ?? row.saves ?? 0,
        Shots: row.Shots ?? row.shots ?? 0,
        Demolitions: row.Demolitions ?? row.demolitions ?? row.demos ?? 0,
        Team: row.Team ?? row.team ?? 0
    };
}

function buildPlayersFromProps(props) {
    let statsArray = props.PlayerStats;
    if (statsArray?.array) statsArray = statsArray.array;
    if (!Array.isArray(statsArray)) return [];
    return statsArray.map(toPlayerRow);
}

function buildPlayersFromMeta(framesData) {
    const players = [];
    const pushTeam = (team, teamId) => {
        if (!Array.isArray(team)) return;
        team.forEach(p => {
            const plain = mapToPlain(p);
            players.push({
                id: plain.remote_id?.Steam || null,
                Name: plain.name || 'Inconnu',
                Score: plain.stats?.score ?? 0,
                Goals: plain.stats?.goals ?? 0,
                Assists: plain.stats?.assists ?? 0,
                Saves: plain.stats?.saves ?? 0,
                Shots: plain.stats?.shots ?? 0,
                Demolitions: plain.stats?.demos ?? 0,
                Team: teamId
            });
        });
    };
    const meta = framesData?.meta;
    if (!meta) return [];
    pushTeam(meta.team_zero, 0);
    pushTeam(meta.team_one, 1);
    return players;
}

function inferTeamNames(players, props) {
    const blue = players.filter(p => p.Team === 0).map(p => p.Name).join(', ');
    const orange = players.filter(p => p.Team === 1).map(p => p.Name).join(', ');
    const blueName = getStr(props.TeamName0);
    const orangeName = getStr(props.TeamName1);
    return {
        blue: blueName !== 'Inconnu' ? blueName : (blue || 'Bleu'),
        orange: orangeName !== 'Inconnu' ? orangeName : (orange || 'Orange')
    };
}

function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function loadFramesWithProgress(uint8Array, onProgress) {
    return get_replay_frames_data_with_progress(uint8Array, (raw) => {
        if (!onProgress) return;
        const p = mapToPlain(raw);
        onProgress({
            phase: 'frames',
            progress: Math.round((p.progress ?? 0) * 100),
            processedFrames: p.processedFrames ?? 0,
            totalFrames: p.totalFrames ?? 0,
            label: `Extraction frames… ${p.processedFrames ?? 0}/${p.totalFrames ?? '?'}`
        });
    }, 500);
}

class ReplayParser {
    static async parse(file, onProgress) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    if (!subtrInitialized) {
                        if (onProgress) onProgress({ phase: 'wasm', progress: 5, label: 'Chargement WASM…' });
                        await initSubtrActor(subtrWasmUrl);
                        subtrInitialized = true;
                    }

                    const uint8Array = new Uint8Array(e.target.result);
                    if (uint8Array.length === 0) throw new Error('Fichier vide.');

                    if (onProgress) onProgress({ phase: 'parse', progress: 15, label: 'Parsing header…' });
                    const replayData = parse_replay(uint8Array);
                    const props = flattenProperties(replayData);

                    if (onProgress) onProgress({ phase: 'frames', progress: 20, label: 'Extraction données réseau…' });
                    let framesData = null;
                    try {
                        framesData = loadFramesWithProgress(uint8Array, onProgress);
                    } catch (err) {
                        console.warn('Frame data unavailable:', err);
                    }

                    if (onProgress) onProgress({ phase: 'timeline', progress: 85, label: 'Analyse coach (timeline)…' });
                    let timeline = null;
                    try {
                        timeline = mapToPlain(get_stats_timeline(uint8Array));
                    } catch (err) {
                        console.warn('Timeline unavailable:', err);
                    }

                    const playersFromProps = buildPlayersFromProps(props);
                    const playersFromMeta = buildPlayersFromMeta(framesData);
                    const players = playersFromProps.length ? playersFromProps : playersFromMeta;
                    if (players.length > 0) props.PlayerStats = players;

                    const teamNames = inferTeamNames(players, props);
                    const idMap = buildPlayerIdMap(framesData?.meta, players);

                    if (onProgress) onProgress({ phase: 'coach', progress: 95, label: 'Calcul métriques coach…' });
                    const coach = buildCoachReport({ timeline, framesData, players, idMap });

                    const rawMap = getStr(props.MapName);
                    const framesCount = framesData?.frame_data?.metadata_frames?.length ?? 0;
                    const recordFps = getFloat(props.RecordFPS) || 30;
                    const numFrames = getInt(props.NumFrames);
                    const totalSeconds = getFloat(props.TotalSecondsPlayed) || (numFrames / recordFps);

                    if (onProgress) onProgress({ phase: 'done', progress: 100, label: 'Terminé' });

                    resolve({
                        filename: getStr(props.ReplayName) !== 'Inconnu' ? getStr(props.ReplayName) : file.name,
                        originalFilename: file.name,
                        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
                        matchGuid: getStr(props.Id) !== 'Inconnu' ? getStr(props.Id) : (getStr(props.MatchGUID) !== 'Inconnu' ? getStr(props.MatchGUID) : '—'),
                        date: getStr(props.Date) !== 'Inconnu' ? getStr(props.Date) : '—',
                        mapName: friendlyMapName(rawMap !== 'Inconnu' ? rawMap : '—'),
                        mapNameRaw: rawMap !== 'Inconnu' ? rawMap : '—',
                        gameType: getStr(props.MatchType) !== 'Inconnu' ? getStr(props.MatchType) : getStr(props.GameType),
                        playlist: getStr(props.PlayList) !== 'Inconnu' ? getStr(props.PlayList) : getStr(props.Playlist),
                        duration: formatDuration(totalSeconds),
                        totalSeconds,
                        recordFps,
                        numFrames,
                        teamBlue: { name: teamNames.blue, score: getInt(props.Team0Score) },
                        teamOrange: { name: teamNames.orange, score: getInt(props.Team1Score) },
                        framesCount,
                        players,
                        timeline,
                        coach,
                        idMap,
                        raw: replayData instanceof Map ? mapToPlain(replayData) : replayData,
                        framesData,
                        props
                    });
                } catch (error) {
                    reject(new Error('Erreur de parsing WASM : ' + error.message));
                }
            };
            reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
            reader.readAsArrayBuffer(file);
        });
    }
}

window.ReplayParser = ReplayParser;
