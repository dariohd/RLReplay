import { steamId, formatPct, mapToPlain } from './utils.js';

const MECHANIC_LABELS = {
    pass: 'Passe', one_timer: 'One-timer', flick: 'Flick', musty_flick: 'Musty flick',
    speed_flip: 'Speed flip', wavedash: 'Wavedash', half_flip: 'Half flip',
    fifty_fifty: '50/50', double_tap: 'Double tap', air_dribble: 'Air dribble',
    ball_carry: 'Ball carry', center: 'Centrage', wall_aerial: 'Aérien mur',
    wall_aerial_shot: 'Tir aérien mur', ceiling_shot: 'Ceiling shot',
    backboard: 'Rebond plaque', half_volley: 'Demi-volée', dodge_reset: 'Dodge reset',
    whiff: 'Raté', bump: 'Bump', rush: 'Rush', powerslide: 'Powerslide'
};

const TOUCH_LABELS = { hard_hit: 'Frappe forte', control: 'Contrôle', medium_hit: 'Frappe moyenne' };

const TIMELINE_LABELS = {
    Goal: 'But', Shot: 'Tir', Save: 'Arrêt', Assist: 'Passe déc.',
    Demo: 'Démolition', Demoed: 'Démoli'
};

const GOAL_TAG_LABELS = {
    aerial_goal: 'But aérien', high_aerial_goal: 'But aérien haut',
    kickoff_goal: 'But kickoff', open_net: 'Filet ouvert',
    long_shot: 'Tir lointain', redirect: 'Redirection'
};

const BUILDUP_LABELS = {
    kickoff_goal_count: 'Kickoff', short_goal_count: 'Court',
    medium_goal_count: 'Moyen', long_goal_count: 'Long',
    counter_attack_goal_count: 'Contre-attaque',
    sustained_pressure_goal_count: 'Pression soutenue',
    other_buildup_goal_count: 'Autre'
};

function emptyPlayerStats(id, name, team) {
    return {
        id, name, team,
        boost: { avg: 0, timeZero: 0, timeFull: 0, bigPads: 0, smallPads: 0, samples: 0 },
        boostLedger: { used: 0, collected: 0, stolen: 0 },
        positioning: {
            defThird: 0, neuThird: 0, offThird: 0, behindBall: 0, inFront: 0,
            mostBack: 0, mostForward: 0, closestBall: 0, avgDistBall: 0, _distSamples: 0
        },
        movement: { distance: 0, speedSum: 0, samples: 0, supersonic: 0, boostSpeed: 0, slow: 0, ground: 0, air: 0 },
        rotation: { firstManChanges: 0, mostBackTime: 0, mostForwardTime: 0 },
        touches: { total: 0, hard_hit: 0, control: 0, medium_hit: 0, advance: 0, retreat: 0 },
        mechanics: {},
        coreDelta: null,
        passesCompleted: 0,
        powerslides: 0
    };
}

export function buildPlayerIdMap(meta, players) {
    const map = new Map();
    const addTeam = (team) => {
        if (!Array.isArray(team)) return;
        team.forEach(p => {
            const plain = mapToPlain(p);
            const id = steamId(plain.remote_id);
            if (id && plain.name) map.set(id, plain.name);
        });
    };
    if (meta) {
        addTeam(meta.team_zero);
        addTeam(meta.team_one);
    }
    players?.forEach(p => {
        if (p.id) map.set(p.id, p.Name);
        map.set(p.Name, p.Name);
    });
    return map;
}

export function resolveName(idMap, ref) {
    const id = steamId(ref);
    if (id && idMap.has(id)) return idMap.get(id);
    if (typeof ref === 'string' && idMap.has(ref)) return idMap.get(ref);
    if (ref?.name) return ref.name;
    return id ? `…${id.slice(-4)}` : 'Inconnu';
}

function getPlayerBucket(buckets, id, name, team) {
    if (!buckets.has(id)) buckets.set(id, emptyPlayerStats(id, name, team));
    return buckets.get(id);
}

function incMechanic(bucket, key) {
    bucket.mechanics[key] = (bucket.mechanics[key] || 0) + 1;
}

function subsampleHeatmap(frames, maxPoints = 600) {
    const points = [];
    if (!frames?.length) return points;
    const step = Math.max(1, Math.floor(frames.length / maxPoints));
    for (let i = 0; i < frames.length; i += step) {
        const f = frames[i];
        if (f !== 'Empty' && f?.Data?.rigid_body) {
            points.push({ x: f.Data.rigid_body.location.x, y: f.Data.rigid_body.location.y });
        }
    }
    return points;
}

function buildPlayerHeatmaps(frameData, idMap) {
    const heatmaps = {};
    const players = frameData?.players;
    if (!players) return heatmaps;
    const entries = players instanceof Map ? [...players.values()] : Object.values(players);
    entries.forEach(pTuple => {
        const id = steamId(pTuple?.[0]);
        const frames = pTuple?.[1]?.frames;
        if (!id || !frames) return;
        const name = resolveName(idMap, pTuple[0]);
        heatmaps[id] = { name, points: subsampleHeatmap(frames) };
    });
    return heatmaps;
}

export function buildCoachReport({ timeline, framesData, players, idMap }) {
    const events = timeline?.events || {};
    const buckets = new Map();

    players?.forEach(p => {
        const id = p.id || p.Name;
        getPlayerBucket(buckets, id, p.Name, p.Team);
    });

    // Positioning
    (events.positioning || []).forEach(e => {
        const id = steamId(e.player);
        if (!id) return;
        const b = getPlayerBucket(buckets, id, resolveName(idMap, e.player), e.is_team_0 ? 0 : 1);
        const p = b.positioning;
        p.defThird += e.time_defensive_third || 0;
        p.neuThird += e.time_neutral_third || 0;
        p.offThird += e.time_offensive_third || 0;
        p.behindBall += e.time_behind_ball || 0;
        p.inFront += e.time_in_front_of_ball || 0;
        p.mostBack += e.time_most_back || 0;
        p.mostForward += e.time_most_forward || 0;
        p.closestBall += e.time_closest_to_ball || 0;
        if (e.tracked_time > 0 && e.sum_distance_to_ball != null) {
            p.avgDistBall += e.sum_distance_to_ball;
            p._distSamples += e.tracked_time;
        }
    });

    // Movement
    (events.movement || []).forEach(e => {
        const id = steamId(e.player);
        if (!id) return;
        const b = getPlayerBucket(buckets, id, resolveName(idMap, e.player), e.is_team_0 ? 0 : 1);
        const m = b.movement;
        m.distance += e.distance || 0;
        m.speedSum += e.speed || 0;
        m.samples += 1;
        if (e.speed_band === 'supersonic') m.supersonic += e.dt || 0;
        else if (e.speed_band === 'boost') m.boostSpeed += e.dt || 0;
        else if (e.speed_band === 'slow') m.slow += e.dt || 0;
        if (e.height_band === 'ground') m.ground += e.dt || 0;
        else m.air += e.dt || 0;
    });

    // Boost state
    (events.boost_state || []).forEach(e => {
        const id = steamId(e.player_id);
        if (!id) return;
        const b = getPlayerBucket(buckets, id, resolveName(idMap, e.player_id), e.is_team_0 ? 0 : 1);
        const amt = e.boost_amount ?? 0;
        b.boost.avg += amt;
        b.boost.samples += 1;
        if (amt <= 5) b.boost.timeZero += 1;
        if (amt >= 95) b.boost.timeFull += 1;
    });

    // Boost pickups
    (events.boost_pickups || []).forEach(e => {
        const id = steamId(e.player_id);
        if (!id) return;
        const b = getPlayerBucket(buckets, id, resolveName(idMap, e.player_id), e.is_team_0 ? 0 : 1);
        if (e.pad_type === 'big') b.boost.bigPads += 1;
        else b.boost.smallPads += 1;
    });

    // Boost ledger (used / collected / stolen)
    (events.boost_ledger || []).forEach(e => {
        const id = steamId(e.player_id);
        if (!id) return;
        const b = getPlayerBucket(buckets, id, resolveName(idMap, e.player_id), e.is_team_0 ? 0 : 1);
        const tx = e.transaction;
        if (tx === 'used' || tx === 'used_allocation') b.boostLedger.used += Math.abs(e.amount || 0);
        else if (tx === 'collected') b.boostLedger.collected += e.amount || 0;
        else if (tx === 'stolen') b.boostLedger.stolen += e.amount || 0;
    });

    // Touches
    (events.touch || []).forEach(e => {
        const id = steamId(e.player);
        if (!id) return;
        const b = getPlayerBucket(buckets, id, resolveName(idMap, e.player), e.is_team_0 ? 0 : 1);
        b.touches.total += 1;
        if (e.kind && b.touches[e.kind] != null) b.touches[e.kind] += 1;
    });

    (events.touch_ball_movement || []).forEach(e => {
        const id = steamId(e.player);
        if (!id) return;
        const b = getPlayerBucket(buckets, id, resolveName(idMap, e.player), e.is_team_0 ? 0 : 1);
        b.touches.advance += e.advance_distance || 0;
        b.touches.retreat += e.retreat_distance || 0;
    });

    // Passes completed
    (events.pass_last_completed || []).forEach(e => {
        const id = steamId(e.player);
        if (!id) return;
        getPlayerBucket(buckets, id, resolveName(idMap, e.player), e.is_team_0 ? 0 : 1).passesCompleted += 1;
    });

    // Powerslides
    (events.powerslide || []).forEach(e => {
        if (!e.active) return;
        const id = steamId(e.player);
        if (!id) return;
        getPlayerBucket(buckets, id, resolveName(idMap, e.player), e.is_team_0 ? 0 : 1).powerslides += 1;
    });

    // Rotation player
    (events.rotation_player || []).forEach(e => {
        const id = steamId(e.player);
        if (!id) return;
        const b = getPlayerBucket(buckets, id, resolveName(idMap, e.player), e.is_team_0 ? 0 : 1);
        b.rotation.firstManChanges += (e.became_first_man_count || 0) + (e.lost_first_man_count || 0);
    });

    // Core player cumulative deltas (coach metrics)
    (events.core_player || []).forEach(e => {
        const id = steamId(e.player);
        if (!id) return;
        getPlayerBucket(buckets, id, resolveName(idMap, e.player), e.is_team_0 ? 0 : 1).coreDelta = e.delta;
    });

    // Mechanics per player
    const mechanicKeys = [
        'pass', 'one_timer', 'flick', 'musty_flick', 'speed_flip', 'wavedash', 'half_flip',
        'fifty_fifty', 'double_tap', 'center', 'wall_aerial', 'wall_aerial_shot', 'ceiling_shot',
        'backboard', 'half_volley', 'whiff', 'ball_carry', 'dodge_reset'
    ];
    mechanicKeys.forEach(key => {
        (events[key] || []).forEach(e => {
            const id = steamId(e.player || e.player_id || e.passer);
            if (!id) return;
            incMechanic(getPlayerBucket(buckets, id, resolveName(idMap, e.player || e.player_id || e.passer), e.is_team_0 ? 0 : 1), key);
        });
    });

    // Generic mechanics events
    (events.mechanics || []).forEach(e => {
        const id = steamId(e.player_id);
        if (!id || !e.kind) return;
        incMechanic(getPlayerBucket(buckets, id, resolveName(idMap, e.player_id), e.is_team_0 ? 0 : 1), e.kind);
    });

    // Demos
    (framesData?.demolish_infos || []).forEach(e => {
        const attacker = steamId(e.attacker);
        const victim = steamId(e.victim);
        if (attacker) incMechanic(getPlayerBucket(buckets, attacker, resolveName(idMap, e.attacker), e.attacker_is_team_0 ? 0 : 1), 'demo');
        if (victim) incMechanic(getPlayerBucket(buckets, victim, resolveName(idMap, e.victim), e.victim_is_team_0 ? 0 : 1), 'demoed');
    });

    (events.bump || []).forEach(e => {
        const id = steamId(e.initiator);
        if (id) incMechanic(getPlayerBucket(buckets, id, resolveName(idMap, e.initiator), e.initiator_is_team_0 ? 0 : 1), 'bump');
    });

    // Possession
    let possBlue = 0, possOrange = 0, possNeutral = 0;
    (events.possession || []).forEach((e, i, arr) => {
        const next = arr[i + 1];
        const dt = next ? (next.time - e.time) : 0.033;
        if (e.possession_state === 'team_zero') possBlue += dt;
        else if (e.possession_state === 'team_one') possOrange += dt;
        else possNeutral += dt;
    });
    const possTotal = possBlue + possOrange + possNeutral || 1;

    // Territorial pressure
    const pressureBlue = (events.territorial_pressure || []).filter(e => e.team_is_team_0).reduce((s, e) => s + (e.duration || 0), 0);
    const pressureOrange = (events.territorial_pressure || []).filter(e => !e.team_is_team_0).reduce((s, e) => s + (e.duration || 0), 0);

    // Field pressure (opponent half time)
    let fieldPressure = { blueOff: 0, orangeOff: 0, neutral: 0 };
    (events.pressure || []).forEach((e, i, arr) => {
        if (!e.active) return;
        const next = arr[i + 1];
        const dt = next ? (next.time - e.time) : 0.033;
        if (e.field_half === 'team_zero') fieldPressure.blueOff += dt;
        else if (e.field_half === 'team_one') fieldPressure.orangeOff += dt;
        else fieldPressure.neutral += dt;
    });

    // Team rotation changes
    const rotBlue = (events.rotation_team || []).filter(e => e.is_team_0).reduce((s, e) => s + (e.rotation_count || 0), 0);
    const rotOrange = (events.rotation_team || []).filter(e => !e.is_team_0).reduce((s, e) => s + (e.rotation_count || 0), 0);

    // Rush events
    const rushBlue = (events.rush || []).filter(e => e.is_team_0).length;
    const rushOrange = (events.rush || []).filter(e => !e.is_team_0).length;

    // Core team goal buildup (last cumulative delta per team)
    const teamCore = { blue: null, orange: null };
    (events.core_team || []).forEach(e => {
        teamCore[e.is_team_0 ? 'blue' : 'orange'] = e.delta;
    });

    // Goal tags analysis
    const goalTags = (events.goal_tags || []).map(e => ({
        time: e.time, frame: e.frame,
        kind: e.kind,
        label: GOAL_TAG_LABELS[e.kind] || e.kind?.replace(/_/g, ' '),
        scorer: resolveName(idMap, e.scorer),
        team: e.scoring_team_is_team_0 ? 0 : 1,
        goalIndex: e.goal_index,
        modifiers: e.modifiers || []
    }));

    const goalTagSummary = {};
    goalTags.forEach(g => {
        goalTagSummary[g.kind] = (goalTagSummary[g.kind] || 0) + 1;
    });

    // Shots from player_stat_events
    const shots = (framesData?.player_stat_events || [])
        .filter(e => e.kind === 'Shot' && e.shot)
        .map(e => ({
            time: e.time, frame: e.frame,
            player: resolveName(idMap, e.player),
            team: e.is_team_0 ? 0 : 1,
            ballSpeed: Math.round(e.shot.ball_speed || 0),
            ballPos: e.shot.ball_position,
            playerSpeed: Math.round(e.shot.player_speed || 0)
        }));

    // Unified event feed
    const feed = [];
    const pushFeed = (item) => feed.push(item);

    (events.timeline || []).forEach(e => {
        pushFeed({
            time: e.time, frame: e.frame, category: 'match',
            kind: e.kind, label: TIMELINE_LABELS[e.kind] || e.kind,
            player: resolveName(idMap, e.player_id), team: e.is_team_0 ? 0 : 1
        });
    });

    (framesData?.goal_events || []).forEach(e => {
        pushFeed({
            time: e.time, frame: e.frame, category: 'goal', kind: 'Goal',
            label: `But (${e.team_zero_score}-${e.team_one_score})`,
            player: resolveName(idMap, e.player), team: e.scoring_team_is_team_0 ? 0 : 1
        });
    });

    goalTags.forEach(e => {
        pushFeed({
            time: e.time, frame: e.frame, category: 'goal', kind: e.kind,
            label: e.label, player: e.scorer, team: e.team,
            detail: e.modifiers.join(', ') || undefined
        });
    });

    (events.goal_context || []).forEach(e => {
        pushFeed({
            time: e.time, frame: e.frame, category: 'goal', kind: 'goal_context',
            label: 'Contexte but', player: resolveName(idMap, e.scorer),
            team: e.scoring_team_is_team_0 ? 0 : 1
        });
    });

    shots.forEach(e => {
        pushFeed({
            time: e.time, frame: e.frame, category: 'match', kind: 'Shot',
            label: `Tir (${e.ballSpeed} uu/s)`, player: e.player, team: e.team
        });
    });

    (events.touch || []).forEach(e => {
        pushFeed({
            time: e.time, frame: e.frame, category: 'touch',
            kind: e.kind, label: TOUCH_LABELS[e.kind] || e.kind,
            player: resolveName(idMap, e.player), team: e.is_team_0 ? 0 : 1,
            detail: e.height_band ? `${e.height_band} · ${e.surface || ''}` : undefined
        });
    });

    Object.entries(MECHANIC_LABELS).forEach(([key, label]) => {
        (events[key] || []).forEach(e => {
            const t = e.time ?? e.start_time ?? e.sample_time;
            const f = e.frame ?? e.start_frame ?? e.sample_frame;
            pushFeed({
                time: t, frame: f, category: 'mechanic', kind: key, label,
                player: resolveName(idMap, e.player || e.player_id || e.passer),
                team: e.is_team_0 != null ? (e.is_team_0 ? 0 : 1) : null
            });
        });
    });

    (events.mechanics || []).forEach(e => {
        const t = e.timing?.time;
        const f = e.timing?.frame;
        pushFeed({
            time: t, frame: f, category: 'mechanic',
            kind: e.kind, label: MECHANIC_LABELS[e.kind] || e.kind,
            player: resolveName(idMap, e.player_id),
            team: e.is_team_0 != null ? (e.is_team_0 ? 0 : 1) : null
        });
    });

    (framesData?.demolish_infos || []).forEach(e => {
        pushFeed({
            time: e.time, frame: e.frame, category: 'demo', kind: 'demo',
            label: 'Démolition', player: resolveName(idMap, e.attacker),
            team: e.attacker_is_team_0 ? 0 : 1,
            detail: `→ ${resolveName(idMap, e.victim)}`
        });
    });

    feed.sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0));

    // Mechanics team summary
    const mechanicsSummary = {};
    Object.keys(MECHANIC_LABELS).forEach(k => {
        const n = (events[k] || []).length;
        if (n) mechanicsSummary[k] = { label: MECHANIC_LABELS[k], count: n };
    });
    if (framesData?.demolish_infos?.length) mechanicsSummary.demo = { label: 'Démolitions', count: framesData.demolish_infos.length };
    if (events.touch?.length) mechanicsSummary.touch = { label: 'Touches balle', count: events.touch.length };
    if (events.pass?.length) mechanicsSummary.pass = { label: 'Passes', count: events.pass.length };
    if (events.powerslide?.length) mechanicsSummary.powerslide = { label: 'Powerslides', count: events.powerslide.filter(e => e.active).length };

    // Heatmaps
    const fd = framesData?.frame_data;
    const heatmapBall = subsampleHeatmap(fd?.ball_data?.frames, 800);
    const heatmapPlayers = buildPlayerHeatmaps(fd, idMap);

    // Finalize player analytics
    const playerAnalytics = [...buckets.values()].map(b => {
        const posTotal = b.positioning.defThird + b.positioning.neuThird + b.positioning.offThird || 1;
        const movTotal = b.movement.ground + b.movement.air || 1;
        const movTime = b.movement.supersonic + b.movement.boostSpeed + b.movement.slow || 1;
        const core = players?.find(p => p.Name === b.name) || {};
        const cd = b.coreDelta || {};
        return {
            ...b,
            core,
            boost: {
                avg: b.boost.samples ? Math.round(b.boost.avg / b.boost.samples) : 0,
                timeZeroPct: formatPct(b.boost.timeZero, b.boost.samples),
                timeFullPct: formatPct(b.boost.timeFull, b.boost.samples),
                bigPads: b.boost.bigPads,
                smallPads: b.boost.smallPads,
                used: Math.round(b.boostLedger.used),
                collected: Math.round(b.boostLedger.collected),
                stolen: Math.round(b.boostLedger.stolen)
            },
            positioning: {
                defThirdPct: formatPct(b.positioning.defThird, posTotal),
                neuThirdPct: formatPct(b.positioning.neuThird, posTotal),
                offThirdPct: formatPct(b.positioning.offThird, posTotal),
                behindBallPct: formatPct(b.positioning.behindBall, posTotal),
                inFrontPct: formatPct(b.positioning.inFront, posTotal),
                mostBackPct: formatPct(b.positioning.mostBack, posTotal),
                mostForwardPct: formatPct(b.positioning.mostForward, posTotal),
                avgDistBall: b.positioning._distSamples
                    ? Math.round(b.positioning.avgDistBall / b.positioning._distSamples) : 0
            },
            movement: {
                avgSpeed: b.movement.samples ? Math.round(b.movement.speedSum / b.movement.samples) : 0,
                totalDistance: Math.round(b.movement.distance),
                supersonicPct: formatPct(b.movement.supersonic, movTime),
                groundPct: formatPct(b.movement.ground, movTotal),
                airPct: formatPct(b.movement.air, movTotal)
            },
            touches: {
                total: b.touches.total,
                hard_hit: b.touches.hard_hit,
                control: b.touches.control,
                medium_hit: b.touches.medium_hit,
                advance: Math.round(b.touches.advance),
                retreat: Math.round(b.touches.retreat)
            },
            coach: {
                goalsConcededLastDefender: cd.goals_conceded_while_last_defender || 0,
                goalsForMostBack: cd.goals_for_while_most_back || 0,
                goalsAgainstMostBack: cd.goals_against_while_most_back || 0,
                avgBoostOnGoalAgainst: cd.goal_against_boost_sample_count
                    ? Math.round(cd.cumulative_boost_on_goals_against / cd.goal_against_boost_sample_count) : null,
                kickoffGoals: cd.kickoff_goal_count || 0,
                shortGoals: cd.short_goal_count || 0,
                mediumGoals: cd.medium_goal_count || 0,
                longGoals: cd.long_goal_count || 0,
                counterAttackGoals: cd.counter_attack_goal_count || 0,
                sustainedPressureGoals: cd.sustained_pressure_goal_count || 0
            },
            rotation: b.rotation,
            passesCompleted: b.passesCompleted,
            powerslides: b.powerslides
        };
    }).sort((a, b) => b.core.Score - a.core.Score);

    const markers = feed
        .filter(e => ['Goal', 'goal', 'demo', 'Save', 'Shot'].includes(e.kind) || e.category === 'goal')
        .map(e => ({ frame: e.frame, kind: e.kind, label: e.label }));

    const buildupBlue = teamCore.blue ? Object.fromEntries(
        Object.entries(BUILDUP_LABELS).map(([k, label]) => [label, teamCore.blue[k] || 0]).filter(([, v]) => v > 0)
    ) : {};
    const buildupOrange = teamCore.orange ? Object.fromEntries(
        Object.entries(BUILDUP_LABELS).map(([k, label]) => [label, teamCore.orange[k] || 0]).filter(([, v]) => v > 0)
    ) : {};

    return {
        players: playerAnalytics,
        teams: {
            possession: {
                blue: formatPct(possBlue, possTotal),
                orange: formatPct(possOrange, possTotal),
                neutral: formatPct(possNeutral, possTotal),
                blueSec: Math.round(possBlue),
                orangeSec: Math.round(possOrange)
            },
            pressure: { blue: Math.round(pressureBlue), orange: Math.round(pressureOrange) },
            fieldPressure: {
                blueOffSec: Math.round(fieldPressure.blueOff),
                orangeOffSec: Math.round(fieldPressure.orangeOff)
            },
            rotationChanges: { blue: rotBlue, orange: rotOrange },
            rush: { blue: rushBlue, orange: rushOrange },
            goalBuildup: { blue: buildupBlue, orange: buildupOrange }
        },
        goals: { tags: goalTags, tagSummary: goalTagSummary },
        shots,
        mechanicsSummary,
        eventFeed: feed,
        markers,
        heatmapBall,
        heatmapPlayers,
        eventCounts: Object.fromEntries(Object.entries(events).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])),
        frameDataCounts: {
            demolitions: framesData?.demolish_infos?.length || 0,
            boostPadEvents: framesData?.boost_pad_events?.length || 0,
            touchEvents: framesData?.touch_events?.length || 0,
            playerStatEvents: framesData?.player_stat_events?.length || 0,
            goalEvents: framesData?.goal_events?.length || 0
        }
    };
}
